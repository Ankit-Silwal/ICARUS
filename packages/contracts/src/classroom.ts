import { z } from "zod";

export const ClassroomJoinCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{8}$/, "Enter a valid 8-character classroom code.");

export const CreateClassroomInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  subject: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional(),
  section: z.string().trim().min(1).max(80).optional(),
  academicYear: z.string().trim().min(4).max(40),
  termEnd: z.iso.datetime().optional(),
});
export type CreateClassroomInput = z.infer<typeof CreateClassroomInputSchema>;

export const JoinClassroomInputSchema = z.object({
  code: ClassroomJoinCodeSchema,
});
export type JoinClassroomInput = z.infer<typeof JoinClassroomInputSchema>;

export const ClassroomSchema = z.object({
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
  name: z.string().min(2).max(120),
  subject: z.string().min(2).max(120),
  description: z.string().nullable(),
  section: z.string().nullable(),
  academicYear: z.string(),
  code: ClassroomJoinCodeSchema,
  termEnd: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  studentCount: z.number().int().nonnegative(),
});
export type Classroom = z.infer<typeof ClassroomSchema>;

export const ClassroomResponseSchema = z.object({
  classroom: ClassroomSchema,
});
export const ClassroomListResponseSchema = z.object({
  classrooms: z.array(ClassroomSchema),
});

export const ClassroomRosterUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "DISABLED"]),
});
export type ClassroomRosterUser = z.infer<typeof ClassroomRosterUserSchema>;

export const ClassroomRosterEntrySchema = z.object({
  studentId: z.string().uuid(),
  joinedAt: z.iso.datetime(),
  user: ClassroomRosterUserSchema.nullable(),
});
export type ClassroomRosterEntry = z.infer<typeof ClassroomRosterEntrySchema>;

export const ClassroomRosterResponseSchema = z.object({
  students: z.array(ClassroomRosterEntrySchema),
  nextCursor: z.string().uuid().nullable(),
});
export type ClassroomRosterResponse = z.infer<
  typeof ClassroomRosterResponseSchema
>;
