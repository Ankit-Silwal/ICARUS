import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4005),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  IDENTITY_URL: z.string().url().default("http://localhost:8000"),
  ASSESSMENT_URL: z.string().url().default("http://localhost:4003"),
  INTERNAL_SERVICE_TOKEN: z
    .string()
    .min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),
  MAX_EVENT_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(100),
  MAX_EVENT_CLOCK_SKEW_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(3600)
    .default(300),
  INTEGRITY_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(1)
    .max(3650)
    .default(180),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid integrity service environment: ${details}`);
}

export const env = parsed.data;
