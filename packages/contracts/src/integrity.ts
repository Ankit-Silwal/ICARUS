import type { EditorEvent, IntegritySignal } from "./index.js";

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

  for (const event of ordered) {
    const add = (kind: IntegritySignal["kind"], severity: IntegritySignal["severity"], message: string) => {
      signals.push({ id: `${event.sequence}-${kind}`, kind, severity, sequence: event.sequence, message });
    };

    if (event.action === "PASTE") add("DIRECT_PASTE", event.insertedCharacters >= thresholds.megaPaste ? "HIGH" : "MEDIUM", `Clipboard paste inserted ${event.insertedCharacters} characters.`);
    if (event.insertedCharacters >= thresholds.megaPaste) add("MEGA_PASTE", "HIGH", `A single edit inserted ${event.insertedCharacters} characters.`);
    else if (event.insertedCharacters >= thresholds.atomicInsert) add("ATOMIC_INSERT", "MEDIUM", `A single edit inserted ${event.insertedCharacters} characters.`);
    if (event.action === "REPLACE" && event.documentLength > 0 && event.deletedCharacters / event.documentLength >= thresholds.bulkReplaceRatio) add("BULK_REPLACE", "MEDIUM", "A large portion of the document was replaced at once.");
    if (event.idleMilliseconds >= thresholds.idleMilliseconds && event.insertedCharacters >= thresholds.atomicInsert) add("POST_IDLE_EDIT", "LOW", "A substantial edit followed a long idle interval.");
  }

  for (let index = 0; index < ordered.length; index += 1) {
    const start = ordered[index];
    if (!start) continue;
    const endMs = Date.parse(start.occurredAt) + 2_000;
    const window = ordered.slice(index).filter((event) => Date.parse(event.occurredAt) <= endMs);
    const chars = window.reduce((sum, event) => sum + event.insertedCharacters, 0);
    if (chars / 2 > thresholds.burstCharactersPerSecond) {
      signals.push({ id: `${start.sequence}-SPEED_BURST`, kind: "SPEED_BURST", severity: chars >= thresholds.megaPaste ? "HIGH" : "MEDIUM", sequence: start.sequence, message: `${chars} characters appeared within two seconds.` });
      index += Math.max(0, window.length - 1);
    }
  }

  return signals;
}

export function calculateFinalScore(automaticScore: number, deduction = 0): number {
  if (automaticScore < 0 || deduction < 0) throw new Error("Scores cannot be negative.");
  return Math.max(0, automaticScore - Math.min(deduction, automaticScore));
}
