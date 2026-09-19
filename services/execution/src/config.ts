import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4004),
  REDIS_URL: z.string().url().default("redis://localhost:6380"),
  ASSESSMENT_URL: z.string().url().default("http://localhost:4003"),
  JUDGE0_URL: z.string().url().default("http://localhost:2358"),
  JUDGE0_TOKEN: z.string().min(1).optional(),
  JUDGE0_CPP_ID: z.coerce.number().int().positive().default(54),
  JUDGE0_JAVA_ID: z.coerce.number().int().positive().default(62),
  JUDGE0_PYTHON_ID: z.coerce.number().int().positive().default(71),
  JUDGE0_JAVASCRIPT_ID: z.coerce.number().int().positive().default(63),
  INTERNAL_SERVICE_TOKEN: z
    .string()
    .min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),
  DISABLE_EXECUTION_WORKER: z.enum(["true", "false"]).default("false"),
  EXECUTION_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid execution service environment: ${details}`);
}

export const env = parsed.data;
