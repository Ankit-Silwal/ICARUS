"use client";

import {
  Activity,
  DatabaseZap,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { AppShell } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function IntegrityRetentionPage() {
  const [cutoff, setCutoff] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{
    before: string;
    eventsRemoved: number;
    sessionsRemoved: number;
  }>();
  const [error, setError] = useState("");

  const removeExpired = async () => {
    if (!confirmed) return;
    setWorking(true);
    setError("");
    setResult(undefined);
    const response = await fetch(`${apiUrl}/integrity/retention/expired`, {
      method: "DELETE",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...(cutoff ? { before: new Date(cutoff).toISOString() } : {}),
      }),
    });
    if (response.ok) {
      setResult(
        (await response.json()) as {
          before: string;
          eventsRemoved: number;
          sessionsRemoved: number;
        },
      );
      setConfirmed(false);
    } else {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      setError(
        body?.error?.message ?? "Expired telemetry could not be removed.",
      );
    }
    setWorking(false);
  };

  return (
    <AppShell
      role="Admin"
      name="Avery Morgan"
      initials="AM"
      navigation={[
        { label: "Overview", href: "/", icon: <LayoutDashboard size={17} /> },
        { label: "Teachers", icon: <GraduationCap size={17} /> },
        { label: "Students", icon: <Users size={17} /> },
        { label: "Service health", icon: <Activity size={17} /> },
        {
          label: "Integrity retention",
          active: true,
          href: "/integrity",
          icon: <ShieldCheck size={17} />,
        },
      ]}
    >
      <div className="mb-7">
        <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
          Data governance
        </p>
        <h1 className="text-2xl font-bold">Integrity telemetry retention</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6E7B76]">
          Permanently remove raw editor events older than a controlled cutoff.
          Reports and sessions with no remaining evidence are removed with them.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <div className="flex items-start gap-3 border-b border-[#E4E8E4] p-5">
            <DatabaseZap className="mt-0.5 text-[#176B5B]" size={20} />
            <div>
              <h2 className="font-bold">Run retention cleanup</h2>
              <p className="mt-1 text-xs leading-5 text-[#6E7B76]">
                Leave the cutoff empty to use the service default configured by
                INTEGRITY_RETENTION_DAYS.
              </p>
            </div>
          </div>
          <div className="space-y-5 p-5">
            <label className="block text-xs font-semibold">
              Delete telemetry before
              <input
                type="datetime-local"
                value={cutoff}
                max={new Date().toISOString().slice(0, 16)}
                onChange={(event) => setCutoff(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
              />
            </label>
            <label className="flex items-start gap-3 rounded-md border border-[#E8DFC0] bg-[#FFF9E9] p-4 text-sm leading-6 text-[#715721]">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 accent-[#A33D32]"
              />
              I understand this permanently deletes matching raw telemetry and
              empty reports. This action cannot be undone.
            </label>
            {error && (
              <p className="rounded-md border border-[#E8C9C5] bg-[#FFF7F5] p-3 text-sm text-[#A33D32]">
                {error}
              </p>
            )}
            <Button
              variant="danger"
              disabled={!confirmed || working}
              onClick={removeExpired}
            >
              <Trash2 size={15} />
              {working
                ? "Removing expired telemetry…"
                : "Remove expired telemetry"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-bold">Latest cleanup</h2>
          {result ? (
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-bold uppercase text-[#7B8883]">
                  Cutoff
                </dt>
                <dd className="mt-1">
                  {new Date(result.before).toLocaleString()}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-[#F4F6F3] p-3">
                  <dt className="text-xs text-[#7B8883]">Events removed</dt>
                  <dd className="mt-1 text-xl font-bold">
                    {result.eventsRemoved}
                  </dd>
                </div>
                <div className="rounded-md bg-[#F4F6F3] p-3">
                  <dt className="text-xs text-[#7B8883]">Sessions removed</dt>
                  <dd className="mt-1 text-xl font-bold">
                    {result.sessionsRemoved}
                  </dd>
                </div>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#6E7B76]">
              No cleanup has been run during this browser session.
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
