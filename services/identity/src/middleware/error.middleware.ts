import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: {
      code: "ROUTE_NOT_FOUND",
      message: "The requested route does not exist.",
    },
  });
};

export const identityErrorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  _next,
) => {
  const requestId = request.get("x-request-id") ?? crypto.randomUUID();

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "The request is invalid.",
        details: error.issues,
        requestId,
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: {
        code: error.code,
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "The uploaded CSV file is too large."
            : error.message,
        requestId,
      },
    });
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    response.status(409).json({
      error: {
        code: "UNIQUE_CONSTRAINT",
        message: "A record with the same unique value already exists.",
        requestId,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
    });
    return;
  }

  request.log.error({ error, requestId }, "identity request failed");
  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "The request could not be completed.",
      requestId,
    },
  });
};
