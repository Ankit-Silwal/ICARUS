import {
  EditorEventSchema,
  IntegrityPolicySchema,
  analyzeEditorEvents,
  defaultIntegrityThresholds,
  type EditorEvent,
  type IntegrityPolicy,
} from "@icarus/contracts";
import { env } from "../config/env.js";
import { validateEventBatch } from "../event-validation.js";
import { conflict, notFound } from "../lib/errors.js";
import { toJson } from "../lib/json.js";
import { prisma } from "../lib/prisma.js";
import { presentReport } from "../presenters/report.presenter.js";
import type { AttemptContext, IdentityUser } from "../types/integrity.types.js";
import { assessmentService } from "./assessment.service.js";

function presentEvent(event: {
  sequence: number;
  occurredAt: Date;
  action: string;
  insertedCharacters: number;
  deletedCharacters: number;
  documentLength: number;
  cursorLine: number;
  checksum: string;
  idleMilliseconds: number;
}) {
  return EditorEventSchema.parse({
    ...event,
    occurredAt: event.occurredAt.toISOString(),
  });
}

function sameEvent(
  stored: ReturnType<typeof presentEvent>,
  incoming: EditorEvent,
) {
  return JSON.stringify(stored) === JSON.stringify(incoming);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 1000)
    : "Assessment synchronization failed.";
}

