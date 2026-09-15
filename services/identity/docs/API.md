# Identity API

All browser-facing routes use the API Gateway prefix `http://localhost:4000/api/v1/auth`. The identity container itself listens internally on port `8000`.

## OAuth and sessions

| Method | Public path              | Authentication          | Purpose                                                                     |
| ------ | ------------------------ | ----------------------- | --------------------------------------------------------------------------- |
| GET    | `/oauth/google`          | None                    | Start Google OAuth. Optional `returnTo` must match a configured app origin. |
| GET    | `/oauth/google/callback` | OAuth state             | Exchange the Google authorization code and create a session.                |
| GET    | `/session`               | Session cookie          | Return the authenticated user. Used by the gateway.                         |
| POST   | `/logout`                | Optional session cookie | Revoke the current session and clear its cookie.                            |
| GET    | `/users/me`              | Session cookie          | Return the authenticated user's public profile.                             |

The browser session is an opaque random token in an HTTP-only, SameSite=Lax cookie. Only its SHA-256 hash is persisted.

## Administrator routes

All routes below require an active `ADMIN` session.

| Method | Public path                   | Purpose                                                                     |
| ------ | ----------------------------- | --------------------------------------------------------------------------- |
| GET    | `/admin/users`                | List users with optional `role`, `status`, `search`, `limit`, and `cursor`. |
| GET    | `/admin/users/:id`            | Retrieve one user.                                                          |
| PATCH  | `/admin/users/:id/status`     | Set `PENDING`, `ACTIVE`, `SUSPENDED`, or `DISABLED`.                        |
| PATCH  | `/admin/users/:id/role`       | Set `ADMIN`, `TEACHER`, or `STUDENT`.                                       |
| GET    | `/admin/teachers/invitations` | List teacher invitations.                                                   |
| POST   | `/admin/teachers/invitations` | Provision one teacher using `{ "email", "name"? }`.                         |
| POST   | `/admin/teachers/import`      | Upload teacher CSV as multipart form field `file`.                          |
| GET    | `/admin/teacher-imports/:id`  | Retrieve a stored import result.                                            |
| GET    | `/admin/audit-logs`           | List audit records with `limit` and `cursor`.                               |

The compatibility path `GET|POST /teacher-invitations` remains available for the current Admin Portal.

## Teacher CSV

Required headers are `email` and `name`. Optional headers are `employee_id` and `department`.

```csv
employee_id,name,email,department
CSE001,Anita Sharma,anita@example.edu,Computer Science
CSE002,Rahul Kumar,rahul@example.edu,Computer Science
```

The import returns `201` when all rows succeed and `207` when valid rows were imported but other rows were rejected. It validates duplicates, existing roles, employee IDs, file size, and row count. CSV files must not contain passwords.

## Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "requestId": "uuid"
  }
}
```
