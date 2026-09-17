import { describe, expect, it } from "vitest";
import {
  CreateExamInputSchema,
  ExamSummarySchema,
  QuestionInputSchema,
} from "./index.js";

const classroomId = "10000000-0000-4000-8000-000000000001";
const questionId = "20000000-0000-4000-8000-000000000001";

describe("assessment contracts", () => {
  it("accepts a complete exam creation request", () => {
    expect(
      CreateExamInputSchema.parse({
        classId: classroomId,
        title: "Algorithms Midterm",
        startsAt: "2026-09-20T10:00:00.000Z",
        endsAt: "2026-09-20T12:00:00.000Z",
        durationMinutes: 90,
        questionIds: [questionId],
      }),
    ).toMatchObject({ attemptLimit: 1, durationMinutes: 90 });
  });

  it("rejects an exam without questions", () => {
    expect(() =>
      CreateExamInputSchema.parse({
        classId: classroomId,
        title: "Algorithms Midterm",
        startsAt: "2026-09-20T10:00:00.000Z",
        endsAt: "2026-09-20T12:00:00.000Z",
        durationMinutes: 90,
        questionIds: [],
      }),
    ).toThrow();
  });

  it("accepts a teacher exam summary", () => {
    expect(
      ExamSummarySchema.parse({
        id: "30000000-0000-4000-8000-000000000001",
        classId: classroomId,
        title: "Algorithms Midterm",
        startsAt: "2026-09-20T10:00:00.000Z",
        endsAt: "2026-09-20T12:00:00.000Z",
        durationMinutes: 90,
        attemptLimit: 1,
        status: "DRAFT",
        integrityPolicy: {},
        questionCount: 1,
        totalPoints: 10,
      }).questionCount,
    ).toBe(1);
  });

  it("accepts MCQ question-bank input", () => {
    expect(
      QuestionInputSchema.parse({
        kind: "MCQ",
        title: "Complexity",
        prompt: "What is binary search complexity?",
        points: 5,
        options: [
          { id: "a", label: "O(log n)" },
          { id: "b", label: "O(n)" },
        ],
        correctOptionId: "a",
      }).kind,
    ).toBe("MCQ");
  });
});
