# Classroom Service Guidelines

## Scope

This service owns classrooms and student enrollments. Teachers can create, list, view, and delete their own classrooms; list their classroom rosters; and remove enrolled students. Students can join with an eight-character classroom code, list/view joined classrooms, and leave. It does not own users, sessions, roles, assessments, or grades.

## Structure

- `src/index.ts`: database readiness, process startup, and graceful shutdown only.
- `src/app.ts`: Express middleware and route composition.
- `src/routes/`: endpoint declarations.
- `src/controllers/`: request validation and HTTP response shapes.
- `src/services/`: classroom rules, Prisma operations, and identity integration.
- `src/middleware/`: identity verification and error handling.
- `src/types/`: classroom-local and Express request types.
- `src/lib/`: Prisma and reusable errors.
- `src/config/`: validated environment configuration.
- `prisma/`: schema and committed migrations.
- `docs/`: API and database contracts.

Controllers must remain thin. Routes must not access Prisma. Do not create tables during application startup.

## Identity and Authorization

- The gateway authenticates the browser session and forwards its cookie and `x-user-id`. Classroom must validate the cookie through identity's `/session` endpoint before every domain request and reject a mismatched forwarded ID.
- Call `POST /internal/users/resolve` with `INTERNAL_SERVICE_TOKEN`; never query the identity database directly and never copy identity tables into the classroom database.
- Only an active `TEACHER` may create a classroom. Only its owning teacher may delete it, view its roster, or remove a student.
- Only an active `STUDENT` may join or leave a classroom. A student may view only classrooms where they have an enrollment.
- An enrollment stores only the identity user UUID. Roster reads resolve current profile data from identity. Missing identity records are returned as unavailable roster entries so teachers can still remove stale enrollments.
- The classroom service must not be publicly exposed; browser traffic goes through gateway port `4000` under `/api/v1/classrooms`.

## Database Workflow

Classroom uses Prisma `7.10.0` and its own PostgreSQL database/container, connection, migrations, and volume. There are deliberately no cross-database foreign keys to identity IDs. After changing `prisma/schema.prisma`, commit a migration and run:

```sh
npm run db:generate --workspace @icarus/classroom-service
npm run check-types --workspace @icarus/classroom-service
```

Container startup runs `prisma migrate deploy`. Never use `db push` for shared or production environments.

## Routes and Environment

The service listens internally on port `4002`; the gateway exposes the routes under `/api/v1/classrooms`. Required environment values are `DATABASE_URL`, `IDENTITY_URL`, and a shared `INTERNAL_SERVICE_TOKEN` of at least 32 characters. Keep `docs/API.md`, `docs/DATABASE.md`, `.env.example`, root `AGENTS.md`, gateway routing, and Docker Compose synchronized when the contract changes.

## Shared Contract, Consumers, and Verification

- Public request and response schemas live in `packages/contracts/src/classroom.ts`. Reuse them instead of defining a competing join-code or classroom shape.
- `apps/teacher/app/classes/page.tsx` is the owner-management consumer. It creates and deletes classrooms, exposes the generated code, paginates rosters, and removes enrollments.
- `apps/student/app/classes/page.tsx` is the membership consumer. It joins by eight-character code, lists memberships, and leaves with explicit confirmation.
- Keep response keys exactly `classroom`, `classrooms`, `students`, and `nextCursor`; frontend consumers depend on those names.
- Run `npm run test --workspace @icarus/classroom-service`, `npm run lint --workspace @icarus/classroom-service`, and `npm run check-types --workspace @icarus/classroom-service`. Also test the shared contracts and build both consumer apps.
- Live verification must create a disposable classroom through the gateway, join it as the demo student, resolve the teacher roster, exercise leave and teacher removal, and delete the disposable classroom.
