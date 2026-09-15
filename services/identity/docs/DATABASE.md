# Identity Database

The Identity Service owns the PostgreSQL schema named `identity`. No other service may query or mutate these tables directly.

## Models

| Model               | Ownership                                                                |
| ------------------- | ------------------------------------------------------------------------ |
| `User`              | College identity, role, status, profile summary, and login timestamps    |
| `OAuthAccount`      | Link between a Google subject and a user; provider tokens are not stored |
| `Session`           | Hashed opaque sessions, expiry, revocation, and request metadata         |
| `OAuthState`        | Short-lived OAuth state, nonce, and PKCE verifier                        |
| `TeacherProfile`    | Employee ID and department attached to a teacher identity                |
| `TeacherInvitation` | Administrator provisioning state for teacher email addresses             |
| `TeacherImport`     | CSV import summary and per-row result report                             |
| `AuditLog`          | Immutable security and administrator activity records                    |

## Administrator bootstrap

At startup, the service upserts the email in `PLATFORM_ADMIN_EMAIL` with the `ADMIN` role and `PENDING` status. No credential is stored. Logging in with the matching verified Google identity activates the account. Restarting the service does not create duplicate administrators.

## Migrations

Committed migrations are applied with `prisma migrate deploy` during identity-container startup. Schema changes must be represented by a new migration; application startup must never issue table-creation SQL.

For the current shared PostgreSQL container, service isolation is provided by the `identity` schema. The database can later be moved to a dedicated PostgreSQL instance without changing domain ownership.
