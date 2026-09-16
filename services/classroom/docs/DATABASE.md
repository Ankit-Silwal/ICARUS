# Classroom Database

Classroom uses a dedicated PostgreSQL database and Docker volume. It never reads or writes identity tables.

## Tables

- `classroom`: classroom metadata, the owning identity user UUID, generated join code, optional term end, and timestamps.
- `enrollment`: composite key of classroom UUID and student identity UUID, plus join time. Deleting a classroom cascades only its local enrollments.

`teacher_id` and `student_id` are external identity references without database foreign keys. Runtime session validation verifies active actors, and protected identity lookups resolve roster profiles. This keeps service ownership and migrations independent while preventing classroom access by removed or inactive accounts.
