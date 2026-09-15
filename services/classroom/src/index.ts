import { z } from "zod";
import { actor, createService, database, listen, validate } from "@icarus/service-kit";

const app = createService("classroom");
const sql = database();
const demoClass = { id: "10000000-0000-4000-8000-000000000001", teacherId: "00000000-0000-4000-8000-000000000002", name: "Data Structures · Section A", code: "ICARUS", termEnd: "2026-12-20T00:00:00.000Z", studentCount: 32 };

async function bootstrap() {
  await sql`create schema if not exists classroom`;
  await sql`create table if not exists classroom.class (id uuid primary key, teacher_id uuid not null, name text not null, code char(6) unique not null, term_end timestamptz not null)`;
  await sql`create table if not exists classroom.enrollment (class_id uuid not null references classroom.class(id), student_id uuid not null, joined_at timestamptz not null default now(), primary key(class_id, student_id))`;
  await sql`insert into classroom.class (id, teacher_id, name, code, term_end) values (${demoClass.id}, ${demoClass.teacherId}, ${demoClass.name}, ${demoClass.code}, ${demoClass.termEnd}) on conflict (id) do nothing`;
  await sql`insert into classroom.enrollment (class_id, student_id) values (${demoClass.id}, '00000000-0000-4000-8000-000000000003') on conflict do nothing`;
}

app.get("/classes", async (request, response) => {
  const user = actor(request);
  const rows = user.role === "TEACHER"
      ? await sql`select c.*, count(e.student_id)::int as student_count from classroom.class c left join classroom.enrollment e on e.class_id=c.id where teacher_id=${user.id} group by c.id`
      : await sql`select c.*, count(all_e.student_id)::int as student_count from classroom.class c join classroom.enrollment mine on mine.class_id=c.id and mine.student_id=${user.id} left join classroom.enrollment all_e on all_e.class_id=c.id group by c.id`;
  response.json({ classes: rows.map((row) => ({ id: row.id, teacherId: row.teacher_id, name: row.name, code: row.code.trim(), termEnd: new Date(row.term_end).toISOString(), studentCount: row.student_count })) });
});

app.post("/classes", validate(z.object({ name: z.string().min(2).max(100), termEnd: z.string().datetime() })), async (request, response) => {
  const user = actor(request);
  if (user.role !== "TEACHER") return response.status(403).json({ error: { code: "FORBIDDEN", message: "Only teachers can create classes." } });
  const item = { id: crypto.randomUUID(), teacherId: user.id, name: request.body.name, code: crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase(), termEnd: request.body.termEnd, studentCount: 0 };
  await sql`insert into classroom.class (id, teacher_id, name, code, term_end) values (${item.id}, ${item.teacherId}, ${item.name}, ${item.code}, ${item.termEnd})`;
  response.status(201).json({ class: item });
});

app.post("/classes/join", validate(z.object({ code: z.string().length(6).transform((value) => value.toUpperCase()) })), async (request, response) => {
  const user = actor(request);
  const found = (await sql`select id, teacher_id as "teacherId", name, code, term_end as "termEnd" from classroom.class where code=${request.body.code}`)[0];
  if (!found) return response.status(404).json({ error: { code: "CLASS_NOT_FOUND", message: "That class code does not exist." } });
  await sql`insert into classroom.enrollment (class_id, student_id) values (${found.id}, ${user.id}) on conflict do nothing`;
  response.status(201).json({ class: found });
});

void bootstrap().then(() => listen(app, Number(process.env.PORT ?? 4002)));
