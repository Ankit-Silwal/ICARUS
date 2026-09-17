import { describe, expect, it } from "vitest";
import { assertJudgeInfrastructureHealthy } from "./judge.js";

describe("Judge0 infrastructure status", () => {
  it("allows student-code outcomes to be scored", () => {
    expect(() =>
      assertJudgeInfrastructureHealthy({ id: 3, description: "Accepted" }),
    ).not.toThrow();
    expect(() =>
      assertJudgeInfrastructureHealthy({
        id: 6,
        description: "Compilation Error",
      }),
    ).not.toThrow();
  });

  it("rejects Judge0 internal errors instead of recording a zero score", () => {
    expect(() =>
      assertJudgeInfrastructureHealthy({
        id: 13,
        description: "Internal Error",
      }),
    ).toThrow("Judge0 execution infrastructure failed (Internal Error).");
  });
});
