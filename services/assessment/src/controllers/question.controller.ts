import type { Request, Response } from "express";
import {
  LanguageSchema,
  QuestionInputSchema,
  TestCaseSchema,
} from "@icarus/contracts";
import { z } from "zod";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { questionService } from "../services/question.service.js";

const idParamsSchema = z.object({ questionId: z.string().uuid() });
const leetCodeParamsSchema = z.object({
  problemNumber: z.coerce.number().int().positive(),
});
const leetCodeImportSchema = z.object({
  problemNumber: z.number().int().positive(),
  points: z.number().positive(),
  functionName: z
    .string()
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
    .optional(),
  languages: z.array(LanguageSchema).min(1).optional(),
  starterCode: z.partialRecord(LanguageSchema, z.string().min(1)).optional(),
  tests: z.array(TestCaseSchema).min(1),
});

function teacher(request: Request) {
  if (!request.identity) throw unauthenticated();
  if (request.identity.role !== "TEACHER") {
    throw forbidden("Only teachers can manage questions.");
  }
  return request.identity;
}

export class QuestionController {
  async list(request: Request, response: Response) {
    response.json({
      questions: await questionService.list(teacher(request).id),
    });
  }

  async get(request: Request, response: Response) {
    const { questionId } = idParamsSchema.parse(request.params);
    response.json({
      question: await questionService.getOwned(teacher(request).id, questionId),
    });
  }

  async create(request: Request, response: Response) {
    const input = QuestionInputSchema.parse(request.body);
    response
      .status(201)
      .json({
        question: await questionService.create(teacher(request).id, input),
      });
  }

  async previewLeetCode(request: Request, response: Response) {
    teacher(request);
    const { problemNumber } = leetCodeParamsSchema.parse(request.params);
    response.json({
      problem: await questionService.previewLeetCode(problemNumber),
    });
  }

  async importLeetCode(request: Request, response: Response) {
    const input = leetCodeImportSchema.parse(request.body);
    response
      .status(201)
      .json(await questionService.importLeetCode(teacher(request).id, input));
  }

  async remove(request: Request, response: Response) {
    const { questionId } = idParamsSchema.parse(request.params);
    await questionService.remove(teacher(request).id, questionId);
    response.status(204).end();
  }
}

export const questionController = new QuestionController();
