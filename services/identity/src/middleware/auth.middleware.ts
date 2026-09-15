import type { RequestHandler } from "express";
import type { UserRole } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { forbidden, unauthenticated } from "../lib/errors.js";
import { sessionService } from "../services/session.service.js";

export const requireAuthentication: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const token = request.cookies?.[env.SESSION_COOKIE_NAME] as
    string | undefined;
  const authenticated = await sessionService.authenticate(token);
  request.identity = authenticated.user;
  request.sessionId = authenticated.sessionId;
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.identity) return next(unauthenticated());
    if (!roles.includes(request.identity.role)) return next(forbidden());
    next();
  };
}
