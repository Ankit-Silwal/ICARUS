"use client";

import type { Classroom, ExamSummary } from "@icarus/contracts";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Code2,
  LayoutDashboard,
  Library,
  Users,
} from "lucide-react";
import { AppShell, StatusPill } from "@repo/ui/shell";
import { Card } from "@repo/ui/card";
import { Metric } from "@repo/ui/metric";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface PublishedResult {
  finalScore: number;
}

export default function StudentDashboard() {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [results, setResults] = useState<PublishedResult[]>([]);
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/classrooms/classes`, { credentials: "include" }),
      fetch(`${apiUrl}/assessments/exams`, { credentials: "include" }),
      fetch(`${apiUrl}/assessments/results`, { credentials: "include" }),
    ]).then(async ([classResponse, examResponse, resultResponse]) => {
      if (classResponse.ok) {
        const body = (await classResponse.json()) as {
          classrooms: Classroom[];
        };
        setClasses(body.classrooms);
      }
      if (examResponse.ok) {
        const body = (await examResponse.json()) as { exams: ExamSummary[] };
        setExams(body.exams);
      }
      if (resultResponse.ok) {
        const body = (await resultResponse.json()) as {
          results: PublishedResult[];
        };
        setResults(body.results);
      }
    });
  }, []);

  const visibleExams = useMemo(
    () =>
      exams
        .filter(
          (exam) =>
            exam.status === "SCHEDULED" &&
            new Date(exam.endsAt).getTime() >= loadedAt,
        )
        .sort(
          (left, right) =>
            new Date(left.startsAt).getTime() -
            new Date(right.startsAt).getTime(),
        ),
    [exams, loadedAt],
  );
  const nextExam = visibleExams[0];
  const nextClassroom = classes.find((item) => item.id === nextExam?.classId);
  const nextExamAvailable =
    nextExam !== undefined && new Date(nextExam.startsAt).getTime() <= loadedAt;
  const averageScore =
    results.length === 0
      ? undefined
      : results.reduce((sum, result) => sum + result.finalScore, 0) /
        results.length;

  const joinClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setJoinError("");
    setJoining(true);
    const response = await fetch(`${apiUrl}/classrooms/classes/join`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    if (response?.ok) {
      const body = (await response.json()) as { classroom: Classroom };
      setClasses((current) => [
        ...current.filter((item) => item.id !== body.classroom.id),
        body.classroom,
      ]);
      setCode("");
    } else {
      const body = (await response?.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setJoinError(
        body?.error?.message ?? "The classroom could not be joined.",
      );
    }
    setJoining(false);
  };

  return (
    <AppShell
      role="Student"
      name="Arjun Mehta"
      initials="AM"
      navigation={[
        {
          label: "Overview",
          active: true,
          href: "/",
          icon: <LayoutDashboard size={17} />,
        },
        { label: "My classes", href: "/classes", icon: <Users size={17} /> },
        { label: "Exams", href: "/exams", icon: <BookOpenCheck size={17} /> },
        { label: "Results", href: "/results", icon: <Award size={17} /> },
      ]}
    >
      <div className="mb-7">
        <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
          Student workspace
        </p>
        <h1 className="text-2xl font-bold">Good morning, Arjun</h1>
        <p className="mt-1 text-sm text-[#6E7B76]">
          {visibleExams.length === 0
            ? "You have no scheduled assessments waiting."
            : `You have ${visibleExams.length} scheduled assessment${visibleExams.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      <Card className="mb-6 grid grid-cols-2 py-5 lg:grid-cols-4">
        <Metric
          label="Joined classes"
          value={String(classes.length)}
          detail={
            classes.length === 1 ? "1 active classroom" : "Active classrooms"
          }
          icon={<Users size={18} />}
        />
        <Metric
          label="Upcoming exams"
          value={String(visibleExams.length)}
          detail={
            nextExam
              ? `${nextExamAvailable ? "Available now" : "Starts"} ${new Date(nextExam.startsAt).toLocaleString()}`
              : "No scheduled exams"
          }
          icon={<CalendarDays size={18} />}
        />
        <Metric
          label="Completed"
          value={String(results.length)}
          detail="Published assessments"
          icon={<CheckCircle2 size={18} />}
        />
        <Metric
          label="Average score"
          value={averageScore === undefined ? "-" : averageScore.toFixed(1)}
          detail="Across published results"
          icon={<Award size={18} />}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Upcoming exam</h2>
            <p className="text-xs text-[#7B8883]">
              Your next scheduled assessment
            </p>
          </div>
          {nextExam ? (
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <span className="grid size-11 place-items-center rounded-md bg-[#E9F3EE] text-[#176B5B]">
                    <Code2 size={21} />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{nextExam.title}</h3>
                      <StatusPill
                        tone={nextExamAvailable ? "green" : "neutral"}
                      >
                        {nextExamAvailable ? "Available" : "Upcoming"}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-[#6F7D77]">
                      {nextClassroom?.name ?? "Classroom assessment"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-5 text-xs text-[#66736E]">
                      <span className="flex items-center gap-1.5">
                        <Clock3 size={14} />
                        {nextExam.durationMinutes} minutes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Library size={14} />
                        {nextExam.questionCount} questions /{" "}
                        {nextExam.totalPoints} marks
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href={
                    nextExamAvailable ? `/exam?examId=${nextExam.id}` : "/exams"
                  }
                  className="inline-flex h-9 items-center rounded-md bg-[#176B5B] px-4 text-sm font-semibold text-white hover:bg-[#125648]"
                >
                  {nextExamAvailable ? "Enter exam" : "View schedule"}
                </Link>
              </div>
              <div className="mt-5 rounded-md border border-[#DDE5DF] bg-[#F7FAF8] px-4 py-3 text-xs text-[#5F6D67]">
                <strong className="text-[#26332E]">Window:</strong>{" "}
                {new Date(nextExam.startsAt).toLocaleString()} -{" "}
                {new Date(nextExam.endsAt).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[#73807B]">
              Scheduled assessments will appear here.
            </div>
          )}
        </Card>

        <Card>
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Class access</h2>
            <p className="text-xs text-[#7B8883]">
              Join with an eight-character code
            </p>
          </div>
          <form className="p-5" onSubmit={joinClass}>
            <label
              htmlFor="class-code"
              className="mb-1.5 block text-xs font-semibold"
            >
              Class code
            </label>
            <div className="flex gap-2">
              <input
                id="class-code"
                maxLength={8}
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-HJ-NP-Z2-9]/g, "")
                      .slice(0, 8),
                  )
                }
                placeholder="ABCD2345"
                className="h-9 min-w-0 flex-1 rounded-md border border-[#D8DED9] px-3 font-mono text-sm uppercase tracking-[0.15em]"
              />
              <button
                disabled={joining || code.length !== 8}
                className="h-9 rounded-md border border-[#D8DDD9] bg-white px-3.5 text-sm font-semibold hover:bg-[#F5F7F5] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join"}
              </button>
            </div>
            {joinError && (
              <p className="mt-3 text-xs text-[#A33D32]">{joinError}</p>
            )}
            <p className="mt-3 text-xs leading-5 text-[#84908B]">
              Ask your teacher for the code assigned to your class.
            </p>
            <Link
              href="/classes"
              className="mt-4 inline-block text-xs font-semibold text-[#176B5B] hover:underline"
            >
              Manage my classrooms
            </Link>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
