export interface JudgeStatus {
  id: number;
  description: string;
}

export function assertJudgeInfrastructureHealthy(status: JudgeStatus): void {
  if (status.id === 13) {
    throw new Error(
      `Judge0 execution infrastructure failed (${status.description}).`,
    );
  }
}
