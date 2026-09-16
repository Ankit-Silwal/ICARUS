import type { Language } from "@icarus/contracts";
import { env } from "../config/env.js";
import { conflict, notFound, unavailable } from "../lib/errors.js";

interface ProblemListEntry {
  paid_only: boolean;
  stat: {
    frontend_question_id: number;
    question__title_slug: string;
  };
}

interface ProblemListResponse {
  stat_status_pairs: ProblemListEntry[];
}

interface QuestionData {
  questionId: string;
  questionFrontendId: string;
  title: string;
  titleSlug: string;
  content: string | null;
  difficulty: string;
  exampleTestcases: string;
  metaData: string;
  topicTags: { name: string; slug: string }[];
  codeSnippets: { lang: string; langSlug: string; code: string }[];
}

const questionQuery = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      questionFrontendId
      title
      titleSlug
      content
      difficulty
      exampleTestcases
      metaData
      topicTags { name slug }
      codeSnippets { lang langSlug code }
    }
  }
`;

const languageBySlug: Record<string, Language | undefined> = {
  cpp: "cpp",
  java: "java",
  python3: "python",
  javascript: "javascript",
};

function decodeHtml(value: string) {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&nbsp;": " ",
  };
  return value.replace(
    /&(amp|lt|gt|quot|#39|nbsp);/g,
    (entity) => entities[entity] ?? entity,
  );
}

function plainText(html: string) {
  return decodeHtml(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(p|pre|li|h[1-6])>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

export class LeetCodeService {
  async load(problemNumber: number) {
    const listing = await this.fetchJson<ProblemListResponse>(
      env.LEETCODE_API_URL,
      {
        headers: { "user-agent": "ICARUS assessment importer" },
      },
    );
    const match = listing.stat_status_pairs.find(
      (entry) => entry.stat.frontend_question_id === problemNumber,
    );
    if (!match) throw notFound(`LeetCode problem ${problemNumber}`);
    if (match.paid_only) {
      throw conflict(
        "PREMIUM_PROBLEM",
        "Premium LeetCode content cannot be imported.",
      );
    }

    const result = await this.fetchJson<{
      data?: { question?: QuestionData | null };
      errors?: unknown[];
    }>(env.LEETCODE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://leetcode.com",
        referer: `https://leetcode.com/problems/${match.stat.question__title_slug}/`,
        "user-agent": "ICARUS assessment importer",
      },
      body: JSON.stringify({
        operationName: "questionData",
        query: questionQuery,
        variables: { titleSlug: match.stat.question__title_slug },
      }),
    });
    const question = result.data?.question;
    if (!question?.content) {
      throw unavailable(
        "LEETCODE_IMPORT_FAILED",
        "LeetCode did not return public problem content.",
      );
    }

    let metadata: { name?: string; params?: unknown; return?: unknown } = {};
    try {
      metadata = JSON.parse(question.metaData) as typeof metadata;
    } catch {
      // Some older questions do not expose machine-readable function metadata.
    }

    const starterCode: Partial<Record<Language, string>> = {};
    for (const snippet of question.codeSnippets) {
      const language = languageBySlug[snippet.langSlug];
      if (language) starterCode[language] = snippet.code;
    }

    return {
      title: question.title,
      prompt: plainText(question.content),
      functionName: metadata.name,
      difficulty: question.difficulty,
      tags: question.topicTags,
      exampleTestcases: question.exampleTestcases,
      starterCode,
      source: {
        provider: "LEETCODE" as const,
        problemNumber,
        url: `https://leetcode.com/problems/${question.titleSlug}/`,
      },
    };
  }

  private async fetchJson<T>(url: string, init: RequestInit) {
    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw unavailable(
        "LEETCODE_UNAVAILABLE",
        "LeetCode could not be reached.",
      );
    }
    if (!response.ok) {
      throw unavailable(
        "LEETCODE_IMPORT_FAILED",
        `LeetCode returned HTTP ${response.status}.`,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw unavailable(
        "LEETCODE_IMPORT_FAILED",
        "LeetCode returned an invalid response.",
      );
    }
  }
}

export const leetCodeService = new LeetCodeService();
