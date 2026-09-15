import { z } from "zod";
import { QuestionInputSchema, QuestionSchema, calculateFinalScore, type Exam, type Question } from "@icarus/contracts";
import { actor, createService, database, listen, validate } from "@icarus/service-kit";
import { scoreMcq } from "./scoring.js";

const app = createService("assessment");
const sql = database();

const demoQuestions: Question[] = [
  { id: "20000000-0000-4000-8000-000000000001", kind: "MCQ", title: "Runtime reasoning", prompt: "What is the average lookup complexity of a well-distributed hash table?", points: 4, options: [{ id: "a", label: "O(1)" }, { id: "b", label: "O(log n)" }, { id: "c", label: "O(n)" }, { id: "d", label: "O(n log n)" }], correctOptionId: "a" },
  { id: "20000000-0000-4000-8000-000000000002", kind: "CODE", title: "Two Sum", prompt: "Return the indices of two values whose sum equals target.", points: 16, functionName: "twoSum", languages: ["cpp", "java", "python", "javascript"], starterCode: { cpp: "vector<int> twoSum(vector<int>& nums, int target) {\n  // Write your solution\n}", java: "public int[] twoSum(int[] nums, int target) {\n  // Write your solution\n}", python: "def twoSum(nums, target):\n    # Write your solution\n    pass", javascript: "function twoSum(nums, target) {\n  // Write your solution\n}" }, tests: [{ id: "sample-1", label: "Sample 1", input: [[2, 7, 11, 15], 9], expected: [0, 1], weight: 0, visibility: "SAMPLE" }, { id: "hidden-1", label: "Hidden 1", input: [[3, 2, 4], 6], expected: [1, 2], weight: 8, visibility: "HIDDEN" }, { id: "hidden-2", label: "Hidden 2", input: [[3, 3], 6], expected: [0, 1], weight: 8, visibility: "HIDDEN" }], source: { provider: "LEETCODE", problemNumber: 1, url: "https://leetcode.com/problems/two-sum/" } },
];
const demoExam: Exam = { id: "30000000-0000-4000-8000-000000000001", classId: "10000000-0000-4000-8000-000000000001", title: "Arrays & Hashing · Midterm", startsAt: "2026-09-01T00:00:00.000Z", endsAt: "2026-12-01T00:00:00.000Z", durationMinutes: 75, attemptLimit: 1, status: "SCHEDULED", questions: demoQuestions };

type AttemptRow = {
  id: string; exam_id: string; student_id: string; status: string; started_at: Date; expires_at: Date;
  answers: Record<string, { answer: unknown; version: number; savedAt: string }>;
  automatic_score: string; deduction: string; deduction_reason: string | null;
};

function json(value: unknown) { return sql.json(JSON.parse(JSON.stringify(value))); }
function attemptDto(row: AttemptRow) {
  const automaticScore = Number(row.automatic_score);
  const deduction = Number(row.deduction);
  return { id: row.id, examId: row.exam_id, studentId: row.student_id, status: row.status, startedAt: row.started_at.toISOString(), expiresAt: row.expires_at.toISOString(), answers: row.answers, automaticScore, deduction, deductionReason: row.deduction_reason ?? undefined, finalScore: calculateFinalScore(automaticScore, deduction) };
}
async function getExam(id: string): Promise<Exam | null> {
  const row = (await sql`select payload, status from assessment.exam where id=${id}`)[0];
  return row ? ExamSchemaCompat(row.payload, row.status) : null;
}
function ExamSchemaCompat(payload: unknown, status: unknown): Exam {
  const parsed = z.object({ id: z.string(), classId: z.string(), title: z.string(), startsAt: z.string(), endsAt: z.string(), durationMinutes: z.number(), attemptLimit: z.number(), questions: z.array(QuestionSchema) }).parse(payload);
  return { ...parsed, id: parsed.id, classId: parsed.classId, status: z.enum(["DRAFT", "SCHEDULED", "CLOSED", "REVIEW", "PUBLISHED"]).parse(status) };
}

