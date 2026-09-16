CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "classroom" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teacher_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "subject" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "section" VARCHAR(80),
  "academic_year" VARCHAR(40) NOT NULL,
  "join_code" VARCHAR(8) NOT NULL,
  "term_end" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "classroom_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enrollment" (
  "classroom_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enrollment_pkey" PRIMARY KEY ("classroom_id", "student_id")
);

CREATE UNIQUE INDEX "classroom_join_code_key" ON "classroom"("join_code");
CREATE INDEX "classroom_teacher_id_created_at_idx" ON "classroom"("teacher_id", "created_at");
CREATE INDEX "enrollment_student_id_joined_at_idx" ON "enrollment"("student_id", "joined_at");

ALTER TABLE "enrollment"
  ADD CONSTRAINT "enrollment_classroom_id_fkey"
  FOREIGN KEY ("classroom_id") REFERENCES "classroom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
