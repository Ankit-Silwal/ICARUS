import type { IntegrityPolicy, Question } from "@icarus/contracts";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";
export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DISABLED";

export interface IdentityUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
}

export interface AttemptContext {
  question: Question;
  integrityPolicy: IntegrityPolicy;
  attempt: {
    id: string;
    studentId: string;
    status:
      "CREATED" | "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED" | "GRADED";
    startedAt: string;
    expiresAt: string;
  };
}

declare module "express-serve-static-core" {
  interface Request {
    identity?: IdentityUser;
  }
}
