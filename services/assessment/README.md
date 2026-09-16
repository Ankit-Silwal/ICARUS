# Assessment service

The assessment service runs on port `4003` and is exposed by the gateway at `/api/v1/assessments`.

It supports teacher-owned MCQ and coding question banks, public LeetCode problem import by frontend problem number, weighted hidden cases, immutable exam snapshots, scheduling, multiple attempts, versioned autosave, automatic scoring, integrity-review recommendations, percentage reductions, and result publication.

## Local database

Set `DATABASE_URL` to the dedicated assessment PostgreSQL database, then run:

```sh
npm run db:generate --workspace @icarus/assessment-service
npm run db:deploy --workspace @icarus/assessment-service
```

`INTERNAL_SERVICE_TOKEN` must be the same value used by execution and integrity. `IDENTITY_URL` and `CLASSROOM_URL` point to the internal service addresses. No secret has a source-code default.

See [docs/api.md](docs/api.md) for routes and payload rules.
