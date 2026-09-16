# Integrity service

The integrity service runs on port `4005` and is exposed by the gateway at `/api/v1/integrity`.

It receives batched editor telemetry from active coding attempts, keeps exact retries idempotent, derives review signals, and synchronizes those signals to assessment. Teachers can inspect the report and its paginated raw evidence or explicitly re-run analysis. Suggested percentage reductions are advisory: only a teacher can apply a reduction in assessment.

## Local database

Set `DATABASE_URL` to the dedicated integrity PostgreSQL database, then run:

```sh
npm run db:generate --workspace @icarus/integrity-service
npm run db:deploy --workspace @icarus/integrity-service
```

`INTERNAL_SERVICE_TOKEN` must match assessment. `IDENTITY_URL` and `ASSESSMENT_URL` point to the services' internal addresses. `INTEGRITY_RETENTION_DAYS` provides the default cutoff for administrator cleanup. No secret has a source-code default.

See [docs/api.md](docs/api.md) for routes, roles, event semantics, and retention behavior.
