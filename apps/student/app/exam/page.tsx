"use client";
import Editor from "@monaco-editor/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  FileQuestion,
  Play,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { AuthGate } from "@repo/ui/auth-gate";

const initialCode = `function twoSum(nums, target) {
  const seen = new Map();

  for (let index = 0; index < nums.length; index++) {
    const complement = target - nums[index];
    if (seen.has(complement)) return [seen.get(complement), index];
    seen.set(nums[index], index);
  }

  return [];
}`;
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const questionId = "20000000-0000-4000-8000-000000000002";

function ExamWorkspace() {
  const [question, setQuestion] = useState(2);
  const [code, setCode] = useState(initialCode);
  const [saved, setSaved] = useState("Saved just now");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | "passed" | "failed">(null);
  const [seconds, setSeconds] = useState(61 * 60 + 42);
  const [pasteCount, setPasteCount] = useState(0);
  const [attemptId, setAttemptId] = useState<string>();
  const [language, setLanguage] = useState<
    "javascript" | "python" | "cpp" | "java"
  >("javascript");
  const previousLength = useRef(initialCode.length);
  const version = useRef(1);
  const sequence = useRef(1);
  const lastEdit = useRef(0);
  const pastePending = useRef(false);

  useEffect(() => {
    const examId =
      new URLSearchParams(window.location.search).get("examId") ??
      "30000000-0000-4000-8000-000000000001";
    void fetch(`${apiUrl}/assessments/exams/${examId}/start`, {
      method: "POST",
      credentials: "include",
    }).then(async (response) => {
      if (!response.ok) return;
      const body = (await response.json()) as {
        attempt: {
          id: string;
          expiresAt: string;
          answers?: Record<string, { answer?: unknown }>;
        };
      };
      setAttemptId(body.attempt.id);
      setSeconds(
        Math.max(
          0,
          Math.floor((Date.parse(body.attempt.expiresAt) - Date.now()) / 1000),
        ),
      );
      const savedCode = body.attempt.answers?.[questionId]?.answer;
      if (typeof savedCode === "string") setCode(savedCode);
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!attemptId) return;
    const currentVersion = version.current;
    const timer = window.setTimeout(() => {
      void fetch(`${apiUrl}/assessments/attempts/${attemptId}/autosave`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId,
          answer: code,
          version: currentVersion,
        }),
      }).then((response) =>
        setSaved(response.ok ? "Saved just now" : "Save failed"),
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [attemptId, code]);
  const execute = async (mode: "RUN" | "SUBMIT") => {
    if (!attemptId) return;
    setRunning(true);
    setResult(null);
    const response = await fetch(`${apiUrl}/execution/execute`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId,
        questionId,
        language,
        sourceCode: code,
        mode,
      }),
    });
    if (!response.ok) {
      setRunning(false);
      setResult("failed");
      return;
    }
    const { execution } = (await response.json()) as {
      execution: { id: string };
    };
    for (let poll = 0; poll < 60; poll += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const statusResponse = await fetch(
        `${apiUrl}/execution/executions/${execution.id}`,
        { credentials: "include" },
      );
      if (!statusResponse.ok) continue;
      const body = (await statusResponse.json()) as {
        execution: {
          status: string;
          result?: { cases: { passed: boolean }[] };
        };
      };
      if (body.execution.status === "completed") {
        setResult(
          body.execution.result?.cases.every((test) => test.passed)
            ? "passed"
            : "failed",
        );
        setRunning(false);
        return;
      }
      if (body.execution.status === "failed") {
        setResult("failed");
        setRunning(false);
        return;
      }
    }
    setRunning(false);
    setResult("failed");
  };
  const submitExam = async () => {
    if (!attemptId) return;
    await fetch(`${apiUrl}/assessments/attempts/${attemptId}/autosave`, {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        questionId,
        answer: code,
        version: version.current,
      }),
    });
    const response = await fetch(
      `${apiUrl}/assessments/attempts/${attemptId}/submit`,
      { method: "POST", credentials: "include" },
    );
    if (response.ok) await execute("SUBMIT");
  };
  const changeCode = (value = "") => {
    const inserted = Math.max(0, value.length - previousLength.current);
    if (inserted >= 20) setPasteCount((count) => count + 1);
    const now = Date.now();
    const event = {
      sequence: sequence.current++,
      occurredAt: new Date(now).toISOString(),
      action: pastePending.current
        ? "PASTE"
        : inserted > 0 &&
            previousLength.current > 0 &&
            value.length === previousLength.current
          ? "REPLACE"
          : inserted > 0
            ? "TYPE"
            : "DELETE",
      insertedCharacters: inserted,
      deletedCharacters: Math.max(0, previousLength.current - value.length),
      documentLength: value.length,
      cursorLine: 1,
      checksum: `${value.length}-${version.current}`,
      idleMilliseconds: lastEdit.current === 0 ? 0 : now - lastEdit.current,
    };
    pastePending.current = false;
    lastEdit.current = now;
    version.current += 1;
    if (attemptId)
      void fetch(`${apiUrl}/integrity/events`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, questionId, events: [event] }),
      });
    previousLength.current = value.length;
    setSaved("Saving…");
    setCode(value);
  };
  const time = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex h-screen min-h-[680px] flex-col overflow-hidden bg-[#F2F4F1] text-[#202B27]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#D7DDD8] bg-[#172520] px-4 text-white">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/"
            aria-label="Leave exam"
            className="grid size-8 place-items-center rounded-md hover:bg-white/10"
          >
            <ChevronLeft size={18} />
          </Link>
          <div className="h-6 w-px bg-white/15" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">
              Arrays & Hashing · Midterm
            </div>
            <div className="text-[10px] text-white/45">
              Data Structures · Section A
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 text-xs text-white/60 sm:flex">
            <Save size={14} />
            <span>{saved}</span>
          </div>
          <div className="flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 font-mono text-sm font-semibold">
            <Clock3 size={15} className="text-[#DFF36D]" />
            {time}
          </div>
          <Button
            onClick={submitExam}
            disabled={!attemptId || running}
            className="bg-[#DFF36D] text-[#172520] hover:bg-[#D3E961]"
          >
            <Send size={15} /> Submit exam
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#D7DDD8] bg-white lg:block">
          <div className="border-b border-[#E5E9E5] p-4">
            <div className="text-[11px] font-bold uppercase text-[#7D8984]">
              Questions
            </div>
            <div className="mt-1 text-xs text-[#8A9591]">
              20 marks · 2 questions
            </div>
          </div>
          <nav className="p-3">
            <button
              onClick={() => setQuestion(1)}
              className={`mb-2 flex w-full items-start gap-3 rounded-md border p-3 text-left ${question === 1 ? "border-[#AACCBF] bg-[#F0F7F4]" : "border-transparent hover:bg-[#F6F8F6]"}`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded bg-[#E6F3ED] text-[#176B5B]">
                <Check size={14} />
              </span>
              <span>
                <span className="block text-xs font-semibold">
                  1. Runtime reasoning
                </span>
                <span className="mt-1 block text-[11px] text-[#82908B]">
                  MCQ · 4 marks
                </span>
              </span>
            </button>
            <button
              onClick={() => setQuestion(2)}
              className={`flex w-full items-start gap-3 rounded-md border p-3 text-left ${question === 2 ? "border-[#AACCBF] bg-[#F0F7F4]" : "border-transparent hover:bg-[#F6F8F6]"}`}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded bg-[#176B5B] text-white">
                2
              </span>
              <span>
                <span className="block text-xs font-semibold">2. Two Sum</span>
                <span className="mt-1 block text-[11px] text-[#82908B]">
                  Coding · 16 marks
                </span>
              </span>
            </button>
          </nav>
          <div className="absolute bottom-0 w-[279px] border-t border-[#E5E9E5] bg-[#FAFBFA] p-4">
            <div className="flex items-start gap-2 text-[11px] leading-4 text-[#74817C]">
              <ShieldCheck size={16} className="shrink-0 text-[#176B5B]" />
              <span>
                Editing events are retained for review. Signals never change
                marks automatically.
              </span>
            </div>
          </div>
        </aside>
        {question === 2 ? (
          <main className="grid min-h-0 lg:grid-cols-[minmax(320px,0.8fr)_minmax(460px,1.2fr)]">
            <section className="overflow-y-auto border-r border-[#D7DDD8] bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase text-[#176B5B]">
                  <Code2 size={15} /> Coding problem
                </span>
                <span className="text-xs font-semibold text-[#6F7C77]">
                  16 marks
                </span>
              </div>
              <h1 className="text-xl font-bold">Two Sum</h1>
              <p className="mt-4 text-sm leading-6 text-[#53615B]">
                Given an array of integers <code>nums</code> and an integer{" "}
                <code>target</code>, return the indices of the two numbers whose
                sum equals the target.
              </p>
              <p className="mt-3 text-sm leading-6 text-[#53615B]">
                You may assume exactly one valid answer exists, and you may not
                use the same element twice.
              </p>
              <div className="mt-6">
                <div className="text-xs font-bold uppercase text-[#74817C]">
                  Function signature
                </div>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[#172520] p-3 font-mono text-xs text-[#DCE9E3]">
                  twoSum(nums: number[], target: number): number[]
                </pre>
              </div>
              <div className="mt-6">
                <div className="text-xs font-bold uppercase text-[#74817C]">
                  Sample
                </div>
                <div className="mt-2 rounded-md border border-[#DFE4E0] bg-[#F8F9F7] p-4 font-mono text-xs leading-6">
                  <div>
                    <span className="text-[#7C8984]">Input:</span> nums =
                    [2,7,11,15], target = 9
                  </div>
                  <div>
                    <span className="text-[#7C8984]">Output:</span> [0,1]
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-start gap-2 rounded-md border border-[#E7DFC5] bg-[#FFF9EA] p-3 text-xs leading-5 text-[#6E5825]">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                Hidden tests contribute 16 marks. Their inputs stay private
                during the exam.
              </div>
            </section>
            <section className="flex min-h-0 flex-col bg-[#111A17]">
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-3">
                <select
                  aria-label="Language"
                  value={language}
                  onChange={(event) =>
                    setLanguage(event.target.value as typeof language)
                  }
                  className="h-7 rounded border border-white/15 bg-[#1D2A26] px-2 text-xs text-white outline-none"
                >
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python 3</option>
                  <option value="cpp">C++17</option>
                  <option value="java">Java 17</option>
                </select>
                <div className="text-[11px] text-white/40">main.js</div>
              </div>
              <div
                onPaste={() => {
                  pastePending.current = true;
                  setPasteCount((count) => count + 1);
                }}
                className="min-h-0 flex-1"
              >
                <Editor
                  height="100%"
                  defaultLanguage="javascript"
                  theme="vs-dark"
                  value={code}
                  onChange={changeCode}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineHeight: 21,
                    padding: { top: 16 },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                  }}
                />
              </div>
              <div className="shrink-0 border-t border-white/10 bg-[#17211E]">
                <div className="flex h-11 items-center justify-between px-3">
                  <div className="text-xs text-white/50">
                    Sample tests{" "}
                    {pasteCount > 0 && (
                      <span className="ml-2 text-[#E5BB62]">
                        · {pasteCount} edit signal{pasteCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="h-8 border-white/15 bg-transparent text-white hover:bg-white/10"
                      onClick={() => execute("RUN")}
                    >
                      <Play size={14} />
                      {running ? "Running…" : "Run sample"}
                    </Button>
                    <Button
                      className="h-8"
                      onClick={() => execute("SUBMIT")}
                      disabled={running || !attemptId}
                    >
                      <Send size={14} /> Submit code
                    </Button>
                  </div>
                </div>
                {result && (
                  <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/65">
                    <span className="grid size-6 place-items-center rounded-full bg-[#2D856F] text-white">
                      <Check size={13} />
                    </span>
                    <div>
                      <strong className="text-white">
                        {result === "passed" ? "Tests passed" : "Tests failed"}
                      </strong>
                      <div className="mt-0.5 text-white/40">2 ms · 42.1 MB</div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>
        ) : (
          <main className="bg-white p-8">
            <div className="mx-auto max-w-2xl">
              <span className="flex items-center gap-2 text-xs font-bold uppercase text-[#176B5B]">
                <FileQuestion size={15} /> Multiple choice
              </span>
              <h1 className="mt-4 text-xl font-bold">Runtime reasoning</h1>
              <p className="mt-3 text-sm text-[#5C6964]">
                What is the average lookup complexity of a well-distributed hash
                table?
              </p>
              <div className="mt-6 space-y-3">
                {["O(1)", "O(log n)", "O(n)", "O(n log n)"].map((answer) => (
                  <label
                    key={answer}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-[#DCE2DD] p-4 text-sm hover:border-[#83AD9D]"
                  >
                    <input type="radio" name="runtime" />
                    {answer}
                  </label>
                ))}
              </div>
              <Button className="mt-6" onClick={() => setQuestion(2)}>
                Save & next <ChevronRight size={15} />
              </Button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}

export default function ExamPage() {
  return (
    <AuthGate requiredRole="STUDENT">
      <ExamWorkspace />
    </AuthGate>
  );
}
