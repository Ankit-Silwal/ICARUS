import { env } from "../config/env.js";
import { AppError, unavailable } from "../lib/errors.js";
import type { IdentityUser } from "../types/assessment.types.js";

export interface ClassroomSummary {
  id: string;
  teacherId: string;
  name: string;
}

export class ClassroomService {
  async list(actor: IdentityUser, cookie: string) {
    const payload = await this.request<{ classrooms: ClassroomSummary[] }>(
      "/classes",
      actor,
      cookie,
    );
    return payload.classrooms;
  }

  async requireAccess(
    actor: IdentityUser,
    cookie: string,
    classroomId: string,
  ) {
    const payload = await this.request<{ classroom: ClassroomSummary }>(
      `/classes/${classroomId}`,
      actor,
      cookie,
    );
    return payload.classroom;
  }

  private async request<T>(
    path: string,
    actor: IdentityUser,
    cookie: string,
  ): Promise<T> {
    let response: globalThis.Response;
    try {
      response = await fetch(`${env.CLASSROOM_URL.replace(/\/$/, "")}${path}`, {
        headers: {
          cookie,
          "x-user-id": actor.id,
          "x-user-role": actor.role,
        },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw unavailable(
        "CLASSROOM_UNAVAILABLE",
        "The classroom service could not be reached.",
      );
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      if (response.status === 403 || response.status === 404) {
        throw new AppError(
          response.status,
          payload?.error?.code ?? "CLASSROOM_ACCESS_DENIED",
          payload?.error?.message ?? "The classroom is not available.",
        );
      }
      throw unavailable(
        "CLASSROOM_UNAVAILABLE",
        "The classroom service rejected the request.",
      );
    }
    return (await response.json()) as T;
  }
}

export const classroomService = new ClassroomService();
