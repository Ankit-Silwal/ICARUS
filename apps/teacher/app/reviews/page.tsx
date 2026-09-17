"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { AppShell, StatusPill } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

interface ReviewAttempt {
  id: string;
  studentId: string;
  examId: string;
  status: string;
  submittedAt?: string;
  automaticScore: number;
  suggestedReductionPercent: number;
  appliedReductionPercent: number;
  deductionReason?: string;
  finalScore: number;
  integrityFlags: unknown[];
}

interface IntegritySignal {
  id: string;
  kind: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  sequence: number;
  message: string;
}

interface IntegrityReport {
  attemptId: string;
  questionId: string;
  eventCount: number;
  signals: IntegritySignal[];
  signalCount: number;
  bySeverity: { LOW: number; MEDIUM: number; HIGH: number };
  suggestedReductionPercent: number;
  assessmentSync: {
    status: "PENDING" | "SYNCED" | "FAILED";
    attempts: number;
    error?: string;
    syncedAt?: string;
  };
  analyzedAt: string;
  disclaimer: string;
}

interface EditorEvent {
  sequence: number;
  occurredAt: string;
  action: string;
  insertedCharacters: number;
  deletedCharacters: number;
  documentLength: number;
  cursorLine: number;
  idleMilliseconds: number;
}

function tone(status: string): "green" | "amber" | "red" | "neutral" {
  if (status === "SYNCED" || status === "GRADED") return "green";
  if (status === "FAILED" || status === "HIGH") return "red";
  if (status === "PENDING" || status === "MEDIUM") return "amber";
  return "neutral";
}

