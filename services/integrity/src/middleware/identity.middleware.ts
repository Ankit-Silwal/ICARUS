import type { RequestHandler } from "express";
import { unauthenticated } from "../lib/errors.js";
import { identityService } from "../services/identity.service.js";

export const requireIdentity: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const user = await identityService.authenticate(request.get("cookie"));
  if (!user || user.status !== "ACTIVE") {
    return next(unauthenticated("Your account is not active."));
  }
  const forwardedUserId = request.get("x-user-id");
  if (forwardedUserId && forwardedUserId !== user.id) {
    return next(unauthenticated("The forwarded identity is invalid."));
  }
  request.identity = user;
  next();
};
