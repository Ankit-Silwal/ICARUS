# ICARUS Classroom Service

The classroom microservice owns classroom metadata and enrollments. It runs internally on port `4002`; clients use `http://localhost:4000/api/v1/classrooms/classes` through the API Gateway.

## Setup

Copy `.env.example` when running the service outside Docker. The classroom database is separate from identity and defaults to local PostgreSQL port `5433`. `INTERNAL_SERVICE_TOKEN` must exactly match identity.

```sh
npm run db:generate --workspace @icarus/classroom-service
npm run db:migrate --workspace @icarus/classroom-service
npm run db:deploy --workspace @icarus/classroom-service
npm run db:studio --workspace @icarus/classroom-service
npm run check-types --workspace @icarus/classroom-service
npm run lint --workspace @icarus/classroom-service
```

See `docs/API.md` and `docs/DATABASE.md` for the public contract and ownership boundaries.
