"use client";

import {
  Award,
  BookOpenCheck,
  CheckCircle2,
  LayoutDashboard,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@repo/ui/card";
import { AppShell, StatusPill } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface PublishedResult {
  id: string;
  examId: string;
  examTitle: string;
  attemptNumber: number;
  status: string;
  submittedAt?: string;
  automaticScore: number;
  appliedReductionPercent: number;
  deduction: number;
  deductionReason?: string;
  finalScore: number;
}

export default function StudentResultsPage() {
  const [results, setResults] = useState<PublishedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`${apiUrl}/assessments/results`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          setError("Published results could not be loaded.");
          return;
        }
        const body = (await response.json()) as {
          results: PublishedResult[];
        };
        setResults(body.results);
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
        { label: "Exams", href: "/exams", icon: <BookOpenCheck size={17} /> },
        {
          label: "Results",
          href: "/results",
          active: true,
          icon: <Award size={17} />,
        },
      ]}
    >
      <div className="mb-7">
        <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
          Published grades
        </p>
        <h1 className="text-2xl font-bold">My results</h1>
        <p className="mt-1 text-sm text-[#6E7B76]">
          Automatic scores and any explicitly reviewed reductions.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-md border border-[#E8C9C5] bg-[#FFF7F5] p-3 text-sm text-[#A33D32]">
          {error}
        </p>
      )}

      {loading ? (
        <Card className="p-8 text-sm text-[#73807B]">Loading results…</Card>
      ) : results.length === 0 ? (
        <Card className="p-10 text-center">
          <Trophy className="mx-auto text-[#81908A]" size={32} />
          <h2 className="mt-3 font-bold">No published results</h2>
          <p className="mt-1 text-sm text-[#73807B]">
            Results appear only after your teacher publishes the exam.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {results.map((result) => (
            <Card key={result.id} className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4E8E4] p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold">{result.examTitle}</h2>
                    <StatusPill tone="green">Published</StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-[#73807B]">
                    Attempt {result.attemptNumber}
                    {result.submittedAt
                      ? ` · Submitted ${new Date(result.submittedAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase text-[#7A8782]">
                    Final score
                  </div>
                  <div className="mt-1 text-3xl font-bold text-[#176B5B]">
                    {result.finalScore}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-3">
                <div className="rounded-md bg-[#F4F6F3] p-4">
                  <div className="flex items-center gap-2 text-xs text-[#73807B]">
                    <CheckCircle2 size={14} /> Automatic score
                  </div>
                  <div className="mt-2 text-xl font-bold">
                    {result.automaticScore}
                  </div>
                </div>
                <div className="rounded-md bg-[#F4F6F3] p-4">
                  <div className="flex items-center gap-2 text-xs text-[#73807B]">
                    <ShieldCheck size={14} /> Reviewed reduction
                  </div>
                  <div className="mt-2 text-xl font-bold">
                    {result.appliedReductionPercent}%
                  </div>
                </div>
                <div className="rounded-md bg-[#F4F6F3] p-4">
                  <div className="text-xs text-[#73807B]">Marks deducted</div>
                  <div className="mt-2 text-xl font-bold">
                    {result.deduction}
                  </div>
                </div>
              </div>
              {result.deductionReason && (
                <p className="border-t border-[#E4E8E4] px-5 py-4 text-sm leading-6 text-[#65736D]">
                  <strong>Teacher review:</strong> {result.deductionReason}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
