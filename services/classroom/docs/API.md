# Classroom API

All routes require an active identity session at the gateway. Public paths start with `http://localhost:4000/api/v1/classrooms`.

| Method | Public path                        | Role    | Purpose                                     |
| ------ | ---------------------------------- | ------- | ------------------------------------------- |
| GET    | `/classes`                         | Both    | List owned or joined classrooms.            |
| POST   | `/classes`                         | Teacher | Create a classroom and generated join code. |
| POST   | `/classes/join`                    | Student | Join using `{ "code": "ABCD2345" }`.        |
| GET    | `/classes/:id`                     | Both    | View an owned or joined classroom.          |
| DELETE | `/classes/:id`                     | Teacher | Delete an owned classroom and enrollments.  |
| DELETE | `/classes/:id/leave`               | Student | Leave a joined classroom.                   |
| GET    | `/classes/:id/students`            | Teacher | List roster; supports `limit` and `cursor`. |
| DELETE | `/classes/:id/students/:studentId` | Teacher | Remove one student from an owned classroom. |

Create body:

```json
{
  "name": "Data Structures - Section A",
  "subject": "Data Structures",
  "description": "Second-year core course",
  "section": "A",
  "academicYear": "2026-2027",
  "termEnd": "2026-12-20T00:00:00.000Z"
}
```

`description`, `section`, and `termEnd` are optional. Join codes contain eight unambiguous uppercase letters/digits. Joining is idempotent and ended classrooms reject new joins.

Errors use `{ "error": { "code", "message", "requestId" } }`.
