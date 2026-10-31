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

Browser CORS access is restricted by default to `http://localhost:5173` and `http://127.0.0.1:5173`. Add other exact origins as a comma-separated `CORS_ALLOWED_ORIGINS` environment variable when needed. This is a browser policy, not authentication; admin endpoints remain unauthenticated in this phase.

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
