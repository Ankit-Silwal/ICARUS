import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4003),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  IDENTITY_URL: z.string().url().default("http://localhost:8000"),
  CLASSROOM_URL: z.string().url().default("http://localhost:4002"),
  INTERNAL_SERVICE_TOKEN: z
    .string()
    .min(32, "INTERNAL_SERVICE_TOKEN must be at least 32 characters"),
  LEETCODE_API_URL: z
    .string()
    .url()
    .default("https://leetcode.com/api/problems/all/"),
  LEETCODE_GRAPHQL_URL: z
    .string()
    .url()
    .default("https://leetcode.com/graphql/"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid assessment service environment: ${details}`);
}

export const env = parsed.data;