async function bootstrap() {
  await sql`create schema if not exists assessment`;
  await sql`create table if not exists assessment.question (id uuid primary key, teacher_id uuid not null, payload jsonb not null, created_at timestamptz not null default now())`;
  await sql`create table if not exists assessment.exam (id uuid primary key, class_id uuid not null, teacher_id uuid not null, payload jsonb not null, status text not null, created_at timestamptz not null default now())`;
  await sql`create table if not exists assessment.attempt (id uuid primary key, exam_id uuid not null, student_id uuid not null, status text not null, started_at timestamptz not null, expires_at timestamptz not null, answers jsonb not null default '{}', automatic_score numeric not null default 0, deduction numeric not null default 0, deduction_reason text, submitted_at timestamptz, unique(exam_id, student_id))`;
  await sql`alter table assessment.attempt add column if not exists mcq_score numeric not null default 0`;
  await sql`create table if not exists assessment.code_result (attempt_id uuid not null references assessment.attempt(id), question_id uuid not null, score numeric not null, details jsonb not null, judged_at timestamptz not null default now(), primary key(attempt_id, question_id))`;
  for (const question of demoQuestions) await sql`insert into assessment.question (id, teacher_id, payload) values (${question.id}, '00000000-0000-4000-8000-000000000002', ${json(question)}) on conflict (id) do nothing`;
  await sql`insert into assessment.exam (id, class_id, teacher_id, payload, status) values (${demoExam.id}, ${demoExam.classId}, '00000000-0000-4000-8000-000000000002', ${json(demoExam)}, ${demoExam.status}) on conflict (id) do nothing`;
}

app.get("/questions", async (request, response) => {
  const user = actor(request);
  if (user.role !== "TEACHER") return response.status(403).json({ error: { code: "FORBIDDEN", message: "Only teachers can view the question bank." } });
  const rows = await sql`select payload from assessment.question where teacher_id=${user.id} order by created_at desc`;
  response.json({ questions: rows.map((row) => QuestionSchema.parse(row.payload)) });
});

app.get("/internal/questions/:questionId", async (request, response) => {
  const row = (await sql`select payload from assessment.question where id=${String(request.params.questionId)}`)[0];
  if (!row) return response.status(404).json({ error: { code: "QUESTION_NOT_FOUND", message: "Question not found." } });
  response.json({ question: QuestionSchema.parse(row.payload) });
});

app.post("/questions", validate(QuestionInputSchema), async (request, response) => {
  const user = actor(request);
  if (user.role !== "TEACHER") return response.status(403).json({ error: { code: "FORBIDDEN", message: "Only teachers can author questions." } });
  const question = QuestionSchema.parse({ ...request.body, id: crypto.randomUUID() });
  if (question.kind === "CODE" && question.tests.reduce((sum, test) => sum + test.weight, 0) !== question.points) return response.status(400).json({ error: { code: "INVALID_TEST_WEIGHT", message: "Test weights must equal the question points." } });
  await sql`insert into assessment.question (id, teacher_id, payload) values (${question.id}, ${user.id}, ${json(question)})`;
  response.status(201).json({ question });
});

app.get("/exams", async (request, response) => {
  const user = actor(request);
  const rows = user.role === "TEACHER" ? await sql`select payload, status from assessment.exam where teacher_id=${user.id} order by created_at desc` : await sql`select payload, status from assessment.exam where status in ('SCHEDULED','PUBLISHED') order by created_at desc`;
  const list = rows.map((row) => ExamSchemaCompat(row.payload, row.status)).map(({ questions, ...exam }) => ({ ...exam, questionCount: questions.length, totalPoints: questions.reduce((sum, question) => sum + question.points, 0) }));
  response.json({ exams: list });
});

app.get("/exams/:examId", async (request, response) => {
  const exam = await getExam(String(request.params.examId));
  if (!exam) return response.status(404).json({ error: { code: "EXAM_NOT_FOUND", message: "Exam not found." } });
  const sanitized = actor(request).role === "STUDENT" ? { ...exam, questions: exam.questions.map((question) => question.kind === "MCQ" ? (({ correctOptionId: _, ...safe }) => safe)(question) : { ...question, tests: question.tests.filter((test) => test.visibility === "SAMPLE") }) } : exam;
  response.json({ exam: sanitized });
});

