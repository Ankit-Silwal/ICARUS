import {
  ExamSchema,
  QuestionSchema,
  defaultIntegrityPolicy,
  type Exam,
  type IntegrityPolicy,
} from "@icarus/contracts";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { toJson } from "../lib/json.js";
import { prisma } from "../lib/prisma.js";
import type { IdentityUser } from "../types/assessment.types.js";
import { classroomService } from "./classroom.service.js";

export interface CreateExamInput {
  classId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  attemptLimit: number;
  questionIds: string[];
  integrityPolicy?: IntegrityPolicy;
}

function parseExam(row: { payload: unknown; status: string }) {
  const exam = ExamSchema.parse(row.payload);
  return ExamSchema.parse({ ...exam, status: row.status });
}

function summarize(exam: Exam) {
  const { questions, ...details } = exam;
  return {
    ...details,
    questionCount: questions.length,
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
  };
}

function sanitizeForStudent(exam: Exam) {
  return {
    ...exam,
    questions: exam.questions.map((question) => {
      if (question.kind === "MCQ") {
        const { correctOptionId: _correctOptionId, ...safeQuestion } = question;
        return safeQuestion;
      }
      return {
        ...question,
        tests: question.tests.filter((test) => test.visibility === "SAMPLE"),
      };
    }),
  };
}

export class ExamService {
  async create(actor: IdentityUser, cookie: string, input: CreateExamInput) {
    const classroom = await classroomService.requireAccess(
      actor,
      cookie,
      input.classId,
    );
    if (classroom.teacherId !== actor.id) {
      throw forbidden("Only the classroom owner can create an assessment.");
    }
    if (new Date(input.startsAt) >= new Date(input.endsAt)) {
      throw badRequest(
        "INVALID_EXAM_WINDOW",
        "The end time must be after the start time.",
      );
    }
    const uniqueQuestionIds = [...new Set(input.questionIds)];
    if (uniqueQuestionIds.length !== input.questionIds.length) {
      throw badRequest(
        "DUPLICATE_QUESTION",
        "An exam cannot contain the same question more than once.",
      );
    }
    const rows = await prisma.question.findMany({
      where: { teacherId: actor.id, id: { in: uniqueQuestionIds } },
    });
    if (rows.length !== uniqueQuestionIds.length) {
      throw badRequest(
        "QUESTION_NOT_FOUND",
        "One or more questions do not belong to this teacher.",
      );
    }
    const byId = new Map(
      rows.map((row) => [row.id, QuestionSchema.parse(row.payload)]),
    );
    const questions = uniqueQuestionIds.map((id) => byId.get(id)!);
    const exam = ExamSchema.parse({
      id: crypto.randomUUID(),
      classId: input.classId,
      title: input.title,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      durationMinutes: input.durationMinutes,
      attemptLimit: input.attemptLimit,
      status: "DRAFT",
      integrityPolicy: input.integrityPolicy ?? defaultIntegrityPolicy,
      questions,
    });
    await prisma.exam.create({
      data: {
        id: exam.id,
        classId: exam.classId,
        teacherId: actor.id,
        title: exam.title,
        startsAt: new Date(exam.startsAt),
        endsAt: new Date(exam.endsAt),
        payload: toJson(exam),
      },
    });
    return exam;
  }

  async list(actor: IdentityUser, cookie: string) {
    if (actor.role === "ADMIN")
      throw forbidden("Administrators do not have assessments.");
    const rows =
      actor.role === "TEACHER"
        ? await prisma.exam.findMany({
            where: { teacherId: actor.id },
            orderBy: { startsAt: "desc" },
          })
        : await prisma.exam.findMany({
            where: {
              classId: {
                in: (await classroomService.list(actor, cookie)).map(
                  (classroom) => classroom.id,
                ),
              },
              status: {
                in: ["SCHEDULED", "CLOSED", "REVIEW", "PUBLISHED"],
              },
            },
            orderBy: { startsAt: "desc" },
          });
    return rows.map((row) => summarize(parseExam(row)));
  }

  async get(actor: IdentityUser, cookie: string, examId: string) {
    const row = await this.getRow(examId);
    await classroomService.requireAccess(actor, cookie, row.classId);
    if (actor.role === "TEACHER" && row.teacherId !== actor.id) {
      throw forbidden("Only the assessment owner can view this assessment.");
    }
    if (actor.role === "ADMIN")
      throw forbidden("Administrators do not have assessments.");
    if (actor.role === "STUDENT" && row.status === "DRAFT")
      throw notFound("Assessment");
    const exam = parseExam(row);
    return actor.role === "STUDENT" ? sanitizeForStudent(exam) : exam;
  }

  async getInternal(examId: string) {
    return parseExam(await this.getRow(examId));
  }

  async schedule(teacherId: string, examId: string) {
    const row = await this.requireOwner(teacherId, examId);
    if (row.status !== "DRAFT") {
      throw conflict(
        "INVALID_EXAM_STATE",
        "Only a draft assessment can be scheduled.",
      );
    }
    const exam = parseExam(row);
    if (new Date(exam.endsAt) <= new Date()) {
      throw conflict(
        "EXAM_WINDOW_ENDED",
        "An assessment cannot be scheduled after its end time.",
      );
    }
    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: "SCHEDULED" },
    });
    return parseExam(updated);
  }

  async close(teacherId: string, examId: string) {
    const row = await this.requireOwner(teacherId, examId);
    if (row.status !== "SCHEDULED") {
      throw conflict(
        "INVALID_EXAM_STATE",
        "Only a scheduled assessment can be closed.",
      );
    }
    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: "REVIEW" },
    });
    return parseExam(updated);
  }

  async publish(teacherId: string, examId: string) {
    const row = await this.requireOwner(teacherId, examId);
    if (!(["CLOSED", "REVIEW"] as string[]).includes(row.status)) {
      throw conflict(
        "INVALID_EXAM_STATE",
        "Close the assessment before publishing results.",
      );
    }
    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: "PUBLISHED" },
    });
    return parseExam(updated);
  }

  private async getRow(examId: string) {
    const row = await prisma.exam.findUnique({ where: { id: examId } });
    if (!row) throw notFound("Assessment");
    return row;
  }

  private async requireOwner(teacherId: string, examId: string) {
    const row = await this.getRow(examId);
    if (row.teacherId !== teacherId)
      throw forbidden("Only the assessment owner can perform this action.");
    return row;
  }
}

export const examService = new ExamService();
