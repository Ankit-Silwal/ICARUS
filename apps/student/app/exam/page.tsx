"use client";

import Editor, {
  type OnChange as EditorOnChange,
  type OnMount as EditorOnMount,
} from "@monaco-editor/react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Code2,
  FileQuestion,
  LoaderCircle,
  Play,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "@repo/ui/auth-gate";
import { Button } from "@repo/ui/button";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const integrityBatchSize = 100;

type Language = "cpp" | "java" | "python" | "javascript";
type EditorAction =
  | "TYPE"
  | "PASTE"
  | "DELETE"
  | "REPLACE"
  | "UNDO"
  | "REDO"
  | "FOCUS_LOST"
  | "FOCUS_GAINED";

interface BaseQuestion {
  id: string;
  title: string;
  prompt: string;
  points: number;
}

interface McqQuestion extends BaseQuestion {
  kind: "MCQ";
  options: { id: string; label: string }[];
}

interface CodeQuestion extends BaseQuestion {
  kind: "CODE";
  functionName: string;
  languages: Language[];
  starterCode: Partial<Record<Language, string>>;
  tests: {
    id: string;
    label: string;
    input: unknown;
    expected: unknown;
    weight: number;
    visibility: "SAMPLE";
  }[];
}

type Question = McqQuestion | CodeQuestion;

interface Exam {
  id: string;
  title: string;
  durationMinutes: number;
  integrityPolicy: { enabled: boolean };
  questions: Question[];
}

interface Attempt {
  id: string;
  expiresAt: string;
  answers: Record<
    string,
    { answer?: unknown; version: number; savedAt?: string }
  >;
}

interface IntegrityEvent {
  sequence: number;
  occurredAt: string;
  action: EditorAction;
  insertedCharacters: number;
  deletedCharacters: number;
  documentLength: number;
  cursorLine: number;
  checksum: string;
  idleMilliseconds: number;
}

interface PendingIntegrityEvent {
  questionId: string;
  event: IntegrityEvent;
}

