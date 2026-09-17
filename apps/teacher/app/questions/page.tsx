"use client";

import type {
  CodeQuestion,
  Language,
  Question,
  QuestionInput,
  TestCase,
} from "@icarus/contracts";
import {
  BookOpenCheck,
  Braces,
  ClipboardCheck,
  FileQuestion,
  LayoutDashboard,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { AppShell, StatusPill } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const allLanguages: Language[] = ["cpp", "java", "python", "javascript"];
const defaultTests = JSON.stringify(
  [
    {
      id: "sample-1",
      label: "Sample",
      input: [1, 2],
      expected: 3,
      weight: 0,
      visibility: "SAMPLE",
    },
    {
      id: "hidden-1",
      label: "Hidden 1",
      input: [2, 3],
      expected: 5,
      weight: 10,
      visibility: "HIDDEN",
    },
  ],
  null,
  2,
);

interface LeetCodePreview {
  title: string;
  prompt: string;
  functionName?: string;
  difficulty: string;
  tags: { name: string; slug: string }[];
  exampleTestcases: string;
  starterCode: Partial<Record<Language, string>>;
  source: NonNullable<CodeQuestion["source"]>;
}

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}

export default function QuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [kind, setKind] = useState<"MCQ" | "CODE">("MCQ");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [points, setPoints] = useState(10);
  const [options, setOptions] = useState([
    { id: "a", label: "" },
    { id: "b", label: "" },
  ]);
  const [correctOptionId, setCorrectOptionId] = useState("a");
  const [functionName, setFunctionName] = useState("solve");
  const [languages, setLanguages] = useState<Language[]>(["javascript"]);
  const [starterCode, setStarterCode] = useState<
    Partial<Record<Language, string>>
  >({ javascript: "function solve() {}" });
  const [testsText, setTestsText] = useState(defaultTests);
  const [source, setSource] = useState<CodeQuestion["source"]>();
  const [problemNumber, setProblemNumber] = useState("");
  const [preview, setPreview] = useState<LeetCodePreview>();
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void fetch(`${apiUrl}/assessments/questions`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          setError(
            await responseError(response, "Questions could not be loaded."),
          );
          return;
        }
        const body = (await response.json()) as { questions: Question[] };
        setQuestions(body.questions);
      })
      .catch(() => setError("The assessment service is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  const resetEditor = (nextKind: "MCQ" | "CODE" = "MCQ") => {
    setEditingId("");
    setKind(nextKind);
    setTitle("");
    setPrompt("");
    setPoints(10);
    setOptions([
      { id: "a", label: "" },
      { id: "b", label: "" },
    ]);
    setCorrectOptionId("a");
    setFunctionName("solve");
    setLanguages(["javascript"]);
    setStarterCode({ javascript: "function solve() {}" });
    setTestsText(defaultTests);
    setSource(undefined);
    setPreview(undefined);
    setProblemNumber("");
    setError("");
    setNotice("");
    setShowEditor(true);
  };

  const editQuestion = (question: Question) => {
    setEditingId(question.id);
    setKind(question.kind);
    setTitle(question.title);
    setPrompt(question.prompt);
    setPoints(question.points);
    if (question.kind === "MCQ") {
      setOptions(question.options);
      setCorrectOptionId(question.correctOptionId);
    } else {
      setFunctionName(question.functionName);
      setLanguages(question.languages);
      setStarterCode(question.starterCode);
      setTestsText(JSON.stringify(question.tests, null, 2));
      setSource(question.source);
    }
    setPreview(undefined);
    setProblemNumber("");
    setError("");
    setNotice("");
    setShowEditor(true);
  };

  const saveQuestion = async (event: FormEvent) => {
    event.preventDefault();
    setWorking("save");
    setError("");
    let input: QuestionInput;
    try {
      if (kind === "MCQ") {
        input = {
          kind,
          title,
          prompt,
          points,
          options,
          correctOptionId,
        };
      } else {
        const tests = JSON.parse(testsText) as TestCase[];
        input = {
          kind,
          title,
          prompt,
          points,
          functionName,
          languages,
          starterCode,
          tests,
          ...(source ? { source } : {}),
        };
      }
    } catch {
      setError("Test cases must be valid JSON.");
      setWorking("");
      return;
    }
    const response = await fetch(
      editingId
        ? `${apiUrl}/assessments/questions/${editingId}`
        : `${apiUrl}/assessments/questions`,
      {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The question could not be saved.")
          : "The assessment service is unavailable.",
      );
    } else {
      const body = (await response.json()) as { question: Question };
      setQuestions((current) => [
        body.question,
        ...current.filter((item) => item.id !== body.question.id),
      ]);
      setShowEditor(false);
      setNotice(editingId ? "Question updated." : "Question created.");
    }
    setWorking("");
  };

  const removeQuestion = async (question: Question) => {
    if (
      !window.confirm(
        `Delete ${question.title}? Existing exam snapshots will remain unchanged.`,
      )
    )
      return;
    setWorking(question.id);
    setError("");
    const response = await fetch(
      `${apiUrl}/assessments/questions/${question.id}`,
      { method: "DELETE", credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The question could not be deleted.")
          : "The assessment service is unavailable.",
      );
    } else {
      setQuestions((current) =>
        current.filter((item) => item.id !== question.id),
      );
      setNotice("Question deleted; existing exam snapshots were preserved.");
    }
    setWorking("");
  };

  const previewLeetCode = async () => {
    const number = Number(problemNumber);
    if (!Number.isInteger(number) || number <= 0) {
      setError("Enter a positive LeetCode problem number.");
      return;
    }
    setWorking("preview");
    setError("");
    const response = await fetch(
      `${apiUrl}/assessments/questions/import/leetcode/${number}/preview`,
      { credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(
              response,
              "The public problem could not be loaded.",
            )
          : "LeetCode is unavailable.",
      );
    } else {
      const body = (await response.json()) as { problem: LeetCodePreview };
      setPreview(body.problem);
      setKind("CODE");
      setTitle(body.problem.title);
      setPrompt(body.problem.prompt);
      setFunctionName(body.problem.functionName ?? "solve");
      const available = allLanguages.filter(
        (language) => body.problem.starterCode[language],
      );
      setLanguages(available.length > 0 ? available : ["javascript"]);
      setStarterCode(body.problem.starterCode);
      setSource(body.problem.source);
    }
    setWorking("");
  };

  const toggleLanguage = (language: Language) => {
    setLanguages((current) =>
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language],
    );
  };

  return (
    <AppShell
      role="Teacher"
      name="Maya Rao"
      initials="MR"
      navigation={[
        { label: "Overview", href: "/", icon: <LayoutDashboard size={17} /> },
        { label: "Classes", href: "/classes", icon: <Users size={17} /> },
        {
          label: "Question bank",
          href: "/questions",
          active: true,
          icon: <FileQuestion size={17} />,
        },
        { label: "Exams", href: "/exams", icon: <BookOpenCheck size={17} /> },
        {
          label: "Review & grading",
          href: "/reviews",
          icon: <ClipboardCheck size={17} />,
        },
      ]}
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
            Assessment authoring
          </p>
          <h1 className="text-2xl font-bold">Question bank</h1>
          <p className="mt-1 text-sm text-[#6E7B76]">
            Author reusable questions. Scheduled exams keep immutable copies.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => resetEditor("CODE")}>
            <Braces size={16} /> New coding question
          </Button>
          <Button onClick={() => resetEditor("MCQ")}>
            <Plus size={16} /> New MCQ
          </Button>
        </div>
      </div>

      {(error || notice) && !showEditor && (
        <p
          className={`mb-4 rounded-md border p-3 text-sm ${
            error
              ? "border-[#E8C9C5] bg-[#FFF7F5] text-[#A33D32]"
              : "border-[#CFE4D8] bg-[#F1FAF5] text-[#176B5B]"
          }`}
        >
          {error || notice}
        </p>
      )}

      {loading ? (
        <Card className="p-8 text-sm text-[#73807B]">Loading questions…</Card>
      ) : questions.length === 0 ? (
        <Card className="p-10 text-center">
          <FileQuestion className="mx-auto text-[#81908A]" size={32} />
          <h2 className="mt-3 font-bold">No questions yet</h2>
          <p className="mt-1 text-sm text-[#73807B]">
            Create an MCQ or coding question to begin an exam.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {questions.map((question) => (
            <Card key={question.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <StatusPill
                      tone={question.kind === "CODE" ? "green" : "neutral"}
                    >
                      {question.kind}
                    </StatusPill>
                    <span className="text-xs font-semibold text-[#7A8782]">
                      {question.points} marks
                    </span>
                  </div>
                  <h2 className="mt-3 font-bold">{question.title}</h2>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    onClick={() => editQuestion(question)}
                  >
                    <Pencil size={14} /> Edit
                  </Button>
                  <Button
                    variant="danger"
                    disabled={working === question.id}
                    onClick={() => void removeQuestion(question)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#65736D]">
                {question.prompt}
              </p>
              <div className="mt-4 border-t border-[#E7EAE7] pt-3 text-xs text-[#73807B]">
                {question.kind === "MCQ"
                  ? `${question.options.length} options`
                  : `${question.languages.length} languages · ${question.tests.filter((test) => test.visibility === "HIDDEN").length} hidden tests`}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showEditor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F1C18]/50 p-4">
          <form
            onSubmit={saveQuestion}
            className="mx-auto my-4 w-full max-w-3xl rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E6E3] px-5 py-4">
              <div>
                <h2 className="font-bold">
                  {editingId ? "Edit question" : "Create question"}
                </h2>
                <p className="text-xs text-[#7D8984]">
                  Existing exam snapshots are never changed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="text-sm font-semibold text-[#64716C]"
              >
                Close
              </button>
            </div>

            <div className="space-y-5 p-5">
              {!editingId && kind === "CODE" && (
                <div className="rounded-md border border-[#DDE5DF] bg-[#F7FAF8] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles size={15} className="text-[#176B5B]" />
                    Import public LeetCode content
                  </div>
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={problemNumber}
                      onChange={(event) => setProblemNumber(event.target.value)}
                      placeholder="Problem number"
                      className="h-9 min-w-0 flex-1 rounded-md border border-[#D8DED9] px-3 text-sm"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={working === "preview"}
                      onClick={() => void previewLeetCode()}
                    >
                      {working === "preview" ? "Loading…" : "Preview"}
                    </Button>
                  </div>
                  {preview && (
                    <p className="mt-3 text-xs text-[#65736D]">
                      {preview.difficulty} ·{" "}
                      {preview.tags.map((tag) => tag.name).join(", ")}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-5 text-[#7A8782]">
                    Only public statements and starter snippets are imported.
                    You must supply every test and its expected output.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-[1fr_160px_140px]">
                <label className="block text-xs font-semibold">
                  Title
                  <input
                    required
                    minLength={1}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Type
                  <select
                    value={kind}
                    disabled={Boolean(editingId)}
                    onChange={(event) =>
                      setKind(event.target.value as "MCQ" | "CODE")
                    }
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  >
                    <option value="MCQ">MCQ</option>
                    <option value="CODE">Code</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold">
                  Marks
                  <input
                    required
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={points}
                    onChange={(event) => setPoints(Number(event.target.value))}
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold">
                Prompt
                <textarea
                  required
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={6}
                  className="mt-1.5 w-full rounded-md border border-[#D8DED9] p-3 text-sm"
                />
              </label>

              {kind === "MCQ" ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold">Options</h3>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const id = String.fromCharCode(97 + options.length);
                        setOptions((current) => [
                          ...current,
                          { id, label: "" },
                        ]);
                      }}
                    >
                      <Plus size={13} /> Add option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {options.map((option, index) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="correct-option"
                          checked={correctOptionId === option.id}
                          onChange={() => setCorrectOptionId(option.id)}
                          aria-label={`Mark option ${index + 1} correct`}
                        />
                        <input
                          required
                          value={option.label}
                          onChange={(event) =>
                            setOptions((current) =>
                              current.map((item) =>
                                item.id === option.id
                                  ? { ...item, label: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder={`Option ${index + 1}`}
                          className="h-9 flex-1 rounded-md border border-[#D8DED9] px-3 text-sm"
                        />
                        {options.length > 2 && (
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => {
                              setOptions((current) =>
                                current.filter((item) => item.id !== option.id),
                              );
                              if (correctOptionId === option.id) {
                                setCorrectOptionId(options[0]?.id ?? "a");
                              }
                            }}
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[#7A8782]">
                    Select the radio button beside the correct answer.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <label className="block text-xs font-semibold">
                    Function name
                    <input
                      required
                      value={functionName}
                      onChange={(event) => setFunctionName(event.target.value)}
                      className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 font-mono text-sm"
                    />
                  </label>
                  <div>
                    <h3 className="text-xs font-semibold">Languages</h3>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {allLanguages.map((language) => (
                        <label
                          key={language}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={languages.includes(language)}
                            onChange={() => toggleLanguage(language)}
                          />
                          {language}
                        </label>
                      ))}
                    </div>
                  </div>
                  {languages.map((language) => (
                    <label
                      key={language}
                      className="block text-xs font-semibold"
                    >
                      {language} starter code
                      <textarea
                        required
                        value={starterCode[language] ?? ""}
                        onChange={(event) =>
                          setStarterCode((current) => ({
                            ...current,
                            [language]: event.target.value,
                          }))
                        }
                        rows={4}
                        className="mt-1.5 w-full rounded-md border border-[#D8DED9] p-3 font-mono text-xs"
                      />
                    </label>
                  ))}
                  <label className="block text-xs font-semibold">
                    Tests JSON
                    <textarea
                      required
                      value={testsText}
                      onChange={(event) => setTestsText(event.target.value)}
                      rows={12}
                      className="mt-1.5 w-full rounded-md border border-[#D8DED9] p-3 font-mono text-xs"
                    />
                  </label>
                  <p className="text-xs leading-5 text-[#7A8782]">
                    Samples must award 0 marks. Hidden-test weights must total
                    the question marks. Hidden judge cases are never imported.
                  </p>
                </div>
              )}

              {error && (
                <p className="rounded-md border border-[#E8C9C5] bg-[#FFF7F5] p-3 text-sm text-[#A33D32]">
                  {error}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E2E6E3] px-5 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowEditor(false)}
              >
                Cancel
              </Button>
              <Button disabled={working === "save"}>
                {working === "save" ? "Saving…" : "Save question"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
