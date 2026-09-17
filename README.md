# ICARUS

ICARUS is a classroom assessment platform built as an npm/Turborepo monorepo.
It includes separate student, teacher, and administrator Next.js applications,
an API gateway, and isolated identity, classroom, assessment, execution, and
integrity services.

## Local development

Requirements:

- Node.js 24 or newer
- npm 11.6.1
- Docker Desktop with Docker Compose

Copy `.env.example` to `.env`, replace the local-only secrets, and create the
ignored Judge0 configuration:

```sh
cp .env.example .env
cp infra/judge0/judge0.conf.example infra/judge0/judge0.conf
docker compose up -d --build
```

The local endpoints are:

- Student: `http://localhost:3000`
- Teacher: `http://localhost:3001`
- Administrator: `http://localhost:3002`
- API gateway: `http://localhost:4000`
- Identity PostgreSQL: `localhost:5433`
- Classroom PostgreSQL: `localhost:5434`
- Assessment PostgreSQL: `localhost:5435`
- Integrity PostgreSQL: `localhost:5436`
- Redis: `localhost:6380`

## Validation

```sh
npm run lint
npm run check-types
npm run test
npm run build
```

Committed Prisma migrations are applied by each database-backed container during
startup. See [Deployment](docs/DEPLOYMENT.md) for staging, production, TLS,
secrets, and GitHub environment setup.
