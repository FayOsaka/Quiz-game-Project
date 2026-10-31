import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.QUESTION_DB_PATH || path.join(directory, 'question.db');
const port = Number(process.env.API_PORT || 8000);
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

// Preserve the existing database schema and add the answer variants table used by the editor.
db.exec(`
  CREATE TABLE IF NOT EXISTS accepted_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    score INTEGER NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER
  );
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
    question_text TEXT NOT NULL,
    reference_answer TEXT NOT NULL DEFAULT '',
    answer_text TEXT NOT NULL DEFAULT '',
    is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
    matched_answer_id INTEGER REFERENCES accepted_answers(id) ON DELETE SET NULL,
    UNIQUE (submission_id, question_id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_student_question_set
    ON submissions(student_id, question_set_id);
  CREATE TABLE IF NOT EXISTS pinned_students (
    student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
    pinned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const submissionColumns = db.prepare('PRAGMA table_info(submissions)').all().map((column) => column.name);
if (!submissionColumns.includes('duration_seconds')) {
  db.exec('ALTER TABLE submissions ADD COLUMN duration_seconds INTEGER');
}

function readSet(id) {
  const set = db.prepare(`
    SELECT qs.*,
      (SELECT COUNT(DISTINCT s.student_id) FROM submissions s WHERE s.question_set_id = qs.id) AS respondent_count
    FROM question_sets qs WHERE qs.id = ?
  `).get(id);
  if (!set) return null;
  set.questions = db.prepare(
    'SELECT * FROM questions WHERE question_set_id = ? ORDER BY position, id',
  ).all(id).map((question) => ({
    ...question,
    accepted_answers: db.prepare(
      'SELECT answer_text FROM accepted_answers WHERE question_id = ? ORDER BY id',
    ).all(question.id).map((row) => row.answer_text),
  }));
  return set;
}

function readDashboard(questionSetId = null) {
  const questionSets = db.prepare('SELECT id, title, status FROM question_sets ORDER BY id DESC').all();
  const submissions = db.prepare(`
    SELECT s.id, s.question_set_id, s.submitted_at, s.score, s.total_questions,
      st.student_code, st.full_name, st.program_name, st.faculty_name, st.campus_name,
      s.duration_seconds,
      EXISTS(SELECT 1 FROM pinned_students p WHERE p.student_id = st.id) AS is_pinned,
      qs.title AS question_set_title
    FROM submissions s
    JOIN students st ON st.id = s.student_id
    JOIN question_sets qs ON qs.id = s.question_set_id
    WHERE (? IS NULL OR s.question_set_id = ?)
    ORDER BY s.submitted_at DESC, s.id DESC
  `).all(questionSetId, questionSetId).map((submission) => {
    const answers = db.prepare(`
      SELECT a.id, a.question_id, a.answer_text, a.is_correct,
        COALESCE(a.question_text, q.text) AS question_text
      FROM answers a LEFT JOIN questions q ON q.id = a.question_id
      WHERE a.submission_id = ? ORDER BY COALESCE(q.position, a.id), a.id
    `).all(submission.id).map((answer) => {
      const accepted = answer.question_id
        ? db.prepare('SELECT answer_text FROM accepted_answers WHERE question_id = ? ORDER BY id').all(answer.question_id).map((row) => row.answer_text)
        : [];
      return {
        id: answer.id,
        question: answer.question_text,
        isCorrect: Boolean(answer.is_correct),
        userAnswer: answer.answer_text,
        refAnswer: accepted.length ? `เฉลยในฐานข้อมูล: ${accepted.join(' / ')}` : (answer.reference_answer || 'ไม่มีเฉลยที่บันทึกไว้'),
      };
    });
    const submittedDate = new Date(`${submission.submitted_at.replace(' ', 'T')}Z`);
    const campus = submission.campus_name === 'ภายในมหาวิทยาลัย' ? 'ในมหาวิทยาลัย' : submission.campus_name;
    return {
      id: submission.student_code,
      submissionId: submission.id,
      questionSetId: submission.question_set_id,
      questionSetTitle: submission.question_set_title,
      name: submission.full_name,
      degree: submission.program_name || '',
      faculty: submission.faculty_name || '',
      campus: campus || '',
      submittedAt: submission.submitted_at,
      date: submittedDate.toLocaleDateString('th-TH', { dateStyle: 'medium', timeZone: 'Asia/Bangkok' }),
      time: submittedDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) + ' น.',
      score: submission.score,
      totalQuestions: submission.total_questions,
      durationSeconds: submission.duration_seconds,
      isPinned: Boolean(submission.is_pinned),
      status: `ตรวจ ${submission.score}/${submission.total_questions} ข้อ`,
      answers,
    };
  });
  const allAnswers = submissions.flatMap((submission) => submission.answers);
  const correct = allAnswers.filter((answer) => answer.isCorrect).length;
  return {
    questionSets,
    submissions,
    stats: { totalAnswers: allAnswers.length, correct, wrong: allAnswers.length - correct },
  };
}

function normalizeAnswer(value) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/gu, ' ');
}

function send(res, status, value) {
  const body = value === undefined ? '' : JSON.stringify(value);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(body);
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      return send(res, 200, {
        name: 'Quiz Game Question API',
        database: dbPath,
        endpoints: [
          'GET /api/health',
          'GET /api/question-sets',
          'GET /api/dashboard?question_set_id=:id',
          'POST /api/submissions',
          'PUT /api/students/:student_code/pin',
          'POST /api/question-sets',
          'PUT /api/question-sets/:id',
          'PUT /api/question-sets/:id/questions',
          'DELETE /api/question-sets/:id',
        ],
      });
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return send(res, 200, { status: 'ok', database: dbPath });
    }
    if (req.method === 'GET' && url.pathname === '/api/question-sets') {
      const ids = db.prepare('SELECT id FROM question_sets ORDER BY id DESC').all();
      return send(res, 200, ids.map(({ id }) => readSet(id)));
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const rawId = url.searchParams.get('question_set_id');
      const setId = rawId ? Number(rawId) : null;
      if (setId !== null && (!Number.isSafeInteger(setId) || setId < 1)) {
        return send(res, 400, { error: 'Invalid question_set_id' });
      }
      return send(res, 200, readDashboard(setId));
    }
    if (req.method === 'POST' && url.pathname === '/api/submissions') {
      const data = await readBody(req);
      const setId = Number(data.question_set_id);
      const student = data.student || data;
      const studentCode = String(student.student_code || student.studentCode || '').trim();
      const fullName = String(student.full_name || student.fullName || '').trim();
      if (!Number.isSafeInteger(setId) || setId < 1 || !studentCode || !fullName || !Array.isArray(data.answers)) {
        return send(res, 400, { error: 'question_set_id, student_code, full_name, and answers are required' });
      }
      const set = readSet(setId);
      if (!set) return send(res, 404, { error: 'Question set not found' });
      const previousSubmission = db.prepare(`
        SELECT 1 FROM submissions s JOIN students st ON st.id = s.student_id
        WHERE st.student_code = ? AND s.question_set_id = ? LIMIT 1
      `).get(studentCode, setId);
      if (previousSubmission) return send(res, 409, { error: 'ท่านได้ส่งคำตอบแล้ว' });
      const validQuestionIds = new Set(set.questions.map((question) => question.id));
      if (data.answers.some((answer) => !validQuestionIds.has(Number(answer.question_id)))) {
        return send(res, 400, { error: 'An answer references a question outside this set' });
      }

      db.exec('BEGIN');
      try {
        const studentRow = db.prepare(`
          INSERT INTO students(student_code, full_name, program_name, faculty_name, campus_name)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(student_code) DO UPDATE SET
            full_name = excluded.full_name,
            program_name = excluded.program_name,
            faculty_name = excluded.faculty_name,
            campus_name = excluded.campus_name,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `).get(studentCode, fullName, student.program_name || student.program || null,
          student.faculty_name || student.faculty || null, student.campus_name || student.campus || null);
        const submittedAnswers = data.answers.map((answer) => {
          const text = String(answer.answer_text ?? answer.answer ?? '');
          const question = set.questions.find((item) => item.id === Number(answer.question_id));
          const accepted = question.accepted_answers.map((answerText) => ({
            id: db.prepare('SELECT id FROM accepted_answers WHERE question_id = ? AND answer_text = ?').get(question.id, answerText)?.id,
            answer_text: answerText,
          }));
          const match = accepted.find((row) => normalizeAnswer(row.answer_text) === normalizeAnswer(text));
          return {
            questionId: question.id,
            questionText: question.text,
            referenceAnswer: accepted.map((row) => row.answer_text).join(' / '),
            text,
            isCorrect: Boolean(match),
            matchedAnswerId: match?.id ?? null,
          };
        });
        const score = submittedAnswers.filter((answer) => answer.isCorrect).length;
        const submission = db.prepare(`
          INSERT INTO submissions(question_set_id, student_id, score, total_questions, duration_seconds)
          VALUES (?, ?, ?, ?, ?) RETURNING id
        `).get(setId, studentRow.id, score, set.questions.length,
          Number.isFinite(Number(data.duration_seconds)) ? Math.max(0, Math.round(Number(data.duration_seconds))) : null);
        const insertAnswer = db.prepare(`
          INSERT INTO answers(submission_id, question_id, question_text, reference_answer, answer_text, is_correct, matched_answer_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        submittedAnswers.forEach((answer) => insertAnswer.run(
          submission.id, answer.questionId, answer.questionText, answer.referenceAnswer,
          answer.text, answer.isCorrect ? 1 : 0, answer.matchedAnswerId,
        ));
        db.exec('COMMIT');
        return send(res, 201, { submission_id: Number(submission.id), score, total_questions: set.questions.length });
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] === 'students' && parts[3] === 'pin' && parts.length === 4) {
      const studentCode = decodeURIComponent(parts[2]);
      const data = await readBody(req);
      if (typeof data.pinned !== 'boolean') return send(res, 400, { error: 'pinned must be a boolean' });
      const student = db.prepare('SELECT id FROM students WHERE student_code = ?').get(studentCode);
      if (!student) return send(res, 404, { error: 'Student not found' });
      if (data.pinned) {
        db.prepare('INSERT OR IGNORE INTO pinned_students(student_id) VALUES (?)').run(student.id);
      } else {
        db.prepare('DELETE FROM pinned_students WHERE student_id = ?').run(student.id);
      }
      return send(res, 200, { student_code: studentCode, isPinned: data.pinned });
    }
    if (req.method === 'POST' && url.pathname === '/api/question-sets') {
      const data = await readBody(req);
      const title = String(data.title || '').trim();
      if (!title) return send(res, 400, { error: 'title is required' });
      const result = db.prepare(`
        INSERT INTO question_sets(title, description, status, start_at, end_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(title, data.description || '', data.status || 'closed', data.start_at ?? null, data.end_at ?? null);
      return send(res, 201, readSet(Number(result.lastInsertRowid)));
    }
    if (parts[0] === 'api' && parts[1] === 'question-sets' && parts[2]) {
      const id = Number(parts[2]);
      if (!Number.isSafeInteger(id) || id < 1) return send(res, 400, { error: 'Invalid question set id' });
      const current = readSet(id);
      if (!current) return send(res, 404, { error: 'Question set not found' });

      if (req.method === 'PUT' && parts[3] === 'questions' && parts.length === 4) {
        const data = await readBody(req);
        if (!Array.isArray(data.questions)) return send(res, 400, { error: 'questions must be an array' });
        db.exec('BEGIN');
        try {
          db.prepare('DELETE FROM questions WHERE question_set_id = ?').run(id);
          const insertQuestion = db.prepare(`
            INSERT INTO questions(question_set_id, text, type, is_required, position)
            VALUES (?, ?, ?, ?, ?)
          `);
          const insertAnswer = db.prepare('INSERT INTO accepted_answers(question_id, answer_text) VALUES (?, ?)');
          data.questions.forEach((item, position) => {
            const result = insertQuestion.run(id, String(item.text || ''), item.type || 'textarea', item.is_required === false ? 0 : 1, position);
            const answers = item.accepted_answers || (item.answer ? [item.answer] : []);
            answers.filter((answer) => String(answer).trim()).forEach((answer) => insertAnswer.run(Number(result.lastInsertRowid), String(answer).trim()));
          });
          db.prepare("UPDATE question_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
        return send(res, 200, readSet(id));
      }

      if (req.method === 'PUT' && parts.length === 3) {
        const data = await readBody(req);
        const allowed = ['title', 'description', 'status', 'start_at', 'end_at'];
        const fields = allowed.filter((field) => Object.hasOwn(data, field));
        if (fields.includes('title') && !String(data.title).trim()) return send(res, 400, { error: 'title is required' });
        if (fields.length) {
          const assignments = fields.map((field) => `${field} = ?`).join(', ');
          db.prepare(`UPDATE question_sets SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(...fields.map((field) => data[field]), id);
        }
        return send(res, 200, readSet(id));
      }

      if (req.method === 'DELETE' && parts.length === 3) {
        db.prepare('DELETE FROM question_sets WHERE id = ?').run(id);
        return send(res, 204);
      }
    }
    return send(res, 404, { error: 'Not found' });
  } catch (error) {
    const duplicateSubmission = error.message.includes('idx_submissions_student_question_set')
      || error.message.includes('submissions.student_id, submissions.question_set_id');
    const status = duplicateSubmission ? 409 : 400;
    if (duplicateSubmission) return send(res, status, { error: 'ท่านได้ส่งคำตอบแล้ว' });
    return send(res, status, { error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Question API listening at http://127.0.0.1:${port}`);
  console.log(`SQLite database: ${dbPath}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