export default function IntegrityReviewsPage() {
  const [attempts, setAttempts] = useState<ReviewAttempt[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [reports, setReports] = useState<IntegrityReport[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [report, setReport] = useState<IntegrityReport>();
  const [events, setEvents] = useState<EditorEvent[]>([]);
  const [nextSequence, setNextSequence] = useState<number | null>(null);
  const [percentage, setPercentage] = useState(0);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedAttempt = attempts.find(
    (attempt) => attempt.id === selectedAttemptId,
  );

  const loadAttempts = useCallback(async () => {
    const response = await fetch(`${apiUrl}/assessments/reviews`, {
      credentials: "include",
    });
    if (!response.ok) throw new Error("The review queue could not be loaded.");
    const body = (await response.json()) as { attempts: ReviewAttempt[] };
    setAttempts(body.attempts);
    setSelectedAttemptId((current) => current || body.attempts[0]?.id || "");
  }, []);

  const loadReports = useCallback(async (attemptId: string) => {
    setReport(undefined);
    setEvents([]);
    setSelectedQuestionId("");
    const response = await fetch(`${apiUrl}/integrity/reports/${attemptId}`, {
      credentials: "include",
    });
    if (response.status === 404) {
      setReports([]);
      return;
    }
    if (!response.ok) throw new Error("Integrity reports could not be loaded.");
    const body = (await response.json()) as { reports: IntegrityReport[] };
    setReports(body.reports);
    setSelectedQuestionId(body.reports[0]?.questionId ?? "");
  }, []);

  const loadReport = useCallback(
    async (attemptId: string, questionId: string, afterSequence?: number) => {
      const append = afterSequence !== undefined;
      const after = append ? `?afterSequence=${afterSequence}` : "";
      const [reportResponse, eventsResponse] = await Promise.all([
        fetch(`${apiUrl}/integrity/reports/${attemptId}/${questionId}`, {
          credentials: "include",
        }),
        fetch(
          `${apiUrl}/integrity/reports/${attemptId}/${questionId}/events${after}`,
          { credentials: "include" },
        ),
      ]);
      if (!reportResponse.ok || !eventsResponse.ok) {
        throw new Error("Integrity evidence could not be loaded.");
      }
      const reportBody = (await reportResponse.json()) as {
        report: IntegrityReport;
      };
      const eventsBody = (await eventsResponse.json()) as {
        events: EditorEvent[];
        nextSequence: number | null;
      };
      setReport(reportBody.report);
      setPercentage(reportBody.report.suggestedReductionPercent);
      setReason(
        reportBody.report.signalCount > 0
          ? "Reviewed editor evidence and confirmed the selected reduction."
          : "Reviewed editor evidence; no reduction is required.",
      );
      setEvents((current) =>
        append ? [...current, ...eventsBody.events] : eventsBody.events,
      );
      setNextSequence(eventsBody.nextSequence);
    },
    [],
  );

  useEffect(() => {
    void Promise.resolve()
      .then(loadAttempts)
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : "Review queue failed.",
        ),
      )
      .finally(() => setLoading(false));
  }, [loadAttempts]);

  useEffect(() => {
    if (!selectedAttemptId) return;
    void Promise.resolve()
      .then(() => {
        setLoading(true);
        setError("");
        return loadReports(selectedAttemptId);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Reports failed."),
      )
      .finally(() => setLoading(false));
  }, [loadReports, selectedAttemptId]);

  useEffect(() => {
    if (!selectedAttemptId || !selectedQuestionId) return;
    void Promise.resolve()
      .then(() => {
        setLoading(true);
        setError("");
        return loadReport(selectedAttemptId, selectedQuestionId);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "Evidence failed."),
      )
      .finally(() => setLoading(false));
  }, [loadReport, selectedAttemptId, selectedQuestionId]);

  const totalSignals = useMemo(
    () => reports.reduce((sum, item) => sum + item.signalCount, 0),
    [reports],
  );

  const reanalyze = async () => {
    if (!selectedAttemptId || !selectedQuestionId) return;
    setWorking(true);
    setError("");
    const response = await fetch(
      `${apiUrl}/integrity/reports/${selectedAttemptId}/${selectedQuestionId}/reanalyze`,
      { method: "POST", credentials: "include" },
    );
    if (response.ok) {
      await loadReport(selectedAttemptId, selectedQuestionId);
      await loadReports(selectedAttemptId);
      setSelectedQuestionId(selectedQuestionId);
      setMessage("Evidence was reanalyzed and synchronization retried.");
    } else {
      setError("The evidence could not be reanalyzed.");
    }
    setWorking(false);
  };

  const decide = async (approved: boolean) => {
    if (!selectedAttemptId) return;
    const decisionReason = approved
      ? reason
      : "Integrity recommendation reviewed and rejected; no reduction applied.";
    if (decisionReason.trim().length < 5) {
      setError("Add a short reason before applying a reduction.");
      return;
    }
    setWorking(true);
    setError("");
    const response = await fetch(
      `${apiUrl}/assessments/attempts/${selectedAttemptId}/deduction`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          percentageReduction: approved ? percentage : 0,
          reason: decisionReason,
        }),
      },
    );
    if (response.ok) {
      setMessage(
        approved
          ? `${percentage}% reduction applied after teacher review.`
          : "Recommendation rejected; no reduction was applied.",
      );
      await loadAttempts();
    } else {
      setError("The review decision could not be saved.");
    }
    setWorking(false);
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
          label: "Review & grading",
          active: true,
          href: "/reviews",
          icon: <ClipboardCheck size={17} />,
        },
      ]}
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-[#176B5B]"
          >
            <ArrowLeft size={14} /> Assessment desk
          </Link>
          <h1 className="text-2xl font-bold">Integrity review</h1>
          <p className="mt-1 text-sm text-[#6E7B76]">
            Review editing evidence in context before making a grading decision.
          </p>
        </div>
        {report && (
          <Button variant="secondary" disabled={working} onClick={reanalyze}>
            <RefreshCw size={15} /> Reanalyze evidence
          </Button>
        )}
      </div>

      {(message || error) && (
        <div
          className={`mb-5 rounded-md border p-3 text-sm ${error ? "border-[#E8C9C5] bg-[#FFF7F5] text-[#A33D32]" : "border-[#BFDACC] bg-[#F0F8F4] text-[#176B5B]"}`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Review queue</h2>
            <p className="text-xs text-[#7B8883]">{attempts.length} attempts</p>
          </div>
          <div className="max-h-[720px] divide-y divide-[#EDF0ED] overflow-y-auto">
            {attempts.map((attempt) => (
              <button
                key={attempt.id}
                onClick={() => setSelectedAttemptId(attempt.id)}
                className={`w-full p-4 text-left ${selectedAttemptId === attempt.id ? "bg-[#F0F7F4]" : "hover:bg-[#FAFBF9]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    Student {attempt.studentId.slice(0, 8)}
                  </span>
                  <StatusPill tone={tone(attempt.status)}>
                    {attempt.status}
                  </StatusPill>
                </div>
                <div className="mt-2 text-xs text-[#74817C]">
                  Attempt {attempt.id.slice(0, 8)} · score {attempt.finalScore}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-[#8B5D0B]">
                  <AlertTriangle size={13} /> Suggested{" "}
                  {attempt.suggestedReductionPercent}%
                </div>
              </button>
            ))}
            {!loading && attempts.length === 0 && (
              <p className="p-5 text-sm text-[#74817C]">
                No attempts are waiting for review.
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {loading && (
            <Card className="grid min-h-48 place-items-center text-sm text-[#74817C]">
              <span className="flex items-center gap-2">
                <LoaderCircle className="animate-spin" size={16} /> Loading
                review evidence…
              </span>
            </Card>
          )}
          {!loading && selectedAttempt && reports.length === 0 && (
            <Card className="p-6">
              <FileClock className="text-[#176B5B]" />
              <h2 className="mt-3 font-bold">No integrity telemetry</h2>
              <p className="mt-2 text-sm text-[#6E7B76]">
                This attempt has no analyzed coding-question evidence.
              </p>
            </Card>
          )}
          {!loading && report && (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4E8E4] p-5">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#176B5B]">
                      Question {report.questionId.slice(0, 8)}
                    </p>
                    <h2 className="mt-1 text-lg font-bold">
                      {report.signalCount} signals across {report.eventCount}{" "}
                      events
                    </h2>
                    <p className="mt-1 text-xs text-[#7B8883]">
                      Analyzed {new Date(report.analyzedAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusPill tone={tone(report.assessmentSync.status)}>
                    {report.assessmentSync.status}
                  </StatusPill>
                </div>
                {reports.length > 1 && (
                  <div className="flex flex-wrap gap-2 border-b border-[#E4E8E4] p-4">
                    {reports.map((item) => (
                      <button
                        key={item.questionId}
                        onClick={() => setSelectedQuestionId(item.questionId)}
                        className={`rounded-md border px-3 py-2 text-xs font-semibold ${selectedQuestionId === item.questionId ? "border-[#176B5B] bg-[#F0F7F4] text-[#176B5B]" : "border-[#DDE2DE]"}`}
                      >
                        {item.questionId.slice(0, 8)} · {item.signalCount}{" "}
                        signals
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid gap-4 p-5 md:grid-cols-4">
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((severity) => (
                    <div
                      key={severity}
                      className="rounded-md border border-[#E3E7E4] p-4"
                    >
                      <div className="text-xs font-bold text-[#74817C]">
                        {severity}
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        {report.bySeverity[severity]}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-md border border-[#E8DFC0] bg-[#FFF9E9] p-4">
                    <div className="text-xs font-bold text-[#8B5D0B]">
                      SUGGESTED
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {report.suggestedReductionPercent}%
                    </div>
                  </div>
                </div>
                <div className="space-y-3 px-5 pb-5">
                  {report.signals.map((signal) => (
                    <div
                      key={signal.id}
                      className="flex items-start gap-3 rounded-md border border-[#E3E7E4] p-3"
                    >
                      <ShieldAlert
                        size={17}
                        className={
                          signal.severity === "HIGH"
                            ? "text-[#A33D32]"
                            : "text-[#986F1C]"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">
                            {signal.kind.replaceAll("_", " ")}
                          </span>
                          <StatusPill tone={tone(signal.severity)}>
                            {signal.severity}
                          </StatusPill>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#68756F]">
                          Sequence {signal.sequence}: {signal.message}
                        </p>
                      </div>
                    </div>
                  ))}
                  {report.signals.length === 0 && (
                    <p className="text-sm text-[#74817C]">
                      No heuristic signals were detected.
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <div className="flex items-center justify-between border-b border-[#E4E8E4] px-5 py-4">
                  <div>
                    <h2 className="font-bold">Raw editor evidence</h2>
                    <p className="text-xs text-[#7B8883]">
                      Ordered, read-only telemetry
                    </p>
                  </div>
                  <span className="text-xs text-[#74817C]">
                    {events.length} loaded
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-[#F7F8F6] uppercase text-[#7B8883]">
                      <tr>
                        <th className="px-4 py-3">Sequence</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Time</th>
                        <th className="px-4 py-3">Insert / delete</th>
                        <th className="px-4 py-3">Length</th>
                        <th className="px-4 py-3">Idle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EDF0ED]">
                      {events.map((event) => (
                        <tr key={event.sequence}>
                          <td className="px-4 py-3 font-mono">
                            {event.sequence}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {event.action}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(event.occurredAt).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-3">
                            +{event.insertedCharacters} / -
                            {event.deletedCharacters}
                          </td>
                          <td className="px-4 py-3">{event.documentLength}</td>
                          <td className="px-4 py-3">
                            {event.idleMilliseconds} ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {nextSequence !== null && (
                  <div className="border-t border-[#E4E8E4] p-4 text-center">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void loadReport(
                          selectedAttemptId,
                          selectedQuestionId,
                          nextSequence ?? undefined,
                        )
                      }
                    >
                      Load more evidence
                    </Button>
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 text-[#176B5B]" size={19} />
                  <div>
                    <h2 className="font-bold">Teacher decision</h2>
                    <p className="mt-1 text-xs leading-5 text-[#6E7B76]">
                      The recommendation is advisory. Your explicit decision is
                      the only action that can change the final mark.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                  <label className="text-xs font-semibold">
                    Reduction percentage
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={percentage}
                      onChange={(event) =>
                        setPercentage(Number(event.target.value))
                      }
                      className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                    />
                  </label>
                  <label className="text-xs font-semibold">
                    Decision reason
                    <textarea
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="mt-1.5 min-h-24 w-full rounded-md border border-[#D8DED9] p-3 text-sm"
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="secondary"
                    disabled={working}
                    onClick={() => void decide(false)}
                  >
                    Reject recommendation
                  </Button>
                  <Button disabled={working} onClick={() => void decide(true)}>
                    Apply reviewed reduction
                  </Button>
                </div>
              </Card>
            </>
          )}
          <p className="text-xs leading-5 text-[#7B8883]">
            Integrity signals are editing heuristics for teacher review, not
            proof of misconduct.
          </p>
          <p className="text-xs text-[#7B8883]">
            Total signals in selected attempt: {totalSignals}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
