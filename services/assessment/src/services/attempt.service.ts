import {
  ExamSchema,
  IntegritySignalSchema,
  QuestionSchema,
  recommendedIntegrityReduction,
  type IntegritySignal,
  type Question,
} from "@icarus/contracts";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors.js";
import { toJson } from "../lib/json.js";
import { prisma } from "../lib/prisma.js";
import { presentAttempt } from "../presenters/attempt.presenter.js";
import { scoreMcq, scoreTestCases } from "../scoring.js";
import type { IdentityUser } from "../types/assessment.types.js";
import { classroomService } from "./classroom.service.js";
import { z } from "zod";

const attemptInclude = {
  answers: true,
  codeResults: true,
  exam: true,
} as const;

const storedIntegrityFlagSchema = IntegritySignalSchema.extend({
  questionId: z.string().uuid(),
});

function parseExam(attempt: { exam: { payload: unknown; status: string } }) {
  const snapshot = ExamSchema.parse(attempt.exam.payload);
  return ExamSchema.parse({ ...snapshot, status: attempt.exam.status });
}

function totalMcqScore(
  questions: Question[],
  answers: { questionId: string; answer: unknown }[],
) {
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer.answer]),
  );
  return questions
    .filter(
      (question): question is Extract<Question, { kind: "MCQ" }> =>
        question.kind === "MCQ",
    )
    .reduce(
      (sum, question) =>
        sum + scoreMcq(question, answerByQuestion.get(question.id)),
      0,
    );
}

export class AttemptService {
  async start(actor: IdentityUser, cookie: string, examId: string) {
    const examRow = await prisma.exam.findUnique({ where: { id: examId } });
    if (!examRow) throw notFound("Assessment");
    await classroomService.requireAccess(actor, cookie, examRow.classId);
    if (actor.role !== "STUDENT")
      throw forbidden("Only students can start attempts.");
    const exam = ExamSchema.parse({
      ...ExamSchema.parse(examRow.payload),
      status: examRow.status,
    });
    const now = new Date();
    if (
      exam.status !== "SCHEDULED" ||
      now < new Date(exam.startsAt) ||
      now > new Date(exam.endsAt)
    ) {
      throw conflict(
        "EXAM_NOT_AVAILABLE",
        "The assessment is outside its scheduled window.",
      );
    }

    const attempts = await prisma.attempt.findMany({
      where: { examId, studentId: actor.id },
      include: attemptInclude,
      orderBy: { attemptNumber: "desc" },
    });
    const active = attempts.find((attempt) => attempt.status === "IN_PROGRESS");
    if (active && active.expiresAt > now) return presentAttempt(active);
    if (active) await this.finalize(active, "AUTO_SUBMITTED");
    if (attempts.length >= exam.attemptLimit) {
      throw conflict(
        "ATTEMPT_LIMIT_REACHED",
        "No attempts remain for this assessment.",
      );
    }

    const expiresAt = new Date(
      Math.min(
        new Date(exam.endsAt).getTime(),
        now.getTime() + exam.durationMinutes * 60_000,
      ),
    );
    const created = await prisma.attempt.create({
      data: {
        examId,
        studentId: actor.id,
        attemptNumber: attempts.length + 1,
        status: "IN_PROGRESS",
        startedAt: now,
        expiresAt,
      },
      include: attemptInclude,
    });
    return presentAttempt(created);
  }

