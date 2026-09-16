# ICARUS Identity Service

The identity microservice provides passwordless Google OAuth, opaque database-backed sessions, college administrator bootstrap, role/status management, teacher provisioning, CSV imports, and audit logs.

It listens on internal port `8000`. Browser clients use the API Gateway at `http://localhost:4000/api/v1/auth`.

## Setup

1. Copy the root `.env.example` to `.env` and provide the Google OAuth values.
2. Register this redirect URI in Google Cloud: `http://localhost:4000/api/v1/auth/oauth/google/callback`.
3. Start the Docker environment. The service runs committed Prisma migrations and creates the configured administrator as a pending account.
4. Sign in with the Google account matching `PLATFORM_ADMIN_EMAIL`; the first successful OAuth login activates it.

Useful workspace commands:

```sh
npm run db:generate --workspace @icarus/identity-service
npm run db:migrate --workspace @icarus/identity-service
npm run db:deploy --workspace @icarus/identity-service
npm run db:studio --workspace @icarus/identity-service
npm run check-types --workspace @icarus/identity-service
npm run lint --workspace @icarus/identity-service
```

See `docs/API.md` for routes and `docs/DATABASE.md` for ownership and schema details.

## Environment contract

Required values:

- `DATABASE_URL`: PostgreSQL connection owned by the identity service.
- `INTERNAL_SERVICE_TOKEN`: at least 32 random characters, shared only with trusted backend services such as classroom.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth web-client credentials.
- `PLATFORM_ADMIN_EMAIL`: verified Google email for the initial administrator.

Application URLs determine the OAuth callback and role-based redirects. Student self-registration is disabled unless `STUDENT_SELF_REGISTRATION=true`; when enabled, `ALLOWED_EMAIL_DOMAINS` restricts which verified domains can register. Copy `services/identity/.env.example` for the complete list and safe local defaults.
