import { createHash } from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";
import { CodeQuestionSchema, type CodeQuestion } from "@icarus/contracts";
import {
  actor,
  createService,
  listen,
  logger,
  validate,
} from "@icarus/service-kit";
import { env } from "./config.js";
import { buildHarness } from "./harness.js";
import { Judge0Client, parseHarnessResults } from "./judge.js";

const app = createService("execution");
const requestSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  language: z.enum(["cpp", "java", "python", "javascript"]),
  sourceCode: z.string().min(1).max(100_000),
  mode: z.enum(["RUN", "SUBMIT"]),
});
type ExecutionRequest = z.infer<typeof requestSchema>;
type ExecutionJob = ExecutionRequest & { studentId: string };
const languageIds: Record<ExecutionRequest["language"], number> = {
  cpp: env.JUDGE0_CPP_ID,
  java: env.JUDGE0_JAVA_ID,
  python: env.JUDGE0_PYTHON_ID,
  javascript: env.JUDGE0_JAVASCRIPT_ID,
};
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const queue = new Queue<ExecutionJob>("icarus-execution", {
  connection: redis,
});
const judge = new Judge0Client({
  baseUrl: env.JUDGE0_URL,
  authToken: env.JUDGE0_TOKEN,
});

async function loadQuestion(
  attemptId: string,
  questionId: string,
  studentId: string,
): Promise<CodeQuestion> {
  const response = await fetch(
    `${env.ASSESSMENT_URL}/internal/attempts/${attemptId}/questions/${questionId}`,
    {
      headers: {
        authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
        "x-user-id": studentId,
        "x-user-role": "STUDENT",
      },
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Question could not be loaded (${response.status}).`);
  }
  const payload = (await response.json()) as { question: unknown };
  return CodeQuestionSchema.parse(payload.question);
}

async function processExecution(job: Job<ExecutionJob>) {
  const question = await loadQuestion(
    job.data.attemptId,
    job.data.questionId,
    job.data.studentId,
  );
  if (!question.languages.includes(job.data.language)) {
    throw new Error("Language is not enabled for this question.");
  }
  const harness = buildHarness(
    question,
    job.data.language,
    job.data.sourceCode,
    job.data.mode,
  );
  await job.updateProgress(10);
  const token = await judge.submit(
    harness.source,
    languageIds[job.data.language],
    {
      memoryLimitKilobytes:
        job.data.language === "java"
          ? 1_536_000
          : job.data.language === "javascript"
            ? 1_024_000
            : 128_000,
      cpuTimeSeconds: job.data.language === "javascript" ? 10 : 3,
      wallTimeSeconds: job.data.language === "javascript" ? 15 : 8,
    },
  );
  await job.updateProgress(35);
  const judgeResult = await judge.waitForResult(token);
  let passed: boolean[] = [];
  if (judgeResult.status.id === 3 && judgeResult.stdout) {
    passed = parseHarnessResults(judgeResult.stdout, harness.tests.length);
  }
  const cases = harness.tests.map((test, index) => ({
    id: test.id,
    label: test.label,
    passed: passed[index] ?? false,
    visibility: test.visibility,
    weight: test.weight,
  }));
  const score = cases.reduce(
    (sum, test) => sum + (test.passed ? test.weight : 0),
    0,
  );
  const details = {
    judgeToken: token,
    status: judgeResult.status.description,
    cases,
    score,
    time: judgeResult.time,
    memory: judgeResult.memory,
    compileOutput: judgeResult.compile_output
      ? Buffer.from(judgeResult.compile_output, "base64").toString("utf8")
      : null,
    stderr: judgeResult.stderr
      ? Buffer.from(judgeResult.stderr, "base64").toString("utf8")
      : null,
  };
  if (job.data.mode === "SUBMIT") {
    const callback = await fetch(
      `${env.ASSESSMENT_URL}/internal/attempts/${job.data.attemptId}/code-score`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          questionId: job.data.questionId,
          score,
          details,
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!callback.ok) {
      throw new Error(`Assessment score callback failed (${callback.status}).`);
    }
  }
  await job.updateProgress(100);
  return details;
}

if (env.DISABLE_EXECUTION_WORKER !== "true") {
  const worker = new Worker<ExecutionJob>(
    "icarus-execution",
    processExecution,
    {
      connection: redis,
      concurrency: env.EXECUTION_CONCURRENCY,
    },
  );
  worker.on("failed", (job, error) =>
    logger.error({ jobId: job?.id, error }, "execution job failed"),
  );
  worker.on("error", (error) =>
    logger.error({ error }, "execution worker failed"),
  );
}

app.get("/languages", (_request, response) =>
  response.json({
    languages: Object.entries(languageIds).map(([key, judge0Id]) => ({
      key,
      judge0Id,
    })),
  }),
);
app.post("/execute", validate(requestSchema), async (request, response) => {
  const user = actor(request);
  if (user.role !== "STUDENT") {
    return response.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "Only students can execute assessment attempts.",
      },
    });
  }
  const digest = createHash("sha256")
    .update(
      `${user.id}:${request.body.attemptId}:${request.body.questionId}:${request.body.language}:${request.body.mode}:${request.body.sourceCode}`,
    )
    .digest("hex")
    .slice(0, 32);
  const job = await queue.add(
    "judge",
    { ...request.body, studentId: user.id },
    {
      jobId: digest,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 604_800 },
    },
  );
  response.status(202).json({
    execution: {
      id: job.id,
      status: await job.getState(),
      progress: job.progress,
    },
  });
});

app.get("/executions/:jobId", async (request, response) => {
  const job = await queue.getJob(String(request.params.jobId));
  if (!job || job.data.studentId !== actor(request).id) {
    return response.status(404).json({
      error: {
        code: "EXECUTION_NOT_FOUND",
        message: "Execution not found.",
      },
    });
  }
  const state = await job.getState();
  response.json({
    execution: {
      id: job.id,
      status: state,
      progress: job.progress,
      result: state === "completed" ? job.returnvalue : undefined,
      error: state === "failed" ? job.failedReason : undefined,
    },
  });
});

listen(app, env.PORT);
