CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "EditorAction" AS ENUM ('TYPE', 'PASTE', 'DELETE', 'REPLACE', 'UNDO', 'REDO', 'FOCUS_LOST', 'FOCUS_GAINED');
CREATE TYPE "ReportSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

CREATE TABLE "integrity_session" (
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "policy" JSONB NOT NULL,
  "attempt_started_at" TIMESTAMPTZ(3) NOT NULL,
  "attempt_expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "integrity_session_pkey" PRIMARY KEY ("attempt_id", "question_id")
);

CREATE TABLE "editor_event" (
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "action" "EditorAction" NOT NULL,
  "inserted_characters" INTEGER NOT NULL,
  "deleted_characters" INTEGER NOT NULL,
  "document_length" INTEGER NOT NULL,
  "cursor_line" INTEGER NOT NULL,
  "checksum" VARCHAR(128) NOT NULL,
  "idle_milliseconds" INTEGER NOT NULL,
  "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "editor_event_pkey" PRIMARY KEY ("attempt_id", "question_id", "sequence")
);

CREATE TABLE "integrity_report" (
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "event_count" INTEGER NOT NULL,
  "signals" JSONB NOT NULL,
  "sync_status" "ReportSyncStatus" NOT NULL DEFAULT 'PENDING',
  "sync_attempts" INTEGER NOT NULL DEFAULT 0,
  "sync_error" TEXT,
  "analyzed_at" TIMESTAMPTZ(3) NOT NULL,
  "synced_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "integrity_report_pkey" PRIMARY KEY ("attempt_id", "question_id")
);

CREATE INDEX "integrity_session_student_id_updated_at_idx" ON "integrity_session"("student_id", "updated_at");
CREATE INDEX "integrity_session_updated_at_idx" ON "integrity_session"("updated_at");
CREATE INDEX "editor_event_attempt_id_question_id_occurred_at_idx" ON "editor_event"("attempt_id", "question_id", "occurred_at");
CREATE INDEX "editor_event_occurred_at_idx" ON "editor_event"("occurred_at");
CREATE INDEX "integrity_report_sync_status_updated_at_idx" ON "integrity_report"("sync_status", "updated_at");

ALTER TABLE "editor_event" ADD CONSTRAINT "editor_event_attempt_id_question_id_fkey" FOREIGN KEY ("attempt_id", "question_id") REFERENCES "integrity_session"("attempt_id", "question_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integrity_report" ADD CONSTRAINT "integrity_report_attempt_id_question_id_fkey" FOREIGN KEY ("attempt_id", "question_id") REFERENCES "integrity_session"("attempt_id", "question_id") ON DELETE CASCADE ON UPDATE CASCADE;