export class IntegrityService {
  async ingest(
    actor: IdentityUser,
    attemptId: string,
    questionId: string,
    events: EditorEvent[],
  ) {
    const context = await assessmentService.loadContext(
      attemptId,
      questionId,
      actor,
    );
    this.requireCollectableContext(context, actor.id);
    validateEventBatch(
      events,
      context.attempt,
      new Date(),
      env.MAX_EVENT_CLOCK_SKEW_SECONDS * 1_000,
    );
    const ordered = [...events].sort(
      (left, right) => left.sequence - right.sequence,
    );
    const result = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.editorEvent.findMany({
        where: {
          attemptId,
          questionId,
          sequence: { in: ordered.map((event) => event.sequence) },
        },
      });
      const existingBySequence = new Map(
        existing.map((event) => [event.sequence, event]),
      );
      for (const event of ordered) {
        const stored = existingBySequence.get(event.sequence);
        if (stored && !sameEvent(presentEvent(stored), event)) {
          throw conflict(
            "EVENT_SEQUENCE_CONFLICT",
            `Sequence ${event.sequence} was already stored with different data.`,
          );
        }
      }
      await transaction.integritySession.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: {
          attemptId,
          questionId,
          studentId: actor.id,
          policy: toJson(context.integrityPolicy),
          attemptStartedAt: new Date(context.attempt.startedAt),
          attemptExpiresAt: new Date(context.attempt.expiresAt),
        },
        update: {
          policy: toJson(context.integrityPolicy),
          attemptStartedAt: new Date(context.attempt.startedAt),
          attemptExpiresAt: new Date(context.attempt.expiresAt),
        },
      });
      const fresh = ordered.filter(
        (event) => !existingBySequence.has(event.sequence),
      );
      const inserted = await transaction.editorEvent.createMany({
        data: fresh.map((event) => ({
          attemptId,
          questionId,
          sequence: event.sequence,
          occurredAt: new Date(event.occurredAt),
          action: event.action,
          insertedCharacters: event.insertedCharacters,
          deletedCharacters: event.deletedCharacters,
          documentLength: event.documentLength,
          cursorLine: event.cursorLine,
          checksum: event.checksum,
          idleMilliseconds: event.idleMilliseconds,
        })),
        skipDuplicates: true,
      });
      return {
        accepted: inserted.count,
        duplicates: ordered.length - inserted.count,
      };
    });
    const report = await this.analyzeAndSync(
      attemptId,
      questionId,
      context.integrityPolicy,
    );
    return { ...result, report };
  }

  async getReport(actor: IdentityUser, attemptId: string, questionId: string) {
    await assessmentService.loadContext(attemptId, questionId, actor);
    const report = await prisma.integrityReport.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
      include: { session: true },
    });
    if (!report) throw notFound("Integrity report");
    return presentReport(report);
  }

  async listAttemptReports(actor: IdentityUser, attemptId: string) {
    const sessions = await prisma.integritySession.findMany({
      where: { attemptId },
      include: { report: { include: { session: true } } },
      orderBy: { questionId: "asc" },
    });
    const first = sessions[0];
    if (!first) throw notFound("Integrity report");
    await assessmentService.loadContext(attemptId, first.questionId, actor);
    return sessions.flatMap((session) =>
      session.report ? [presentReport(session.report)] : [],
    );
  }

  async listEvents(
    actor: IdentityUser,
    attemptId: string,
    questionId: string,
    limit: number,
    afterSequence?: number,
  ) {
    await assessmentService.loadContext(attemptId, questionId, actor);
    const rows = await prisma.editorEvent.findMany({
      where: {
        attemptId,
        questionId,
        ...(afterSequence === undefined
          ? {}
          : { sequence: { gt: afterSequence } }),
      },
      orderBy: { sequence: "asc" },
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      events: page.map(presentEvent),
      nextSequence:
        rows.length > limit ? (page.at(-1)?.sequence ?? null) : null,
    };
  }

  async reanalyze(actor: IdentityUser, attemptId: string, questionId: string) {
    const context = await assessmentService.loadContext(
      attemptId,
      questionId,
      actor,
    );
    const session = await prisma.integritySession.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
    });
    if (!session) throw notFound("Integrity session");
    return this.analyzeAndSync(attemptId, questionId, context.integrityPolicy);
  }

  async removeExpired(before: Date) {
    return prisma.$transaction(async (transaction) => {
      const removedEvents = await transaction.editorEvent.deleteMany({
        where: { occurredAt: { lt: before } },
      });
      const removedSessions = await transaction.integritySession.deleteMany({
        where: { events: { none: {} } },
      });
      return {
        eventsRemoved: removedEvents.count,
        sessionsRemoved: removedSessions.count,
      };
    });
  }

  private async analyzeAndSync(
    attemptId: string,
    questionId: string,
    policy: IntegrityPolicy,
  ) {
    const rows = await prisma.editorEvent.findMany({
      where: { attemptId, questionId },
      orderBy: { sequence: "asc" },
    });
    const events = rows.map(presentEvent);
    const signals = analyzeEditorEvents(events, {
      ...defaultIntegrityThresholds,
      burstCharactersPerSecond: policy.typingSpeedCharactersPerSecond,
      idleMilliseconds: policy.idleThresholdMilliseconds,
    });
    await prisma.integrityReport.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        eventCount: events.length,
        signals: toJson(signals),
        syncStatus: "PENDING",
        analyzedAt: new Date(),
      },
      update: {
        eventCount: events.length,
        signals: toJson(signals),
        syncStatus: "PENDING",
        syncError: null,
        analyzedAt: new Date(),
      },
    });
    try {
      await assessmentService.syncSignals(attemptId, questionId, signals);
      await prisma.integrityReport.update({
        where: { attemptId_questionId: { attemptId, questionId } },
        data: {
          syncStatus: "SYNCED",
          syncAttempts: { increment: 1 },
          syncError: null,
          syncedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.integrityReport.update({
        where: { attemptId_questionId: { attemptId, questionId } },
        data: {
          syncStatus: "FAILED",
          syncAttempts: { increment: 1 },
          syncError: errorMessage(error),
        },
      });
    }
    const report = await prisma.integrityReport.findUnique({
      where: { attemptId_questionId: { attemptId, questionId } },
      include: { session: true },
    });
    if (!report) throw notFound("Integrity report");
    return presentReport(report);
  }

  private requireCollectableContext(
    context: AttemptContext,
    studentId: string,
  ) {
    if (context.attempt.studentId !== studentId) {
      throw conflict(
        "ATTEMPT_OWNER_MISMATCH",
        "The attempt does not belong to this student.",
      );
    }
    if (context.attempt.status !== "IN_PROGRESS") {
      throw conflict(
        "ATTEMPT_NOT_ACTIVE",
        "Editor events are accepted only while an attempt is active.",
      );
    }
    if (context.question.kind !== "CODE") {
      throw conflict(
        "NOT_A_CODE_QUESTION",
        "Editor events are accepted only for coding questions.",
      );
    }
    if (!IntegrityPolicySchema.parse(context.integrityPolicy).enabled) {
      throw conflict(
        "INTEGRITY_DISABLED",
        "Integrity event collection is disabled for this assessment.",
      );
    }
  }
}

export const integrityService = new IntegrityService();
