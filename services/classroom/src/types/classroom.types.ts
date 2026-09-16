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

declare module "express-serve-static-core" {
  interface Request {
    identity?: IdentityUser;
  }
}
