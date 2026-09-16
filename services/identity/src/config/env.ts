import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  INTERNAL_SERVICE_TOKEN: z
    .string()
    .min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  PLATFORM_ADMIN_EMAIL: z.string().email(),
  PLATFORM_ADMIN_NAME: z.string().min(1).default("College Administrator"),
  PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  STUDENT_APP_URL: z.string().url().default("http://localhost:3000"),
  TEACHER_APP_URL: z.string().url().default("http://localhost:3001"),
  ADMIN_APP_URL: z.string().url().default("http://localhost:3002"),
  SESSION_COOKIE_NAME: z.string().min(1).default("icarus_session"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(8),
  OAUTH_STATE_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: booleanFromString,
  ALLOWED_EMAIL_DOMAINS: z.string().default(""),
  STUDENT_SELF_REGISTRATION: booleanFromString,
  MAX_TEACHER_IMPORT_ROWS: z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(2000),
  MAX_TEACHER_IMPORT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(10_000_000)
    .default(2_000_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid identity service environment: ${details}`);
}

const values = parsed.data;

export const env = {
  ...values,
  platformAdminEmail: values.PLATFORM_ADMIN_EMAIL.toLowerCase(),
  allowedEmailDomains: values.ALLOWED_EMAIL_DOMAINS.split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean),
  cookieSecure: values.NODE_ENV === "production" || values.COOKIE_SECURE,
  googleRedirectUri: `${values.PUBLIC_API_URL.replace(/\/$/, "")}/api/v1/auth/oauth/google/callback`,
};
