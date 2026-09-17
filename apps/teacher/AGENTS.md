# Teacher Classroom and Integrity Review Rules

- The classroom management route is `/classes`. Teachers may create classrooms, copy generated join codes, inspect paginated rosters, remove students, and delete only classrooms they own.
- Classroom deletion and roster removal require explicit confirmation. Missing identity profiles remain visible by student UUID so stale enrollments can still be removed.
- Reuse the classroom shapes from `@icarus/contracts`; list responses use `classrooms`, single-item responses use `classroom`, and roster pagination uses `students` plus `nextCursor`.
- Keep dashboard classroom totals and the Classes navigation linked to live classroom data.

- The integrity review route is `/reviews`. Load the queue from `GET /api/v1/assessments/reviews`, reports from `/api/v1/integrity/reports/*`, and raw evidence through the paginated events route.
- Always show assessment synchronization state and errors. Reanalysis must use the integrity reanalyze endpoint so the current analyzer runs and assessment synchronization is retried.
- Signals and suggested reductions are advisory. Never apply a suggestion on page load or reanalysis. A teacher must explicitly approve a percentage with a reason or reject it; rejection is persisted through assessment as zero percent with a review reason.
- Preserve the evidence disclaimer and display raw events read-only. Do not label heuristic signals as cheating or misconduct.
- Validate changes with `npm run lint --workspace teacher` and `npm run build --workspace teacher`, then exercise `/classes` and `/reviews` with a local teacher session as applicable.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
