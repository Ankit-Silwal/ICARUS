import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { badRequest } from "../lib/errors.js";
import { auditService } from "../services/audit.service.js";
import { oauthService } from "../services/oauth.service.js";
import { sessionService } from "../services/session.service.js";

const callbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(16),
});
const authorizationQuerySchema = z.object({
  returnTo: z.string().url().optional(),
});

function metadata(request: Request) {
  return { ipAddress: request.ip, userAgent: request.get("user-agent") };
}

function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.cookieSecure,
    domain: env.COOKIE_DOMAIN || undefined,
    expires: expiresAt,
    path: "/",
  };
}

export class AuthController {
  async googleAuthorization(request: Request, response: Response) {
    const query = authorizationQuerySchema.parse(request.query);
    response.redirect(
      await oauthService.createGoogleAuthorizationUrl(query.returnTo),
    );
  }

  async googleCallback(request: Request, response: Response) {
    const query = callbackQuerySchema.safeParse(request.query);
    if (!query.success)
      throw badRequest(
        "INVALID_OAUTH_CALLBACK",
        "Google returned an invalid callback.",
      );
    const result = await oauthService.completeGoogleLogin(
      query.data.code,
      query.data.state,
      metadata(request),
    );
    response.cookie(
      env.SESSION_COOKIE_NAME,
      result.session.token,
      cookieOptions(result.session.expiresAt),
    );
    response.redirect(result.destination);
  }

  async session(request: Request, response: Response) {
    const token = request.cookies?.[env.SESSION_COOKIE_NAME] as
      string | undefined;
    const result = await sessionService.authenticate(token);
    response.json({ user: result.user });
  }

  async logout(request: Request, response: Response) {
    const token = request.cookies?.[env.SESSION_COOKIE_NAME] as
      string | undefined;
    if (request.identity && request.sessionId) {
      await auditService.record({
        actorId: request.identity.id,
        action: "USER_SIGNED_OUT",
        entityType: "Session",
        entityId: request.sessionId,
        ...metadata(request),
      });
    }
    await sessionService.revoke(token);
    response.clearCookie(env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.cookieSecure,
      domain: env.COOKIE_DOMAIN || undefined,
      path: "/",
    });
    response.status(204).end();
  }
}

export const authController = new AuthController();
