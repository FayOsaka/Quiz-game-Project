# Question API

Requires Node.js 22.5 or later. The server uses Node's built-in SQLite module; no `npm install` is needed. It connects directly to `server/question.db` and keeps the existing tables/data. Startup adds `accepted_answers`, `submissions`, and `answers` if they are missing.

From this folder, start the API with:

```powershell
npm run dev
```

The API listens at `http://127.0.0.1:8000`. In a second terminal, start the frontend with `cd ..\client; npm run dev`; Vite forwards `/api` to this server.

Endpoints:

- `GET /api/public/question-sets` — sets currently accepting responses, with question text and required flags but no answer keys
- `GET /api/question-sets` — list sets with their questions and accepted answers
- `POST /api/question-sets` — create a set (`title`, optional `description`)
- `PUT /api/question-sets/{id}` — update title, description, status, or schedule
- `PUT /api/question-sets/{id}/questions` — replace a set's questions and accepted answers
- `DELETE /api/question-sets/{id}` — delete a set
- `GET /api/health` — health check
- `GET /api/dashboard?question_set_id={id}` — dashboard list, answer statistics, and question sets (omit id to show all)
- `POST /api/submissions` — save a student's submission and automatically compare answers to accepted answers
- `PUT /api/students/{student_code}/pin` — save or remove a student's dashboard pin (`{"pinned": true}`)

In development, browser CORS allows `http://localhost:5173` and `http://127.0.0.1:5173`. In production there are no default allowed origins; set exact origins in the comma-separated `CORS_ALLOWED_ORIGINS` environment variable. Dashboard, question-set management, and pinning endpoints require an admin session and CSRF token. Public question listing and student submissions remain public.

## Admin access

There is no public admin registration. Stop the API, then from this folder create an account in an interactive terminal; the password prompt is hidden:

```powershell
node admin-cli.js create admin
```

The CLI uses `server/question.db` by default. If the API uses `QUESTION_DB_PATH`, run the CLI with the same environment variable. To disable an account and revoke all of its sessions:

```powershell
node admin-cli.js disable admin
```

Open `/admin/login` in the frontend. Admin sessions use an HttpOnly, SameSite=Lax cookie, scrypt password hashes, a 30-minute idle timeout, a 12-hour absolute timeout, CSRF checks on unsafe admin requests, and a database-backed limit of five login attempts per account/IP in a rolling 15-minute window. The API creates the additive `admin_users`, `admin_sessions`, `admin_session_csrf_tokens`, and `admin_login_attempts` tables at startup; it does not rewrite student, question, or submission rows.

For an HTTPS reverse proxy or Cloudflare Tunnel, configure exact browser origins, for example `CORS_ALLOWED_ORIGINS=https://your-public-host.example`, and set `COOKIE_SECURE=true`. If Cloudflare is the only route to the loopback-bound API, set `TRUST_CLOUDFLARE_PROXY=true` to use its client-IP header for login rate limiting. Do not expose the admin APIs publicly before provisioning an admin and setting the production origin/cookie environment values.

## Tests

Run the built-in Node test suite from this folder with `npm test`. Tests create an isolated temporary SQLite database and do not use `question.db`.

Submission JSON shape:

```json
{
  "question_set_id": 1,
  "student": {
    "student_code": "690100101",
    "full_name": "Student Name",
    "program_name": "Program",
    "faculty_name": "Faculty",
    "campus_name": "Campus"
  },
  "answers": [{ "question_id": 1, "answer_text": "Student response" }]
}
```
