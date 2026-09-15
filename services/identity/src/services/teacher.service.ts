import { parse } from "csv-parse/sync";
import { z } from "zod";
import { env } from "../config/env.js";
import { badRequest, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type {
  RequestMetadata,
  TeacherCsvRow,
  TeacherImportRowResult,
} from "../types/identity.types.js";
import { auditService } from "./audit.service.js";

const teacherRowSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
  name: z.string().trim().min(1).max(160),
  employeeId: z.string().trim().min(1).max(80).optional(),
  department: z.string().trim().min(1).max(160).optional(),
});

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    email: row.email,
    name: row.name,
    employeeId: row.employee_id ?? row.employeeid,
    department: row.department,
  };
}

export class TeacherService {
  async listInvitations() {
    return prisma.teacherInvitation.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async invite(
    emailInput: string,
    name: string | undefined,
    actorId: string,
    metadata: RequestMetadata,
  ) {
    const email = emailInput.trim().toLowerCase();
    const user = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({ where: { email } });
      if (existing && existing.role !== "TEACHER") {
        throw badRequest(
          "ROLE_CONFLICT",
          "The email already belongs to a non-teacher account.",
        );
      }
      const account = await transaction.user.upsert({
        where: { email },
        create: {
          email,
          name: name?.trim() || email.split("@")[0] || "Teacher",
          role: "TEACHER",
          status: "PENDING",
        },
        update: { role: "TEACHER" },
      });
      await transaction.teacherProfile.upsert({
        where: { userId: account.id },
        create: { userId: account.id },
        update: {},
      });
      await transaction.teacherInvitation.upsert({
        where: { email },
        create: { email, invitedBy: actorId },
        update: { status: "PENDING", invitedBy: actorId, acceptedAt: null },
      });
      return account;
    });
    await auditService.record({
      actorId,
      action: "TEACHER_INVITED",
      entityType: "User",
      entityId: user.id,
      metadata: { email },
      ...metadata,
    });
    return user;
  }

  async importCsv(
    file: Express.Multer.File,
    actorId: string,
    metadata: RequestMetadata,
  ) {
    let rawRows: Record<string, unknown>[];
    try {
      rawRows = parse(file.buffer, {
        bom: true,
        columns: (headers: string[]) => headers.map(normalizeHeader),
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, unknown>[];
    } catch {
      throw badRequest(
        "INVALID_CSV",
        "The uploaded file is not a valid CSV document.",
      );
    }

    if (rawRows.length === 0)
      throw badRequest(
        "EMPTY_CSV",
        "The CSV file does not contain teacher rows.",
      );
    if (rawRows.length > env.MAX_TEACHER_IMPORT_ROWS) {
      throw badRequest(
        "CSV_ROW_LIMIT",
        `The CSV file exceeds the ${env.MAX_TEACHER_IMPORT_ROWS} row limit.`,
      );
    }

    const importRecord = await prisma.teacherImport.create({
      data: {
        fileName: file.originalname,
        totalRows: rawRows.length,
        createdById: actorId,
      },
    });
    const results: TeacherImportRowResult[] = [];
    const seenEmails = new Set<string>();
    const seenEmployeeIds = new Set<string>();

    for (const [index, rawRow] of rawRows.entries()) {
      const parsed = teacherRowSchema.safeParse(normalizeRow(rawRow));
      if (!parsed.success) {
        results.push({
          row: index + 2,
          email: String(rawRow.email ?? ""),
          name: String(rawRow.name ?? ""),
          status: "REJECTED",
          reason: parsed.error.issues.map((issue) => issue.message).join(", "),
        });
        continue;
      }

      const teacher: TeacherCsvRow = parsed.data;
      if (
        seenEmails.has(teacher.email) ||
        (teacher.employeeId && seenEmployeeIds.has(teacher.employeeId))
      ) {
        results.push({
          ...teacher,
          row: index + 2,
          status: "REJECTED",
          reason: "Duplicate email or employee ID in this CSV file.",
        });
        continue;
      }
      seenEmails.add(teacher.email);
      if (teacher.employeeId) seenEmployeeIds.add(teacher.employeeId);

      try {
        const user = await prisma.$transaction(async (transaction) => {
          const existing = await transaction.user.findUnique({
            where: { email: teacher.email },
          });
          if (existing && existing.role !== "TEACHER")
            throw new Error("The email belongs to a non-teacher account.");
          if (teacher.employeeId) {
            const profile = await transaction.teacherProfile.findUnique({
              where: { employeeId: teacher.employeeId },
            });
            if (profile && profile.userId !== existing?.id)
              throw new Error("The employee ID is already assigned.");
          }

          const account = await transaction.user.upsert({
            where: { email: teacher.email },
            create: {
              email: teacher.email,
              name: teacher.name,
              role: "TEACHER",
              status: "PENDING",
            },
            update: { name: teacher.name },
          });
          await transaction.teacherProfile.upsert({
            where: { userId: account.id },
            create: {
              userId: account.id,
              employeeId: teacher.employeeId,
              department: teacher.department,
            },
            update: {
              employeeId: teacher.employeeId,
              department: teacher.department,
            },
          });
          await transaction.teacherInvitation.upsert({
            where: { email: teacher.email },
            create: { email: teacher.email, invitedBy: actorId },
            update: { status: "PENDING", invitedBy: actorId, acceptedAt: null },
          });
          return account;
        });
        results.push({
          ...teacher,
          row: index + 2,
          status: "IMPORTED",
          userId: user.id,
        });
      } catch (error) {
        results.push({
          ...teacher,
          row: index + 2,
          status: "REJECTED",
          reason:
            error instanceof Error
              ? error.message
              : "The row could not be imported.",
        });
      }
    }

    const importedRows = results.filter(
      (result) => result.status === "IMPORTED",
    ).length;
    const rejectedRows = results.length - importedRows;
    const completed = await prisma.teacherImport.update({
      where: { id: importRecord.id },
      data: {
        importedRows,
        rejectedRows,
        status: rejectedRows === 0 ? "COMPLETED" : "COMPLETED_WITH_ERRORS",
        result: JSON.parse(JSON.stringify(results)),
        completedAt: new Date(),
      },
    });
    await auditService.record({
      actorId,
      action: "TEACHERS_IMPORTED",
      entityType: "TeacherImport",
      entityId: completed.id,
      metadata: { totalRows: results.length, importedRows, rejectedRows },
      ...metadata,
    });

    return { import: completed, rows: results };
  }

  async getImport(id: string) {
    const result = await prisma.teacherImport.findUnique({ where: { id } });
    if (!result) throw notFound("Teacher import");
    return result;
  }
}

export const teacherService = new TeacherService();
