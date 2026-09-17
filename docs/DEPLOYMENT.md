# Deployment

ICARUS deploys as one Docker Compose stack on a Linux host. Caddy is the only
public-facing container and obtains TLS certificates automatically. PostgreSQL,
Redis, Judge0, and all backend services remain on the private Compose network.

## Host prerequisites

- A Linux host with Docker Engine and Docker Compose 2.24.4 or newer.
- Judge0 requires cgroup v1. On Ubuntu 22.04, add
  `systemd.unified_cgroup_hierarchy=0` to `GRUB_CMDLINE_LINUX`, run
  `sudo update-grub`, reboot, and confirm `/sys/fs/cgroup/memory` exists.
  Judge0 code execution is not supported on Docker Desktop for Windows or
  macOS; use the Linux deployment host for end-to-end runner verification.
- Ports 80 and 443 open to the internet.
- Four DNS records pointing to the host: API, student, teacher, and admin.
- A checkout of this repository at a fixed deployment path.
- A deploy-only SSH key and a read-only Git credential for this repository.

## Environment setup

Create `.env.staging` or `.env.production` on the host from
`.env.deploy.example`. Generate secrets rather than reusing development values:

```sh
openssl rand -hex 24 # POSTGRES_PASSWORD
openssl rand -hex 32 # INTERNAL_SERVICE_TOKEN
```

The PostgreSQL password must be URL-safe because it is interpolated into service
connection URLs. Set `COOKIE_DOMAIN` to the shared parent domain, including its
leading dot. Configure the Google OAuth callback as:

```text
https://<API_DOMAIN>/api/v1/auth/oauth/google/callback
```

Create the ignored Judge0 configuration separately:

```sh
cp infra/judge0/judge0.conf.example infra/judge0/judge0.conf
```

Replace both Judge0 password placeholders with independent random values. Keep
both environment files and `judge0.conf` readable only by the deployment user.

## First deployment

Validate the resolved configuration before starting it:

```sh
test -d /sys/fs/cgroup/memory
docker compose --env-file .env.staging \
  -f docker-compose.yml \
  -f docker-compose.deploy.yml \
  config --quiet
```

Then build and start the stack:

```sh
docker compose --env-file .env.staging \
  -f docker-compose.yml \
  -f docker-compose.deploy.yml \
  up -d --build
```

The identity, classroom, assessment, and integrity containers apply committed
Prisma migrations before starting their processes. Never use `prisma db push` on
a deployed environment.

## GitHub deployment environments

Create `staging` and `production` environments in GitHub. Add these secrets to
each environment:

- `DEPLOY_HOST`: deployment host name or IP address.
- `DEPLOY_USER`: restricted deployment user.
- `DEPLOY_SSH_KEY`: private key for that user.
- `DEPLOY_KNOWN_HOSTS`: pinned `ssh-keyscan` output for the host.

Add these environment variables:

- `DEPLOY_PATH`: absolute repository path on the host.
- `HEALTHCHECK_URL`: public API origin, such as
  `https://api.staging.example.edu`.

Run the `Deploy` workflow manually and select `staging`. Configure required
reviewers on the `production` GitHub environment before enabling production
deployments.

## Release verification

After each deployment:

1. Confirm `GET /health` returns HTTP 200 through the public API domain.
2. Confirm the student, teacher, and administrator sites load over HTTPS.
3. Exercise login and the classroom create/join/roster/leave/delete lifecycle.
4. Exercise the assessment authoring/start/save/submit/review/publish lifecycle.
5. Confirm integrity events, reports, and assessment synchronization.
6. Restart the stack and verify that database data remains present.

Back up all four ICARUS PostgreSQL volumes before schema changes and before each
production release. Judge0's database is operational infrastructure and should
be backed up separately if retaining its execution history matters.
