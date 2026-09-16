# Assessment API

All public routes are mounted under `/api/v1/assessments` by the gateway.

## Questions

- `GET /questions` — list the signed-in teacher's bank.
- `POST /questions` — create an MCQ or coding question.
- `GET /questions/:questionId` — get an owned question.
- `DELETE /questions/:questionId` — remove a bank item; exam snapshots remain intact.
- `GET /questions/import/leetcode/:problemNumber/preview` — preview public LeetCode metadata, starter snippets, and examples.
- `POST /questions/import/leetcode` — import a public problem and attach teacher-supplied tests.

Coding questions require at least one hidden case. Each test has `input`, `expected`, `visibility`, and `weight`. Samples must have weight `0`; hidden weights must add up to `points`.

## Exams

- `GET|POST /exams`
- `GET /exams/:examId`
- `POST /exams/:examId/schedule`
- `POST /exams/:examId/start`
- `POST /exams/:examId/close`
- `POST /exams/:examId/publish`

An exam copies question payloads when it is created. Students never receive MCQ answers or hidden test cases.

The optional `integrityPolicy` on exam creation contains:

```json
{
  "enabled": true,
  "directPasteReductionPercent": 10,
  "rapidEntryReductionPercent": 5,
  "idleReturnReductionPercent": 5,
  "maximumReductionPercent": 25,
  "typingSpeedCharactersPerSecond": 25,
  "idleThresholdMilliseconds": 10000
}
```

## Attempts and review

- `PUT /attempts/:attemptId/autosave` — versioned/idempotent answer save.
- `POST /attempts/:attemptId/submit` — score MCQs and finalize the attempt.
- `PATCH /attempts/:attemptId/deduction` — teacher applies `{ percentageReduction, reason }`.
- `GET /reviews` — teacher review queue.
- `GET /results` — published student results.

Integrity recommendations do not alter marks automatically. A teacher sees the stored signals and suggested percentage, then explicitly applies or rejects a reduction.

## Internal service routes

These require `Authorization: Bearer <INTERNAL_SERVICE_TOKEN>` and are not gateway routes.

- `GET /internal/attempts/:attemptId/questions/:questionId` — fetch the immutable question snapshot after checking the forwarded actor owns the attempt or exam.
- `PATCH /internal/attempts/:attemptId/code-score` — execution callback; assessment derives the score from passed hidden test IDs.
- `PUT /internal/attempts/:attemptId/integrity-flags` — merge one question's review signals into the attempt and calculate a capped suggestion.
