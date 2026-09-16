import { calculatePercentageReduction } from "@icarus/contracts";
import type { AttemptAnswer } from "../generated/prisma/client.js";

interface AttemptRecord {
  id: string;
  examId: string;
  studentId: string;
  attemptNumber: number;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  submittedAt: Date | null;
  automaticScore: { toString(): string };
  appliedReductionPercent: { toString(): string };
  suggestedReductionPercent: { toString(): string };
  reductionReason: string | null;
  integrityFlags: unknown;
  answers?: AttemptAnswer[];
}

export function presentAttempt(attempt: AttemptRecord) {
  const automaticScore = Number(attempt.automaticScore.toString());
  const appliedReductionPercent = Number(
    attempt.appliedReductionPercent.toString(),
  );
  const { deduction, finalScore } = calculatePercentageReduction(
    automaticScore,
    appliedReductionPercent,
  );
  const answers = Object.fromEntries(
    (attempt.answers ?? []).map((answer) => [
      answer.questionId,
      {
        answer: answer.answer,
        version: answer.version,
        savedAt: answer.savedAt.toISOString(),
      },
    ]),
  );

  return {
    id: attempt.id,
    examId: attempt.examId,
    studentId: attempt.studentId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    submittedAt: attempt.submittedAt?.toISOString(),
    answers,
    automaticScore,
    appliedReductionPercent,
    suggestedReductionPercent: Number(
      attempt.suggestedReductionPercent.toString(),
    ),
    deduction,
    deductionReason: attempt.reductionReason ?? undefined,
    finalScore,
    integrityFlags: attempt.integrityFlags,
  };
}
