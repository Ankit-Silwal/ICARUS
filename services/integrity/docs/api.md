# Integrity API

All public routes are mounted under `/api/v1/integrity` by the gateway. Every route requires a valid browser session, which integrity revalidates with identity.

## Student event ingestion

`POST /events` accepts batches of up to `MAX_EVENT_BATCH_SIZE` events for the signed-in student's active coding attempt:

```json
{
  "attemptId": "00000000-0000-4000-8000-000000000000",
  "questionId": "00000000-0000-4000-8000-000000000000",
  "events": [
    {
      "sequence": 1,
      "occurredAt": "2026-09-16T10:15:00.000Z",
      "action": "TYPE",
      "insertedCharacters": 1,
      "deletedCharacters": 0,
      "documentLength": 42,
      "cursorLine": 3,
      "checksum": "fnv1a-d34db33f",
      "idleMilliseconds": 250
    }
  ]
}
```

Actions are `TYPE`, `PASTE`, `DELETE`, `REPLACE`, `UNDO`, `REDO`, `FOCUS_LOST`, and `FOCUS_GAINED`. Sequence numbers are scoped to an attempt/question. Retrying identical sequences is safe; changing a previously stored sequence returns `409 EVENT_SEQUENCE_CONFLICT`. Timestamps outside the attempt window and configured clock skew are rejected.

The response includes accepted and duplicate counts plus the latest report. An assessment synchronization failure is recorded in the report rather than discarding accepted telemetry.

## Teacher review

- `GET /reports/:attemptId` lists analyzed question reports for one authorized attempt.
- `GET /reports/:attemptId/:questionId` returns one report, signals, severity counts, the suggested reduction, and synchronization state.
- `GET /reports/:attemptId/:questionId/events?limit=100&afterSequence=123` returns ordered raw evidence with cursor pagination.
- `POST /reports/:attemptId/:questionId/reanalyze` runs the current analyzer over stored evidence and retries assessment synchronization.

Signals cover direct paste, large atomic insertion, short-window speed bursts, bulk replacement, edits after long idle periods, repeated similar idle-return patterns, focus loss, sequence gaps, timestamp regression, and document discontinuity. These are editing heuristics, not proof. The report never changes marks automatically.

## Administrator retention

`DELETE /retention/expired` deletes events older than the supplied optional ISO `before` value and removes now-empty sessions and reports. When omitted, the cutoff is `INTEGRITY_RETENTION_DAYS` before the current time. Future cutoffs are rejected.
