"use client";

import type { Classroom, ExamSummary, Question } from "@icarus/contracts";
import {
  AlertTriangle,
  BookOpenCheck,
  Braces,
  CalendarClock,
  ChevronRight,
  CirclePlus,
  ClipboardCheck,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@repo/ui/card";
import { Metric } from "@repo/ui/metric";
import { AppShell, StatusPill } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface ReviewAttempt {
  id: string;
  status: string;
  suggestedReductionPercent: number;
}

function tone(status: ExamSummary["status"]) {
  if (status === "PUBLISHED") return "green" as const;
  if (status === "REVIEW" || status === "CLOSED") return "amber" as const;
  return "neutral" as const;
}

export default function TeacherDashboard() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [reviews, setReviews] = useState<ReviewAttempt[]>([]);

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/assessments/exams`, { credentials: "include" }),
      fetch(`${apiUrl}/classrooms/classes`, { credentials: "include" }),
      fetch(`${apiUrl}/assessments/questions`, { credentials: "include" }),
      fetch(`${apiUrl}/assessments/reviews`, { credentials: "include" }),
    ]).then(
      async ([
        examResponse,
        classResponse,
        questionResponse,
        reviewResponse,
      ]) => {
        if (examResponse.ok) {
          const body = (await examResponse.json()) as { exams: ExamSummary[] };
          setExams(body.exams);
        }
        if (classResponse.ok) {
          const body = (await classResponse.json()) as {
            classrooms: Classroom[];
          };
          setClassrooms(body.classrooms);
        }
        if (questionResponse.ok) {
          const body = (await questionResponse.json()) as {
            questions: Question[];
          };
          setQuestions(body.questions);
        }
        if (reviewResponse.ok) {
          const body = (await reviewResponse.json()) as {
            attempts: ReviewAttempt[];
          };
          setReviews(body.attempts);
        }
      },
    );
  }, []);

  const reviewCount = reviews.filter(
    (attempt) =>
      attempt.status === "SUBMITTED" || attempt.status === "AUTO_SUBMITTED",
  ).length;
  const flaggedCount = reviews.filter(
    (attempt) => attempt.suggestedReductionPercent > 0,
  ).length;
  const nextExam = exams.find((exam) => exam.status === "SCHEDULED");

  return (
    <AppShell
      role="Teacher"
      name="Maya Rao"
      initials="MR"
      navigation={[
        {
          label: "Overview",
          active: true,
          href: "/",
          icon: <LayoutDashboard size={17} />,
        },
        { label: "Classes", href: "/classes", icon: <Users size={17} /> },
        {
          label: "Question bank",
          href: "/questions",
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
            Teacher workspace
          </p>
          <h1 className="text-2xl font-bold">Your assessment desk</h1>
          <p className="mt-1 text-sm text-[#6E7B76]">
            Build questions, schedule exams, and publish reviewed results.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/questions"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#D8DDD9] bg-white px-3.5 text-sm font-semibold hover:bg-[#F5F7F5]"
          >
            <Braces size={16} /> New question
          </Link>
          <Link
            href="/exams"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#176B5B] px-3.5 text-sm font-semibold text-white hover:bg-[#125648]"
          >
            <CirclePlus size={16} /> Create exam
          </Link>
        </div>
      </div>

      <Card className="mb-6 grid grid-cols-2 py-5 lg:grid-cols-4">
        <Metric
          label="Active classes"
          value={String(classrooms.length)}
          detail={`${classrooms.reduce((sum, classroom) => sum + classroom.studentCount, 0)} enrolled students`}
          icon={<GraduationCap size={18} />}
        />
        <Metric
          label="Question bank"
          value={String(questions.length)}
          detail={`${questions.filter((question) => question.kind === "CODE").length} coding · ${questions.filter((question) => question.kind === "MCQ").length} MCQ`}
          icon={<FileQuestion size={18} />}
        />
        <Metric
          label="Needs review"
          value={String(reviewCount)}
          detail="Submitted attempts"
          icon={<ClipboardCheck size={18} />}
        />
        <Metric
          label="Flagged edits"
          value={String(flaggedCount)}
          detail="Evidence, not verdicts"
          icon={<AlertTriangle size={18} />}
        />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E4E8E4] px-5 py-4">
            <div>
              <h2 className="font-bold">Recent exams</h2>
              <p className="text-xs text-[#7B8883]">
                Draft, scheduled, review, and published work
              </p>
            </div>
            <Link
              href="/exams"
              className="text-xs font-semibold text-[#176B5B]"
            >
              Manage exams
            </Link>
          </div>
          {exams.length === 0 ? (
            <p className="p-6 text-sm text-[#73807B]">No exams created yet.</p>
          ) : (
            <div className="divide-y divide-[#EDF0ED]">
              {exams.slice(0, 6).map((exam) => {
                const classroom = classrooms.find(
                  (item) => item.id === exam.classId,
                );
                return (
                  <Link
                    href="/exams"
                    key={exam.id}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#FAFBF9]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{exam.title}</div>
                      <div className="mt-1 text-xs text-[#87928E]">
                        {classroom?.name ?? `Class ${exam.classId.slice(0, 8)}`}{" "}
                        · {new Date(exam.startsAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill tone={tone(exam.status)}>
                        {exam.status}
                      </StatusPill>
                      <ChevronRight size={16} className="text-[#8A9691]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Next assessment</h2>
            <p className="text-xs text-[#7B8883]">Nearest scheduled window</p>
          </div>
          <div className="p-5">
            {nextExam ? (
              <div className="border-l-2 border-[#176B5B] pl-4">
                <div className="text-xs font-bold uppercase text-[#176B5B]">
                  {new Date(nextExam.startsAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {nextExam.title}
                </div>
                <div className="mt-1 text-xs text-[#78847F]">
                  {nextExam.questionCount} questions ·{" "}
                  {nextExam.durationMinutes} minutes
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm text-[#73807B]">
                <CalendarClock size={17} className="mt-0.5" />
                No scheduled assessment window.
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
