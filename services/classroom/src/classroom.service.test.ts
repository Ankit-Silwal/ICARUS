import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    classroom: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  resolveUsers: vi.fn(),
}));

vi.mock("./lib/prisma.js", () => ({ prisma: mocks.prisma }));
vi.mock("./services/identity.service.js", () => ({
  identityService: { resolveUsers: mocks.resolveUsers },
}));

const teacherId = "10000000-0000-4000-8000-000000000001";
const studentId = "20000000-0000-4000-8000-000000000001";
const classroomId = "30000000-0000-4000-8000-000000000001";
const classroom = {
  id: classroomId,
  teacherId,
  name: "Algorithms",
  subject: "Computer Science",
  description: null,
  section: "A",
  academicYear: "2026-2027",
  joinCode: "ABCD2345",
  termEnd: null,
  createdAt: new Date("2026-09-17T06:00:00.000Z"),
  updatedAt: new Date("2026-09-17T06:00:00.000Z"),
  _count: { enrollments: 3 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.classroom.findUnique.mockResolvedValue(classroom);
  mocks.prisma.enrollment.findUnique.mockResolvedValue(null);
  mocks.prisma.enrollment.upsert.mockResolvedValue({});
  mocks.prisma.enrollment.deleteMany.mockResolvedValue({ count: 1 });
  mocks.resolveUsers.mockResolvedValue([]);
});

describe("ClassroomService", () => {
  it("joins a classroom idempotently without inflating the roster count", async () => {
    mocks.prisma.enrollment.findUnique.mockResolvedValue({ studentId });
    const { classroomService } =
      await import("./services/classroom.service.js");

    await expect(
      classroomService.join(studentId, "ABCD2345"),
    ).resolves.toMatchObject({ code: "ABCD2345", studentCount: 3 });
    expect(mocks.prisma.enrollment.upsert).toHaveBeenCalledOnce();
  });

  it("rejects joins after the classroom term has ended", async () => {
    mocks.prisma.classroom.findUnique.mockResolvedValue({
      ...classroom,
      termEnd: new Date("2020-01-01T00:00:00.000Z"),
    });
    const { classroomService } =
      await import("./services/classroom.service.js");

    await expect(
      classroomService.join(studentId, "ABCD2345"),
    ).rejects.toMatchObject({ code: "CLASSROOM_ENDED", status: 409 });
    expect(mocks.prisma.enrollment.upsert).not.toHaveBeenCalled();
  });

  it("prevents a different teacher from accessing a classroom", async () => {
    const { classroomService } =
      await import("./services/classroom.service.js");

    await expect(
      classroomService.get(
        {
          id: "40000000-0000-4000-8000-000000000001",
          email: "other.teacher@example.edu",
          name: "Other Teacher",
          avatarUrl: null,
          role: "TEACHER",
          status: "ACTIVE",
        },
        classroomId,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("keeps unavailable identity records removable in a paginated roster", async () => {
    const joinedAt = new Date("2026-09-17T06:00:00.000Z");
    const secondId = "50000000-0000-4000-8000-000000000001";
    mocks.prisma.enrollment.findMany.mockResolvedValue([
      { classroomId, studentId, joinedAt },
      { classroomId, studentId: secondId, joinedAt },
    ]);
    mocks.resolveUsers.mockResolvedValue([]);
    const { classroomService } =
      await import("./services/classroom.service.js");

    await expect(
      classroomService.listStudents(teacherId, classroomId, 1),
    ).resolves.toEqual({
      students: [{ studentId, joinedAt, user: null }],
      nextCursor: studentId,
    });
  });
});
