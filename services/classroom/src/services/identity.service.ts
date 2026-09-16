import { env } from "../config/env.js";
import { unavailable } from "../lib/errors.js";
import type { IdentityUser } from "../types/classroom.types.js";

interface ResolveUsersResponse {
  users: IdentityUser[];
}

export class IdentityService {
  async authenticate(cookie?: string) {
    if (!cookie) return null;

    let response: globalThis.Response;
    try {
      response = await fetch(
        `${env.IDENTITY_URL.replace(/\/$/, "")}/session`,
        {
          headers: { cookie },
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw unavailable("The identity service could not be reached.");
    }

    if (response.status === 401) return null;
    if (!response.ok) {
      throw unavailable("The identity service rejected session validation.");
    }

    const payload = (await response.json()) as { user: IdentityUser };
    return payload.user;
  }

  async resolveUsers(ids: string[]) {
    if (ids.length === 0) return [];

    let response: globalThis.Response;
    try {
      response = await fetch(
        `${env.IDENTITY_URL.replace(/\/$/, "")}/internal/users/resolve`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${env.INTERNAL_SERVICE_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ ids: [...new Set(ids)] }),
          signal: AbortSignal.timeout(5_000),
        },
      );
    } catch {
      throw unavailable("The identity service could not be reached.");
    }

    if (!response.ok) {
      throw unavailable("The identity service rejected the user lookup.");
    }

    const payload = (await response.json()) as ResolveUsersResponse;
    return payload.users;
  }
}

export const identityService = new IdentityService();