app.post("/exams", validate(z.object({ classId: z.string().uuid(), title: z.string().min(2), startsAt: z.string().datetime(), endsAt: z.string().datetime(), durationMinutes: z.number().int().positive(), attemptLimit: z.number().int().positive().default(1), questionIds: z.array(z.string().uuid()).min(1) })), async (request, response) => {
  const user = actor(request);
  if (user.role !== "TEACHER") return response.status(403).json({ error: { code: "FORBIDDEN", message: "Only teachers can create exams." } });
  const rows = await sql`select payload from assessment.question where teacher_id=${user.id} and id in ${sql(request.body.questionIds)}`;
  const selected = rows.map((row) => QuestionSchema.parse(row.payload));
  if (selected.length !== request.body.questionIds.length) return response.status(400).json({ error: { code: "QUESTION_NOT_FOUND", message: "One or more questions do not exist." } });
  const exam: Exam = { ...request.body, id: crypto.randomUUID(), status: "DRAFT", questions: structuredClone(selected) };
  await sql`insert into assessment.exam (id, class_id, teacher_id, payload, status) values (${exam.id}, ${exam.classId}, ${user.id}, ${json(exam)}, ${exam.status})`;
  response.status(201).json({ exam });
});

app.post("/exams/:examId/start", async (request, response) => {
  const exam = await getExam(String(request.params.examId));
  if (!exam) return response.status(404).json({ error: { code: "EXAM_NOT_FOUND", message: "Exam not found." } });
  const user = actor(request);
  if (user.role !== "STUDENT") return response.status(403).json({ error: { code: "FORBIDDEN", message: "Only students can start attempts." } });
  const existing = (await sql`select * from assessment.attempt where exam_id=${exam.id} and student_id=${user.id}`)[0] as AttemptRow | undefined;
  if (existing) return response.json({ attempt: attemptDto(existing) });
  const now = new Date();
  if (now < new Date(exam.startsAt) || now > new Date(exam.endsAt)) return response.status(409).json({ error: { code: "EXAM_NOT_AVAILABLE", message: "The exam is outside its scheduled window." } });
  const expiresAt = new Date(Math.min(new Date(exam.endsAt).getTime(), now.getTime() + exam.durationMinutes * 60_000));
  const id = crypto.randomUUID();
  const row = (await sql`insert into assessment.attempt (id, exam_id, student_id, status, started_at, expires_at) values (${id}, ${exam.id}, ${user.id}, 'IN_PROGRESS', ${now}, ${expiresAt}) returning *`)[0] as AttemptRow;
  response.status(201).json({ attempt: attemptDto(row) });
});

app.put("/attempts/:attemptId/autosave", validate(z.object({ questionId: z.string().uuid(), answer: z.unknown(), version: z.number().int().positive() })), async (request, response) => {
  const user = actor(request);
  const row = (await sql`select * from assessment.attempt where id=${String(request.params.attemptId)} and student_id=${user.id} for update`)[0] as AttemptRow | undefined;
  if (!row || row.status !== "IN_PROGRESS") return response.status(409).json({ error: { code: "ATTEMPT_NOT_ACTIVE", message: "This attempt is no longer active." } });
  if (Date.now() >= row.expires_at.getTime()) {
    await sql`update assessment.attempt set status='AUTO_SUBMITTED', submitted_at=now() where id=${row.id}`;
    return response.status(409).json({ error: { code: "ATTEMPT_EXPIRED", message: "Time expired and the attempt was submitted." } });
  }
  const priorVersion = row.answers?.[request.body.questionId]?.version ?? 0;
  if (request.body.version <= priorVersion) return response.json({ savedAt: row.answers[request.body.questionId]?.savedAt, status: row.status, version: priorVersion, duplicate: true });
  const savedAt = new Date().toISOString();
  const answers = { ...(row.answers ?? {}), [request.body.questionId]: { answer: request.body.answer, version: request.body.version, savedAt } };
  await sql`update assessment.attempt set answers=${json(answers)} where id=${row.id}`;
  response.json({ savedAt, status: row.status, version: request.body.version });
});

