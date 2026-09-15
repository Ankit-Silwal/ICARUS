import { describe, expect, it } from "vitest";
import { analyzeEditorEvents, calculateFinalScore } from "./integrity.js";

describe("integrity analysis", () => {
  it("flags a large direct paste without changing a score", () => {
    const signals = analyzeEditorEvents([{ sequence: 1, occurredAt: "2026-09-15T10:00:00.000Z", action: "PASTE", insertedCharacters: 120, deletedCharacters: 0, documentLength: 120, cursorLine: 1, checksum: "abc", idleMilliseconds: 0 }]);
    expect(signals.map((signal) => signal.kind)).toContain("DIRECT_PASTE");
    expect(signals.map((signal) => signal.kind)).toContain("MEGA_PASTE");
    expect(calculateFinalScore(20, 5)).toBe(15);
  });
});
