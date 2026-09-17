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
  create: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  listStudents: vi.fn(),
  removeStudent: vi.fn(),
}));

vi.mock("./services/identity.service.js", () => ({
  identityService: { authenticate: mocks.authenticate },
}));

vi.mock("./services/classroom.service.js", () => ({
  classroomService: {
    create: mocks.create,
    list: mocks.list,
    get: mocks.get,
    remove: mocks.remove,
    join: mocks.join,
    leave: mocks.leave,
    listStudents: mocks.listStudents,
    removeStudent: mocks.removeStudent,
  },
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
const classroomId = "30000000-0000-4000-8000-000000000001";
const classroom = {
  id: classroomId,
  teacherId: teacher.id,
  name: "Data Structures - Section A",
  subject: "Data Structures",
  description: null,
  section: "A",
  academicYear: "2026-2027",
  code: "ABCD2345",
  termEnd: null,
  createdAt: "2026-09-17T06:00:00.000Z",
  updatedAt: "2026-09-17T06:00:00.000Z",
  studentCount: 1,
};
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.IDENTITY_URL = "http://identity.test";
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
  mocks.create.mockResolvedValue(classroom);
  mocks.list.mockResolvedValue([classroom]);
  mocks.join.mockResolvedValue(classroom);
  mocks.listStudents.mockResolvedValue({ students: [], nextCursor: null });
});

describe("classroom HTTP contract", () => {
  it("rejects requests without a revalidated browser session", async () => {
    const response = await fetch(`${baseUrl}/classes`);

    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("lets a teacher create a classroom", async () => {
    const response = await fetch(`${baseUrl}/classes`, {
      method: "POST",
      headers: { cookie: "role=teacher", "content-type": "application/json" },
      body: JSON.stringify({
        name: "Data Structures - Section A",
        subject: "Data Structures",
        academicYear: "2026-2027",
      }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ classroom });
    expect(mocks.create).toHaveBeenCalledWith(
      teacher.id,
      expect.objectContaining({ academicYear: "2026-2027" }),
    );
  });

  it("prevents students from creating classrooms", async () => {
    const response = await fetch(`${baseUrl}/classes`, {
      method: "POST",
      headers: { cookie: "role=student", "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("normalizes a student's join code", async () => {
    const response = await fetch(`${baseUrl}/classes/join`, {
      method: "POST",
      headers: { cookie: "role=student", "content-type": "application/json" },
      body: JSON.stringify({ code: "abcd2345" }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ classroom });
    expect(mocks.join).toHaveBeenCalledWith(student.id, "ABCD2345");
  });

  it("lets only teachers request a roster", async () => {
    const denied = await fetch(`${baseUrl}/classes/${classroomId}/students`, {
      headers: { cookie: "role=student" },
    });
    const allowed = await fetch(
      `${baseUrl}/classes/${classroomId}/students?limit=25`,
      { headers: { cookie: "role=teacher" } },
    );

    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(200);
    expect(mocks.listStudents).toHaveBeenCalledWith(
      teacher.id,
      classroomId,
      25,
      undefined,
    );
  });
});
