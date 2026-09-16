# Student Assessment and Integrity Rules

- The exam workspace must load the assessment snapshot and attempt from the assessment API. Do not hard-code exam IDs, question IDs, titles, prompts, options, tests, languages, marks, or starter code; the only accepted exam identifier comes from the `examId` query parameter.
- Render both MCQ and coding questions from the sanitized student snapshot. Hidden tests and MCQ answers must never be requested, inferred, or displayed.
- Autosave each answer with its own monotonically increasing version. Submission must flush all answers and queued integrity events before finalizing the attempt, then submit every coding answer to execution.
- Integrity telemetry is collected only for coding questions when the immutable exam policy enables it. Sequence numbers are scoped independently to each attempt/question, exact failed batches are retried, focus transitions are recorded, and telemetry failures must never discard the student's answer.
- Keep the disclosure that editing signals are review heuristics and never alter marks automatically.
- Validate changes with `npm run lint --workspace student` and `npm run build --workspace student`, then exercise `/exam?examId=<scheduled-exam-uuid>` with a local student session.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
