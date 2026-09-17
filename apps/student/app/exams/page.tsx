"use client";

import type { Classroom, ExamSummary } from "@icarus/contracts";
import {
  Award,
  BookOpenCheck,
  CalendarClock,
  Clock3,
  LayoutDashboard,
  Library,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@repo/ui/card";
import { AppShell, StatusPill } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

function tone(status: ExamSummary["status"]) {
  if (status === "PUBLISHED") return "green" as const;
  if (status === "REVIEW" || status === "CLOSED") return "amber" as const;
  return "neutral" as const;
}

export default function StudentExamsPage() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/assessments/exams`, { credentials: "include" }),
      fetch(`${apiUrl}/classrooms/classes`, { credentials: "include" }),
    ])
      .then(async ([examResponse, classroomResponse]) => {
        if (!examResponse.ok || !classroomResponse.ok) {
          setError("Exams could not be loaded.");
          return;
        }
        const examBody = (await examResponse.json()) as {
          exams: ExamSummary[];
        };
        const classroomBody = (await classroomResponse.json()) as {
          classrooms: Classroom[];
        };
        setExams(examBody.exams);
        setClassrooms(classroomBody.classrooms);
      })
      .catch(() => setError("The assessment service is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell
      role="Student"
      name="Arjun Mehta"
      initials="AM"
      navigation={[
        { label: "Overview", href: "/", icon: <LayoutDashboard size={17} /> },
        { label: "My classes", href: "/classes", icon: <Users size={17} /> },
        {
          label: "Exams",
          href: "/exams",
          active: true,
          icon: <BookOpenCheck size={17} />,
        },
        { label: "Results", href: "/results", icon: <Award size={17} /> },
      ]}
    >
      <div className="mb-7">
        <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
          Assessment schedule
        </p>
        <h1 className="text-2xl font-bold">My exams</h1>
        <p className="mt-1 text-sm text-[#6E7B76]">
          Enter active assessments and track closed or published work.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-[#E8C9C5] bg-[#FFF7F5] p-3 text-sm text-[#A33D32]">
          {error}
        </p>
      )}

      {loading ? (
        <Card className="p-8 text-sm text-[#73807B]">Loading exams…</Card>
      ) : exams.length === 0 ? (
        <Card className="p-10 text-center">
          <Library className="mx-auto text-[#81908A]" size={32} />
          <h2 className="mt-3 font-bold">No assessments available</h2>
          <p className="mt-1 text-sm text-[#73807B]">
            Scheduled exams from your classrooms will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {exams.map((exam) => {
            const classroom = classrooms.find(
              (item) => item.id === exam.classId,
            );
            const opensAt = new Date(exam.startsAt).getTime();
            const closesAt = new Date(exam.endsAt).getTime();
            const available =
              exam.status === "SCHEDULED" &&
              loadedAt >= opensAt &&
              loadedAt <= closesAt;
            const upcoming = exam.status === "SCHEDULED" && loadedAt < opensAt;
            return (
              <Card key={exam.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#176B5B]">
                      {classroom?.name ?? "Classroom assessment"}
                    </p>
                    <h2 className="mt-1 font-bold">{exam.title}</h2>
                  </div>
                  <StatusPill tone={available ? "green" : tone(exam.status)}>
                    {available
                      ? "Available"
                      : upcoming
                        ? "Upcoming"
                        : exam.status}
                  </StatusPill>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2">
                    <CalendarClock
                      size={15}
                      className="mt-0.5 text-[#176B5B]"
                    />
                    <span>
                      <span className="block text-xs text-[#7A8782]">
                        Opens
                      </span>
                      <span className="font-semibold">
                        {new Date(exam.startsAt).toLocaleString()}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock3 size={15} className="mt-0.5 text-[#176B5B]" />
                    <span>
                      <span className="block text-xs text-[#7A8782]">
                        Duration
                      </span>
                      <span className="font-semibold">
                        {exam.durationMinutes} minutes
                      </span>
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#E7EAE7] pt-4">
                  <span className="text-xs text-[#73807B]">
                    {exam.questionCount} questions · {exam.totalPoints} marks ·{" "}
                    {exam.attemptLimit} attempt
                    {exam.attemptLimit === 1 ? "" : "s"}
                  </span>
                  {available ? (
                    <Link
                      href={`/exam?examId=${exam.id}`}
                      className="inline-flex h-9 items-center rounded-md bg-[#176B5B] px-4 text-sm font-semibold text-white hover:bg-[#125648]"
                    >
                      Enter exam
                    </Link>
                  ) : exam.status === "PUBLISHED" ? (
                    <Link
                      href="/results"
                      className="text-sm font-semibold text-[#176B5B] hover:underline"
                    >
                      View results
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-[#7A8782]">
                      {upcoming
                        ? `Opens ${new Date(exam.startsAt).toLocaleString()}`
                        : "Entry closed"}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
