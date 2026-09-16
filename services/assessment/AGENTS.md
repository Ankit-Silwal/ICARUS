# Assessment Service Guidelines

## Scope

This service owns question banks, immutable exam snapshots, attempt state, answers, automatic scores, and teacher-approved percentage reductions. It does not execute untrusted code or own raw editor events. Execution is delegated to the execution service and editing telemetry to the integrity service.

## Boundaries

- Browser requests must carry a session cookie. Revalidate it through identity and reject a mismatched forwarded user ID.
- Validate classroom ownership or enrollment through the classroom HTTP API. Never query another service's database.
- Protect `/internal/*` with `INTERNAL_SERVICE_TOKEN`; the gateway must not expose these routes.
- Treat exam question payloads as immutable snapshots. Editing or deleting a question-bank item must not alter an existing exam.
- Never trust a score sent by execution. Recalculate it from passed test IDs and the snapshot's hidden-test weights.
- Integrity signals are review evidence, not proof. Store a suggested reduction separately and require a teacher to apply a percentage.
- Do not create or alter tables at application startup. Commit every schema change as a Prisma migration.

## LeetCode Imports

Only import public problem metadata, statement content, and starter snippets. LeetCode does not expose its hidden judge suite. Teachers must provide test inputs, expected outputs, visibility, and marks they are permitted to use. Sample tests carry zero marks; hidden test marks must total the question marks.
