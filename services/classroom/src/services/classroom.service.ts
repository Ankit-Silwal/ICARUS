import { randomBytes } from "node:crypto";
import type { CreateClassroomInput } from "@icarus/contracts";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { IdentityUser } from "../types/classroom.types.js";
import { identityService } from "./identity.service.js";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateJoinCode() {
  const bytes = randomBytes(8);
  return [...bytes]
    .map((byte) => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length])
    .join("");
}

function isUniqueConstraint(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function presentClassroom<
  T extends { joinCode: string; _count: { enrollments: number } },
>(classroom: T) {
  const { _count, joinCode, ...values } = classroom;
  return { ...values, code: joinCode, studentCount: _count.enrollments };
}

export class ClassroomService {
  async create(teacherId: string, input: CreateClassroomInput) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const classroom = await prisma.classroom.create({
          data: {
            teacherId,
            name: input.name,
            subject: input.subject,
            description: input.description,
            section: input.section,
            academicYear: input.academicYear,
            termEnd: input.termEnd ? new Date(input.termEnd) : undefined,
            joinCode: generateJoinCode(),
          },
          include: { _count: { select: { enrollments: true } } },
        });
        return presentClassroom(classroom);
      } catch (error) {
        if (!isUniqueConstraint(error)) throw error;
      }
    }

    throw conflict(
      "JOIN_CODE_UNAVAILABLE",
      "A unique classroom code could not be generated. Please try again.",
    );
  }

  async list(actor: IdentityUser) {
    if (actor.role === "ADMIN") {
      throw forbidden("Administrators do not have classroom membership.");
    }

    const classrooms = await prisma.classroom.findMany({
      where:
        actor.role === "TEACHER"
          ? { teacherId: actor.id }
          : { enrollments: { some: { studentId: actor.id } } },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { createdAt: "desc" },
    });

    return classrooms.map(presentClassroom);
  }

  async get(actor: IdentityUser, classroomId: string) {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!classroom) throw notFound("Classroom");

    const allowed =
      (actor.role === "TEACHER" && classroom.teacherId === actor.id) ||
      (actor.role === "STUDENT" &&
        (await prisma.enrollment.findUnique({
          where: {
            classroomId_studentId: { classroomId, studentId: actor.id },
          },
          select: { studentId: true },
        })) !== null);
    if (!allowed) {
      throw forbidden("You are not a member of this classroom.");
    }

    return presentClassroom(classroom);
  }

  async remove(teacherId: string, classroomId: string) {
    await this.requireOwner(teacherId, classroomId);
    await prisma.classroom.delete({ where: { id: classroomId } });
  }

  async join(studentId: string, code: string) {
    const classroom = await prisma.classroom.findUnique({
      where: { joinCode: code },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!classroom) throw notFound("Classroom");
    if (classroom.termEnd && classroom.termEnd <= new Date()) {
      throw conflict(
        "CLASSROOM_ENDED",
        "This classroom is no longer accepting students.",
      );
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        classroomId_studentId: { classroomId: classroom.id, studentId },
      },
      select: { studentId: true },
    });
    await prisma.enrollment.upsert({
      where: {
        classroomId_studentId: { classroomId: classroom.id, studentId },
      },
      create: { classroomId: classroom.id, studentId },
      update: {},
    });

    return presentClassroom({
      ...classroom,
      _count: {
        enrollments:
          classroom._count.enrollments + (existingEnrollment ? 0 : 1),
      },
    });
  }

  async leave(studentId: string, classroomId: string) {
    const deleted = await prisma.enrollment.deleteMany({
      where: { classroomId, studentId },
    });
    if (deleted.count === 0) throw notFound("Enrollment");
  }

  async listStudents(
    teacherId: string,
    classroomId: string,
    limit: number,
    cursor?: string,
  ) {
    await this.requireOwner(teacherId, classroomId);
    const enrollments = await prisma.enrollment.findMany({
      where: { classroomId },
      orderBy: [{ joinedAt: "asc" }, { studentId: "asc" }],
      take: limit + 1,
      ...(cursor
        ? {
            cursor: {
              classroomId_studentId: { classroomId, studentId: cursor },
            },
            skip: 1,
          }
        : {}),
    });
    const page = enrollments.slice(0, limit);
    const users = await identityService.resolveUsers(
      page.map((enrollment) => enrollment.studentId),
    );
    const usersById = new Map(users.map((user) => [user.id, user]));

    return {
      students: page.map((enrollment) => ({
        joinedAt: enrollment.joinedAt,
        user: usersById.get(enrollment.studentId) ?? null,
        studentId: enrollment.studentId,
      })),
      nextCursor:
        enrollments.length > limit ? (page.at(-1)?.studentId ?? null) : null,
    };
  }

  async removeStudent(
    teacherId: string,
    classroomId: string,
    studentId: string,
  ) {
    await this.requireOwner(teacherId, classroomId);
    const deleted = await prisma.enrollment.deleteMany({
      where: { classroomId, studentId },
    });
    if (deleted.count === 0) throw notFound("Enrollment");
  }

  private async requireOwner(teacherId: string, classroomId: string) {
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { teacherId: true },
    });
    if (!classroom) throw notFound("Classroom");
    if (classroom.teacherId !== teacherId) {
      throw forbidden("Only the classroom owner can perform this action.");
    }
  }
}

export const classroomService = new ClassroomService();
