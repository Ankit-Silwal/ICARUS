CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'CLOSED', 'REVIEW', 'PUBLISHED');
CREATE TYPE "AttemptStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'GRADED');

CREATE TABLE "question" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teacher_id" UUID NOT NULL,
  "kind" VARCHAR(16) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "exam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "exam_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "status" "AttemptStatus" NOT NULL DEFAULT 'CREATED',
  "started_at" TIMESTAMPTZ(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "submitted_at" TIMESTAMPTZ(3),
  "mcq_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "code_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "automatic_score" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "applied_reduction_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "suggested_reduction_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "reduction_reason" TEXT,
  "integrity_flags" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "attempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attempt_answer" (
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "answer" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  "saved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attempt_answer_pkey" PRIMARY KEY ("attempt_id", "question_id")
);

CREATE TABLE "code_result" (
  "attempt_id" UUID NOT NULL,
  "question_id" UUID NOT NULL,
  "score" DECIMAL(10,2) NOT NULL,
  "details" JSONB NOT NULL,
  "judged_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "code_result_pkey" PRIMARY KEY ("attempt_id", "question_id")
);

CREATE INDEX "question_teacher_id_created_at_idx" ON "question"("teacher_id", "created_at");
CREATE INDEX "exam_teacher_id_created_at_idx" ON "exam"("teacher_id", "created_at");
CREATE INDEX "exam_class_id_status_starts_at_idx" ON "exam"("class_id", "status", "starts_at");
CREATE UNIQUE INDEX "attempt_exam_id_student_id_attempt_number_key" ON "attempt"("exam_id", "student_id", "attempt_number");
CREATE INDEX "attempt_student_id_created_at_idx" ON "attempt"("student_id", "created_at");
CREATE INDEX "attempt_exam_id_status_idx" ON "attempt"("exam_id", "status");

ALTER TABLE "attempt" ADD CONSTRAINT "attempt_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "code_result" ADD CONSTRAINT "code_result_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
