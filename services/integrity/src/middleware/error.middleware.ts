import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response
    .status(404)
    .json({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "The requested route does not exist.",
      },
    });
};

export const integrityErrorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  _next,
) => {
  const requestId = request.get("x-request-id") ?? crypto.randomUUID();
  if (error instanceof ZodError) {
    response
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request is invalid.",
          details: error.issues,
          requestId,
        },
      });
    return;
  }
  if (error instanceof AppError) {
    response
      .status(error.status)
      .json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      });
    return;
  }
  request.log.error({ error, requestId }, "integrity request failed");
  response
    .status(500)
    .json({
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
        requestId,
      },
    });
};
