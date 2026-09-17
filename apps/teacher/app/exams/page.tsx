"use client";

import type { Classroom, Exam, ExamSummary, Question } from "@icarus/contracts";
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileQuestion,
  LayoutDashboard,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { AppShell, StatusPill } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}

function statusTone(status: ExamSummary["status"]) {
  if (status === "PUBLISHED") return "green" as const;
  if (status === "REVIEW" || status === "CLOSED") return "amber" as const;
  return "neutral" as const;
}

export default function TeacherExamsPage() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam>();
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/assessments/exams`, { credentials: "include" }),
      fetch(`${apiUrl}/assessments/questions`, { credentials: "include" }),
      fetch(`${apiUrl}/classrooms/classes`, { credentials: "include" }),
    ])
      .then(async ([examResponse, questionResponse, classroomResponse]) => {
        if (!examResponse.ok || !questionResponse.ok || !classroomResponse.ok) {
          const failed = [
            examResponse,
            questionResponse,
            classroomResponse,
          ].find((response) => !response.ok);
          setError(
            failed
              ? await responseError(
                  failed,
                  "Assessment data could not be loaded.",
                )
              : "Assessment data could not be loaded.",
          );
          return;
        }
        const examBody = (await examResponse.json()) as {
          exams: ExamSummary[];
        };
        const questionBody = (await questionResponse.json()) as {
          questions: Question[];
        };
        const classroomBody = (await classroomResponse.json()) as {
          classrooms: Classroom[];
        };
        setExams(examBody.exams);
        setQuestions(questionBody.questions);
        setClassrooms(classroomBody.classrooms);
      })
      .catch(() => setError("Assessment data could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const createExam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedQuestionIds.length === 0) {
      setError("Select at least one question.");
      return;
    }
    setWorking("create");
    setError("");
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("startsAt") ?? "");
    const endsAt = String(form.get("endsAt") ?? "");
    const integrityEnabled = form.get("integrityEnabled") === "on";
    const payload = {
      classId: String(form.get("classId") ?? ""),
      title: String(form.get("title") ?? ""),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      durationMinutes: Number(form.get("durationMinutes")),
      attemptLimit: Number(form.get("attemptLimit")),
      questionIds: selectedQuestionIds,
      integrityPolicy: {
        enabled: integrityEnabled,
        directPasteReductionPercent: 10,
        rapidEntryReductionPercent: 5,
        idleReturnReductionPercent: 5,
        maximumReductionPercent: Number(form.get("maximumReductionPercent")),
        typingSpeedCharactersPerSecond: 25,
        idleThresholdMilliseconds: 10_000,
      },
    };
    const response = await fetch(`${apiUrl}/assessments/exams`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The exam could not be created.")
          : "The assessment service is unavailable.",
      );
    } else {
      const body = (await response.json()) as { exam: Exam };
      const { questions: snapshotQuestions, ...details } = body.exam;
      const examSummary: ExamSummary = {
        ...details,
        questionCount: snapshotQuestions.length,
        totalPoints: snapshotQuestions.reduce(
          (sum, question) => sum + question.points,
          0,
        ),
      };
      setExams((current) => [examSummary, ...current]);
      setSelectedExam(body.exam);
      setSelectedQuestionIds([]);
      setShowCreate(false);
      setNotice("Draft exam created with an immutable question snapshot.");
    }
    setWorking("");
  };

  const loadExam = async (examId: string) => {
    setWorking(`load-${examId}`);
    setError("");
    const response = await fetch(`${apiUrl}/assessments/exams/${examId}`, {
      credentials: "include",
    }).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The exam could not be loaded.")
          : "The assessment service is unavailable.",
      );
    } else {
      const body = (await response.json()) as { exam: Exam };
      setSelectedExam(body.exam);
    }
    setWorking("");
  };

  const transition = async (
    exam: ExamSummary | Exam,
    action: "schedule" | "close" | "publish",
  ) => {
    if (
      action === "publish" &&
      !window.confirm(
        "Publish final results? Students will be able to view their scores.",
      )
    )
      return;
    setWorking(`${action}-${exam.id}`);
    setError("");
    setNotice("");
    const response = await fetch(
      `${apiUrl}/assessments/exams/${exam.id}/${action}`,
      { method: "POST", credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, `The exam could not be ${action}d.`)
          : "The assessment service is unavailable.",
      );
    } else {
      const body = (await response.json()) as { exam: Exam };
      setSelectedExam(body.exam);
      setExams((current) =>
        current.map((item) =>
          item.id === body.exam.id
            ? { ...item, status: body.exam.status }
            : item,
        ),
      );
      setNotice(
        action === "schedule"
          ? "Exam scheduled."
          : action === "close"
            ? "Exam moved to review."
            : "Results published.",
      );
    }
    setWorking("");
  };

  const actionFor = (exam: ExamSummary | Exam) => {
    if (exam.status === "DRAFT") return "schedule" as const;
    if (exam.status === "SCHEDULED") return "close" as const;
    if (exam.status === "CLOSED" || exam.status === "REVIEW") {
      return "publish" as const;
    }
    return null;
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
          icon: <FileQuestion size={17} />,
        },
        {
          label: "Exams",
          href: "/exams",
          active: true,
          icon: <BookOpenCheck size={17} />,
        },
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
            Assessment delivery
          </p>
          <h1 className="text-2xl font-bold">Exams</h1>
          <p className="mt-1 text-sm text-[#6E7B76]">
            Snapshot questions, schedule availability, review, and publish.
          </p>
        </div>
        <Button
          disabled={classrooms.length === 0 || questions.length === 0}
          onClick={() => {
            setError("");
            setNotice("");
            setShowCreate(true);
          }}
        >
          <Plus size={16} /> Create exam
        </Button>
      </div>

      {(error || notice) && !showCreate && (
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

      {!loading && (classrooms.length === 0 || questions.length === 0) && (
        <Card className="mb-5 p-5 text-sm text-[#715721]">
          Create at least one classroom and one question before creating an
          exam.
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="overflow-hidden">
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Assessment timeline</h2>
            <p className="text-xs text-[#7B8883]">{exams.length} exams</p>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-[#73807B]">Loading exams…</p>
          ) : exams.length === 0 ? (
            <p className="p-8 text-center text-sm text-[#73807B]">
              No exams have been created.
            </p>
          ) : (
            <div className="divide-y divide-[#EDF0ED]">
              {exams.map((exam) => {
                const action = actionFor(exam);
                return (
                  <div key={exam.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <button
                        onClick={() => void loadExam(exam.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{exam.title}</h3>
                          <StatusPill tone={statusTone(exam.status)}>
                            {exam.status}
                          </StatusPill>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-4 text-xs text-[#6E7B76]">
                          <span className="flex items-center gap-1.5">
                            <CalendarClock size={13} />
                            {new Date(exam.startsAt).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock3 size={13} /> {exam.durationMinutes} minutes
                          </span>
                          <span>{exam.questionCount} questions</span>
                          <span>{exam.totalPoints} marks</span>
                        </div>
                      </button>
                      {action && (
                        <Button
                          variant={
                            action === "publish" ? "primary" : "secondary"
                          }
                          disabled={working === `${action}-${exam.id}`}
                          onClick={() => void transition(exam, action)}
                        >
                          {action === "schedule" ? (
                            <Play size={14} />
                          ) : action === "close" ? (
                            <CheckCircle2 size={14} />
                          ) : (
                            <Send size={14} />
                          )}
                          {action === "schedule"
                            ? "Schedule"
                            : action === "close"
                              ? "Close for review"
                              : "Publish"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="h-fit overflow-hidden">
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Exam snapshot</h2>
            <p className="text-xs text-[#7B8883]">Immutable after creation</p>
          </div>
          {selectedExam ? (
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold">{selectedExam.title}</h3>
                <StatusPill tone={statusTone(selectedExam.status)}>
                  {selectedExam.status}
                </StatusPill>
              </div>
              <div className="mt-4 flex items-start gap-2 rounded-md bg-[#F4F6F3] p-3 text-xs leading-5 text-[#65736D]">
                <ShieldCheck size={15} className="mt-0.5 text-[#176B5B]" />
                Integrity telemetry is{" "}
                {selectedExam.integrityPolicy.enabled ? "enabled" : "disabled"};
                recommendations remain advisory.
              </div>
              <div className="mt-5 space-y-3">
                {selectedExam.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="rounded-md border border-[#E3E7E4] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {index + 1}. {question.title}
                      </span>
                      <span className="text-xs text-[#73807B]">
                        {question.points} marks
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#7A8782]">
                      {question.kind}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="p-6 text-sm text-[#73807B]">
              Select an exam to inspect its frozen question snapshot.
            </p>
          )}
        </Card>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#0F1C18]/50 p-4">
          <form
            onSubmit={createExam}
            className="mx-auto my-4 w-full max-w-3xl rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E6E3] px-5 py-4">
              <div>
                <h2 className="font-bold">Create draft exam</h2>
                <p className="text-xs text-[#7D8984]">
                  Selected questions are copied into an immutable snapshot.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm font-semibold text-[#64716C]"
              >
                Close
              </button>
            </div>
            <div className="space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold">
                  Classroom
                  <select
                    name="classId"
                    required
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  >
                    <option value="">Select classroom</option>
                    {classrooms.map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold">
                  Exam title
                  <input
                    name="title"
                    required
                    minLength={2}
                    maxLength={200}
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Opens
                  <input
                    name="startsAt"
                    type="datetime-local"
                    required
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Closes
                  <input
                    name="endsAt"
                    type="datetime-local"
                    required
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Duration (minutes)
                  <input
                    name="durationMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    defaultValue={60}
                    required
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold">
                  Attempt limit
                  <input
                    name="attemptLimit"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={1}
                    required
                    className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
              </div>

              <div>
                <h3 className="text-xs font-semibold">Questions</h3>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-md border border-[#D8DED9] p-3">
                  {questions.map((question) => (
                    <label
                      key={question.id}
                      className="flex items-start gap-3 rounded-md p-2 hover:bg-[#F7F9F7]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(question.id)}
                        onChange={() =>
                          setSelectedQuestionIds((current) =>
                            current.includes(question.id)
                              ? current.filter((id) => id !== question.id)
                              : [...current, question.id],
                          )
                        }
                        className="mt-1"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">
                          {question.title}
                        </span>
                        <span className="text-xs text-[#73807B]">
                          {question.kind} · {question.points} marks
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 rounded-md border border-[#DDE5DF] bg-[#F7FAF8] p-4 sm:grid-cols-[1fr_180px]">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    name="integrityEnabled"
                    type="checkbox"
                    defaultChecked
                    className="mt-1"
                  />
                  <span>
                    <strong className="block">
                      Enable integrity telemetry
                    </strong>
                    <span className="text-xs leading-5 text-[#73807B]">
                      Signals are advisory and never modify marks automatically.
                    </span>
                  </span>
                </label>
                <label className="text-xs font-semibold">
                  Maximum suggestion %
                  <input
                    name="maximumReductionPercent"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={25}
                    className="mt-1.5 h-9 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                  />
                </label>
              </div>
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
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button disabled={working === "create"}>
                {working === "create" ? "Creating…" : "Create draft"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