app.post("/attempts/:attemptId/submit", async (request, response) => {
  const user = actor(request);
  const row = (await sql`select * from assessment.attempt where id=${String(request.params.attemptId)} and student_id=${user.id}`)[0] as AttemptRow | undefined;
  if (!row) return response.status(404).json({ error: { code: "ATTEMPT_NOT_FOUND", message: "Attempt not found." } });
  if (row.status !== "IN_PROGRESS") return response.json({ attempt: attemptDto(row), duplicate: true });
  const exam = await getExam(row.exam_id);
  if (!exam) return response.status(404).json({ error: { code: "EXAM_NOT_FOUND", message: "Exam not found." } });
  const mcqScore = exam.questions.filter((question): question is Extract<Question, { kind: "MCQ" }> => question.kind === "MCQ").reduce((sum, question) => sum + scoreMcq(question, row.answers?.[question.id]?.answer), 0);
  const status = Date.now() >= row.expires_at.getTime() ? "AUTO_SUBMITTED" : "SUBMITTED";
  const updated = (await sql`update assessment.attempt set status=${status}, mcq_score=${mcqScore}, automatic_score=${mcqScore}, submitted_at=now() where id=${row.id} returning *`)[0] as AttemptRow;
  response.status(202).json({ attempt: attemptDto(updated), codingQuestions: exam.questions.filter((question) => question.kind === "CODE").map((question) => ({ questionId: question.id, answer: row.answers?.[question.id]?.answer })) });
});

app.patch("/internal/attempts/:attemptId/code-score", validate(z.object({ questionId: z.string().uuid(), score: z.number().nonnegative(), details: z.unknown() })), async (request, response) => {
  const attemptId = String(request.params.attemptId);
  await sql`insert into assessment.code_result (attempt_id, question_id, score, details) values (${attemptId}, ${request.body.questionId}, ${request.body.score}, ${json(request.body.details)}) on conflict (attempt_id, question_id) do update set score=excluded.score, details=excluded.details, judged_at=now()`;
  const row = (await sql`update assessment.attempt set automatic_score=mcq_score+(select coalesce(sum(score),0) from assessment.code_result where attempt_id=${attemptId}) where id=${attemptId} returning *`)[0] as AttemptRow | undefined;
  if (!row) return response.status(404).json({ error: { code: "ATTEMPT_NOT_FOUND", message: "Attempt not found." } });
  response.json({ attempt: attemptDto(row) });
});

app.get("/reviews", async (request, response) => {
  const user = actor(request);
  if (user.role !== "TEACHER") return response.status(403).json({ error: { code: "FORBIDDEN", message: "Only teachers can review attempts." } });
  const rows = await sql`select a.* from assessment.attempt a join assessment.exam e on e.id=a.exam_id where e.teacher_id=${user.id} order by a.started_at desc` as unknown as AttemptRow[];
  response.json({ attempts: rows.map(attemptDto) });
});

app.get("/results", async (request, response) => {
  const user = actor(request);
  const rows = await sql`select a.*, e.payload as exam from assessment.attempt a join assessment.exam e on e.id=a.exam_id where a.student_id=${user.id} and e.status='PUBLISHED' order by a.started_at desc`;
  response.json({ results: rows.map((row) => ({ ...attemptDto(row as AttemptRow), examTitle: z.object({ title: z.string() }).parse(row.exam).title })) });
});

app.patch("/attempts/:attemptId/deduction", validate(z.object({ deduction: z.number().nonnegative(), reason: z.string().min(5) })), async (request, response) => {
  const user = actor(request);
  const current = (await sql`select a.* from assessment.attempt a join assessment.exam e on e.id=a.exam_id where a.id=${String(request.params.attemptId)} and e.teacher_id=${user.id}`)[0] as AttemptRow | undefined;
  if (!current) return response.status(404).json({ error: { code: "ATTEMPT_NOT_FOUND", message: "Attempt not found." } });
  if (request.body.deduction > Number(current.automatic_score)) return response.status(400).json({ error: { code: "INVALID_DEDUCTION", message: "A deduction cannot exceed the automatic score." } });
  const row = (await sql`update assessment.attempt set deduction=${request.body.deduction}, deduction_reason=${request.body.reason}, status='GRADED' where id=${current.id} returning *`)[0] as AttemptRow;
  response.json({ attempt: attemptDto(row) });
});

app.post("/exams/:examId/publish", async (request, response) => {
  const user = actor(request);
  const row = (await sql`update assessment.exam set status='PUBLISHED' where id=${String(request.params.examId)} and teacher_id=${user.id} returning payload`)[0];
  if (!row) return response.status(404).json({ error: { code: "EXAM_NOT_FOUND", message: "Exam not found." } });
  response.json({ exam: ExamSchemaCompat(row.payload, "PUBLISHED") });
});

void bootstrap().then(() => listen(app, Number(process.env.PORT ?? 4003)));
