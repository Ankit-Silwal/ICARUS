import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { env } from "../config/env.js";
import { pkceChallenge, randomToken, sha256 } from "../lib/crypto.js";
import { badRequest, unauthenticated } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type {
  GoogleIdentity,
  RequestMetadata,
} from "../types/identity.types.js";
import { auditService } from "./audit.service.js";
import { sessionService } from "./session.service.js";
import { userService } from "./user.service.js";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const tokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  id_token: z.string(),
  scope: z.string(),
  token_type: z.string(),
});

function safeReturnTo(candidate?: string) {
  if (!candidate) return undefined;
  try {
    const target = new URL(candidate);
    const allowedOrigins = [
      env.ADMIN_APP_URL,
      env.TEACHER_APP_URL,
      env.STUDENT_APP_URL,
    ].map((url) => new URL(url).origin);
    return allowedOrigins.includes(target.origin)
      ? target.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function roleDestination(role: "ADMIN" | "TEACHER" | "STUDENT") {
  if (role === "ADMIN") return env.ADMIN_APP_URL;
  if (role === "TEACHER") return env.TEACHER_APP_URL;
  return env.STUDENT_APP_URL;
}

export class OAuthService {
  async createGoogleAuthorizationUrl(returnTo?: string) {
    const state = randomToken(32);
    const codeVerifier = randomToken(64);
    const nonce = randomToken(32);

    await prisma.oAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await prisma.oAuthState.create({
      data: {
        stateHash: sha256(state),
        codeVerifier,
        nonce,
        returnTo: safeReturnTo(returnTo),
        expiresAt: new Date(
          Date.now() + env.OAUTH_STATE_TTL_MINUTES * 60 * 1000,
        ),
      },
    });

    const query = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.googleRedirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: pkceChallenge(codeVerifier),
      code_challenge_method: "S256",
      prompt: "select_account",
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  }

  async completeGoogleLogin(
    code: string,
    state: string,
    metadata: RequestMetadata,
  ) {
    const storedState = await prisma.$transaction(async (transaction) => {
      const record = await transaction.oAuthState.findUnique({
        where: { stateHash: sha256(state) },
      });
      if (!record || record.expiresAt <= new Date())
        throw badRequest(
          "INVALID_OAUTH_STATE",
          "The sign-in request is invalid or expired.",
        );
      await transaction.oAuthState.delete({ where: { id: record.id } });
      return record;
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.googleRedirectUri,
        grant_type: "authorization_code",
        code_verifier: storedState.codeVerifier,
      }),
    });

    if (!tokenResponse.ok)
      throw unauthenticated("Google rejected the authorization request.");
    const tokens = tokenResponseSchema.safeParse(await tokenResponse.json());
    if (!tokens.success)
      throw unauthenticated("Google returned an invalid token response.");

    const verified = await jwtVerify(tokens.data.id_token, googleKeys, {
      audience: env.GOOGLE_CLIENT_ID,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });

    if (verified.payload.nonce !== storedState.nonce)
      throw unauthenticated("The Google identity token could not be verified.");
    const claims = z
      .object({
        sub: z.string().min(1),
        email: z.string().email(),
        email_verified: z.boolean(),
        name: z.string().min(1),
        picture: z.string().url().optional(),
      })
      .safeParse(verified.payload);
    if (!claims.success || !claims.data.email_verified)
      throw unauthenticated("A verified Google email address is required.");

    const identity: GoogleIdentity = {
      subject: claims.data.sub,
      email: claims.data.email,
      name: claims.data.name,
      avatarUrl: claims.data.picture,
      emailVerified: claims.data.email_verified,
    };
    const user = await userService.resolveGoogleIdentity(identity);
    const session = await sessionService.create(user.id, metadata);
    await auditService.record({
      actorId: user.id,
      action: "USER_SIGNED_IN",
      entityType: "Session",
      entityId: session.sessionId,
      ...metadata,
    });

    return {
      user,
      session,
      destination: storedState.returnTo ?? roleDestination(user.role),
    };
  }
}

export const oauthService = new OAuthService();
