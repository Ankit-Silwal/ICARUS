"use client";
import { Feather, LogIn } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./button";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";
type Session = {
  user: { id: string; name: string; email: string; role: Role };
};
const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export function AuthGate({
  requiredRole,
  children,
}: {
  requiredRole: Role;
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`${apiUrl}/auth/session`, { credentials: "include" })
      .then(async (response) =>
        setSession(response.ok ? ((await response.json()) as Session) : null),
      )
      .catch(() => setSession(null));
  }, []);
  const demoLogin = async () => {
    setError("");
    const response = await fetch(`${apiUrl}/auth/demo-login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: requiredRole }),
    }).catch(() => null);
    if (!response?.ok)
      return setError("The API is unavailable. Start Docker and try again.");
    window.location.reload();
  };
  if (session === undefined)
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F6F3] text-sm text-[#71807A]">
        Checking your ICARUS session...
      </div>
    );
  if (!session)
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F6F3] p-5">
        <div className="w-full max-w-sm rounded-lg border border-[#DDE2DE] bg-white p-7 shadow-sm">
          <span className="mb-6 grid size-10 place-items-center rounded-md bg-[#DFF36D] text-[#172520]">
            <Feather size={21} />
          </span>
          <h1 className="text-xl font-bold text-[#1E2925]">
            Sign in to ICARUS
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6D7A75]">
            Continue with the Google account connected to your{" "}
            {requiredRole.toLowerCase()} profile.
          </p>
          <a
            href={`${apiUrl}/auth/oauth/google`}
            className="mt-6 flex h-10 items-center justify-center gap-2 rounded-md bg-[#176B5B] text-sm font-semibold text-white"
          >
            <LogIn size={16} /> Continue with Google
          </a>
          {process.env.NODE_ENV !== "production" && (
            <Button
              variant="secondary"
              className="mt-2 h-10 w-full"
              onClick={demoLogin}
            >
              Use local {requiredRole.toLowerCase()} account
            </Button>
          )}
          {error && <p className="mt-3 text-xs text-[#A33D32]">{error}</p>}
          <p className="mt-5 text-[11px] leading-5 text-[#8A9691]">
            Local accounts are disabled in production.
          </p>
        </div>
      </div>
    );
  if (session.user.role !== requiredRole)
    return (
      <div className="grid min-h-screen place-items-center bg-[#F4F6F3] p-5">
        <div className="max-w-md rounded-lg border border-[#E8C9C5] bg-white p-6">
          <h1 className="font-bold">This workspace is restricted</h1>
          <p className="mt-2 text-sm text-[#6D7A75]">
            Signed in as {session.user.email} ({session.user.role.toLowerCase()}
            ).
          </p>
        </div>
      </div>
    );
  return children;
}
