import { describe, expect, it } from "vitest";
import type { CodeQuestion } from "@icarus/contracts";
import { buildHarness } from "./harness.js";

const question: CodeQuestion = { id: crypto.randomUUID(), kind: "CODE", title: "Add", prompt: "Add", points: 2, functionName: "add", languages: ["cpp", "java", "python", "javascript"], starterCode: { cpp: "", java: "", python: "", javascript: "" }, tests: [{ id: "sample", label: "Sample", input: [1, 2], expected: 3, weight: 0, visibility: "SAMPLE" }, { id: "hidden", label: "Hidden", input: [3, 4], expected: 7, weight: 2, visibility: "HIDDEN" }] };

describe("language harnesses", () => {
  it.each(["cpp", "java", "python", "javascript"] as const)("builds a %s sample harness", (language) => {
    const harness = buildHarness(question, language, question.starterCode[language], "RUN");
    expect(harness.tests.map((test) => test.id)).toEqual(["sample"]);
    expect(harness.source).toContain("add");
  });
});
