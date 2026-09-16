import {
  IntegrityPolicySchema,
  IntegritySignalSchema,
  recommendedIntegrityReduction,
} from "@icarus/contracts";
import { z } from "zod";

interface ReportRecord {
  attemptId: string;
  questionId: string;
  eventCount: number;
  signals: unknown;
  syncStatus: string;
  syncAttempts: number;
  syncError: string | null;
  analyzedAt: Date;
  syncedAt: Date | null;
  session: { policy: unknown };
}

export function presentReport(report: ReportRecord) {
  const signals = z.array(IntegritySignalSchema).parse(report.signals);
  const policy = IntegrityPolicySchema.parse(report.session.policy);
  const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  for (const signal of signals) bySeverity[signal.severity] += 1;
  return {
    attemptId: report.attemptId,
    questionId: report.questionId,
    eventCount: report.eventCount,
    signals,
    signalCount: signals.length,
    bySeverity,
    suggestedReductionPercent: recommendedIntegrityReduction(signals, policy),
    assessmentSync: {
      status: report.syncStatus,
      attempts: report.syncAttempts,
      error: report.syncError ?? undefined,
      syncedAt: report.syncedAt?.toISOString(),
    },
    analyzedAt: report.analyzedAt.toISOString(),
    disclaimer:
      "Signals are editing heuristics for teacher review, not proof of misconduct.",
  };
}
