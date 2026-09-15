import type { Question, TestCase } from "@icarus/contracts";

export function scoreMcq(question: Extract<Question, { kind: "MCQ" }>, selectedOptionId: unknown): number {
  return selectedOptionId === question.correctOptionId ? question.points : 0;
}

export function scoreTestCases(tests: TestCase[], passedTestIds: ReadonlySet<string>): number {
  return tests.reduce((score, test) => score + (passedTestIds.has(test.id) ? test.weight : 0), 0);
}
