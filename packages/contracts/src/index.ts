import { z } from "zod";

export const RoleSchema = z.enum(["ADMIN", "TEACHER", "STUDENT"]);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  role: RoleSchema,
});
export type User = z.infer<typeof UserSchema>;

export const LanguageSchema = z.enum(["cpp", "java", "python", "javascript"]);
export type Language = z.infer<typeof LanguageSchema>;

export const TestCaseSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  input: z.unknown(),
  expected: z.unknown(),
  weight: z.number().nonnegative(),
  visibility: z.enum(["SAMPLE", "HIDDEN"]),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const McqQuestionSchema = z.object({
  id: z.string().uuid(),
  kind: z.literal("MCQ"),
  title: z.string().min(1),
  prompt: z.string().min(1),
  points: z.number().positive(),
  options: z.array(z.object({ id: z.string(), label: z.string() })).min(2),
  correctOptionId: z.string(),
});

export const CodeQuestionSchema = z.object({
  id: z.string().uuid(),
  kind: z.literal("CODE"),
  title: z.string().min(1),
  prompt: z.string().min(1),
  points: z.number().positive(),
  functionName: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  languages: z.array(LanguageSchema).min(1),
  starterCode: z.partialRecord(LanguageSchema, z.string()),
  tests: z.array(TestCaseSchema).min(1),
  source: z
    .object({
      provider: z.literal("LEETCODE"),
      problemNumber: z.number().int().positive(),
      url: z.string().url(),
    })
    .optional(),
});

export const QuestionSchema = z.discriminatedUnion("kind", [
  McqQuestionSchema,
  CodeQuestionSchema,
]);
export const QuestionInputSchema = z.discriminatedUnion("kind", [
  McqQuestionSchema.omit({ id: true }),
  CodeQuestionSchema.omit({ id: true }),
]);
export type Question = z.infer<typeof QuestionSchema>;
export type CodeQuestion = z.infer<typeof CodeQuestionSchema>;

export const ExamStatusSchema = z.enum([
  "DRAFT",
  "SCHEDULED",
  "CLOSED",
  "REVIEW",
  "PUBLISHED",
]);
export const AttemptStatusSchema = z.enum([
  "CREATED",
  "IN_PROGRESS",
  "SUBMITTED",
  "AUTO_SUBMITTED",
  "GRADED",
]);

export const IntegrityPolicySchema = z.object({
  enabled: z.boolean().default(true),
  directPasteReductionPercent: z.number().min(0).max(100).default(10),
  rapidEntryReductionPercent: z.number().min(0).max(100).default(5),
  idleReturnReductionPercent: z.number().min(0).max(100).default(5),
  maximumReductionPercent: z.number().min(0).max(100).default(25),
  typingSpeedCharactersPerSecond: z.number().positive().default(25),
  idleThresholdMilliseconds: z.number().int().positive().default(10_000),
});
export type IntegrityPolicy = z.infer<typeof IntegrityPolicySchema>;

export const defaultIntegrityPolicy: IntegrityPolicy = {
  enabled: true,
  directPasteReductionPercent: 10,
  rapidEntryReductionPercent: 5,
  idleReturnReductionPercent: 5,
  maximumReductionPercent: 25,
  typingSpeedCharactersPerSecond: 25,
  idleThresholdMilliseconds: 10_000,
};

export const ExamSchema = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  title: z.string().min(2),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  attemptLimit: z.number().int().positive().default(1),
  status: ExamStatusSchema,
  integrityPolicy: IntegrityPolicySchema.default(defaultIntegrityPolicy),
  questions: z.array(QuestionSchema),
});
export type Exam = z.infer<typeof ExamSchema>;

export const CreateExamInputSchema = z.object({
  classId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  durationMinutes: z
    .number()
    .int()
    .min(1)
    .max(24 * 60),
  attemptLimit: z.number().int().min(1).max(10).default(1),
  questionIds: z.array(z.string().uuid()).min(1).max(100),
  integrityPolicy: IntegrityPolicySchema.optional(),
});
export type CreateExamInput = z.infer<typeof CreateExamInputSchema>;

export const ExamSummarySchema = ExamSchema.omit({ questions: true }).extend({
  questionCount: z.number().int().nonnegative(),
  totalPoints: z.number().nonnegative(),
});
export type ExamSummary = z.infer<typeof ExamSummarySchema>;

export const EditorEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
  action: z.enum([
    "TYPE",
    "PASTE",
    "DELETE",
    "REPLACE",
    "UNDO",
    "REDO",
    "FOCUS_LOST",
    "FOCUS_GAINED",
  ]),
  insertedCharacters: z.number().int().nonnegative(),
  deletedCharacters: z.number().int().nonnegative(),
  documentLength: z.number().int().nonnegative(),
  cursorLine: z.number().int().positive(),
  checksum: z.string(),
  idleMilliseconds: z.number().int().nonnegative().default(0),
});
export type EditorEvent = z.infer<typeof EditorEventSchema>;

export const IntegritySignalSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "DIRECT_PASTE",
    "ATOMIC_INSERT",
    "MEGA_PASTE",
    "SPEED_BURST",
    "BULK_REPLACE",
    "POST_IDLE_EDIT",
    "FOCUS_LOSS",
    "REPEATED_IDLE_PATTERN",
    "SEQUENCE_GAP",
    "TIMESTAMP_REGRESSION",
    "DOCUMENT_DISCONTINUITY",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  sequence: z.number().int(),
  message: z.string(),
});
export type IntegritySignal = z.infer<typeof IntegritySignalSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export const ScoreSchema = z.object({
  automaticScore: z.number().nonnegative(),
  deduction: z.number().nonnegative(),
  finalScore: z.number().nonnegative(),
  deductionReason: z.string().optional(),
});
export type Score = z.infer<typeof ScoreSchema>;

export * from "./integrity.js";
export * from "./classroom.js";