function documentChecksum(value: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function languageLabel(language: Language) {
  return {
    cpp: "C++",
    java: "Java",
    python: "Python",
    javascript: "JavaScript",
  }[language];
}

function ExamWorkspace() {
  const [exam, setExam] = useState<Exam>();
  const [attemptId, setAttemptId] = useState<string>();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [languages, setLanguages] = useState<Record<string, Language>>({});
  const [saved, setSaved] = useState("Loading assessment…");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | "passed" | "failed">(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const versions = useRef<Record<string, number>>({});
  const dirtyQuestions = useRef(new Set<string>());
  const sequenceByQuestion = useRef<Record<string, number>>({});
  const lastEditAtByQuestion = useRef<Record<string, number>>({});
  const pastePending = useRef(false);
  const cursorLine = useRef(1);
  const answersRef = useRef<Record<string, string>>({});
  const activeQuestionRef = useRef<Question | undefined>(undefined);
  const attemptIdRef = useRef<string | undefined>(undefined);
  const attemptActive = useRef(true);
  const integrityEnabled = useRef(false);
  const pendingIntegrityEvents = useRef<PendingIntegrityEvent[]>([]);
  const flushPromise = useRef<Promise<Response> | null>(null);
  const focusState = useRef<"FOCUSED" | "BLURRED">("FOCUSED");

  const activeQuestion = exam?.questions[questionIndex];

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const totalPoints = useMemo(
    () =>
      exam?.questions.reduce((sum, question) => sum + question.points, 0) ?? 0,
    [exam],
  );

  const queueIntegrityEvent = useCallback(
    (
      question: CodeQuestion,
      action: EditorAction,
      value: string,
      insertedCharacters = 0,
      deletedCharacters = 0,
    ) => {
      if (!attemptActive.current || !integrityEnabled.current) return;
      const now = Date.now();
      const isEdit = action !== "FOCUS_LOST" && action !== "FOCUS_GAINED";
      const sequence = sequenceByQuestion.current[question.id] ?? 1;
      pendingIntegrityEvents.current.push({
        questionId: question.id,
        event: {
          sequence,
          occurredAt: new Date(now).toISOString(),
          action,
          insertedCharacters,
          deletedCharacters,
          documentLength: value.length,
          cursorLine: cursorLine.current,
          checksum: documentChecksum(value),
          idleMilliseconds:
            isEdit && lastEditAtByQuestion.current[question.id]
              ? now - lastEditAtByQuestion.current[question.id]
              : 0,
        },
      });
      sequenceByQuestion.current[question.id] = sequence + 1;
      if (isEdit) lastEditAtByQuestion.current[question.id] = now;
    },
    [],
  );

  const flushIntegrityEvents = useCallback(async (keepalive = false) => {
    while (attemptIdRef.current && pendingIntegrityEvents.current.length > 0) {
      if (flushPromise.current) {
        if (keepalive) return;
        await flushPromise.current.catch(() => undefined);
        continue;
      }
      const activeAttemptId = attemptIdRef.current;
      const questionId = pendingIntegrityEvents.current[0]?.questionId;
      if (!questionId) return;
      const batch = pendingIntegrityEvents.current
        .filter((item) => item.questionId === questionId)
        .slice(0, integrityBatchSize);
      const batchSequences = new Set(batch.map((item) => item.event.sequence));
      pendingIntegrityEvents.current = pendingIntegrityEvents.current.filter(
        (item) =>
          item.questionId !== questionId ||
          !batchSequences.has(item.event.sequence),
      );
      const request = fetch(`${apiUrl}/integrity/events`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId: activeAttemptId,
          questionId,
          events: batch.map((item) => item.event),
        }),
        keepalive,
      });
      flushPromise.current = request;
      try {
        const response = await request;
        if (!response.ok) {
          pendingIntegrityEvents.current.unshift(...batch);
          return;
        }
      } catch {
        pendingIntegrityEvents.current.unshift(...batch);
        return;
      } finally {
        if (flushPromise.current === request) flushPromise.current = null;
      }
      if (keepalive) return;
    }
  }, []);

  useEffect(() => {
    const loadAssessment = async () => {
      const examId = new URLSearchParams(window.location.search).get("examId");
      if (!examId) {
        throw new Error(
          "Choose an assessment from your dashboard before opening the exam workspace.",
        );
      }
      const [examResponse, attemptResponse] = await Promise.all([
        fetch(`${apiUrl}/assessments/exams/${examId}`, {
          credentials: "include",
        }),
        fetch(`${apiUrl}/assessments/exams/${examId}/start`, {
          method: "POST",
          credentials: "include",
        }),
      ]);
      if (!examResponse.ok || !attemptResponse.ok) {
        const failed = !attemptResponse.ok ? attemptResponse : examResponse;
        const payload = (await failed.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          payload?.error?.message ?? "The assessment could not be opened.",
        );
      }
      const { exam: loadedExam } = (await examResponse.json()) as {
        exam: Exam;
      };
      const { attempt } = (await attemptResponse.json()) as {
        attempt: Attempt;
      };
      const hydratedAnswers: Record<string, string> = {};
      const initialLanguages: Record<string, Language> = {};
      for (const question of loadedExam.questions) {
        const stored = attempt.answers?.[question.id];
        versions.current[question.id] = (stored?.version ?? 0) + 1;
        sequenceByQuestion.current[question.id] = 1;
        if (question.kind === "CODE") {
          const language = question.languages[0] ?? "javascript";
          initialLanguages[question.id] = language;
          hydratedAnswers[question.id] =
            typeof stored?.answer === "string"
              ? stored.answer
              : (question.starterCode[language] ?? "");
        } else if (typeof stored?.answer === "string") {
          hydratedAnswers[question.id] = stored.answer;
        }
      }
      setExam(loadedExam);
      setAttemptId(attempt.id);
      attemptIdRef.current = attempt.id;
      integrityEnabled.current = loadedExam.integrityPolicy.enabled;
      attemptActive.current = true;
      setAnswers(hydratedAnswers);
      setLanguages(initialLanguages);
      setSeconds(
        Math.max(
          0,
          Math.floor((Date.parse(attempt.expiresAt) - Date.now()) / 1_000),
        ),
      );
      setSaved("All answers saved");
    };
    void loadAssessment().catch((reason: unknown) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "The assessment could not be opened.",
      ),
    );
  }, []);

  useEffect(() => {
    if (!attemptId) return;
    const timer = window.setInterval(() => void flushIntegrityEvents(), 2_000);
    return () => window.clearInterval(timer);
  }, [attemptId, flushIntegrityEvents]);

  useEffect(() => {
    if (!attemptId) return;
    focusState.current =
      document.visibilityState === "hidden" || !document.hasFocus()
        ? "BLURRED"
        : "FOCUSED";
    const recordFocus = (next: "FOCUSED" | "BLURRED") => {
      if (focusState.current === next) return;
      focusState.current = next;
      const question = activeQuestionRef.current;
      if (question?.kind === "CODE") {
        queueIntegrityEvent(
          question,
          next === "FOCUSED" ? "FOCUS_GAINED" : "FOCUS_LOST",
          answersRef.current[question.id] ?? "",
        );
      }
      if (next === "BLURRED") void flushIntegrityEvents(true);
    };
    const onVisibilityChange = () =>
      recordFocus(
        document.visibilityState === "hidden" ? "BLURRED" : "FOCUSED",
      );
    const onPageHide = () => void flushIntegrityEvents(true);
    const onBlur = () => recordFocus("BLURRED");
    const onFocus = () => recordFocus("FOCUSED");
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      void flushIntegrityEvents(true);
    };
  }, [attemptId, flushIntegrityEvents, queueIntegrityEvent]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setSeconds((value) => Math.max(0, value - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      !attemptId ||
      !activeQuestion ||
      !dirtyQuestions.current.has(activeQuestion.id)
    ) {
      return;
    }
    const questionId = activeQuestion.id;
    const timer = window.setTimeout(() => {
      void fetch(`${apiUrl}/assessments/attempts/${attemptId}/autosave`, {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId,
          answer: answersRef.current[questionId] ?? "",
          version: versions.current[questionId],
        }),
      }).then((response) => {
        if (response.ok) dirtyQuestions.current.delete(questionId);
        setSaved(response.ok ? "All answers saved" : "Save failed — retrying");
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [activeQuestion, answers, attemptId]);

  const updateAnswer = (questionId: string, answer: string) => {
    versions.current[questionId] = (versions.current[questionId] ?? 0) + 1;
    dirtyQuestions.current.add(questionId);
    setSaved("Saving…");
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  };

  const changeCode: EditorOnChange = (value = "", change) => {
    if (!activeQuestion || activeQuestion.kind !== "CODE") return;
    const inserted = change.changes.reduce(
      (total, item) => total + item.text.length,
      0,
    );
    const deleted = change.changes.reduce(
      (total, item) => total + item.rangeLength,
      0,
    );
    const action: EditorAction = change.isUndoing
      ? "UNDO"
      : change.isRedoing
        ? "REDO"
        : pastePending.current
          ? "PASTE"
          : inserted > 0 && deleted > 0
            ? "REPLACE"
            : inserted > 0
              ? "TYPE"
              : "DELETE";
    queueIntegrityEvent(activeQuestion, action, value, inserted, deleted);
    pastePending.current = false;
    updateAnswer(activeQuestion.id, value);
  };

  const mountEditor: EditorOnMount = (editor) => {
    cursorLine.current = editor.getPosition()?.lineNumber ?? 1;
    editor.onDidChangeCursorPosition(({ position }) => {
      cursorLine.current = position.lineNumber;
    });
  };

  const execute = async (mode: "RUN" | "SUBMIT", question: CodeQuestion) => {
    if (!attemptId) return false;
    setRunning(true);
    setResult(null);
    const response = await fetch(`${apiUrl}/execution/execute`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        attemptId,
        questionId: question.id,
        language: languages[question.id] ?? question.languages[0],
        sourceCode: answersRef.current[question.id] ?? "",
        mode,
      }),
    });
    if (!response.ok) {
      setRunning(false);
      setResult("failed");
      return false;
    }
    if (mode === "SUBMIT") {
      setRunning(false);
      return true;
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
        return true;
      }
      if (body.execution.status === "failed") break;
    }
    setRunning(false);
    setResult("failed");
    return false;
  };

  const submitExam = async () => {
    if (!attemptId || !exam) return;
    setRunning(true);
    const saves = exam.questions
      .filter((question) => answersRef.current[question.id] !== undefined)
      .map((question) =>
        fetch(`${apiUrl}/assessments/attempts/${attemptId}/autosave`, {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            questionId: question.id,
            answer: answersRef.current[question.id],
            version: versions.current[question.id],
          }),
        }),
      );
    const saveResponses = await Promise.all(saves);
    if (saveResponses.some((response) => !response.ok)) {
      setError("One or more answers could not be saved. Please try again.");
      setRunning(false);
      return;
    }
    await flushIntegrityEvents();
    const response = await fetch(
      `${apiUrl}/assessments/attempts/${attemptId}/submit`,
      { method: "POST", credentials: "include" },
    );
    if (!response.ok) {
      setError("The assessment could not be submitted. Please try again.");
      setRunning(false);
      return;
    }
    attemptActive.current = false;
    for (const question of exam.questions) {
      if (question.kind === "CODE" && answersRef.current[question.id]) {
        await execute("SUBMIT", question);
      }
    }
    setRunning(false);
    setSubmitted(true);
    setSaved("Assessment submitted");
  };

  const time = `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(
    Math.floor((seconds % 3600) / 60),
  ).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (error && !exam) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F2F4F1] p-5">
        <div className="max-w-md rounded-lg border border-[#E8C9C5] bg-white p-6">
          <AlertCircle className="text-[#A33D32]" />
          <h1 className="mt-3 text-lg font-bold">Unable to open assessment</h1>
          <p className="mt-2 text-sm leading-6 text-[#68756F]">{error}</p>
          <Link
            className="mt-5 inline-block text-sm font-semibold text-[#176B5B]"
            href="/"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!exam || !activeQuestion) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F2F4F1] text-sm text-[#68756F]">
        <span className="flex items-center gap-2">
          <LoaderCircle className="animate-spin" size={17} /> Loading
          assessment…
        </span>
      </div>
    );
  }

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
            <div className="truncate text-sm font-semibold">{exam.title}</div>
            <div className="text-[10px] text-white/45">
              {exam.questions.length} questions · {totalPoints} marks
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 text-xs text-white/60 sm:flex">
            <Save size={14} /> <span>{saved}</span>
          </div>
          <div className="flex h-9 items-center gap-2 rounded-md bg-white/10 px-3 font-mono text-sm font-semibold">
            <Clock3 size={15} className="text-[#DFF36D]" /> {time}
          </div>
          <Button
            onClick={submitExam}
            disabled={!attemptId || running || submitted}
            className="bg-[#DFF36D] text-[#172520] hover:bg-[#D3E961]"
          >
            <Send size={15} /> {submitted ? "Submitted" : "Submit exam"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#D7DDD8] bg-white lg:flex lg:flex-col">
          <div className="border-b border-[#E5E9E5] p-4">
            <div className="text-[11px] font-bold uppercase text-[#7D8984]">
              Questions
            </div>
            <div className="mt-1 text-xs text-[#8A9591]">
              {totalPoints} marks · {exam.questions.length} questions
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            {exam.questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => {
                  setQuestionIndex(index);
                  setResult(null);
                }}
                className={`mb-2 flex w-full items-start gap-3 rounded-md border p-3 text-left ${
                  index === questionIndex
                    ? "border-[#AACCBF] bg-[#F0F7F4]"
                    : "border-transparent hover:bg-[#F6F8F6]"
                }`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded ${
                    answers[question.id]
                      ? "bg-[#E6F3ED] text-[#176B5B]"
                      : "bg-[#EEF1EE] text-[#65716D]"
                  }`}
                >
                  {answers[question.id] ? <Check size={14} /> : index + 1}
                </span>
                <span>
                  <span className="block text-xs font-semibold">
                    {index + 1}. {question.title}
                  </span>
                  <span className="mt-1 block text-[11px] text-[#82908B]">
                    {question.kind === "CODE" ? "Coding" : "MCQ"} ·{" "}
                    {question.points} marks
                  </span>
                </span>
              </button>
            ))}
          </nav>
          <div className="border-t border-[#E5E9E5] bg-[#FAFBFA] p-4">
            <div className="flex items-start gap-2 text-[11px] leading-4 text-[#74817C]">
              <ShieldCheck size={16} className="shrink-0 text-[#176B5B]" />
              <span>
                {exam.integrityPolicy.enabled
                  ? "Editing events are retained for review. Signals never change marks automatically."
                  : "Integrity telemetry is disabled for this assessment."}
              </span>
            </div>
          </div>
        </aside>

        {activeQuestion.kind === "CODE" ? (
          <main className="grid min-h-0 lg:grid-cols-[minmax(320px,0.8fr)_minmax(460px,1.2fr)]">
            <section className="overflow-y-auto border-r border-[#D7DDD8] bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase text-[#176B5B]">
                  <Code2 size={15} /> Coding problem
                </span>
                <span className="text-xs font-semibold text-[#6F7C77]">
                  {activeQuestion.points} marks
                </span>
              </div>
              <h1 className="text-xl font-bold">{activeQuestion.title}</h1>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#53615B]">
                {activeQuestion.prompt}
              </p>
              <div className="mt-6">
                <div className="text-xs font-bold uppercase text-[#74817C]">
                  Function
                </div>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[#172520] p-3 font-mono text-xs text-[#DCE9E3]">
                  {activeQuestion.functionName}
                </pre>
              </div>
              {activeQuestion.tests.map((test) => (
                <div key={test.id} className="mt-6">
                  <div className="text-xs font-bold uppercase text-[#74817C]">
                    {test.label}
                  </div>
                  <div className="mt-2 rounded-md border border-[#DFE4E0] bg-[#F8F9F7] p-4 font-mono text-xs leading-6">
                    <div>
                      <span className="text-[#7C8984]">Input:</span>{" "}
                      {JSON.stringify(test.input)}
                    </div>
                    <div>
                      <span className="text-[#7C8984]">Expected:</span>{" "}
                      {JSON.stringify(test.expected)}
                    </div>
                  </div>
                </div>
              ))}
            </section>
            <section className="flex min-h-0 flex-col bg-[#111A17]">
              <div className="flex h-12 items-center justify-between border-b border-white/10 px-4">
                <select
                  aria-label="Programming language"
                  value={
                    languages[activeQuestion.id] ?? activeQuestion.languages[0]
                  }
                  onChange={(event) =>
                    setLanguages((current) => ({
                      ...current,
                      [activeQuestion.id]: event.target.value as Language,
                    }))
                  }
                  className="rounded border border-white/15 bg-[#1B2925] px-2 py-1 text-xs text-white"
                >
                  {activeQuestion.languages.map((language) => (
                    <option key={language} value={language}>
                      {languageLabel(language)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={running || submitted}
                  onClick={() => void execute("RUN", activeQuestion)}
                  className="h-8 border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  <Play size={14} /> {running ? "Running…" : "Run samples"}
                </Button>
              </div>
              <div
                className="min-h-0 flex-1"
                onPasteCapture={() => {
                  pastePending.current = true;
                }}
              >
                <Editor
                  key={activeQuestion.id}
                  height="100%"
                  language={
                    languages[activeQuestion.id] ?? activeQuestion.languages[0]
                  }
                  theme="vs-dark"
                  value={answers[activeQuestion.id] ?? ""}
                  onChange={changeCode}
                  onMount={mountEditor}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    automaticLayout: true,
                  }}
                />
              </div>
              <div className="flex h-12 items-center border-t border-white/10 px-4 text-xs">
                {result === "passed" && (
                  <span className="flex items-center gap-2 text-[#9FE2B7]">
                    <Check size={15} /> Sample tests passed
                  </span>
                )}
                {result === "failed" && (
                  <span className="flex items-center gap-2 text-[#F2A9A0]">
                    <AlertCircle size={15} /> One or more sample tests failed
                  </span>
                )}
                {!result && (
                  <span className="text-white/40">
                    Run the visible samples before submitting.
                  </span>
                )}
              </div>
            </section>
          </main>
        ) : (
          <main className="overflow-y-auto bg-white p-6 md:p-10">
            <div className="mx-auto max-w-3xl">
              <div className="mb-5 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-bold uppercase text-[#176B5B]">
                  <FileQuestion size={15} /> Multiple choice
                </span>
                <span className="text-xs font-semibold text-[#6F7C77]">
                  {activeQuestion.points} marks
                </span>
              </div>
              <h1 className="text-2xl font-bold">{activeQuestion.title}</h1>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#53615B]">
                {activeQuestion.prompt}
              </p>
              <div className="mt-8 space-y-3">
                {activeQuestion.options.map((option) => (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 ${
                      answers[activeQuestion.id] === option.id
                        ? "border-[#176B5B] bg-[#F0F7F4]"
                        : "border-[#DDE2DE] hover:bg-[#F8FAF8]"
                    }`}
                  >
                    <input
                      type="radio"
                      name={activeQuestion.id}
                      value={option.id}
                      checked={answers[activeQuestion.id] === option.id}
                      disabled={submitted}
                      onChange={() =>
                        updateAnswer(activeQuestion.id, option.id)
                      }
                      className="mt-0.5 accent-[#176B5B]"
                    />
                    <span className="text-sm leading-6">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </main>
        )}
      </div>

      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-[#D7DDD8] bg-white px-4 lg:hidden">
        <Button
          variant="secondary"
          disabled={questionIndex === 0}
          onClick={() => setQuestionIndex((value) => Math.max(0, value - 1))}
        >
          <ChevronLeft size={14} /> Previous
        </Button>
        <span className="text-xs text-[#71807A]">
          {questionIndex + 1} / {exam.questions.length}
        </span>
        <Button
          variant="secondary"
          disabled={questionIndex === exam.questions.length - 1}
          onClick={() =>
            setQuestionIndex((value) =>
              Math.min(exam.questions.length - 1, value + 1),
            )
          }
        >
          Next <ChevronRight size={14} />
        </Button>
      </footer>
      {error && exam && (
        <div className="fixed bottom-5 right-5 max-w-md rounded-md border border-[#E8C9C5] bg-white p-4 text-sm text-[#A33D32] shadow-lg">
          {error}
        </div>
      )}
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
