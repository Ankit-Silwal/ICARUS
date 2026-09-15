import type { RequestMetadata } from "../types/identity.types.js";
import { prisma } from "../lib/prisma.js";

interface AuditInput extends RequestMetadata {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  async record(input: AuditInput) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata
          ? JSON.parse(JSON.stringify(input.metadata))
          : undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }

  async list(limit: number, cursor?: string) {
    return prisma.auditLog.findMany({
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        actor: { select: { id: true, email: true, name: true, role: true } },
      },
    });
  }
}

export const auditService = new AuditService();
