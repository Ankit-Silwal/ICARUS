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

## API and Lifecycle

- Public routes are grouped under `/questions`, `/exams`, `/attempts`, `/reviews`, and `/results`; keep `/internal` reachable only by trusted services.
- Question-bank updates use `PATCH /questions/:questionId` and preserve the question ID. They may change future exam content but never existing snapshots.
- Exam creation accepts shared `CreateExamInput` data and creates a draft snapshot. Lifecycle changes are explicit: draft to scheduled, scheduled to review when closed, and review to published.
- Students may list only relevant exams and may start attempts only for scheduled exams inside the configured window and attempt limit.
- Autosaves use a monotonically increasing per-question version. Exact repeats are idempotent and older conflicting versions are rejected.
- Submission derives MCQ marks locally. Execution reports passed test IDs through the protected code-score route, and assessment recomputes coding marks from hidden snapshot weights.
- Expired in-progress attempts are finalized as `AUTO_SUBMITTED`. Published results expose the automatic score, explicit reduction, deduction, reason, and final score.

## Shared Consumers

- Shared question and exam request/response shapes live in `packages/contracts`; update their contract tests when changing them.
- Teacher authoring is implemented in `apps/teacher/app/questions` and `apps/teacher/app/exams`; review decisions remain in `apps/teacher/app/reviews`.
- Student discovery is implemented in `apps/student/app/exams`, the active attempt in `apps/student/app/exam`, and published grades in `apps/student/app/results`.

## Validation

Run these focused checks from the repository root:

- `npm run test --workspace @icarus/contracts`
- `npm run test --workspace @icarus/assessment-service`
- `npm run lint --workspace @icarus/assessment-service`
- `npm run check-types --workspace @icarus/assessment-service`
- `npm run db:generate --workspace @icarus/assessment-service` after schema changes

For an end-to-end change, verify the complete teacher-to-student lifecycle through gateway port `4000`, inspect the migrated PostgreSQL tables and indexes, and confirm `/health` for both assessment and the gateway.

## LeetCode Imports

Only import public problem metadata, statement content, and starter snippets. LeetCode does not expose its hidden judge suite. Teachers must provide test inputs, expected outputs, visibility, and marks they are permitted to use. Sample tests carry zero marks; hidden test marks must total the question marks.
