import { describe, expect, it } from "vitest";
import {
  analyzeEditorEvents,
  calculateFinalScore,
  calculatePercentageReduction,
  recommendedIntegrityReduction,
} from "./integrity.js";

describe("integrity analysis", () => {
  it("flags a large direct paste without changing a score", () => {
    const signals = analyzeEditorEvents([
      {
        sequence: 1,
        occurredAt: "2026-09-15T10:00:00.000Z",
        action: "PASTE",
        insertedCharacters: 120,
        deletedCharacters: 0,
        documentLength: 120,
        cursorLine: 1,
        checksum: "abc",
        idleMilliseconds: 0,
      },
    ]);
    expect(signals.map((signal) => signal.kind)).toContain("DIRECT_PASTE");
    expect(signals.map((signal) => signal.kind)).toContain("MEGA_PASTE");
    expect(calculateFinalScore(20, 5)).toBe(15);
  });

  it("converts distinct review signals into a capped recommendation", () => {
    const signals = analyzeEditorEvents([
      {
        sequence: 1,
        occurredAt: "2026-09-15T10:00:00.000Z",
        action: "PASTE",
        insertedCharacters: 120,
        deletedCharacters: 0,
        documentLength: 120,
        cursorLine: 1,
        checksum: "abc",
        idleMilliseconds: 12_000,
      },
    ]);
    expect(
      recommendedIntegrityReduction(signals, {
        enabled: true,
        directPasteReductionPercent: 10,
        rapidEntryReductionPercent: 5,
        idleReturnReductionPercent: 5,
        maximumReductionPercent: 15,
        typingSpeedCharactersPerSecond: 25,
        idleThresholdMilliseconds: 10_000,
      }),
    ).toBe(15);
  });

  it("applies percentage reductions to the automatic score", () => {
    expect(calculatePercentageReduction(80, 25)).toEqual({
      deduction: 20,
      finalScore: 60,
    });
  });
});
