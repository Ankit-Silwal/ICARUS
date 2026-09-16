import { EditorEventSchema } from "@icarus/contracts";
import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { badRequest, forbidden, unauthenticated } from "../lib/errors.js";
import { integrityService } from "../services/integrity.service.js";
import type { IdentityUser, UserRole } from "../types/integrity.types.js";

const attemptParamsSchema = z.object({ attemptId: z.string().uuid() });
const questionParamsSchema = attemptParamsSchema.extend({
  questionId: z.string().uuid(),
});
const eventBatchSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  events: z.array(EditorEventSchema).min(1).max(env.MAX_EVENT_BATCH_SIZE),
});
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  afterSequence: z.coerce.number().int().nonnegative().optional(),
});
const retentionSchema = z.object({
  before: z.iso.datetime().optional(),
});

function requireRole(request: Request, role: UserRole): IdentityUser {
  if (!request.identity) throw unauthenticated();
  if (request.identity.role !== role) {
    throw forbidden(
      role === "STUDENT"
        ? "Only students can submit editor events."
        : role === "TEACHER"
          ? "Only teachers can review integrity evidence."
          : "Only administrators can manage integrity retention.",
    );
  }
  return request.identity;
}

export class IntegrityController {
  async ingest(request: Request, response: Response) {
    const actor = requireRole(request, "STUDENT");
    const input = eventBatchSchema.parse(request.body);
    response
      .status(202)
      .json(
        await integrityService.ingest(
          actor,
          input.attemptId,
          input.questionId,
          input.events,
        ),
      );
  }

  async getReport(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { attemptId, questionId } = questionParamsSchema.parse(
      request.params,
    );
    response.json({
      report: await integrityService.getReport(actor, attemptId, questionId),
    });
  }

  async listReports(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { attemptId } = attemptParamsSchema.parse(request.params);
    response.json({
      reports: await integrityService.listAttemptReports(actor, attemptId),
    });
  }

  async listEvents(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { attemptId, questionId } = questionParamsSchema.parse(
      request.params,
    );
    const { limit, afterSequence } = paginationSchema.parse(request.query);
    response.json(
      await integrityService.listEvents(
        actor,
        attemptId,
        questionId,
        limit,
        afterSequence,
      ),
    );
  }

  async reanalyze(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { attemptId, questionId } = questionParamsSchema.parse(
      request.params,
    );
    response.json({
      report: await integrityService.reanalyze(actor, attemptId, questionId),
    });
  }

  async removeExpired(request: Request, response: Response) {
    requireRole(request, "ADMIN");
    const { before: requestedBefore } = retentionSchema.parse(
      request.body ?? {},
    );
    const before = requestedBefore
      ? new Date(requestedBefore)
      : new Date(
          Date.now() - env.INTEGRITY_RETENTION_DAYS * 24 * 60 * 60 * 1_000,
        );
    if (before.getTime() > Date.now()) {
      throw badRequest(
        "INVALID_RETENTION_CUTOFF",
        "The retention cutoff cannot be in the future.",
      );
    }
    response.json({
      before: before.toISOString(),
      ...(await integrityService.removeExpired(before)),
    });
  }
}

export const integrityController = new IntegrityController();
