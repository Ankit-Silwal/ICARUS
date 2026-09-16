import { describe, expect, it } from "vitest";
import { scoreMcq, scoreTestCases } from "./scoring.js";

describe("assessment scoring", () => {
  it("awards MCQ points only for the configured answer", () => {
    const question = {
      id: crypto.randomUUID(),
      kind: "MCQ" as const,
      title: "Complexity",
      prompt: "Choose",
      points: 4,
      options: [
        { id: "a", label: "O(1)" },
        { id: "b", label: "O(n)" },
      ],
      correctOptionId: "a",
    };
    expect(scoreMcq(question, "a")).toBe(4);
    expect(scoreMcq(question, "b")).toBe(0);
  });

  it("adds only passed hidden-test weights", () => {
    const tests = [
      {
        id: "sample",
        label: "Sample",
        input: [],
        expected: [],
        weight: 0,
        visibility: "SAMPLE" as const,
      },
      {
        id: "h1",
        label: "Hidden 1",
        input: [],
        expected: [],
        weight: 8,
        visibility: "HIDDEN" as const,
      },
      {
        id: "h2",
        label: "Hidden 2",
        input: [],
        expected: [],
        weight: 8,
        visibility: "HIDDEN" as const,
      },
    ];
    expect(scoreTestCases(tests, new Set(["sample", "h2"]))).toBe(8);
  });
});
