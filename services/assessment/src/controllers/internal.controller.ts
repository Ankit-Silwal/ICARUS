import type { Request, Response } from "express";
import { IntegritySignalSchema } from "@icarus/contracts";
import { z } from "zod";
import { attemptService } from "../services/attempt.service.js";
import { questionService } from "../services/question.service.js";

const questionParamsSchema = z.object({ questionId: z.string().uuid() });
const attemptQuestionParamsSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
});
const codeResultSchema = z.object({
  questionId: z.string().uuid(),
  score: z.number().nonnegative().optional(),
  details: z
    .object({
      cases: z.array(z.object({ id: z.string(), passed: z.boolean() }).loose()),
    })
    .loose(),
});
const integrityFlagsSchema = z.object({
  questionId: z.string().uuid(),
  signals: z.array(IntegritySignalSchema).max(1000),
});

export class InternalController {
  async getQuestion(request: Request, response: Response) {
    const { questionId } = questionParamsSchema.parse(request.params);
    response.json({ question: await questionService.getInternal(questionId) });
  }

  async getAttemptQuestion(request: Request, response: Response) {
    const { attemptId, questionId } = attemptQuestionParamsSchema.parse(
      request.params,
    );
    const actor = z
      .object({
        id: z.string().uuid(),
        role: z.enum(["TEACHER", "STUDENT"]),
      })
      .parse({
        id: request.get("x-user-id"),
        role: request.get("x-user-role"),
      });
    response.json(
      await attemptService.getQuestion(
        attemptId,
        questionId,
        actor.id,
        actor.role,
      ),
    );
  }

  async recordCodeResult(request: Request, response: Response) {
    const { attemptId } = z
      .object({ attemptId: z.string().uuid() })
      .parse(request.params);
    const { questionId, details } = codeResultSchema.parse(request.body);
    response.json({
      attempt: await attemptService.recordCodeResult(
        attemptId,
        questionId,
        details,
      ),
    });
  }

  async recordIntegrityFlags(request: Request, response: Response) {
    const { attemptId } = z
      .object({ attemptId: z.string().uuid() })
      .parse(request.params);
    const { questionId, signals } = integrityFlagsSchema.parse(request.body);
    response.json({
      attempt: await attemptService.recordIntegrityFlags(
        attemptId,
        questionId,
        signals,
      ),
    });
  }
}

export const internalController = new InternalController();
