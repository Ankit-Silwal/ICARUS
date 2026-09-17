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
  question: {
    list: vi.fn(),
    getOwned: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    previewLeetCode: vi.fn(),
    importLeetCode: vi.fn(),
    remove: vi.fn(),
    getInternal: vi.fn(),
  },
  exam: {
    create: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
    schedule: vi.fn(),
    close: vi.fn(),
    publish: vi.fn(),
    getInternal: vi.fn(),
  },
  attempt: {
    start: vi.fn(),
    autosave: vi.fn(),
    submit: vi.fn(),
    listReviews: vi.fn(),
    applyReduction: vi.fn(),
    results: vi.fn(),
    getQuestion: vi.fn(),
    recordCodeResult: vi.fn(),
    recordIntegrityFlags: vi.fn(),
  },
}));

vi.mock("./services/identity.service.js", () => ({
  identityService: { authenticate: mocks.authenticate },
}));
vi.mock("./services/question.service.js", () => ({
  questionService: mocks.question,
}));
vi.mock("./services/exam.service.js", () => ({ examService: mocks.exam }));
vi.mock("./services/attempt.service.js", () => ({
  attemptService: mocks.attempt,
}));

const student = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "student@example.edu",
  name: "Student",
  avatarUrl: null,
  role: "STUDENT" as const,
  status: "ACTIVE" as const,
};
const teacher = {
  ...student,
  id: "20000000-0000-4000-8000-000000000001",
  email: "teacher@example.edu",
  role: "TEACHER" as const,
};
const questionId = "30000000-0000-4000-8000-000000000001";
const classroomId = "40000000-0000-4000-8000-000000000001";
const question = {
  id: questionId,
  kind: "MCQ" as const,
  title: "Complexity",
  prompt: "What is binary search complexity?",
  points: 5,
  options: [
    { id: "a", label: "O(log n)" },
    { id: "b", label: "O(n)" },
  ],
  correctOptionId: "a",
};
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
    return null;
  });
  mocks.question.list.mockResolvedValue([question]);
  mocks.question.create.mockResolvedValue(question);
  mocks.question.update.mockResolvedValue(question);
  mocks.exam.create.mockResolvedValue({ id: crypto.randomUUID() });
  mocks.exam.list.mockResolvedValue([]);
  mocks.attempt.results.mockResolvedValue([]);
});

describe("assessment HTTP contract", () => {
  it("rejects requests without a revalidated browser session", async () => {
    const response = await fetch(`${baseUrl}/questions`);

    expect(response.status).toBe(401);
    expect(mocks.question.list).not.toHaveBeenCalled();
  });

  it("prevents students from managing the question bank", async () => {
    const response = await fetch(`${baseUrl}/questions`, {
      headers: { cookie: "role=student" },
    });

    expect(response.status).toBe(403);
  });

  it("lets a teacher create a validated question", async () => {
    const { id: _id, ...input } = question;
    const response = await fetch(`${baseUrl}/questions`, {
      method: "POST",
      headers: { cookie: "role=teacher", "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ question });
    expect(mocks.question.create).toHaveBeenCalledWith(teacher.id, input);
  });

  it("updates the bank item while retaining its identifier", async () => {
    const { id: _id, ...input } = question;
    const response = await fetch(`${baseUrl}/questions/${questionId}`, {
      method: "PATCH",
      headers: { cookie: "role=teacher", "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    expect(response.status).toBe(200);
    expect(mocks.question.update).toHaveBeenCalledWith(
      teacher.id,
      questionId,
      input,
    );
  });

  it("lets a teacher create an exam from owned questions", async () => {
    const input = {
      classId: classroomId,
      title: "Algorithms Midterm",
      startsAt: "2026-09-20T10:00:00.000Z",
      endsAt: "2026-09-20T12:00:00.000Z",
      durationMinutes: 90,
      attemptLimit: 1,
      questionIds: [questionId],
    };
    const response = await fetch(`${baseUrl}/exams`, {
      method: "POST",
      headers: { cookie: "role=teacher", "content-type": "application/json" },
      body: JSON.stringify(input),
    });

    expect(response.status).toBe(201);
    expect(mocks.exam.create).toHaveBeenCalledWith(
      teacher,
      "role=teacher",
      input,
    );
  });

  it("exposes published results only to students", async () => {
    const denied = await fetch(`${baseUrl}/results`, {
      headers: { cookie: "role=teacher" },
    });
    const allowed = await fetch(`${baseUrl}/results`, {
      headers: { cookie: "role=student" },
    });

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(mocks.attempt.results).toHaveBeenCalledWith(student.id);
  });
});
