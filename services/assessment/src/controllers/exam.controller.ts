import type { Request, Response } from "express";
import { CreateExamInputSchema } from "@icarus/contracts";
import { z } from "zod";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { attemptService } from "../services/attempt.service.js";
import { examService } from "../services/exam.service.js";

const examParamsSchema = z.object({ examId: z.string().uuid() });
function identity(request: Request) {
  if (!request.identity) throw unauthenticated();
  return request.identity;
}

function cookie(request: Request) {
  const value = request.get("cookie");
  if (!value) throw unauthenticated();
  return value;
}

function teacher(request: Request) {
  const actor = identity(request);
  if (actor.role !== "TEACHER")
    throw forbidden("Only teachers can manage assessments.");
  return actor;
}

export class ExamController {
  async create(request: Request, response: Response) {
    const input = CreateExamInputSchema.parse(request.body);
    response.status(201).json({
      exam: await examService.create(teacher(request), cookie(request), input),
    });
  }

  async list(request: Request, response: Response) {
    response.json({
      exams: await examService.list(identity(request), cookie(request)),
    });
  }

  async get(request: Request, response: Response) {
    const { examId } = examParamsSchema.parse(request.params);
    response.json({
      exam: await examService.get(identity(request), cookie(request), examId),
    });
  }

  async schedule(request: Request, response: Response) {
    const { examId } = examParamsSchema.parse(request.params);
    response.json({
      exam: await examService.schedule(teacher(request).id, examId),
    });
  }

  async close(request: Request, response: Response) {
    const { examId } = examParamsSchema.parse(request.params);
    response.json({
      exam: await examService.close(teacher(request).id, examId),
    });
  }

  async publish(request: Request, response: Response) {
    const { examId } = examParamsSchema.parse(request.params);
    response.json({
      exam: await examService.publish(teacher(request).id, examId),
    });
  }

  async start(request: Request, response: Response) {
    const { examId } = examParamsSchema.parse(request.params);
    response.status(201).json({
      attempt: await attemptService.start(
        identity(request),
        cookie(request),
        examId,
      ),
    });
  }
}

export const examController = new ExamController();
