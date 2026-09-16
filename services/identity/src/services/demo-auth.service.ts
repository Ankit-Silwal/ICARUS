import type { UserRole } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { forbidden } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { RequestMetadata } from "../types/identity.types.js";
import { auditService } from "./audit.service.js";
import { sessionService } from "./session.service.js";

const demoProfiles: Record<UserRole, { email: string; name: string }> = {
  ADMIN: { email: "admin.demo@example.edu", name: "Demo Administrator" },
  TEACHER: { email: "teacher.demo@example.edu", name: "Demo Teacher" },
  STUDENT: { email: "student.demo@example.edu", name: "Demo Student" },
};

export class DemoAuthService {
  async login(role: UserRole, metadata: RequestMetadata) {
    if (env.NODE_ENV === "production") {
      throw forbidden("Local demo accounts are disabled in production.");
    }
    const profile =
      role === "ADMIN"
        ? { email: env.platformAdminEmail, name: env.PLATFORM_ADMIN_NAME }
        : demoProfiles[role];
    const now = new Date();
    const user = await prisma.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email,
        name: profile.name,
        role,
        status: "ACTIVE",
        emailVerifiedAt: now,
        lastLoginAt: now,
      },
      update: {
        name: profile.name,
        role,
        status: "ACTIVE",
        emailVerifiedAt: now,
        lastLoginAt: now,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
      },
    });
    const session = await sessionService.create(user.id, metadata);
    await auditService.record({
      actorId: user.id,
      action: "DEVELOPMENT_DEMO_SIGNED_IN",
      entityType: "Session",
      entityId: session.sessionId,
      metadata: { role },
      ...metadata,
    });
    return { user, session };
  }
}

export const demoAuthService = new DemoAuthService();