  async autosave(
    studentId: string,
    attemptId: string,
    questionId: string,
    answer: unknown,
    version: number,
  ) {
    const attempt = await this.requireStudentAttempt(studentId, attemptId);
    if (attempt.status !== "IN_PROGRESS") {
      throw conflict("ATTEMPT_NOT_ACTIVE", "This attempt is no longer active.");
    }
    if (attempt.expiresAt <= new Date()) {
      await this.finalize(attempt, "AUTO_SUBMITTED");
      throw conflict(
        "ATTEMPT_EXPIRED",
        "Time expired and the attempt was submitted.",
      );
    }
    const exam = parseExam(attempt);
    const question = exam.questions.find(
      (candidate) => candidate.id === questionId,
    );
    if (!question)
      throw badRequest(
        "QUESTION_NOT_IN_EXAM",
        "The question does not belong to this assessment.",
      );
    this.validateAnswer(question, answer);

    const saved = await prisma.$transaction(async (transaction) => {
      const current = await transaction.attemptAnswer.findUnique({
        where: { attemptId_questionId: { attemptId, questionId } },
      });
      if (current && current.version >= version)
        return { ...current, duplicate: true };
      const row = await transaction.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: { attemptId, questionId, answer: toJson(answer), version },
        update: { answer: toJson(answer), version, savedAt: new Date() },
      });
      return { ...row, duplicate: false };
    });
    return {
      savedAt: saved.savedAt.toISOString(),
      status: attempt.status,
      version: saved.version,
      duplicate: saved.duplicate,
    };
  }

  async submit(studentId: string, attemptId: string) {
    const attempt = await this.requireStudentAttempt(studentId, attemptId);
    if (attempt.status !== "IN_PROGRESS")
      return {
        attempt: presentAttempt(attempt),
        duplicate: true,
        codingQuestions: [],
      };
    const status =
      attempt.expiresAt <= new Date() ? "AUTO_SUBMITTED" : "SUBMITTED";
    const updated = await this.finalize(attempt, status);
    const exam = parseExam(attempt);
    const answers = new Map(
      attempt.answers.map((answer) => [answer.questionId, answer.answer]),
    );
    return {
      attempt: presentAttempt(updated),
      duplicate: false,
      codingQuestions: exam.questions
        .filter((question) => question.kind === "CODE")
        .map((question) => ({
          questionId: question.id,
          answer: answers.get(question.id),
        })),
    };
  }

  async getQuestion(
    attemptId: string,
    questionId: string,
    actorId: string,
    actorRole: "TEACHER" | "STUDENT",
  ) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { exam: true },
    });
    if (!attempt) throw notFound("Attempt");
    const allowed =
      (actorRole === "STUDENT" && attempt.studentId === actorId) ||
      (actorRole === "TEACHER" && attempt.exam.teacherId === actorId);
    if (!allowed) throw forbidden("The attempt does not belong to this user.");
    const exam = parseExam(attempt);
    const question = exam.questions.find(
      (candidate) => candidate.id === questionId,
    );
    if (!question) throw notFound("Question");
    return {
      question: QuestionSchema.parse(question),
      integrityPolicy: exam.integrityPolicy,
      attempt: {
        id: attempt.id,
        studentId: attempt.studentId,
        status: attempt.status,
        startedAt: attempt.startedAt.toISOString(),
        expiresAt: attempt.expiresAt.toISOString(),
      },
    };
  }

  async recordCodeResult(
    attemptId: string,
    questionId: string,
    details: { cases: { id: string; passed: boolean }[] } & Record<
      string,
      unknown
    >,
  ) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: attemptInclude,
    });
    if (!attempt) throw notFound("Attempt");
    if (
      !(["IN_PROGRESS", "SUBMITTED", "AUTO_SUBMITTED"] as string[]).includes(
        attempt.status,
      )
    ) {
      throw conflict(
        "ATTEMPT_NOT_JUDGABLE",
        "This attempt can no longer accept code results.",
      );
    }
    const question = parseExam(attempt).questions.find(
      (candidate) => candidate.id === questionId,
    );
    if (!question || question.kind !== "CODE")
      throw notFound("Coding question");
    const passed = new Set(
      details.cases.filter((test) => test.passed).map((test) => test.id),
    );
    const score = scoreTestCases(
      question.tests.filter((test) => test.visibility === "HIDDEN"),
      passed,
    );
    await prisma.codeResult.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      create: {
        attemptId,
        questionId,
        score,
        details: toJson({ ...details, score }),
      },
      update: {
        score,
        details: toJson({ ...details, score }),
        judgedAt: new Date(),
      },
    });
    const codeResults = await prisma.codeResult.findMany({
      where: { attemptId },
    });
    const codeScore = codeResults.reduce(
      (sum, result) => sum + Number(result.score),
      0,
    );
    const updated = await prisma.attempt.update({
      where: { id: attemptId },
      data: { codeScore, automaticScore: Number(attempt.mcqScore) + codeScore },
      include: attemptInclude,
    });
    return presentAttempt(updated);
  }

  async recordIntegrityFlags(
    attemptId: string,
    questionId: string,
    rawSignals: IntegritySignal[],
  ) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: attemptInclude,
    });
    if (!attempt) throw notFound("Attempt");
    if (
      !parseExam(attempt).questions.some(
        (question) => question.id === questionId,
      )
    ) {
      throw notFound("Question");
    }
    const signals = rawSignals.map((signal) =>
      IntegritySignalSchema.parse(signal),
    );
    const existing = z
      .array(storedIntegrityFlagSchema)
      .safeParse(attempt.integrityFlags);
    const flags = [
      ...(existing.success
        ? existing.data.filter((flag) => flag.questionId !== questionId)
        : []),
      ...signals.map((signal) => ({ ...signal, questionId })),
    ];
    const percentage = recommendedIntegrityReduction(
      flags,
      parseExam(attempt).integrityPolicy,
    );
    const updated = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        integrityFlags: toJson(flags),
        suggestedReductionPercent: percentage,
      },
      include: attemptInclude,
    });
    return presentAttempt(updated);
  }

  async listReviews(teacherId: string) {
    const attempts = await prisma.attempt.findMany({
      where: { exam: { teacherId } },
      include: attemptInclude,
      orderBy: { startedAt: "desc" },
    });
    return attempts.map(presentAttempt);
  }

  async applyReduction(
    teacherId: string,
    attemptId: string,
    percentage: number,
    reason: string,
  ) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, exam: { teacherId } },
      include: attemptInclude,
    });
    if (!attempt) throw notFound("Attempt");
    if (attempt.status === "IN_PROGRESS") {
      throw conflict(
        "ATTEMPT_NOT_SUBMITTED",
        "A score reduction cannot be applied before submission.",
      );
    }
    const updated = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        appliedReductionPercent: percentage,
        reductionReason: reason,
        status: "GRADED",
      },
      include: attemptInclude,
    });
    return presentAttempt(updated);
  }

  async results(studentId: string) {
    const attempts = await prisma.attempt.findMany({
      where: { studentId, exam: { status: "PUBLISHED" } },
      include: attemptInclude,
      orderBy: { startedAt: "desc" },
    });
    return attempts.map((attempt) => ({
      ...presentAttempt(attempt),
      examTitle: attempt.exam.title,
    }));
  }

  private async requireStudentAttempt(studentId: string, attemptId: string) {
    const attempt = await prisma.attempt.findFirst({
      where: { id: attemptId, studentId },
      include: attemptInclude,
    });
    if (!attempt) throw notFound("Attempt");
    return attempt;
  }

  private async finalize(
    attempt: Awaited<ReturnType<AttemptService["requireStudentAttempt"]>>,
    status: "SUBMITTED" | "AUTO_SUBMITTED",
  ) {
    const exam = parseExam(attempt);
    const mcqScore = totalMcqScore(exam.questions, attempt.answers);
    const codeScore = attempt.codeResults.reduce(
      (sum, result) => sum + Number(result.score),
      0,
    );
    return prisma.attempt.update({
      where: { id: attempt.id },
      data: {
        status,
        submittedAt: new Date(),
        mcqScore,
        codeScore,
        automaticScore: mcqScore + codeScore,
      },
      include: attemptInclude,
    });
  }

  private validateAnswer(question: Question, answer: unknown) {
    if (question.kind === "MCQ") {
      if (
        typeof answer !== "string" ||
        !question.options.some((option) => option.id === answer)
      ) {
        throw badRequest(
          "INVALID_MCQ_ANSWER",
          "Select one of the available options.",
        );
      }
      return;
    }
    const source = typeof answer === "string" ? answer : null;
    if (source === null || source.length === 0 || source.length > 100_000) {
      throw badRequest(
        "INVALID_CODE_ANSWER",
        "Code answers must contain between 1 and 100,000 characters.",
      );
    }
  }
}

export const attemptService = new AttemptService();
