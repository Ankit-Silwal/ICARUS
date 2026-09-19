import { describe, expect, it } from "vitest";
import {
  assertJudgeInfrastructureHealthy,
  Judge0Client,
  parseHarnessResults,
} from "./judge.js";

describe("Judge0 infrastructure status", () => {
  it("allows student-code outcomes to be scored", () => {
    expect(() =>
      assertJudgeInfrastructureHealthy({ id: 3, description: "Accepted" }),
    ).not.toThrow();
    expect(() =>
      assertJudgeInfrastructureHealthy({
        id: 6,
        description: "Compilation Error",
      }),
    ).not.toThrow();
  });

  it("rejects Judge0 internal errors instead of recording a zero score", () => {
    expect(() =>
      assertJudgeInfrastructureHealthy({
        id: 13,
        description: "Internal Error",
      }),
    ).toThrow("Judge0 execution infrastructure failed (Internal Error).");
  });
});

describe("Judge0 client", () => {
  it("submits base64 source and authenticates submission and polling", async () => {
    const requests: { input: string; init?: RequestInit }[] = [];
    const fetchMock = async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      requests.push({ input: String(input), init });
      if (requests.length === 1) {
        return Response.json({ token: "judge-token" });
      }
      return Response.json({
        status: { id: 3, description: "Accepted" },
        stdout: Buffer.from('{"results":[true]}').toString("base64"),
      });
    };
    const client = new Judge0Client({
      baseUrl: "http://judge0.test/",
      authToken: "secret",
      fetch: fetchMock as typeof fetch,
      pollIntervalMilliseconds: 0,
      maximumPolls: 1,
    });

    const token = await client.submit("print('ok')", 71);
    const result = await client.waitForResult(token);

    expect(token).toBe("judge-token");
    expect(result.status.id).toBe(3);
    expect(requests).toHaveLength(2);
    expect(requests[0]?.init?.headers).toMatchObject({
      "X-Auth-Token": "secret",
      "content-type": "application/json",
    });
    expect(requests[1]?.init?.headers).toMatchObject({
      "X-Auth-Token": "secret",
    });
    const body = JSON.parse(String(requests[0]?.init?.body)) as {
      source_code: string;
      language_id: number;
      enable_network: boolean;
      enable_per_process_and_thread_time_limit: boolean;
      enable_per_process_and_thread_memory_limit: boolean;
    };
    expect(Buffer.from(body.source_code, "base64").toString("utf8")).toBe(
      "print('ok')",
    );
    expect(body.language_id).toBe(71);
    expect(body.enable_network).toBe(false);
    expect(body.enable_per_process_and_thread_time_limit).toBe(true);
    expect(body.enable_per_process_and_thread_memory_limit).toBe(true);
  });

  it("reads the harness result after user debug output", () => {
    const stdout = Buffer.from(
      'debug output\n{"results":[true,false]}\n',
    ).toString("base64");

    expect(parseHarnessResults(stdout, 2)).toEqual([true, false]);
  });

  it("rejects incomplete harness results", () => {
    const stdout = Buffer.from('{"results":[true]}').toString("base64");

    expect(() => parseHarnessResults(stdout, 2)).toThrow(
      "Judge0 returned 1 test results; expected 2.",
    );
  });
});
