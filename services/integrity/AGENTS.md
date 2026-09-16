# Integrity Service Guidelines

## Scope

This service owns raw coding-editor events, derived integrity signals, analysis reports, assessment synchronization state, and telemetry retention. It does not own attempts, questions, scores, users, or browser sessions.

## Boundaries

- Revalidate every public request through identity, even though the gateway already authenticates it.
- Ask assessment to authorize an attempt/question before accepting or disclosing telemetry. Never query another service's database.
- Students may submit events only for their own active coding attempt. Teachers may read and re-analyze only attempts belonging to their exams. Only administrators may delete expired telemetry.
- Treat sequence numbers as idempotency keys. An exact retry is safe; a reused sequence with different data is a conflict.
- Integrity signals are heuristics for teacher review, not proof of misconduct. Never apply a score reduction from this service.
- Keep the report's assessment synchronization state visible. Telemetry must remain stored if assessment is temporarily unavailable.
- Do not create or alter tables at application startup. Commit every schema change as a Prisma migration.

## Detection

Analyze explicit paste events, atomic inserts, short-window typing bursts, bulk replacements, post-idle edits, repeated similar idle-return patterns, focus loss, sequence/timestamp anomalies, and document-length discontinuities. Thresholds that affect recommendations come from the immutable assessment integrity policy.
