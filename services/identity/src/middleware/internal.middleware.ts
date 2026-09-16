import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { unauthenticated } from "../lib/errors.js";

function tokensMatch(received: string, expected: string) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export const requireInternalService: RequestHandler = (
  request,
  _response,
  next,
) => {
  const authorization = request.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!token || !tokensMatch(token, env.INTERNAL_SERVICE_TOKEN)) {
    return next(unauthenticated("A valid service credential is required."));
  }

  next();
};
