"use client";

import type { Classroom } from "@icarus/contracts";
import {
  Award,
  BookOpenCheck,
  CalendarDays,
  DoorOpen,
  LayoutDashboard,
  Library,
  LogOut,
  Users,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { AppShell, StatusPill } from "@repo/ui/shell";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}

export default function StudentClassesPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loadedAt] = useState(() => Date.now());

  useEffect(() => {
    void fetch(`${apiUrl}/classrooms/classes`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          setError(
            await responseError(response, "Classrooms could not be loaded."),
          );
          return;
        }
        const body = (await response.json()) as { classrooms: Classroom[] };
        setClassrooms(body.classrooms);
      })
      .catch(() => setError("The classroom service is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  const joinClassroom = async (event: FormEvent) => {
    event.preventDefault();
    setWorkingId("join");
    setError("");
    setNotice("");
    const response = await fetch(`${apiUrl}/classrooms/classes/join`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The classroom could not be joined.")
          : "The classroom service is unavailable.",
      );
    } else {
      const body = (await response.json()) as { classroom: Classroom };
      setClassrooms((current) => [
        body.classroom,
        ...current.filter((item) => item.id !== body.classroom.id),
      ]);
      setCode("");
      setNotice(`Joined ${body.classroom.name}.`);
    }
    setWorkingId("");
  };

  const leaveClassroom = async (classroom: Classroom) => {
    if (!window.confirm(`Leave ${classroom.name}?`)) return;
    setWorkingId(classroom.id);
    setError("");
    setNotice("");
    const response = await fetch(
      `${apiUrl}/classrooms/classes/${classroom.id}/leave`,
      { method: "DELETE", credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The classroom could not be left.")
          : "The classroom service is unavailable.",
      );
    } else {
      setClassrooms((current) =>
        current.filter((item) => item.id !== classroom.id),
      );
      setNotice(`You left ${classroom.name}.`);
    }
    setWorkingId("");
  };

  return (
    <AppShell
      role="Student"
      name="Arjun Mehta"
      initials="AM"
      navigation={[
        { label: "Overview", href: "/", icon: <LayoutDashboard size={17} /> },
        {
          label: "My classes",
          href: "/classes",
          active: true,
          icon: <Users size={17} />,
        },
        { label: "Exams", icon: <BookOpenCheck size={17} /> },
        { label: "Results", icon: <Award size={17} /> },
      ]}
    >
      <div className="mb-7">
        <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
          Classroom membership
        </p>
        <h1 className="text-2xl font-bold">My classrooms</h1>
        <p className="mt-1 text-sm text-[#6E7B76]">
          Join with the code from your teacher or leave a class you no longer
          attend.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-md bg-[#E9F3EE] text-[#176B5B]">
              <DoorOpen size={19} />
            </span>
            <div>
              <h2 className="font-bold">Join a classroom</h2>
              <p className="mt-1 text-xs leading-5 text-[#73807B]">
                Codes contain eight uppercase letters or digits.
              </p>
            </div>
          </div>
          <form onSubmit={joinClassroom}>
            <label className="block text-xs font-semibold" htmlFor="join-code">
              Classroom code
            </label>
            <input
              id="join-code"
              required
              minLength={8}
              maxLength={8}
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-HJ-NP-Z2-9]/g, "")
                    .slice(0, 8),
                )
              }
              placeholder="ABCD2345"
              className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 font-mono text-sm uppercase tracking-[0.18em]"
            />
            <Button
              className="mt-3 w-full"
              disabled={workingId === "join" || code.length !== 8}
            >
              {workingId === "join" ? "Joining…" : "Join classroom"}
            </Button>
          </form>
        </Card>

        <div>
          {(error || notice) && (
            <p
              className={`mb-4 rounded-md border p-3 text-sm ${
                error
                  ? "border-[#E8C9C5] bg-[#FFF7F5] text-[#A33D32]"
                  : "border-[#CFE4D8] bg-[#F1FAF5] text-[#176B5B]"
              }`}
            >
              {error || notice}
            </p>
          )}
          {loading ? (
            <Card className="p-8 text-sm text-[#73807B]">
              Loading classrooms…
            </Card>
          ) : classrooms.length === 0 ? (
            <Card className="p-8 text-center">
              <Library className="mx-auto text-[#81908A]" size={28} />
              <h2 className="mt-3 font-bold">No classrooms yet</h2>
              <p className="mt-1 text-sm text-[#73807B]">
                Enter a classroom code to get started.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {classrooms.map((classroom) => {
                const ended =
                  classroom.termEnd !== null &&
                  new Date(classroom.termEnd).getTime() <= loadedAt;
                return (
                  <Card key={classroom.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase text-[#176B5B]">
                          {classroom.subject}
                        </p>
                        <h2 className="mt-1 font-bold">{classroom.name}</h2>
                      </div>
                      <StatusPill tone={ended ? "neutral" : "green"}>
                        {ended ? "Ended" : "Active"}
                      </StatusPill>
                    </div>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs text-[#7A8782]">Section</dt>
                        <dd className="mt-1 font-semibold">
                          {classroom.section ?? "Not specified"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[#7A8782]">
                          Academic year
                        </dt>
                        <dd className="mt-1 font-semibold">
                          {classroom.academicYear}
                        </dd>
                      </div>
                    </dl>
                    {classroom.description && (
                      <p className="mt-4 text-sm leading-6 text-[#65736D]">
                        {classroom.description}
                      </p>
                    )}
                    <div className="mt-5 flex items-center justify-between border-t border-[#E7EAE7] pt-4">
                      <span className="flex items-center gap-1.5 text-xs text-[#73807B]">
                        <CalendarDays size={14} />
                        {classroom.termEnd
                          ? `Ends ${new Date(classroom.termEnd).toLocaleDateString()}`
                          : "No term end set"}
                      </span>
                      <Button
                        variant="danger"
                        disabled={workingId === classroom.id}
                        onClick={() => void leaveClassroom(classroom)}
                      >
                        <LogOut size={14} />
                        {workingId === classroom.id ? "Leaving…" : "Leave"}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
