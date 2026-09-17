"use client";

import type {
  Classroom,
  ClassroomRosterEntry,
  ClassroomRosterResponse,
} from "@icarus/contracts";
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  Clipboard,
  ClipboardCheck,
  CirclePlus,
  FileQuestion,
  GraduationCap,
  LayoutDashboard,
  Trash2,
  UserMinus,
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

export default function TeacherClassesPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [roster, setRoster] = useState<ClassroomRosterEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selected = classrooms.find((item) => item.id === selectedId);

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
        setSelectedId(body.classrooms[0]?.id ?? "");
        if (body.classrooms.length === 0) setRosterLoading(false);
      })
      .catch(() => setError("The classroom service is unavailable."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void fetch(`${apiUrl}/classrooms/classes/${selectedId}/students?limit=50`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          setError(
            await responseError(response, "The roster could not be loaded."),
          );
          return;
        }
        const body = (await response.json()) as ClassroomRosterResponse;
        setRoster(body.students);
        setNextCursor(body.nextCursor);
      })
      .catch(() => setError("The classroom service is unavailable."))
      .finally(() => setRosterLoading(false));
  }, [selectedId]);

  const chooseClassroom = (classroomId: string) => {
    setSelectedId(classroomId);
    setRoster([]);
    setNextCursor(null);
    setRosterLoading(true);
    setError("");
    setNotice("");
  };

  const createClassroom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWorking("create");
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const termEnd = String(form.get("termEnd") ?? "");
    const payload = {
      name: String(form.get("name") ?? ""),
      subject: String(form.get("subject") ?? ""),
      description: String(form.get("description") ?? "") || undefined,
      section: String(form.get("section") ?? "") || undefined,
      academicYear: String(form.get("academicYear") ?? ""),
      termEnd: termEnd ? new Date(termEnd).toISOString() : undefined,
    };
    const response = await fetch(`${apiUrl}/classrooms/classes`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The classroom could not be created.")
          : "The classroom service is unavailable.",
      );
    } else {
      const body = (await response.json()) as { classroom: Classroom };
      setClassrooms((current) => [body.classroom, ...current]);
      setSelectedId(body.classroom.id);
      setRoster([]);
      setNextCursor(null);
      setRosterLoading(true);
      setShowCreate(false);
      setNotice(`${body.classroom.name} was created.`);
    }
    setWorking("");
  };

  const deleteClassroom = async () => {
    if (!selected) return;
    if (
      !window.confirm(
        `Delete ${selected.name}? This also removes its local enrollments.`,
      )
    )
      return;
    setWorking("delete");
    setError("");
    const response = await fetch(
      `${apiUrl}/classrooms/classes/${selected.id}`,
      { method: "DELETE", credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The classroom could not be deleted.")
          : "The classroom service is unavailable.",
      );
    } else {
      const remaining = classrooms.filter((item) => item.id !== selected.id);
      setClassrooms(remaining);
      setSelectedId(remaining[0]?.id ?? "");
      setRoster([]);
      setNextCursor(null);
      setRosterLoading(remaining.length > 0);
      setNotice(`${selected.name} was deleted.`);
    }
    setWorking("");
  };

  const removeStudent = async (entry: ClassroomRosterEntry) => {
    if (!selected) return;
    const label = entry.user?.name ?? entry.studentId;
    if (!window.confirm(`Remove ${label} from ${selected.name}?`)) return;
    setWorking(entry.studentId);
    setError("");
    const response = await fetch(
      `${apiUrl}/classrooms/classes/${selected.id}/students/${entry.studentId}`,
      { method: "DELETE", credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "The student could not be removed.")
          : "The classroom service is unavailable.",
      );
    } else {
      setRoster((current) =>
        current.filter((item) => item.studentId !== entry.studentId),
      );
      setClassrooms((current) =>
        current.map((item) =>
          item.id === selected.id
            ? { ...item, studentCount: Math.max(0, item.studentCount - 1) }
            : item,
        ),
      );
      setNotice(`${label} was removed.`);
    }
    setWorking("");
  };

  const loadMore = async () => {
    if (!selected || !nextCursor) return;
    setWorking("more");
    setError("");
    const response = await fetch(
      `${apiUrl}/classrooms/classes/${selected.id}/students?limit=50&cursor=${nextCursor}`,
      { credentials: "include" },
    ).catch(() => null);
    if (!response?.ok) {
      setError(
        response
          ? await responseError(response, "More students could not be loaded.")
          : "The classroom service is unavailable.",
      );
    } else {
      const body = (await response.json()) as ClassroomRosterResponse;
      setRoster((current) => [...current, ...body.students]);
      setNextCursor(body.nextCursor);
    }
    setWorking("");
  };

  const copyCode = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.code);
      setNotice("Classroom code copied.");
    } catch {
      setError("The classroom code could not be copied automatically.");
    }
  };

  return (
    <AppShell
      role="Teacher"
      name="Maya Rao"
      initials="MR"
      navigation={[
        { label: "Overview", href: "/", icon: <LayoutDashboard size={17} /> },
        {
          label: "Classes",
          href: "/classes",
          active: true,
          icon: <Users size={17} />,
        },
        { label: "Question bank", icon: <FileQuestion size={17} /> },
        { label: "Exams", icon: <BookOpenCheck size={17} /> },
        {
          label: "Review & grading",
          href: "/reviews",
          icon: <ClipboardCheck size={17} />,
        },
      ]}
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase text-[#176B5B]">
            Classroom management
          </p>
          <h1 className="text-2xl font-bold">Classes and rosters</h1>
          <p className="mt-1 text-sm text-[#6E7B76]">
            Create class spaces, share access codes, and manage enrollments.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <CirclePlus size={16} /> Create classroom
        </Button>
      </div>

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

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit overflow-hidden">
          <div className="border-b border-[#E4E8E4] px-5 py-4">
            <h2 className="font-bold">Your classrooms</h2>
            <p className="text-xs text-[#7B8883]">{classrooms.length} total</p>
          </div>
          {loading ? (
            <p className="p-5 text-sm text-[#73807B]">Loading classrooms…</p>
          ) : classrooms.length === 0 ? (
            <div className="p-6 text-center">
              <GraduationCap className="mx-auto text-[#81908A]" size={28} />
              <p className="mt-3 text-sm font-semibold">No classrooms yet</p>
            </div>
          ) : (
            <div className="divide-y divide-[#EDF0ED]">
              {classrooms.map((classroom) => (
                <button
                  key={classroom.id}
                  onClick={() => chooseClassroom(classroom.id)}
                  className={`w-full p-4 text-left transition ${
                    classroom.id === selectedId
                      ? "bg-[#EFF7F2]"
                      : "hover:bg-[#FAFBF9]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {classroom.name}
                      </div>
                      <div className="mt-1 text-xs text-[#7A8782]">
                        {classroom.subject}
                      </div>
                    </div>
                    {classroom.id === selectedId && (
                      <Check size={16} className="text-[#176B5B]" />
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-[#66736E]">
                    <span>{classroom.studentCount} students</span>
                    <span className="font-mono">{classroom.code}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selected ? (
          <div className="space-y-6">
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <StatusPill tone="green">Owned</StatusPill>
                  </div>
                  <p className="mt-1 text-sm text-[#6E7B76]">
                    {selected.subject}
                    {selected.section ? ` · Section ${selected.section}` : ""}
                  </p>
                </div>
                <Button
                  variant="danger"
                  disabled={working === "delete"}
                  onClick={() => void deleteClassroom()}
                >
                  <Trash2 size={15} />
                  {working === "delete" ? "Deleting…" : "Delete"}
                </Button>
              </div>
              {selected.description && (
                <p className="mt-4 max-w-3xl text-sm leading-6 text-[#65736D]">
                  {selected.description}
                </p>
              )}
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-[#F4F6F3] p-3">
                  <div className="text-xs text-[#7A8782]">Academic year</div>
                  <div className="mt-1 text-sm font-semibold">
                    {selected.academicYear}
                  </div>
                </div>
                <div className="rounded-md bg-[#F4F6F3] p-3">
                  <div className="text-xs text-[#7A8782]">Term end</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                    <CalendarDays size={14} />
                    {selected.termEnd
                      ? new Date(selected.termEnd).toLocaleDateString()
                      : "Not set"}
                  </div>
                </div>
                <button
                  onClick={() => void copyCode()}
                  className="rounded-md bg-[#172520] p-3 text-left text-white"
                >
                  <div className="flex items-center gap-1.5 text-xs text-white/60">
                    <Clipboard size={13} /> Join code
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold tracking-[0.18em]">
                    {selected.code}
                  </div>
                </button>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E4E8E4] px-5 py-4">
                <div>
                  <h2 className="font-bold">Student roster</h2>
                  <p className="text-xs text-[#7B8883]">
                    Current identity details for enrolled students
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {selected.studentCount}
                </span>
              </div>
              {rosterLoading ? (
                <p className="p-5 text-sm text-[#73807B]">Loading roster…</p>
              ) : roster.length === 0 ? (
                <p className="p-6 text-center text-sm text-[#73807B]">
                  No students have joined this classroom.
                </p>
              ) : (
                <div className="divide-y divide-[#EDF0ED]">
                  {roster.map((entry) => (
                    <div
                      key={entry.studentId}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {entry.user?.name ?? "Unavailable identity profile"}
                        </div>
                        <div className="mt-1 text-xs text-[#7A8782]">
                          {entry.user?.email ?? entry.studentId}
                          {` · Joined ${new Date(entry.joinedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <Button
                        variant="danger"
                        disabled={working === entry.studentId}
                        onClick={() => void removeStudent(entry)}
                      >
                        <UserMinus size={14} />
                        {working === entry.studentId ? "Removing…" : "Remove"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {nextCursor && (
                <div className="border-t border-[#E4E8E4] p-4 text-center">
                  <Button
                    variant="secondary"
                    disabled={working === "more"}
                    onClick={() => void loadMore()}
                  >
                    {working === "more" ? "Loading…" : "Load more students"}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        ) : (
          <Card className="grid min-h-80 place-items-center p-8 text-center">
            <div>
              <GraduationCap className="mx-auto text-[#81908A]" size={32} />
              <h2 className="mt-3 font-bold">Create your first classroom</h2>
              <p className="mt-1 text-sm text-[#73807B]">
                A unique student join code will be generated automatically.
              </p>
            </div>
          </Card>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0F1C18]/45 p-4">
          <form
            onSubmit={createClassroom}
            className="w-full max-w-2xl rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E2E6E3] px-5 py-4">
              <div>
                <h2 className="font-bold">Create classroom</h2>
                <p className="text-xs text-[#7D8984]">
                  Required fields are marked below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm font-semibold text-[#64716C]"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <label className="block text-xs font-semibold sm:col-span-2">
                Classroom name *
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Data Structures - Section A"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                Subject *
                <input
                  name="subject"
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="Data Structures"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                Section
                <input
                  name="section"
                  maxLength={80}
                  placeholder="A"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                Academic year *
                <input
                  name="academicYear"
                  required
                  minLength={4}
                  maxLength={40}
                  placeholder="2026-2027"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold">
                Term end
                <input
                  name="termEnd"
                  type="datetime-local"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#D8DED9] px-3 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold sm:col-span-2">
                Description
                <textarea
                  name="description"
                  maxLength={2000}
                  rows={3}
                  className="mt-1.5 w-full rounded-md border border-[#D8DED9] px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E2E6E3] px-5 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </Button>
              <Button disabled={working === "create"}>
                {working === "create" ? "Creating…" : "Create classroom"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
