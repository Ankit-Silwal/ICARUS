import { env } from "../config/env.js";
import { unavailable } from "../lib/errors.js";
import type { IdentityUser } from "../types/integrity.types.js";

export class IdentityService {
  async authenticate(cookie?: string) {
    if (!cookie) return null;

    let response: globalThis.Response;
    try {
      response = await fetch(`${env.IDENTITY_URL.replace(/\/$/, "")}/session`, {
        headers: { cookie },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw unavailable(
        "IDENTITY_UNAVAILABLE",
        "The identity service could not be reached.",
      );
    }
    if (response.status === 401) return null;
    if (!response.ok) {
      throw unavailable(
        "IDENTITY_UNAVAILABLE",
        "The identity service rejected session validation.",
      );
    }
    const payload = (await response.json()) as { user: IdentityUser };
    return payload.user;
  }
}

export const identityService = new IdentityService();
