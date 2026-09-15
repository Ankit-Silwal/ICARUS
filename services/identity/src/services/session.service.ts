import type {
  RequestMetadata,
  AuthenticatedUser,
} from "../types/identity.types.js";
import { env } from "../config/env.js";
import { randomToken, sha256 } from "../lib/crypto.js";
import { unauthenticated } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const userSelection = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
} as const;

export class SessionService {
  async create(userId: string, metadata: RequestMetadata) {
    const token = randomToken(48);
    const expiresAt = new Date(
      Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    );
    const session = await prisma.session.create({
      data: {
        tokenHash: sha256(token),
        userId,
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });

    return { token, sessionId: session.id, expiresAt };
  }

  async authenticate(token?: string) {
    if (!token) throw unauthenticated();

    const session = await prisma.session.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: { select: userSelection } },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw unauthenticated("Your session has expired.");
    }

    if (session.user.status !== "ACTIVE") {
      throw unauthenticated("Your account is not active.");
    }

    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    if (session.lastSeenAt < staleThreshold) {
      await prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      });
    }

    return { sessionId: session.id, user: session.user as AuthenticatedUser };
  }

  async revoke(token?: string) {
    if (!token) return;
    await prisma.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string) {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async removeExpired() {
    await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }
}

export const sessionService = new SessionService();
