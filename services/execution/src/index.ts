import { createHash } from "node:crypto";
import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";
import { CodeQuestionSchema, type CodeQuestion } from "@icarus/contracts";
import { actor, createService, listen, validate } from "@icarus/service-kit";
import { buildHarness } from "./harness.js";

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
  cpp: Number(process.env.JUDGE0_CPP_ID ?? 54),
  java: Number(process.env.JUDGE0_JAVA_ID ?? 62),
  python: Number(process.env.JUDGE0_PYTHON_ID ?? 71),
  javascript: Number(process.env.JUDGE0_JAVASCRIPT_ID ?? 63),
};
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});
const queue = new Queue<ExecutionJob>("icarus-execution", {
  connection: redis,
});
const assessmentUrl = process.env.ASSESSMENT_URL ?? "http://localhost:4003";
const judgeUrl = process.env.JUDGE0_URL ?? "http://localhost:2358";
const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? "";

async function loadQuestion(
  attemptId: string,
  questionId: string,
  studentId: string,
): Promise<CodeQuestion> {
  const response = await fetch(
    `${assessmentUrl}/internal/attempts/${attemptId}/questions/${questionId}`,
    {
      headers: {
        authorization: `Bearer ${internalToken}`,
        "x-user-id": studentId,
        "x-user-role": "STUDENT",
      },
    },
  );
  if (!response.ok) throw new Error("Question could not be loaded.");
  const payload = (await response.json()) as { question: unknown };
  return CodeQuestionSchema.parse(payload.question);
}

async function waitForJudge(token: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await fetch(
      `${judgeUrl}/submissions/${token}?base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory`,
    );
    if (!response.ok) throw new Error("Judge0 status request failed.");
    const result = (await response.json()) as {
      status: { id: number; description: string };
      stdout?: string | null;
      stderr?: string | null;
      compile_output?: string | null;
      time?: string;
      memory?: number;
    };
    if (![1, 2].includes(result.status.id)) return result;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Judge0 did not finish within 30 seconds.");
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
  const response = await fetch(
    `${judgeUrl}/submissions?base64_encoded=true&wait=false`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.JUDGE0_TOKEN
          ? { "X-Auth-Token": process.env.JUDGE0_TOKEN }
          : {}),
      },
      body: JSON.stringify({
        source_code: Buffer.from(harness.source).toString("base64"),
        language_id: languageIds[job.data.language],
        cpu_time_limit: 3,
        wall_time_limit: 8,
        memory_limit: 128000,
        enable_network: false,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Judge0 rejected the submission (${response.status}).`);
  }
  const { token } = z
    .object({ token: z.string() })
    .parse(await response.json());
  await job.updateProgress(35);
  const judge = await waitForJudge(token);
  let passed: boolean[] = [];
  if (judge.status.id === 3 && judge.stdout) {
    const stdout = Buffer.from(judge.stdout, "base64").toString("utf8").trim();
    passed = z
      .object({ results: z.array(z.boolean()) })
      .parse(JSON.parse(stdout)).results;
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
    status: judge.status.description,
    cases,
    score,
    time: judge.time,
    memory: judge.memory,
    compileOutput: judge.compile_output
      ? Buffer.from(judge.compile_output, "base64").toString("utf8")
      : null,
    stderr: judge.stderr
      ? Buffer.from(judge.stderr, "base64").toString("utf8")
      : null,
  };
  if (job.data.mode === "SUBMIT") {
    const callback = await fetch(
      `${assessmentUrl}/internal/attempts/${job.data.attemptId}/code-score`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${internalToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          questionId: job.data.questionId,
          score,
          details,
        }),
      },
    );
    if (!callback.ok) throw new Error("Assessment score callback failed.");
  }
  await job.updateProgress(100);
  return details;
}

if (process.env.DISABLE_EXECUTION_WORKER !== "true") {
  new Worker<ExecutionJob>("icarus-execution", processExecution, {
    connection: redis,
    concurrency: Number(process.env.EXECUTION_CONCURRENCY ?? 2),
  });
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
      `${request.body.attemptId}:${request.body.questionId}:${request.body.mode}:${request.body.sourceCode}`,
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

listen(app, Number(process.env.PORT ?? 4004));
