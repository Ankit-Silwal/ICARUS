import type { CodeQuestion, Language } from "@icarus/contracts";
import { buildHarness } from "./harness.js";
import { Judge0Client, parseHarnessResults } from "./judge.js";

const question: CodeQuestion = {
  id: "30000000-0000-4000-8000-000000000001",
  kind: "CODE",
  title: "Add two numbers",
  prompt: "Return the sum of two numbers.",
  points: 2,
  functionName: "add",
  languages: ["cpp", "java", "python", "javascript"],
  starterCode: {},
  tests: [
    {
      id: "sample-1",
      label: "Positive numbers",
      input: [2, 3],
      expected: 5,
      visibility: "SAMPLE",
      weight: 0,
    },
  ],
};

const submissions: Record<Language, { languageId: number; source: string }> = {
  cpp: {
    languageId: Number(process.env.JUDGE0_CPP_ID ?? 54),
    source:
      "class Solution { public: int add(int left, int right) { return left + right; } };",
  },
  java: {
    languageId: Number(process.env.JUDGE0_JAVA_ID ?? 62),
    source:
      "class Solution { public int add(int left, int right) { return left + right; } }",
  },
  python: {
    languageId: Number(process.env.JUDGE0_PYTHON_ID ?? 71),
    source:
      "class Solution:\n    def add(self, left: int, right: int) -> int:\n        return left + right",
  },
  javascript: {
    languageId: Number(process.env.JUDGE0_JAVASCRIPT_ID ?? 63),
    source: "function add(left, right) { return left + right; }",
  },
};

function decode(value?: string | null) {
  return value ? Buffer.from(value, "base64").toString("utf8") : "";
}

const client = new Judge0Client({
  baseUrl: process.env.JUDGE0_URL ?? "http://localhost:2358",
  authToken: process.env.JUDGE0_TOKEN,
});

for (const language of question.languages) {
  const submission = submissions[language];
  const harness = buildHarness(question, language, submission.source, "RUN");
  const token = await client.submit(harness.source, submission.languageId, {
    memoryLimitKilobytes:
      language === "java"
        ? 1_536_000
        : language === "javascript"
          ? 1_024_000
          : 128_000,
    cpuTimeSeconds: language === "javascript" ? 10 : 3,
    wallTimeSeconds: language === "javascript" ? 15 : 8,
  });
  const result = await client.waitForResult(token);
  if (result.status.id !== 3) {
    throw new Error(
      `${language} failed with ${result.status.description}: ${decode(result.compile_output) || decode(result.stderr)}`,
    );
  }
  const passed = parseHarnessResults(result.stdout ?? "", harness.tests.length);
  if (!passed.every(Boolean)) {
    throw new Error(`${language} produced an incorrect result.`);
  }
  console.log(`${language}: accepted`);
}
