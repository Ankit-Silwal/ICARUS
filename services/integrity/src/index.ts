import { z } from "zod";
import {
  EditorEventSchema,
  IntegrityPolicySchema,
  analyzeEditorEvents,
  defaultIntegrityThresholds,
  type EditorEvent,
  type IntegritySignal,
} from "@icarus/contracts";
import {
  actor,
  createService,
  database,
  listen,
  validate,
} from "@icarus/service-kit";

const app = createService("integrity");
const sql = database();
const events = new Map<string, EditorEvent[]>();
const assessmentUrl = process.env.ASSESSMENT_URL ?? "http://localhost:4003";
const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? "";

async function bootstrap() {
  await sql`create schema if not exists integrity`;
  await sql`create table if not exists integrity.editor_event (attempt_id uuid not null, question_id uuid not null, sequence int not null, payload jsonb not null, occurred_at timestamptz not null, primary key(attempt_id, question_id, sequence))`;
}

async function loadAttemptContext(
  attemptId: string,
  questionId: string,
  user: ReturnType<typeof actor>,
) {
  const response = await fetch(
    `${assessmentUrl}/internal/attempts/${attemptId}/questions/${questionId}`,
    {
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-user-id": user.id,
        "x-user-role": user.role,
      },
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) {
    throw new Error("The assessment attempt could not be validated.");
  }
  const payload = (await response.json()) as { integrityPolicy: unknown };
  return IntegrityPolicySchema.parse(payload.integrityPolicy);
}

async function syncSignals(attemptId: string, signals: IntegritySignal[]) {
  const response = await fetch(
    `${assessmentUrl}/internal/attempts/${attemptId}/integrity-flags`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${internalToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ signals }),
      signal: AbortSignal.timeout(5_000),
    },
  );
  return response.ok;
}

app.post(
  "/events",
  validate(
    z.object({
      attemptId: z.string().uuid(),
      questionId: z.string().uuid(),
      events: z.array(EditorEventSchema).min(1).max(100),
    }),
  ),
  async (request, response) => {
    await loadAttemptContext(
      request.body.attemptId,
      request.body.questionId,
      actor(request),
    );
    const key = `${request.body.attemptId}:${request.body.questionId}`;
    const current = events.get(key) ?? [];
    const bySequence = new Map(
      [...current, ...request.body.events].map((event) => [
        event.sequence,
        event,
      ]),
    );
    events.set(
      key,
      [...bySequence.values()].sort((a, b) => a.sequence - b.sequence),
    );
    for (const event of request.body.events) {
      await sql`insert into integrity.editor_event (attempt_id, question_id, sequence, payload, occurred_at) values (${request.body.attemptId}, ${request.body.questionId}, ${event.sequence}, ${sql.json(event)}, ${event.occurredAt}) on conflict do nothing`;
    }
    response.status(202).json({ accepted: request.body.events.length });
  },
);

app.get("/reports/:attemptId/:questionId", async (request, response) => {
  const attemptId = z.string().uuid().parse(request.params.attemptId);
  const questionId = z.string().uuid().parse(request.params.questionId);
  const policy = await loadAttemptContext(
    attemptId,
    questionId,
    actor(request),
  );
  const key = `${attemptId}:${questionId}`;
  const stored = (
    await sql`select payload from integrity.editor_event where attempt_id=${attemptId} and question_id=${questionId} order by sequence`
  ).map((row) => EditorEventSchema.parse(row.payload));
  const allEvents = stored.length > 0 ? stored : (events.get(key) ?? []);
  const signals = analyzeEditorEvents(allEvents, {
    ...defaultIntegrityThresholds,
    burstCharactersPerSecond: policy.typingSpeedCharactersPerSecond,
    idleMilliseconds: policy.idleThresholdMilliseconds,
  });
  const assessmentSync = await syncSignals(attemptId, signals);
  response.json({
    report: {
      attemptId,
      questionId,
      eventCount: allEvents.length,
      signals,
      assessmentSync,
      disclaimer:
        "Signals are editing heuristics for teacher review, not proof of misconduct.",
    },
  });
});

app.delete(
  "/retention/expired",
  validate(z.object({ before: z.iso.datetime() })),
  async (request, response) => {
    if (actor(request).role !== "ADMIN") {
      return response.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only administrators can delete retained events.",
        },
      });
    }
    const removed = (
      await sql`delete from integrity.editor_event where occurred_at < ${request.body.before} returning sequence`
    ).length;
    response.json({ removed });
  },
);

void bootstrap().then(() => listen(app, Number(process.env.PORT ?? 4005)));
