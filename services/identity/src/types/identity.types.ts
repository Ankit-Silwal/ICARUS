import type { UserRole, UserStatus } from "../generated/prisma/client.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

export interface TeacherCsvRow {
  email: string;
  name: string;
  employeeId?: string;
  department?: string;
}

export interface TeacherImportRowResult extends TeacherCsvRow {
  row: number;
  status: "IMPORTED" | "REJECTED";
  reason?: string;
  userId?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    identity?: AuthenticatedUser;
    sessionId?: string;
  }
}
