import cookieParser from "cookie-parser";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { actor, createService, database, listen, validate } from "@icarus/service-kit";

const app = createService("identity");
const sql = database();
const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "local-development-secret-change-me");
const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@icarus.local";
const demoUsers = new Map([
  ["ADMIN", { id: "00000000-0000-4000-8000-000000000001", email: adminEmail, name: "Avery Morgan", role: "ADMIN" }],
  ["TEACHER", { id: "00000000-0000-4000-8000-000000000002", email: "teacher@icarus.local", name: "Maya Rao", role: "TEACHER" }],
  ["STUDENT", { id: "00000000-0000-4000-8000-000000000003", email: "student@icarus.local", name: "Arjun Mehta", role: "STUDENT" }],
]);

function sessionCookie(response: import("express").Response, token: string) {
  response.cookie("icarus_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", domain: process.env.COOKIE_DOMAIN || undefined, maxAge: 8 * 60 * 60 * 1000, path: "/" });
}

async function createSession(user: { id: string; email: string; name: string; role: string; avatarUrl?: string }) {
  return new SignJWT(user).setProtectedHeader({ alg: "HS256" }).setIssuer("icarus-identity").setAudience("icarus-platform").setIssuedAt().setExpirationTime("8h").sign(secret);
}

async function bootstrap() {
  await sql`create schema if not exists identity`;
  await sql`create table if not exists identity.teacher_invitation (email text primary key, created_at timestamptz not null default now())`;
  await sql`create table if not exists identity.user_account (id uuid primary key, email text unique not null, name text not null, avatar_url text, role text not null check (role in ('ADMIN','TEACHER','STUDENT')), created_at timestamptz not null default now(), last_login_at timestamptz not null default now())`;
  for (const user of demoUsers.values()) await sql`insert into identity.user_account (id, email, name, role) values (${user.id}, ${user.email}, ${user.name}, ${user.role}) on conflict (email) do update set role=excluded.role`;
}

app.use(cookieParser());
app.get("/session", async (request, response) => {
  const token = request.cookies.icarus_session as string | undefined;
  if (!token) return response.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Sign in is required." } });
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: "icarus-identity", audience: "icarus-platform" });
    return response.json({ user: payload });
  } catch {
    return response.status(401).json({ error: { code: "INVALID_SESSION", message: "Your session has expired." } });
  }
});

app.post("/demo-login", validate(z.object({ role: z.enum(["ADMIN", "TEACHER", "STUDENT"]) })), async (request, response) => {
  if (process.env.NODE_ENV === "production") return response.status(404).end();
  const user = demoUsers.get(request.body.role)!;
  const token = await createSession(user);
  sessionCookie(response, token);
  response.json({ user });
});

app.post("/logout", (_request, response) => {
  response.clearCookie("icarus_session");
  response.status(204).end();
});

app.get("/teacher-invitations", async (_request, response) => {
  response.json({ invitations: await sql`select email, created_at as "createdAt" from identity.teacher_invitation order by created_at desc` });
});

app.post("/teacher-invitations", validate(z.object({ email: z.string().email() })), async (request, response) => {
  if (actor(request).role !== "ADMIN") return response.status(403).json({ error: { code: "FORBIDDEN", message: "Only administrators can invite teachers." } });
  const invitation = { email: request.body.email.toLowerCase(), createdAt: new Date().toISOString() };
  await sql`insert into identity.teacher_invitation (email) values (${invitation.email}) on conflict (email) do nothing`;
  response.status(201).json({ invitation });
});

app.get("/oauth/google", (_request, response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return response.status(503).json({ error: { code: "OAUTH_NOT_CONFIGURED", message: "Google OAuth credentials are not configured. Use demo login locally." } });
  const callback = `${process.env.PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/auth/oauth/google/callback`;
  const state = crypto.randomUUID();
  response.cookie("icarus_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 10 * 60 * 1000, path: "/" });
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: callback, response_type: "code", scope: "openid email profile", access_type: "online", prompt: "select_account", state });
  response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/oauth/google/callback", async (request, response) => {
  const query = z.object({ code: z.string().min(1), state: z.string().uuid() }).safeParse(request.query);
  if (!query.success || query.data.state !== request.cookies.icarus_oauth_state) return response.status(400).json({ error: { code: "INVALID_OAUTH_STATE", message: "The sign-in request could not be verified." } });
  const callback = `${process.env.PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/auth/oauth/google/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: query.data.code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: callback, grant_type: "authorization_code" }) });
  if (!tokenResponse.ok) return response.status(401).json({ error: { code: "OAUTH_EXCHANGE_FAILED", message: "Google did not accept the authorization code." } });
  const tokens = z.object({ access_token: z.string() }).parse(await tokenResponse.json());
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = z.object({ email: z.string().email(), email_verified: z.boolean(), name: z.string().min(1), picture: z.string().url().optional() }).parse(await profileResponse.json());
  if (!profile.email_verified) return response.status(403).json({ error: { code: "EMAIL_NOT_VERIFIED", message: "A verified Google email is required." } });
  const email = profile.email.toLowerCase();
  const invited = (await sql`select email from identity.teacher_invitation where email=${email}`)[0];
  const existing = (await sql`select id, role from identity.user_account where email=${email}`)[0];
  const role = email === adminEmail.toLowerCase() ? "ADMIN" : existing?.role ?? (invited ? "TEACHER" : "STUDENT");
  const id = existing?.id ?? crypto.randomUUID();
  const row = (await sql`insert into identity.user_account (id, email, name, avatar_url, role) values (${id}, ${email}, ${profile.name}, ${profile.picture ?? null}, ${role}) on conflict (email) do update set name=excluded.name, avatar_url=excluded.avatar_url, last_login_at=now() returning id, email, name, avatar_url as "avatarUrl", role`)[0];
  if (invited) await sql`delete from identity.teacher_invitation where email=${email}`;
  sessionCookie(response, await createSession(row as { id: string; email: string; name: string; role: string; avatarUrl?: string }));
  response.clearCookie("icarus_oauth_state");
  const destination = role === "ADMIN" ? process.env.ADMIN_APP_URL ?? "http://localhost:3002" : role === "TEACHER" ? process.env.TEACHER_APP_URL ?? "http://localhost:3001" : process.env.STUDENT_APP_URL ?? "http://localhost:3000";
  response.redirect(destination);
});

void bootstrap().then(() => listen(app, Number(process.env.PORT ?? 4001)));
