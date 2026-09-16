import { describe, expect, it } from "vitest";
import { AppError } from "./lib/errors.js";
import { assertQuestionIsGradable } from "./question-rules.js";

const codeQuestion = {
  id: crypto.randomUUID(),
  kind: "CODE" as const,
  title: "Sum",
  prompt: "Add two numbers.",
  points: 10,
  functionName: "sum",
  languages: ["javascript" as const],
  starterCode: { javascript: "function sum(a, b) {}" },
  tests: [
    {
      id: "sample",
      label: "Sample",
      input: [1, 2],
      expected: 3,
      weight: 0,
      visibility: "SAMPLE" as const,
    },
    {
      id: "hidden-a",
      label: "Hidden A",
      input: [2, 3],
      expected: 5,
      weight: 4,
      visibility: "HIDDEN" as const,
    },
    {
      id: "hidden-b",
      label: "Hidden B",
      input: [-2, 2],
      expected: 0,
      weight: 6,
      visibility: "HIDDEN" as const,
    },
  ],
};

describe("question grading rules", () => {
  it("accepts marks distributed across hidden test cases", () => {
    expect(() => assertQuestionIsGradable(codeQuestion)).not.toThrow();
  });

  it("rejects grading totals that do not match question marks", () => {
    expect(() =>
      assertQuestionIsGradable({
        ...codeQuestion,
        tests: codeQuestion.tests.slice(0, 2),
      }),
    ).toThrowError(AppError);
  });

  it("rejects marks on a visible sample", () => {
    const tests = codeQuestion.tests.map((test) =>
      test.id === "sample" ? { ...test, weight: 1 } : test,
    );
    expect(() =>
      assertQuestionIsGradable({ ...codeQuestion, tests }),
    ).toThrowError("Sample tests cannot award marks.");
  });
});
