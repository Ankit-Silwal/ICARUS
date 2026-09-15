# Identity Service Guidelines

## Scope

This service owns authentication, OAuth identities, sessions, user roles and statuses, the initial college administrator, teacher provisioning, and identity audit records. It does not own classrooms, courses, exams, grading, or notifications.

## Structure

- `src/index.ts`: process startup, dependency readiness, and graceful shutdown only.
- `src/app.ts`: Express middleware and route composition.
- `src/routes/`: endpoint declarations and middleware ordering.
- `src/controllers/`: HTTP parsing, response status, and response shape.
- `src/services/`: business rules and Prisma operations.
- `src/middleware/`: authentication, authorization, errors, and uploads.
- `src/types/`: identity-domain and Express request types.
- `src/lib/`: Prisma, cryptography, and reusable errors.
- `src/config/`: validated environment configuration.
- `prisma/`: schema and committed migrations.
- `docs/`: API and database contracts.

Controllers must remain thin. Routes must not query Prisma directly. Never trust gateway identity headers inside this service; administrator routes authenticate the opaque session cookie themselves.

## Security Rules

- Google OAuth authorization code flow must use state, nonce, and PKCE.
- Store only SHA-256 hashes of session tokens and OAuth state.
- Never store Google access or ID tokens.
- Normalize all emails to lowercase before lookup or persistence.
- Require an existing provisioned account unless student self-registration is explicitly enabled.
- Suspending, disabling, or changing a user's role revokes that user's sessions.
- An administrator cannot deactivate or demote their own account.
- CSV uploads stay in memory, obey configured byte/row limits, and never contain passwords.
- Do not log cookies, OAuth codes, tokens, client secrets, or database credentials.

## Database Workflow

Use Prisma `7.10.0` with PostgreSQL and the driver adapter. After editing `prisma/schema.prisma`, generate and commit a migration, then run:

```sh
npm run db:generate --workspace @icarus/identity-service
npm run check-types --workspace @icarus/identity-service
```

Container startup applies committed migrations with `prisma migrate deploy`. Never use `db push` for shared or production environments.

## Routes and Environment

The service listens internally on port `8000`. The gateway exposes it under `/api/v1/auth`. Keep `docs/API.md`, `docs/DATABASE.md`, `.env.example`, root `AGENTS.md`, and gateway routing synchronized whenever the contract changes.
