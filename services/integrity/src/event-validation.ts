import type { EditorEvent } from "@icarus/contracts";
import { badRequest } from "./lib/errors.js";

interface AttemptWindow {
  startedAt: string;
  expiresAt: string;
}

export function validateEventBatch(
  events: EditorEvent[],
  attempt: AttemptWindow,
  now: Date,
  clockSkewMilliseconds: number,
) {
  const sequences = events.map((event) => event.sequence);
  if (new Set(sequences).size !== sequences.length) {
    throw badRequest(
      "DUPLICATE_EVENT_SEQUENCE",
      "An event batch cannot contain duplicate sequence numbers.",
    );
  }

  const earliest = Date.parse(attempt.startedAt) - clockSkewMilliseconds;
  const latest =
    Math.min(Date.parse(attempt.expiresAt), now.getTime()) +
    clockSkewMilliseconds;
  for (const event of events) {
    const occurredAt = Date.parse(event.occurredAt);
    if (occurredAt < earliest || occurredAt > latest) {
      throw badRequest(
        "EVENT_OUTSIDE_ATTEMPT",
        "An editor event falls outside the allowed attempt time window.",
        {
          sequence: event.sequence,
        },
      );
    }
  }
}
