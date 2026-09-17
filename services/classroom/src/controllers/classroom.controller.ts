import {
  CreateClassroomInputSchema,
  JoinClassroomInputSchema,
} from "@icarus/contracts";
import type { Request, Response } from "express";
import { z } from "zod";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { classroomService } from "../services/classroom.service.js";

const idParamsSchema = z.object({ id: z.string().uuid() });
const studentParamsSchema = z.object({
  id: z.string().uuid(),
  studentId: z.string().uuid(),
});
const rosterQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
});

function identity(request: Request) {
  if (!request.identity) throw unauthenticated();
  return request.identity;
}

function requireRole(request: Request, role: "TEACHER" | "STUDENT") {
  const actor = identity(request);
  if (actor.role !== role) {
    throw forbidden(
      role === "TEACHER"
        ? "Only teachers can perform this action."
        : "Only students can perform this action.",
    );
  }
  return actor;
}

export class ClassroomController {
  async create(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const input = CreateClassroomInputSchema.parse(request.body);
    response.status(201).json({
      classroom: await classroomService.create(actor.id, input),
    });
  }

  async list(request: Request, response: Response) {
    response.json({
      classrooms: await classroomService.list(identity(request)),
    });
  }

  async get(request: Request, response: Response) {
    const { id } = idParamsSchema.parse(request.params);
    response.json({
      classroom: await classroomService.get(identity(request), id),
    });
  }

  async remove(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { id } = idParamsSchema.parse(request.params);
    await classroomService.remove(actor.id, id);
    response.status(204).end();
  }

  async join(request: Request, response: Response) {
    const actor = requireRole(request, "STUDENT");
    const { code } = JoinClassroomInputSchema.parse(request.body);
    response.status(201).json({
      classroom: await classroomService.join(actor.id, code),
    });
  }

  async leave(request: Request, response: Response) {
    const actor = requireRole(request, "STUDENT");
    const { id } = idParamsSchema.parse(request.params);
    await classroomService.leave(actor.id, id);
    response.status(204).end();
  }

  async listStudents(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { id } = idParamsSchema.parse(request.params);
    const query = rosterQuerySchema.parse(request.query);
    response.json(
      await classroomService.listStudents(
        actor.id,
        id,
        query.limit,
        query.cursor,
      ),
    );
  }

  async removeStudent(request: Request, response: Response) {
    const actor = requireRole(request, "TEACHER");
    const { id, studentId } = studentParamsSchema.parse(request.params);
    await classroomService.removeStudent(actor.id, id, studentId);
    response.status(204).end();
  }
}

export const classroomController = new ClassroomController();
