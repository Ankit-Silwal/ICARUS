import { z } from "zod";

export interface JudgeStatus {
  id: number;
  description: string;
}

export interface JudgeResult {
  status: JudgeStatus;
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  time?: string | null;
  memory?: number | null;
}

interface Judge0ClientOptions {
  baseUrl: string;
  authToken?: string;
  fetch?: typeof globalThis.fetch;
  pollIntervalMilliseconds?: number;
  maximumPolls?: number;
}

interface SubmissionLimits {
  cpuTimeSeconds?: number;
  wallTimeSeconds?: number;
  memoryLimitKilobytes?: number;
}

const tokenSchema = z.object({ token: z.string().min(1) });
const resultSchema = z.object({
  status: z.object({ id: z.number().int(), description: z.string() }),
  stdout: z.string().nullable().optional(),
  stderr: z.string().nullable().optional(),
  compile_output: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  memory: z.number().nullable().optional(),
});
const harnessOutputSchema = z.object({ results: z.array(z.boolean()) });

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function assertJudgeInfrastructureHealthy(status: JudgeStatus): void {
  if (status.id === 13) {
    throw new Error(
      `Judge0 execution infrastructure failed (${status.description}).`,
    );
  }
}

export function parseHarnessResults(
  encodedStdout: string,
  expectedCount: number,
): boolean[] {
  const output = Buffer.from(encodedStdout, "base64").toString("utf8");
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();
  for (const line of lines) {
    try {
      const results = harnessOutputSchema.parse(JSON.parse(line)).results;
      if (results.length !== expectedCount) {
        throw new Error(
          `Judge0 returned ${results.length} test results; expected ${expectedCount}.`,
        );
      }
      return results;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Judge0 returned")
      ) {
        throw error;
      }
    }
  }
  throw new Error("Judge0 did not return a valid harness result.");
}

export class Judge0Client {
  private readonly baseUrl: string;
  private readonly authToken?: string;
  private readonly fetch: typeof globalThis.fetch;
  private readonly pollIntervalMilliseconds: number;
  private readonly maximumPolls: number;

  constructor(options: Judge0ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.authToken = options.authToken;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.pollIntervalMilliseconds = options.pollIntervalMilliseconds ?? 500;
    this.maximumPolls = options.maximumPolls ?? 60;
  }

  private headers(includeContentType = false): Record<string, string> {
    return {
      ...(includeContentType ? { "content-type": "application/json" } : {}),
      ...(this.authToken ? { "X-Auth-Token": this.authToken } : {}),
    };
  }

  async submit(
    source: string,
    languageId: number,
    limits: SubmissionLimits = {},
  ): Promise<string> {
    const response = await this.fetch(
      `${this.baseUrl}/submissions?base64_encoded=true&wait=false`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({
          source_code: Buffer.from(source).toString("base64"),
          language_id: languageId,
          cpu_time_limit: limits.cpuTimeSeconds ?? 3,
          wall_time_limit: limits.wallTimeSeconds ?? 8,
          memory_limit: limits.memoryLimitKilobytes ?? 128_000,
          max_processes_and_or_threads: 32,
          enable_per_process_and_thread_time_limit: true,
          enable_per_process_and_thread_memory_limit: true,
          enable_network: false,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      throw new Error(`Judge0 rejected the submission (${response.status}).`);
    }
    return tokenSchema.parse(await response.json()).token;
  }

  async waitForResult(token: string): Promise<JudgeResult> {
    for (let attempt = 0; attempt < this.maximumPolls; attempt += 1) {
      const response = await this.fetch(
        `${this.baseUrl}/submissions/${encodeURIComponent(token)}?base64_encoded=true&fields=status,stdout,stderr,compile_output,time,memory`,
        {
          headers: this.headers(),
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!response.ok) {
        throw new Error(`Judge0 status request failed (${response.status}).`);
      }
      const result = resultSchema.parse(await response.json());
      if (![1, 2].includes(result.status.id)) {
        assertJudgeInfrastructureHealthy(result.status);
        return result;
      }
      await delay(this.pollIntervalMilliseconds);
    }
    throw new Error(
      `Judge0 did not finish within ${Math.ceil((this.maximumPolls * this.pollIntervalMilliseconds) / 1000)} seconds.`,
    );
  }
}
