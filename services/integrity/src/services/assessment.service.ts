import {
  IntegrityPolicySchema,
  QuestionSchema,
  type IntegritySignal,
} from "@icarus/contracts";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError, unavailable } from "../lib/errors.js";
import type { AttemptContext, IdentityUser } from "../types/integrity.types.js";

const attemptSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
  status: z.enum([
    "CREATED",
    "IN_PROGRESS",
    "SUBMITTED",
    "AUTO_SUBMITTED",
    "GRADED",
  ]),
  startedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});

const contextSchema = z.object({
  question: QuestionSchema,
  integrityPolicy: IntegrityPolicySchema,
  attempt: attemptSchema,
});

export class AssessmentService {
  async loadContext(
    attemptId: string,
    questionId: string,
    actor: IdentityUser,
  ): Promise<AttemptContext> {
    let response: globalThis.Response;
    try {
      response = await fetch(
        `${env.ASSESSMENT_URL.replace(/\/$/, "")}/internal/attempts/${attemptId}/questions/${questionId}`,
        {
          headers: {
            authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
            "x-user-id": actor.id,
            "x-user-role": actor.role,
          },
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw unavailable(
        "ASSESSMENT_UNAVAILABLE",
        "The assessment service could not be reached.",
      );
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      if ([401, 403, 404].includes(response.status)) {
        throw new AppError(
          response.status,
          payload?.error?.code ?? "ATTEMPT_ACCESS_DENIED",
          payload?.error?.message ?? "The assessment attempt is not available.",
        );
      }
      throw unavailable(
        "ASSESSMENT_UNAVAILABLE",
        "The assessment service rejected attempt validation.",
      );
    }
    return contextSchema.parse(await response.json());
  }

  async syncSignals(
    attemptId: string,
    questionId: string,
    signals: IntegritySignal[],
  ) {
    let response: globalThis.Response;
    try {
      response = await fetch(
        `${env.ASSESSMENT_URL.replace(/\/$/, "")}/internal/attempts/${attemptId}/integrity-flags`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ questionId, signals }),
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw unavailable(
        "ASSESSMENT_UNAVAILABLE",
        "The assessment service could not be reached.",
      );
    }
    if (!response.ok) {
      throw unavailable(
        "ASSESSMENT_SYNC_FAILED",
        `Assessment rejected integrity signals with HTTP ${response.status}.`,
      );
    }
  }
}

export const assessmentService = new AssessmentService();
