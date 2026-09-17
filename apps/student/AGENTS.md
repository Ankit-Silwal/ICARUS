# Student Classroom, Assessment, and Integrity Rules

- The classroom workspace lives at `/classes`. Load memberships from `GET /api/v1/classrooms/classes`, join only through `POST /classes/join` using the shared eight-character unambiguous code contract, and leave only after explicit confirmation.
- Classroom response keys are `classroom` for one item and `classrooms` for a list. Reuse `@icarus/contracts` types and do not introduce six-character or locally incompatible classroom shapes.
- Keep the dashboard classroom count and `/classes` navigation connected to live classroom data. Display service validation messages without exposing internal details.

- Assessment discovery lives at `/exams`; calculate availability from the server-provided status and time window, and link only currently available exams into the active workspace. Published grades live at `/results` and must display the automatic score, teacher-approved reduction, deduction, reason, and final score returned by assessment.
- Keep dashboard exam counts, completed totals, average score, next-assessment card, and navigation connected to live assessment data. Do not reintroduce placeholder scores, dates, or exam content.

- The exam workspace must load the assessment snapshot and attempt from the assessment API. Do not hard-code exam IDs, question IDs, titles, prompts, options, tests, languages, marks, or starter code; the only accepted exam identifier comes from the `examId` query parameter.
- Render both MCQ and coding questions from the sanitized student snapshot. Hidden tests and MCQ answers must never be requested, inferred, or displayed.
- Autosave each answer with its own monotonically increasing version. Manual and timeout submission must flush all answers and queued integrity events before finalizing the attempt, then submit every coding answer to execution. Guard timeout submission so it runs once; the service determines whether the attempt is `SUBMITTED` or `AUTO_SUBMITTED` from its expiry.
- Integrity telemetry is collected only for coding questions when the immutable exam policy enables it. Sequence numbers are scoped independently to each attempt/question, exact failed batches are retried, focus transitions are recorded, and telemetry failures must never discard the student's answer.
- Keep the disclosure that editing signals are review heuristics and never alter marks automatically.
- Validate changes with `npm run lint --workspace student` and `npm run build --workspace student`, then exercise `/classes`, `/exams`, `/exam?examId=<scheduled-exam-uuid>`, and `/results` with a local student session as applicable.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
