import { describe, expect, it } from "vitest";
import type { EditorEvent } from "@icarus/contracts";
import { AppError } from "./lib/errors.js";
import { validateEventBatch } from "./event-validation.js";

const attempt = {
  startedAt: "2026-09-16T10:00:00.000Z",
  expiresAt: "2026-09-16T11:00:00.000Z",
};
const event: EditorEvent = {
  sequence: 1,
  occurredAt: "2026-09-16T10:10:00.000Z",
  action: "TYPE",
  insertedCharacters: 1,
  deletedCharacters: 0,
  documentLength: 1,
  cursorLine: 1,
  checksum: "a",
  idleMilliseconds: 0,
};

describe("editor event validation", () => {
  it("accepts events inside the attempt window", () => {
    expect(() =>
      validateEventBatch(
        [event],
        attempt,
        new Date("2026-09-16T10:20:00.000Z"),
        5_000,
      ),
    ).not.toThrow();
  });

  it("rejects duplicate sequences in one batch", () => {
    expect(() =>
      validateEventBatch(
        [event, event],
        attempt,
        new Date("2026-09-16T10:20:00.000Z"),
        5_000,
      ),
    ).toThrowError(AppError);
  });

  it("rejects events outside the attempt window", () => {
    expect(() =>
      validateEventBatch(
        [{ ...event, occurredAt: "2026-09-16T09:30:00.000Z" }],
        attempt,
        new Date("2026-09-16T10:20:00.000Z"),
        5_000,
      ),
    ).toThrowError("outside the allowed attempt time window");
  });
});
