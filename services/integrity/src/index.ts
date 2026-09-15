import { z } from "zod";
import { EditorEventSchema, analyzeEditorEvents, type EditorEvent } from "@icarus/contracts";
import { createService, database, listen, validate } from "@icarus/service-kit";

const app = createService("integrity");
const sql = database();
const events = new Map<string, EditorEvent[]>();

async function bootstrap() {
  if (!sql) return;
  await sql`create schema if not exists integrity`;
  await sql`create table if not exists integrity.editor_event (attempt_id uuid not null, question_id uuid not null, sequence int not null, payload jsonb not null, occurred_at timestamptz not null, primary key(attempt_id, question_id, sequence))`;
}

app.post("/events", validate(z.object({ attemptId: z.string().uuid(), questionId: z.string().uuid(), events: z.array(EditorEventSchema).max(100) })), async (request, response) => {
  const key = `${request.body.attemptId}:${request.body.questionId}`;
  const current = events.get(key) ?? [];
  const bySequence = new Map([...current, ...request.body.events].map((event) => [event.sequence, event]));
  events.set(key, [...bySequence.values()].sort((a, b) => a.sequence - b.sequence));
  if (sql) {
    for (const event of request.body.events) await sql`insert into integrity.editor_event (attempt_id, question_id, sequence, payload, occurred_at) values (${request.body.attemptId}, ${request.body.questionId}, ${event.sequence}, ${sql.json(event)}, ${event.occurredAt}) on conflict do nothing`;
  }
  response.status(202).json({ accepted: request.body.events.length });
});

app.get("/reports/:attemptId/:questionId", async (request, response) => {
  const key = `${request.params.attemptId}:${request.params.questionId}`;
  const stored = sql ? (await sql`select payload from integrity.editor_event where attempt_id=${request.params.attemptId} and question_id=${request.params.questionId} order by sequence`).map((row) => EditorEventSchema.parse(row.payload)) : events.get(key) ?? [];
  const signals = analyzeEditorEvents(stored);
  response.json({ report: { attemptId: request.params.attemptId, questionId: request.params.questionId, eventCount: stored.length, signals, disclaimer: "Signals are editing heuristics for teacher review, not proof of misconduct." } });
});

app.delete("/retention/expired", validate(z.object({ before: z.string().datetime() })), async (request, response) => {
  const removed = sql ? (await sql`delete from integrity.editor_event where occurred_at < ${request.body.before} returning sequence`).length : 0;
  response.json({ removed });
});

void bootstrap().then(() => listen(app, Number(process.env.PORT ?? 4005)));
