CREATE SCHEMA IF NOT EXISTS "identity";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "identity"."UserRole" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "identity"."UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "identity"."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "identity"."ImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "identity"."user_account" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "avatar_url" TEXT,
  "role" "identity"."UserRole" NOT NULL,
  "status" "identity"."UserStatus" NOT NULL DEFAULT 'PENDING',
  "email_verified_at" TIMESTAMPTZ(3),
  "last_login_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_account_pkey" PRIMARY KEY ("id")
);

-- Upgrade the earlier visual-prototype table without deleting its rows.
ALTER TABLE "identity"."user_account" DROP CONSTRAINT IF EXISTS "user_account_role_check";
ALTER TABLE "identity"."user_account" ALTER COLUMN "role" TYPE "identity"."UserRole" USING "role"::text::"identity"."UserRole";
ALTER TABLE "identity"."user_account" ADD COLUMN IF NOT EXISTS "status" "identity"."UserStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "identity"."user_account" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ(3);
ALTER TABLE "identity"."user_account" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "identity"."user_account" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "identity"."user_account" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "identity"."user_account" ALTER COLUMN "last_login_at" DROP NOT NULL;
ALTER TABLE "identity"."user_account" ALTER COLUMN "last_login_at" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "identity"."oauth_account" (
  "id" UUID NOT NULL,
  "provider" VARCHAR(40) NOT NULL,
  "provider_account_id" VARCHAR(255) NOT NULL,
  "provider_email" VARCHAR(320) NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "oauth_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "identity"."session" (
  "id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "user_agent" VARCHAR(512),
  "ip_address" VARCHAR(64),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "identity"."oauth_state" (
  "id" UUID NOT NULL,
  "state_hash" CHAR(64) NOT NULL,
  "code_verifier" VARCHAR(128) NOT NULL,
  "nonce" VARCHAR(128) NOT NULL,
  "return_to" TEXT,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_state_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "identity"."teacher_profile" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "employee_id" VARCHAR(80),
  "department" VARCHAR(160),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "teacher_profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "identity"."teacher_invitation" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "status" "identity"."InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invited_by" UUID,
  "expires_at" TIMESTAMPTZ(3),
  "accepted_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "teacher_invitation_pkey" PRIMARY KEY ("id")
);

-- Upgrade the earlier visual-prototype invitation table in place.
ALTER TABLE "identity"."teacher_invitation" ADD COLUMN IF NOT EXISTS "id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "identity"."teacher_invitation" ADD COLUMN IF NOT EXISTS "status" "identity"."InvitationStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "identity"."teacher_invitation" ADD COLUMN IF NOT EXISTS "invited_by" UUID;
ALTER TABLE "identity"."teacher_invitation" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(3);
ALTER TABLE "identity"."teacher_invitation" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ(3);
ALTER TABLE "identity"."teacher_invitation" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "identity"."teacher_invitation" ALTER COLUMN "id" SET NOT NULL;
ALTER TABLE "identity"."teacher_invitation" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "identity"."teacher_invitation" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "identity"."teacher_invitation" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "identity"."teacher_invitation" DROP CONSTRAINT IF EXISTS "teacher_invitation_pkey";
ALTER TABLE "identity"."teacher_invitation" ADD CONSTRAINT "teacher_invitation_pkey" PRIMARY KEY ("id");

CREATE TABLE IF NOT EXISTS "identity"."teacher_import" (
  "id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "status" "identity"."ImportStatus" NOT NULL DEFAULT 'PROCESSING',
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "imported_rows" INTEGER NOT NULL DEFAULT 0,
  "rejected_rows" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "created_by_id" UUID NOT NULL,
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_import_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "identity"."audit_log" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(120) NOT NULL,
  "entity_type" VARCHAR(80) NOT NULL,
  "entity_id" VARCHAR(255),
  "metadata" JSONB,
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_account_email_key" ON "identity"."user_account"("email");
CREATE INDEX IF NOT EXISTS "user_account_role_status_idx" ON "identity"."user_account"("role", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_account_provider_provider_account_id_key" ON "identity"."oauth_account"("provider", "provider_account_id");
CREATE INDEX IF NOT EXISTS "oauth_account_user_id_idx" ON "identity"."oauth_account"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "session_token_hash_key" ON "identity"."session"("token_hash");
CREATE INDEX IF NOT EXISTS "session_user_id_expires_at_idx" ON "identity"."session"("user_id", "expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_state_state_hash_key" ON "identity"."oauth_state"("state_hash");
CREATE INDEX IF NOT EXISTS "oauth_state_expires_at_idx" ON "identity"."oauth_state"("expires_at");
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_profile_user_id_key" ON "identity"."teacher_profile"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_profile_employee_id_key" ON "identity"."teacher_profile"("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "teacher_invitation_email_key" ON "identity"."teacher_invitation"("email");
CREATE INDEX IF NOT EXISTS "teacher_invitation_status_expires_at_idx" ON "identity"."teacher_invitation"("status", "expires_at");
CREATE INDEX IF NOT EXISTS "teacher_import_created_by_id_created_at_idx" ON "identity"."teacher_import"("created_by_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_log_actor_id_created_at_idx" ON "identity"."audit_log"("actor_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_log_entity_type_entity_id_idx" ON "identity"."audit_log"("entity_type", "entity_id");

ALTER TABLE "identity"."oauth_account" ADD CONSTRAINT "oauth_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity"."session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity"."teacher_profile" ADD CONSTRAINT "teacher_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity"."user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "identity"."teacher_import" ADD CONSTRAINT "teacher_import_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "identity"."user_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "identity"."audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "identity"."user_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
