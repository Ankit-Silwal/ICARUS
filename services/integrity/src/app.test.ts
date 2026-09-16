import { createServer, type Server } from "node:http";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  ingest: vi.fn(),
  getReport: vi.fn(),
  listAttemptReports: vi.fn(),
  listEvents: vi.fn(),
  reanalyze: vi.fn(),
  removeExpired: vi.fn(),
}));

vi.mock("./services/identity.service.js", () => ({
  identityService: { authenticate: mocks.authenticate },
}));

vi.mock("./services/integrity.service.js", () => ({
  integrityService: {
    ingest: mocks.ingest,
    getReport: mocks.getReport,
    listAttemptReports: mocks.listAttemptReports,
    listEvents: mocks.listEvents,
    reanalyze: mocks.reanalyze,
    removeExpired: mocks.removeExpired,
  },
}));

const student = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "student@example.edu",
  name: "Student",
  role: "STUDENT" as const,
  status: "ACTIVE" as const,
};
const teacher = {
  ...student,
  email: "teacher@example.edu",
  role: "TEACHER" as const,
};
const admin = {
  ...student,
  email: "admin@example.edu",
  role: "ADMIN" as const,
};
const attemptId = "20000000-0000-4000-8000-000000000001";
const questionId = "30000000-0000-4000-8000-000000000001";
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.INTERNAL_SERVICE_TOKEN =
    "test-internal-service-token-at-least-32";
  const { app } = await import("./app.js");
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not start.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockImplementation(async (cookie?: string) => {
    if (cookie === "role=student") return student;
    if (cookie === "role=teacher") return teacher;
    if (cookie === "role=admin") return admin;
    return null;
  });
  mocks.ingest.mockResolvedValue({ accepted: 1, duplicates: 0, report: {} });
  mocks.removeExpired.mockResolvedValue({
    eventsRemoved: 4,
    sessionsRemoved: 1,
  });
});

describe("integrity HTTP authorization", () => {
  it("rejects requests without a revalidated browser session", async () => {
    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId, questionId, events: [] }),
    });

    expect(response.status).toBe(401);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("accepts a valid student event batch", async () => {
    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        cookie: "role=student",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        attemptId,
        questionId,
        events: [
          {
            sequence: 1,
            occurredAt: "2026-09-16T10:10:00.000Z",
            action: "TYPE",
            insertedCharacters: 1,
            deletedCharacters: 0,
            documentLength: 1,
            cursorLine: 1,
            checksum: "fnv1a-12345678",
            idleMilliseconds: 0,
          },
        ],
      }),
    });

    expect(response.status).toBe(202);
    expect(mocks.ingest).toHaveBeenCalledOnce();
  });

  it("prevents teachers from submitting student telemetry", async () => {
    const response = await fetch(`${baseUrl}/events`, {
      method: "POST",
      headers: {
        cookie: "role=teacher",
        "content-type": "application/json",
      },
      body: JSON.stringify({ attemptId, questionId, events: [] }),
    });

    expect(response.status).toBe(403);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("allows only administrators to remove expired telemetry", async () => {
    const denied = await fetch(`${baseUrl}/retention/expired`, {
      method: "DELETE",
      headers: {
        cookie: "role=teacher",
        "content-type": "application/json",
      },
      body: "{}",
    });
    const allowed = await fetch(`${baseUrl}/retention/expired`, {
      method: "DELETE",
      headers: { cookie: "role=admin", "content-type": "application/json" },
      body: JSON.stringify({ before: "2026-01-01T00:00:00.000Z" }),
    });

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(mocks.removeExpired).toHaveBeenCalledOnce();
  });
});
