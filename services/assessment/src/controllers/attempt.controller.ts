import type { Request, Response } from "express";
import { z } from "zod";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { attemptService } from "../services/attempt.service.js";

const attemptParamsSchema = z.object({ attemptId: z.string().uuid() });
const autosaveSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.unknown(),
  version: z.number().int().positive(),
});
const reductionSchema = z.object({
  percentageReduction: z.number().min(0).max(100),
  reason: z.string().trim().min(5).max(2000),
});

function requireRole(request: Request, role: "TEACHER" | "STUDENT") {
  if (!request.identity) throw unauthenticated();
  if (request.identity.role !== role) {
    throw forbidden(
      role === "TEACHER"
        ? "Only teachers can review attempts."
        : "Only students can submit attempts.",
    );
  }
  return request.identity;
}

export class AttemptController {
  async autosave(request: Request, response: Response) {
    const actor = requireRole(request, "STUDENT");
    const { attemptId } = attemptParamsSchema.parse(request.params);
    const input = autosaveSchema.parse(request.body);
    response.json(
      await attemptService.autosave(
        actor.id,
        attemptId,
        input.questionId,
        input.answer,
        input.version,
      ),
    );
  }

  async submit(request: Request, response: Response) {
    const actor = requireRole(request, "STUDENT");
    const { attemptId } = attemptParamsSchema.parse(request.params);
    response.status(202).json(await attemptService.submit(actor.id, attemptId));
  }

  async listReviews(request: Request, response: Response) {
    response.json({
      attempts: await attemptService.listReviews(
        requireRole(request, "TEACHER").id,
      ),
    });
  }

  async applyReduction(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { attemptId } = attemptParamsSchema.parse(request.params);
    const input = reductionSchema.parse(request.body);
    response.json({
      attempt: await attemptService.applyReduction(
        actor.id,
        attemptId,
        input.percentageReduction,
        input.reason,
      ),
    });
  }

  async results(request: Request, response: Response) {
    response.json({
      results: await attemptService.results(requireRole(request, "STUDENT").id),
    });
  }
}

export const attemptController = new AttemptController();
