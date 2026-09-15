"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
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

type ExamSummary = {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  questionCount: number;
  totalPoints: number;
};
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function StudentDashboard() {
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [code, setCode] = useState("");
  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/classrooms/classes`, { credentials: "include" }),
      fetch(`${apiUrl}/assessments/exams`, { credentials: "include" }),
    ]).then(async ([classResponse, examResponse]) => {
      if (classResponse.ok)
        setClasses(
          (
            (await classResponse.json()) as {
              classes: { id: string; name: string }[];
            }
          ).classes,
        );
      if (examResponse.ok)
        setExams(
          ((await examResponse.json()) as { exams: ExamSummary[] }).exams,
        );
    });
  }, []);
  const joinClass = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch(`${apiUrl}/classrooms/classes/join`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        class: { id: string; name: string };
      };
      setClasses([
        ...classes.filter((item) => item.id !== body.class.id),
        body.class,
      ]);
      setCode("");
    }
  };
  const nextExam = exams[0];
  return (
    <AppShell
      role="Student"
      name="Arjun Mehta"
      initials="AM"
      navigation={[
        {
          label: "Overview",
          active: true,
          icon: <LayoutDashboard size={17} />,
        },
        { label: "My classes", icon: <Users size={17} /> },
        { label: "Exams", icon: <BookOpenCheck size={17} /> },
        { label: "Results", icon: <Award size={17} /> },
      ]}
    >
      <div className="mb-7">
        <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
          Student workspace
        </p>
        <h1 className="text-2xl font-bold">Good morning, Arjun</h1>
        <p className="mt-1 text-sm text-[#6E7B76]">
          You have one exam coming up and no overdue work.
        </p>
      </div>
      <Card className="mb-6 grid grid-cols-2 py-5 lg:grid-cols-4">
        <Metric
          label="Joined classes"
          value={String(classes.length)}
          detail="One active this week"
          icon={<Users size={18} />}
        />
        <Metric
          label="Upcoming exams"
          value={String(exams.length)}
          detail="Starts Thursday at 10:00"
          icon={<CalendarDays size={18} />}
        />
        <Metric
          label="Completed"
          value="12"
          detail="Across all classes"
          icon={<CheckCircle2 size={18} />}
        />
        <Metric
          label="Average score"
          value="84%"
          detail="Last five published results"
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
          <div className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="grid size-11 place-items-center rounded-md bg-[#E9F3EE] text-[#176B5B]">
                  <Code2 size={21} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">Arrays & Hashing · Midterm</h3>
                    <StatusPill tone="green">Available</StatusPill>
                  </div>
                  <p className="mt-1 text-sm text-[#6F7D77]">
                    Data Structures · Section A
                  </p>
                  <div className="mt-4 flex flex-wrap gap-5 text-xs text-[#66736E]">
                    <span className="flex items-center gap-1.5">
                      <Clock3 size={14} />
                      75 minutes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Library size={14} />2 questions · 20 marks
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href={nextExam ? `/exam?examId=${nextExam.id}` : "#"}
                className="inline-flex h-9 items-center rounded-md bg-[#176B5B] px-4 text-sm font-semibold text-white hover:bg-[#125648]"
              >
                Enter exam
              </Link>
            </div>
            <div className="mt-5 rounded-md border border-[#DDE5DF] bg-[#F7FAF8] px-4 py-3 text-xs text-[#5F6D67]">
              <strong className="text-[#26332E]">Window:</strong> September 1,
              2026 at 05:30 – December 1, 2026 at 05:30 IST
            </div>
          </div>
        </Card>
        <Card>
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Class access</h2>
            <p className="text-xs text-[#7B8883]">
              Join with a six-character code
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
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                className="h-9 min-w-0 flex-1 rounded-md border border-[#D8DED9] px-3 font-mono text-sm uppercase tracking-[0.15em]"
              />
              <button className="h-9 rounded-md border border-[#D8DDD9] bg-white px-3.5 text-sm font-semibold hover:bg-[#F5F7F5]">
                Join
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#84908B]">
              Ask your teacher for the code assigned to your class.
            </p>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
