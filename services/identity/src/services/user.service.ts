import type { UserRole, UserStatus } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { conflict, forbidden, notFound } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type {
  GoogleIdentity,
  RequestMetadata,
} from "../types/identity.types.js";
import { auditService } from "./audit.service.js";
import { sessionService } from "./session.service.js";

const publicUserSelection = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  teacherProfile: { select: { employeeId: true, department: true } },
} as const;

export class UserService {
  async bootstrapAdministrator() {
    return prisma.user.upsert({
      where: { email: env.platformAdminEmail },
      create: {
        email: env.platformAdminEmail,
        name: env.PLATFORM_ADMIN_NAME,
        role: "ADMIN",
        status: "PENDING",
      },
      update: { role: "ADMIN" },
      select: publicUserSelection,
    });
  }

  async resolveGoogleIdentity(identity: GoogleIdentity) {
    const email = identity.email.toLowerCase();
    const linkedAccount = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: identity.subject,
        },
      },
      include: { user: true },
    });
    if (linkedAccount && linkedAccount.user.email !== email) {
      throw forbidden(
        "This Google identity is already linked to a different college account.",
      );
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    const invitation = await prisma.teacherInvitation.findUnique({
      where: { email },
    });
    const isAdmin = email === env.platformAdminEmail;
    const isInvitedTeacher =
      invitation?.status === "PENDING" &&
      (!invitation.expiresAt || invitation.expiresAt > new Date());
    const domain = email.split("@")[1] ?? "";
    const studentAllowed =
      env.STUDENT_SELF_REGISTRATION &&
      (env.allowedEmailDomains.length === 0 ||
        env.allowedEmailDomains.includes(domain));

    if (!existing && !isAdmin && !isInvitedTeacher && !studentAllowed) {
      throw forbidden(
        "This Google account has not been provisioned by the college administrator.",
      );
    }

    if (existing && ["SUSPENDED", "DISABLED"].includes(existing.status)) {
      throw forbidden("This account has been suspended or disabled.");
    }

    const role: UserRole = isAdmin
      ? "ADMIN"
      : isInvitedTeacher
        ? "TEACHER"
        : (existing?.role ?? "STUDENT");
    const now = new Date();

    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.upsert({
        where: { email },
        create: {
          email,
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          role,
          status: "ACTIVE",
          emailVerifiedAt: now,
          lastLoginAt: now,
        },
        update: {
          name: identity.name,
          avatarUrl: identity.avatarUrl,
          emailVerifiedAt: now,
          lastLoginAt: now,
          status: "ACTIVE",
          ...(isAdmin || isInvitedTeacher ? { role } : {}),
        },
        select: publicUserSelection,
      });

      await transaction.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: identity.subject,
          },
        },
        create: {
          provider: "google",
          providerAccountId: identity.subject,
          providerEmail: email,
          userId: user.id,
        },
        update: { providerEmail: email, userId: user.id },
      });

      if (isInvitedTeacher) {
        await transaction.teacherInvitation.update({
          where: { email },
          data: { status: "ACCEPTED", acceptedAt: now },
        });
      }

      return user;
    });
  }

  async list(options: {
    role?: UserRole;
    status?: UserStatus;
    search?: string;
    limit: number;
    cursor?: string;
  }) {
    return prisma.user.findMany({
      take: options.limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      where: {
        role: options.role,
        status: options.status,
        ...(options.search
          ? {
              OR: [
                { email: { contains: options.search, mode: "insensitive" } },
                { name: { contains: options.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: publicUserSelection,
    });
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: publicUserSelection,
    });
    if (!user) throw notFound("User");
    return user;
  }

  async updateStatus(
    actorId: string,
    userId: string,
    status: UserStatus,
    metadata: RequestMetadata,
  ) {
    if (actorId === userId && status !== "ACTIVE")
      throw conflict(
        "SELF_DEACTIVATION",
        "You cannot deactivate your own account.",
      );
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw notFound("User");
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: publicUserSelection,
    });
    if (status !== "ACTIVE") await sessionService.revokeAllForUser(userId);
    await auditService.record({
      actorId,
      action: "USER_STATUS_CHANGED",
      entityType: "User",
      entityId: userId,
      metadata: { from: existing.status, to: status },
      ...metadata,
    });
    return user;
  }

  async updateRole(
    actorId: string,
    userId: string,
    role: UserRole,
    metadata: RequestMetadata,
  ) {
    if (actorId === userId && role !== "ADMIN")
      throw conflict(
        "SELF_ROLE_CHANGE",
        "You cannot remove your own administrator role.",
      );
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw notFound("User");
    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: publicUserSelection,
    });
    await sessionService.revokeAllForUser(userId);
    await auditService.record({
      actorId,
      action: "USER_ROLE_CHANGED",
      entityType: "User",
      entityId: userId,
      metadata: { from: existing.role, to: role },
      ...metadata,
    });
    return user;
  }
}

export const userService = new UserService();
