import type { Request, Response } from "express";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { auditService } from "../services/audit.service.js";
import { teacherService } from "../services/teacher.service.js";
import { userService } from "../services/user.service.js";

const listUsersQuerySchema = z.object({
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]).optional(),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  search: z.string().trim().min(1).max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});
const idParamsSchema = z.object({ id: z.string().uuid() });
const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]),
});
const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
});
const invitationSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(160).optional(),
});
const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

function metadata(request: Request) {
  return { ipAddress: request.ip, userAgent: request.get("user-agent") };
}

function actorId(request: Request) {
  if (!request.identity)
    throw new Error("Administrator middleware did not attach an identity.");
  return request.identity.id;
}

export class AdminController {
  async listUsers(request: Request, response: Response) {
    const query = listUsersQuerySchema.parse(request.query);
    const users = await userService.list(query);
    response.json({
      users,
      nextCursor: users.length === query.limit ? users.at(-1)?.id : null,
    });
  }

  async getUser(request: Request, response: Response) {
    const { id } = idParamsSchema.parse(request.params);
    response.json({ user: await userService.getById(id) });
  }

  async updateStatus(request: Request, response: Response) {
    const { id } = idParamsSchema.parse(request.params);
    const { status } = updateStatusSchema.parse(request.body);
    response.json({
      user: await userService.updateStatus(
        actorId(request),
        id,
        status,
        metadata(request),
      ),
    });
  }

  async updateRole(request: Request, response: Response) {
    const { id } = idParamsSchema.parse(request.params);
    const { role } = updateRoleSchema.parse(request.body);
    response.json({
      user: await userService.updateRole(
        actorId(request),
        id,
        role,
        metadata(request),
      ),
    });
  }

  async listInvitations(_request: Request, response: Response) {
    response.json({ invitations: await teacherService.listInvitations() });
  }

  async inviteTeacher(request: Request, response: Response) {
    const input = invitationSchema.parse(request.body);
    const teacher = await teacherService.invite(
      input.email,
      input.name,
      actorId(request),
      metadata(request),
    );
    response.status(201).json({ teacher });
  }

  async importTeachers(request: Request, response: Response) {
    if (!request.file)
      throw badRequest(
        "CSV_REQUIRED",
        "Attach a CSV file using the 'file' form field.",
      );
    const allowedTypes = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "text/plain",
    ];
    if (
      !allowedTypes.includes(request.file.mimetype) &&
      !request.file.originalname.toLowerCase().endsWith(".csv")
    ) {
      throw badRequest("INVALID_FILE_TYPE", "Only CSV files are accepted.");
    }
    const result = await teacherService.importCsv(
      request.file,
      actorId(request),
      metadata(request),
    );
    response.status(result.import.rejectedRows === 0 ? 201 : 207).json(result);
  }

  async getTeacherImport(request: Request, response: Response) {
    const { id } = idParamsSchema.parse(request.params);
    response.json({ import: await teacherService.getImport(id) });
  }

  async listAuditLogs(request: Request, response: Response) {
    const query = auditQuerySchema.parse(request.query);
    const auditLogs = await auditService.list(query.limit, query.cursor);
    response.json({
      auditLogs,
      nextCursor:
        auditLogs.length === query.limit ? auditLogs.at(-1)?.id : null,
    });
  }
}

export const adminController = new AdminController();
