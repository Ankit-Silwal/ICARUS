import type { EditorEvent, IntegrityPolicy, IntegritySignal } from "./index.js";

export interface IntegrityThresholds {
  atomicInsert: number;
  megaPaste: number;
  burstCharactersPerSecond: number;
  idleMilliseconds: number;
  bulkReplaceRatio: number;
}

export const defaultIntegrityThresholds: IntegrityThresholds = {
  atomicInsert: 20,
  megaPaste: 100,
  burstCharactersPerSecond: 25,
  idleMilliseconds: 10_000,
  bulkReplaceRatio: 0.2,
};

export function analyzeEditorEvents(
  events: EditorEvent[],
  thresholds = defaultIntegrityThresholds,
): IntegritySignal[] {
  const signals: IntegritySignal[] = [];
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const editActions = new Set<EditorEvent["action"]>([
    "TYPE",
    "PASTE",
    "DELETE",
    "REPLACE",
    "UNDO",
    "REDO",
  ]);
  const idleReturns: { sequence: number; milliseconds: number }[] = [];
  let previousEvent: EditorEvent | undefined;
  let previousEdit: EditorEvent | undefined;

  for (const event of ordered) {
    const add = (
      kind: IntegritySignal["kind"],
      severity: IntegritySignal["severity"],
      message: string,
    ) => {
      signals.push({
        id: `${event.sequence}-${kind}`,
        kind,
        severity,
        sequence: event.sequence,
        message,
      });
    };

    if (previousEvent) {
      if (event.sequence > previousEvent.sequence + 1) {
        add(
          "SEQUENCE_GAP",
          "MEDIUM",
          `${event.sequence - previousEvent.sequence - 1} editor event sequence number(s) are missing.`,
        );
      }
      if (Date.parse(event.occurredAt) < Date.parse(previousEvent.occurredAt)) {
        add(
          "TIMESTAMP_REGRESSION",
          "MEDIUM",
          "An editor event timestamp moved backwards.",
        );
      }
    }

    if (event.action === "FOCUS_LOST") {
      add("FOCUS_LOSS", "LOW", "The assessment window lost focus.");
    }

    if (editActions.has(event.action) && previousEdit) {
      const expectedLength =
        previousEdit.documentLength -
        event.deletedCharacters +
        event.insertedCharacters;
      if (expectedLength !== event.documentLength) {
        add(
          "DOCUMENT_DISCONTINUITY",
          "MEDIUM",
          "The reported document length does not match the edit delta.",
        );
      }
    }

    if (event.action === "PASTE")
      add(
        "DIRECT_PASTE",
        event.insertedCharacters >= thresholds.megaPaste ? "HIGH" : "MEDIUM",
        `Clipboard paste inserted ${event.insertedCharacters} characters.`,
      );
    if (event.insertedCharacters >= thresholds.megaPaste)
      add(
        "MEGA_PASTE",
        "HIGH",
        `A single edit inserted ${event.insertedCharacters} characters.`,
      );
    else if (event.insertedCharacters >= thresholds.atomicInsert)
      add(
        "ATOMIC_INSERT",
        "MEDIUM",
        `A single edit inserted ${event.insertedCharacters} characters.`,
      );
    if (
      event.action === "REPLACE" &&
      event.documentLength > 0 &&
      event.deletedCharacters / event.documentLength >=
        thresholds.bulkReplaceRatio
    )
      add(
        "BULK_REPLACE",
        "MEDIUM",
        "A large portion of the document was replaced at once.",
      );
    if (
      event.idleMilliseconds >= thresholds.idleMilliseconds &&
      event.insertedCharacters >= thresholds.atomicInsert
    ) {
      add(
        "POST_IDLE_EDIT",
        "LOW",
        "A substantial edit followed a long idle interval.",
      );
      idleReturns.push({
        sequence: event.sequence,
        milliseconds: event.idleMilliseconds,
      });
    }

    previousEvent = event;
    if (editActions.has(event.action)) previousEdit = event;
  }

  const edits = ordered.filter(
    (event) => editActions.has(event.action) && event.insertedCharacters > 0,
  );
  for (let index = 0; index < edits.length; index += 1) {
    const start = edits[index];
    if (!start) continue;
    const endMs = Date.parse(start.occurredAt) + 2_000;
    const window = edits
      .slice(index)
      .filter((event) => Date.parse(event.occurredAt) <= endMs);
    const chars = window.reduce(
      (sum, event) => sum + event.insertedCharacters,
      0,
    );
    const last = window.at(-1) ?? start;
    const elapsedSeconds = Math.max(
      0.5,
      (Date.parse(last.occurredAt) - Date.parse(start.occurredAt)) / 1_000,
    );
    if (
      chars >= thresholds.atomicInsert &&
      chars / elapsedSeconds > thresholds.burstCharactersPerSecond
    ) {
      signals.push({
        id: `${start.sequence}-SPEED_BURST`,
        kind: "SPEED_BURST",
        severity: chars >= thresholds.megaPaste ? "HIGH" : "MEDIUM",
        sequence: start.sequence,
        message: `${chars} characters appeared within two seconds.`,
      });
      index += Math.max(0, window.length - 1);
    }
  }

  for (let index = 2; index < idleReturns.length; index += 1) {
    const window = idleReturns.slice(index - 2, index + 1);
    const durations = window.map((entry) => entry.milliseconds);
    const average = durations.reduce((sum, value) => sum + value, 0) / 3;
    const spread = Math.max(...durations) - Math.min(...durations);
    const current = window.at(-1);
    if (current && spread <= Math.max(2_000, average * 0.2)) {
      signals.push({
        id: `${current.sequence}-REPEATED_IDLE_PATTERN`,
        kind: "REPEATED_IDLE_PATTERN",
        severity: "MEDIUM",
        sequence: current.sequence,
        message:
          "Three similar long-idle intervals were each followed by a substantial edit.",
      });
      break;
    }
  }

  return signals;
}

export function calculateFinalScore(
  automaticScore: number,
  deduction = 0,
): number {
  if (automaticScore < 0 || deduction < 0)
    throw new Error("Scores cannot be negative.");
  return Math.max(0, automaticScore - Math.min(deduction, automaticScore));
}

export function calculatePercentageReduction(
  automaticScore: number,
  percentage: number,
) {
  if (automaticScore < 0 || percentage < 0 || percentage > 100) {
    throw new Error(
      "The score must be non-negative and percentage must be between 0 and 100.",
    );
  }
  const deduction = (automaticScore * percentage) / 100;
  return {
    deduction,
    finalScore: Math.max(0, automaticScore - deduction),
  };
}

export function recommendedIntegrityReduction(
  signals: IntegritySignal[],
  policy: IntegrityPolicy,
) {
  if (!policy.enabled) return 0;

  const kinds = new Set(signals.map((signal) => signal.kind));
  let percentage = 0;
  if (kinds.has("DIRECT_PASTE") || kinds.has("MEGA_PASTE")) {
    percentage += policy.directPasteReductionPercent;
  }
  if (kinds.has("ATOMIC_INSERT") || kinds.has("SPEED_BURST")) {
    percentage += policy.rapidEntryReductionPercent;
  }
  if (kinds.has("POST_IDLE_EDIT") || kinds.has("REPEATED_IDLE_PATTERN")) {
    percentage += policy.idleReturnReductionPercent;
  }

  return Math.min(percentage, policy.maximumReductionPercent);
}
