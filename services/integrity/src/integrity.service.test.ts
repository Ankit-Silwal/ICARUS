import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.INTERNAL_SERVICE_TOKEN =
    "test-internal-service-token-at-least-32";
  const eventRows: Array<Record<string, unknown>> = [];
  let report: Record<string, unknown> | null = null;
  const transaction = {
    editorEvent: {
      findMany: vi.fn(
        async ({ where }: { where: { sequence: { in: number[] } } }) =>
          eventRows.filter((row) =>
            where.sequence.in.includes(row.sequence as number),
          ),
      ),
      createMany: vi.fn(
        async ({ data }: { data: Array<Record<string, unknown>> }) => {
          eventRows.push(...data);
          return { count: data.length };
        },
      ),
      deleteMany: vi.fn(async () => ({ count: 4 })),
    },
    integritySession: {
      upsert: vi.fn(async () => ({})),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (input: unknown) =>
      typeof input === "function"
        ? (input as (value: typeof transaction) => unknown)(transaction)
        : input,
    ),
    editorEvent: {
      findMany: vi.fn(async () => [...eventRows]),
    },
    integrityReport: {
      upsert: vi.fn(
        async ({
          create,
          update,
        }: {
          create: Record<string, unknown>;
          update: Record<string, unknown>;
        }) => {
          report = report ? { ...report, ...update } : { ...create };
          return report;
        },
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const syncAttempts =
          ((report?.syncAttempts as number | undefined) ?? 0) +
          (typeof data.syncAttempts === "object" ? 1 : 0);
        report = { ...report, ...data, syncAttempts };
        return report;
      }),
      findUnique: vi.fn(async () => report),
    },
  };
  return {
    eventRows,
    prisma,
    transaction,
    loadContext: vi.fn(),
    syncSignals: vi.fn(),
    resetReport: () => {
      report = null;
    },
  };
});

vi.mock("./lib/prisma.js", () => ({ prisma: mocks.prisma }));
vi.mock("./services/assessment.service.js", () => ({
  assessmentService: {
    loadContext: mocks.loadContext,
    syncSignals: mocks.syncSignals,
  },
}));
vi.mock("./presenters/report.presenter.js", () => ({
  presentReport: (value: unknown) => value,
}));

const actor = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "student@example.edu",
  name: "Student",
  avatarUrl: null,
  role: "STUDENT" as const,
  status: "ACTIVE" as const,
};
const attemptId = "20000000-0000-4000-8000-000000000001";
const questionId = "30000000-0000-4000-8000-000000000001";
const event = {
  sequence: 1,
  occurredAt: "2026-09-16T10:10:00.000Z",
  action: "TYPE" as const,
  insertedCharacters: 1,
  deletedCharacters: 0,
  documentLength: 1,
  cursorLine: 1,
  checksum: "fnv1a-12345678",
  idleMilliseconds: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventRows.length = 0;
  mocks.resetReport();
  mocks.loadContext.mockResolvedValue({
    attempt: {
      id: attemptId,
      studentId: actor.id,
      status: "IN_PROGRESS",
      startedAt: "2026-09-16T10:00:00.000Z",
      expiresAt: "2026-09-16T11:00:00.000Z",
    },
    question: {
      id: questionId,
      kind: "CODE",
      title: "Question",
      prompt: "Prompt",
      points: 10,
      functionName: "solve",
      languages: ["javascript"],
      starterCode: { javascript: "function solve() {}" },
      tests: [
        {
          id: "sample",
          label: "Sample",
          input: [],
          expected: [],
          weight: 0,
          visibility: "SAMPLE",
        },
      ],
    },
    integrityPolicy: {
      enabled: true,
      directPasteReductionPercent: 10,
      rapidEntryReductionPercent: 5,
      idleReturnReductionPercent: 5,
      maximumReductionPercent: 25,
      typingSpeedCharactersPerSecond: 25,
      idleThresholdMilliseconds: 10_000,
    },
  });
  mocks.syncSignals.mockResolvedValue(undefined);
});

describe("IntegrityService", () => {
  it("accepts exact retries as idempotent duplicates", async () => {
    const { integrityService } =
      await import("./services/integrity.service.js");
    const first = await integrityService.ingest(actor, attemptId, questionId, [
      event,
    ]);
    const retry = await integrityService.ingest(actor, attemptId, questionId, [
      event,
    ]);

    expect(first).toMatchObject({ accepted: 1, duplicates: 0 });
    expect(retry).toMatchObject({ accepted: 0, duplicates: 1 });
    expect(mocks.eventRows).toHaveLength(1);
  });

  it("rejects a reused sequence containing different event data", async () => {
    const { integrityService } =
      await import("./services/integrity.service.js");
    await integrityService.ingest(actor, attemptId, questionId, [event]);

    await expect(
      integrityService.ingest(actor, attemptId, questionId, [
        { ...event, documentLength: 2, checksum: "fnv1a-87654321" },
      ]),
    ).rejects.toMatchObject({
      code: "EVENT_SEQUENCE_CONFLICT",
      status: 409,
    });
  });

  it("retains telemetry and records a failed assessment synchronization", async () => {
    const { integrityService } =
      await import("./services/integrity.service.js");
    mocks.syncSignals.mockRejectedValueOnce(new Error("assessment offline"));

    const result = (await integrityService.ingest(
      actor,
      attemptId,
      questionId,
      [event],
    )) as unknown as { report: { syncStatus: string; syncError: string } };

    expect(mocks.eventRows).toHaveLength(1);
    expect(result.report.syncStatus).toBe("FAILED");
    expect(result.report.syncError).toContain("assessment offline");
  });

  it("deletes expired events and now-empty sessions in one transaction", async () => {
    const { integrityService } =
      await import("./services/integrity.service.js");
    const cutoff = new Date("2026-01-01T00:00:00.000Z");

    await expect(integrityService.removeExpired(cutoff)).resolves.toEqual({
      eventsRemoved: 4,
      sessionsRemoved: 1,
    });
    expect(mocks.transaction.editorEvent.deleteMany).toHaveBeenCalledWith({
      where: { occurredAt: { lt: cutoff } },
    });
  });
});
