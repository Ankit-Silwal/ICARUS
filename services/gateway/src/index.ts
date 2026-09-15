import cookieParser from "cookie-parser";
import type { RequestHandler } from "express";
import { createService, listen } from "@icarus/service-kit";

const app = createService("gateway");
app.use(cookieParser());

const targets = {
  auth: process.env.IDENTITY_URL ?? "http://localhost:8000",
  classrooms: process.env.CLASSROOM_URL ?? "http://localhost:4002",
  assessments: process.env.ASSESSMENT_URL ?? "http://localhost:4003",
  execution: process.env.EXECUTION_URL ?? "http://localhost:4004",
  integrity: process.env.INTEGRITY_URL ?? "http://localhost:4005",
};

type SessionUser = {
  id: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
};

async function forwardedBody(request: Parameters<RequestHandler>[0]) {
  if (["GET", "HEAD"].includes(request.method)) return undefined;
  const contentType = request.get("content-type") ?? "";
  if (contentType.includes("application/json"))
    return JSON.stringify(request.body);

  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return new Uint8Array(Buffer.concat(chunks));
}

const authenticate: RequestHandler = async (request, response, next) => {
  const cookie = request.get("cookie");
  if (!cookie)
    return response.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Sign in is required." },
    });
  const session = await fetch(`${targets.auth}/session`, {
    headers: { cookie },
  });
  if (!session.ok)
    return response.status(401).json({
      error: {
        code: "INVALID_SESSION",
        message: "Your session has expired.",
      },
    });
  const payload = (await session.json()) as { user: SessionUser };
  response.locals.user = payload.user;
  next();
};

function proxy(target: string): RequestHandler {
  return async (request, response) => {
    const identity = response.locals.user as SessionUser | undefined;
    const headers: Record<string, string> = {
      "content-type": request.get("content-type") ?? "application/json",
      "x-request-id": request.get("x-request-id") ?? crypto.randomUUID(),
    };
    if (identity) {
      headers["x-user-id"] = identity.id;
      headers["x-user-email"] = identity.email;
      headers["x-user-role"] = identity.role;
    }
    if (request.get("cookie")) headers.cookie = request.get("cookie")!;
    const upstream = await fetch(`${target}${request.url}`, {
      method: request.method,
      headers,
      body: await forwardedBody(request),
      redirect: "manual",
    });
    response.status(upstream.status);
    const cookie = upstream.headers.getSetCookie?.();
    if (cookie?.length) response.setHeader("set-cookie", cookie);
    const location = upstream.headers.get("location");
    if (location) response.setHeader("location", location);
    const contentType = upstream.headers.get("content-type");
    if (contentType) response.type(contentType);
    response.send(Buffer.from(await upstream.arrayBuffer()));
  };
}

app.use("/api/v1/auth/teacher-invitations", authenticate);
app.use("/api/v1/auth", proxy(targets.auth));
app.use("/api/v1/classrooms", authenticate, proxy(targets.classrooms));
app.use("/api/v1/assessments", authenticate, proxy(targets.assessments));
app.use("/api/v1/execution", authenticate, proxy(targets.execution));
app.use("/api/v1/integrity", authenticate, proxy(targets.integrity));

app.get("/api/v1", (_request, response) =>
  response.json({
    name: "ICARUS API",
    version: "v1",
    services: Object.keys(targets),
  }),
);
listen(app, Number(process.env.PORT ?? 4000));
