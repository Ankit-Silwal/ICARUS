import {
  QuestionSchema,
  type Language,
  type Question,
  type TestCase,
} from "@icarus/contracts";
import { notFound } from "../lib/errors.js";
import { toJson } from "../lib/json.js";
import { prisma } from "../lib/prisma.js";
import { assertQuestionIsGradable } from "../question-rules.js";
import { leetCodeService } from "./leetcode.service.js";

export interface LeetCodeImportInput {
  problemNumber: number;
  points: number;
  functionName?: string;
  languages?: Language[];
  starterCode?: Partial<Record<Language, string>>;
  tests: TestCase[];
}

export class QuestionService {
  async list(teacherId: string) {
    const rows = await prisma.question.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => QuestionSchema.parse(row.payload));
  }

  async getOwned(teacherId: string, questionId: string) {
    const row = await prisma.question.findFirst({
      where: { id: questionId, teacherId },
    });
    if (!row) throw notFound("Question");
    return QuestionSchema.parse(row.payload);
  }

  async getInternal(questionId: string) {
    const row = await prisma.question.findUnique({ where: { id: questionId } });
    if (!row) throw notFound("Question");
    return QuestionSchema.parse(row.payload);
  }

  async create(teacherId: string, input: Omit<Question, "id">) {
    const question = QuestionSchema.parse({
      ...input,
      id: crypto.randomUUID(),
    });
    assertQuestionIsGradable(question);
    await prisma.question.create({
      data: {
        id: question.id,
        teacherId,
        kind: question.kind,
        title: question.title,
        payload: toJson(question),
      },
    });
    return question;
  }

  async previewLeetCode(problemNumber: number) {
    return leetCodeService.load(problemNumber);
  }

  async importLeetCode(teacherId: string, input: LeetCodeImportInput) {
    const imported = await leetCodeService.load(input.problemNumber);
    const languages =
      input.languages ?? (Object.keys(imported.starterCode) as Language[]);
    const starterCode = { ...imported.starterCode, ...input.starterCode };
    const question = QuestionSchema.parse({
      id: crypto.randomUUID(),
      kind: "CODE",
      title: imported.title,
      prompt: imported.prompt,
      points: input.points,
      functionName: input.functionName ?? imported.functionName,
      languages,
      starterCode,
      tests: input.tests,
      source: imported.source,
    });
    assertQuestionIsGradable(question);
    await prisma.question.create({
      data: {
        id: question.id,
        teacherId,
        kind: question.kind,
        title: question.title,
        payload: toJson(question),
      },
    });
    return {
      question,
      importMetadata: { difficulty: imported.difficulty, tags: imported.tags },
    };
  }

  async remove(teacherId: string, questionId: string) {
    const deleted = await prisma.question.deleteMany({
      where: { id: questionId, teacherId },
    });
    if (deleted.count === 0) throw notFound("Question");
  }
}

export const questionService = new QuestionService();
