import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";
import pino from "pino";
import { pinoHttp } from "pino-http";
import postgres from "postgres";
import { ZodError, type ZodType } from "zod";

export const logger = pino({ name: process.env.SERVICE_NAME ?? "icarus-service" });

export function createService(name: string) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: process.env.WEB_ORIGINS?.split(",") ?? true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));
  app.get("/health", (_request, response) => response.json({ service: name, status: "ok", at: new Date().toISOString() }));
  return app;
}

export function validate<T>(schema: ZodType<T>): RequestHandler {
  return (request, _response, next) => {
    try {
      request.body = schema.parse(request.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = request.get("x-request-id") ?? crypto.randomUUID();
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: "VALIDATION_ERROR", message: error.issues.map((issue) => issue.message).join(", "), requestId } });
    return;
  }
  request.log.error({ error, requestId }, "request failed");
  response.status(500).json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed.", requestId } });
};

export function listen(app: ReturnType<typeof createService>, port: number) {
  app.use(errorHandler);
  app.listen(port, () => logger.info({ port }, "service listening"));
}

export function database() {
  const url = process.env.DATABASE_URL ?? "postgres://icarus:icarus@localhost:5432/icarus";
  return postgres(url, { max: 10 });
}

export function actor(request: express.Request) {
  return {
    id: request.get("x-user-id") ?? "00000000-0000-4000-8000-000000000003",
    email: request.get("x-user-email") ?? "student@icarus.local",
    role: request.get("x-user-role") ?? "STUDENT",
  };
}
