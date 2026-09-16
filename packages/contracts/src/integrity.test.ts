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

  it("flags missing sequences, backwards time, and document discontinuity", () => {
    const signals = analyzeEditorEvents([
      {
        sequence: 1,
        occurredAt: "2026-09-15T10:00:02.000Z",
        action: "TYPE",
        insertedCharacters: 1,
        deletedCharacters: 0,
        documentLength: 1,
        cursorLine: 1,
        checksum: "one",
        idleMilliseconds: 0,
      },
      {
        sequence: 3,
        occurredAt: "2026-09-15T10:00:01.000Z",
        action: "TYPE",
        insertedCharacters: 1,
        deletedCharacters: 0,
        documentLength: 9,
        cursorLine: 1,
        checksum: "two",
        idleMilliseconds: 0,
      },
    ]);
    expect(signals.map((signal) => signal.kind)).toEqual(
      expect.arrayContaining([
        "SEQUENCE_GAP",
        "TIMESTAMP_REGRESSION",
        "DOCUMENT_DISCONTINUITY",
      ]),
    );
  });

  it("flags repeated similar look-away and edit cycles", () => {
    const signals = analyzeEditorEvents(
      [10_000, 10_500, 10_200].flatMap((idleMilliseconds, index) => [
        {
          sequence: index * 2 + 1,
          occurredAt: `2026-09-15T10:00:${String(index * 12).padStart(2, "0")}.000Z`,
          action: "FOCUS_LOST" as const,
          insertedCharacters: 0,
          deletedCharacters: 0,
          documentLength: index * 20,
          cursorLine: 1,
          checksum: `focus-${index}`,
          idleMilliseconds: 0,
        },
        {
          sequence: index * 2 + 2,
          occurredAt: `2026-09-15T10:00:${String(index * 12 + 10).padStart(2, "0")}.000Z`,
          action: "TYPE" as const,
          insertedCharacters: 20,
          deletedCharacters: 0,
          documentLength: (index + 1) * 20,
          cursorLine: 1,
          checksum: `edit-${index}`,
          idleMilliseconds,
        },
      ]),
    );
    expect(signals.map((signal) => signal.kind)).toContain(
      "REPEATED_IDLE_PATTERN",
    );
    expect(
      signals.filter((signal) => signal.kind === "FOCUS_LOSS"),
    ).toHaveLength(3);
  });

  it("does not flag normal paced typing", () => {
    const signals = analyzeEditorEvents([
      {
        sequence: 1,
        occurredAt: "2026-09-15T10:00:00.000Z",
        action: "TYPE",
        insertedCharacters: 1,
        deletedCharacters: 0,
        documentLength: 1,
        cursorLine: 1,
        checksum: "a",
        idleMilliseconds: 0,
      },
      {
        sequence: 2,
        occurredAt: "2026-09-15T10:00:01.000Z",
        action: "TYPE",
        insertedCharacters: 1,
        deletedCharacters: 0,
        documentLength: 2,
        cursorLine: 1,
        checksum: "ab",
        idleMilliseconds: 1_000,
      },
    ]);
    expect(signals).toEqual([]);
  });
});
