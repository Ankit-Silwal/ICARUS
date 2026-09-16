import type { Request, Response } from "express";
import { z } from "zod";
import { questionService } from "../services/question.service.js";

const questionParamsSchema = z.object({ questionId: z.string().uuid() });

export class InternalController {
  async getQuestion(request: Request, response: Response) {
    const { questionId } = questionParamsSchema.parse(request.params);
    response.json({ question: await questionService.getInternal(questionId) });
  }
}

export const internalController = new InternalController();
