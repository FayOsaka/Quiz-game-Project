import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ensureAuthSchema, randomToken, sha256, verifyPassword } from './auth.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const clientDistDirectory = path.resolve(directory, '../client/dist');
const dbPath = process.env.QUESTION_DB_PATH || path.join(directory, 'question.db');
const port = Number(process.env.API_PORT || 8000);
const allowedOrigins = new Set([
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']),
  ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
]);
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
ensureAuthSchema(db);

const SESSION_IDLE_MS = 30 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const SESSION_COOKIE = 'quiz_admin_session';
const DUMMY_PASSWORD_HASH = Buffer.alloc(64);
const DUMMY_PASSWORD_SALT = Buffer.alloc(16);

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

function parseKeywords(value) {
  return String(value ?? '')
    .split(',')
    .map((keyword) => normalizeAnswer(keyword))
    .filter(Boolean);
}

function isWithinSubmissionWindow(set, now = Date.now()) {
  if (set.status !== 'open') return false;
  for (const [field, isStart] of [['start_at', true], ['end_at', false]]) {
    if (!set[field]) continue;
    const timestamp = Date.parse(String(set[field]).replace(' ', 'T'));
    if (!Number.isFinite(timestamp)) return false;
    if (isStart && now < timestamp) return false;
    if (!isStart && now >= timestamp) return false;
  }
  return true;
}

function readPublicQuestionSets() {
  return db.prepare("SELECT * FROM question_sets WHERE status = 'open' ORDER BY id DESC").all()
    .filter((set) => isWithinSubmissionWindow(set))
    .map((set) => ({
      id: set.id,
      title: set.title,
      description: set.description,
      start_at: set.start_at,
      end_at: set.end_at,
      questions: db.prepare(`
        SELECT id, text, type, is_required, position
        FROM questions WHERE question_set_id = ? ORDER BY position, id
      `).all(set.id),
    }));
}

function send(res, status, value, origin, extraHeaders = {}) {
  const body = value === undefined ? '' : JSON.stringify(value);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  };
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
    headers.Vary = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(body);
}

const staticContentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function serveFrontend(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const relativePath = decodedPath.replace(/^\/+/, '');
  const requestedFile = path.resolve(clientDistDirectory, relativePath || 'index.html');
  if (requestedFile !== clientDistDirectory && !requestedFile.startsWith(`${clientDistDirectory}${path.sep}`)) {
    return false;
  }

  let filePath = requestedFile;
  let fileInfo;
  try {
    fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) fileInfo = null;
  } catch {
    fileInfo = null;
  }

  // React Router routes should load index.html; missing asset URLs should stay 404s.
  if (!fileInfo) {
    if (path.extname(decodedPath)) return false;
    filePath = path.join(clientDistDirectory, 'index.html');
    try {
      fileInfo = await stat(filePath);
      if (!fileInfo.isFile()) return false;
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Frontend build not found. Run npm run build in the client directory.');
      return true;
    }
  }

  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': staticContentTypes[extension] || 'application/octet-stream',
    'Content-Length': fileInfo.size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
  stream.pipe(res);
  return true;
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  for (const segment of cookieHeader.split(';')) {
    const separator = segment.indexOf('=');
    if (separator < 0) continue;
    if (segment.slice(0, separator).trim() === name) return decodeURIComponent(segment.slice(separator + 1).trim());
  }
  return '';
}

function secureCookie(req) {
  return Boolean(req.socket.encrypted) || process.env.COOKIE_SECURE === 'true';
}

function makeSessionCookie(token, req, maxAgeSeconds) {
  const secure = secureCookie(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearSessionCookie(req) {
  const secure = secureCookie(req) ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function clientIp(req) {
  if (process.env.TRUST_CLOUDFLARE_PROXY === 'true') {
    const cloudflareIp = req.headers['cf-connecting-ip'];
    if (typeof cloudflareIp === 'string' && cloudflareIp.length <= 64) return cloudflareIp;
  }
  return req.socket.remoteAddress || 'unknown';
}

function authenticateAdmin(req) {
  const rawToken = readCookie(req, SESSION_COOKIE);
  if (!rawToken) return null;
  let tokenBytes;
  try {
    tokenBytes = Buffer.from(rawToken, 'base64url');
  } catch {
    return null;
  }
  if (tokenBytes.length !== 32) return null;
  const now = Date.now();
  const session = db.prepare(`
    SELECT s.id AS session_id, s.csrf_token_hash, s.last_seen_at, s.expires_at,
      s.absolute_expires_at, u.id AS admin_user_id, u.username
    FROM admin_sessions s JOIN admin_users u ON u.id = s.admin_user_id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND u.is_active = 1
  `).get(sha256(tokenBytes));
  if (!session) return null;
  if (session.expires_at <= now || session.absolute_expires_at <= now || session.last_seen_at + SESSION_IDLE_MS <= now) {
    db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').run(now, session.session_id);
    return null;
  }
  const nextExpiry = Math.min(now + SESSION_IDLE_MS, session.absolute_expires_at);
  db.prepare('UPDATE admin_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?')
    .run(now, nextExpiry, session.session_id);
  return { ...session, tokenBytes, expiresAt: nextExpiry };
}

function adminAccess(req) {
  const session = authenticateAdmin(req);
  if (!session) return { error: { status: 401, message: 'Admin login required' } };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      return { error: { status: 403, message: 'Request Origin is not allowed' } };
    }
    const supplied = req.headers['x-csrf-token'];
    if (typeof supplied !== 'string' || !supplied) {
      return { error: { status: 403, message: 'CSRF token required' } };
    }
    const tokenHash = sha256(supplied);
    const validToken = db.prepare(`
      SELECT 1 FROM admin_session_csrf_tokens WHERE session_id = ? AND token_hash = ?
    `).get(session.session_id, tokenHash);
    if (!validToken) {
      return { error: { status: 403, message: 'Invalid CSRF token' } };
    }
  }
  return { session };
}

function originAllowed(req) {
  const origin = req.headers.origin;
  return typeof origin === 'string' && allowedOrigins.has(origin);
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) {
      const error = new Error('Request body exceeds 1 MB');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const error = new Error('Request body must be a JSON object');
    error.statusCode = 400;
    throw error;
  }
  return data;
}

const server = createServer(async (req, res) => {
  let sessionRenewalCookie = null;
  const reply = (status, value, headers = {}) => send(res, status, value, req.headers.origin, {
    ...(sessionRenewalCookie ? { 'Set-Cookie': sessionRenewalCookie } : {}),
    ...headers,
  });
  const checkAdmin = () => {
    const access = adminAccess(req);
    if (access.session) {
      const maxAge = Math.max(0, Math.floor((access.session.expiresAt - Date.now()) / 1000));
      sessionRenewalCookie = makeSessionCookie(access.session.tokenBytes.toString('base64url'), req, maxAge);
    } else {
      sessionRenewalCookie = clearSessionCookie(req);
    }
    return access;
  };
  if (req.method === 'OPTIONS') return reply(204);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && url.pathname === '/') {
      if (await serveFrontend(req, res, url.pathname)) return;
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return reply(200, { status: 'ok' });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
      if (!originAllowed(req)) return reply(403, { error: 'Request Origin is not allowed' });
      const data = await readBody(req);
      if (typeof data.username !== 'string' || typeof data.password !== 'string'
        || data.username.trim().length < 3 || data.username.trim().length > 100
        || data.password.length < 1 || data.password.length > 1024) {
        return reply(400, { error: 'Username and password are required' });
      }
      const username = data.username.trim();
      const now = Date.now();
      const accountHash = sha256(username.toLocaleLowerCase());
      const ipHash = sha256(clientIp(req));
      const saveLoginAttempt = db.prepare(`
        INSERT INTO admin_login_attempts(account_key_hash, ip_key_hash, attempted_at, succeeded)
        VALUES (?, ?, ?, 0)
      `);
      let loginAttempt;
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM admin_login_attempts WHERE attempted_at < ?').run(now - 30 * 24 * 60 * 60 * 1000);
        const recentFailures = db.prepare(`
          SELECT COUNT(*) AS count FROM admin_login_attempts
          WHERE attempted_at >= ? AND succeeded = 0
            AND (account_key_hash = ? OR ip_key_hash = ?)
        `).get(now - LOGIN_WINDOW_MS, accountHash, ipHash).count;
        if (recentFailures >= LOGIN_MAX_FAILURES) {
          db.exec('ROLLBACK');
          return reply(429, { error: 'Too many login attempts. Try again in 15 minutes.' }, { 'Retry-After': '900' });
        }
        loginAttempt = saveLoginAttempt.run(accountHash, ipHash, now);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }

      const admin = db.prepare(`
        SELECT id, username, password_hash, password_salt, scrypt_n, scrypt_r, scrypt_p
        FROM admin_users WHERE username = ? COLLATE NOCASE AND is_active = 1
      `).get(username);
      const passwordOk = await verifyPassword(
        data.password,
        admin ? Buffer.from(admin.password_salt) : DUMMY_PASSWORD_SALT,
        admin ? Buffer.from(admin.password_hash) : DUMMY_PASSWORD_HASH,
        admin
          ? { keyLength: 64, N: admin.scrypt_n, r: admin.scrypt_r, p: admin.scrypt_p }
          : { keyLength: 64, N: 32768, r: 8, p: 1 },
      );
      const succeeded = Boolean(admin && passwordOk);
      if (!succeeded) return reply(401, { error: 'Invalid username or password' });

      const rawSessionToken = randomToken();
      const rawCsrfToken = randomToken();
      const absoluteExpiry = now + SESSION_ABSOLUTE_MS;
      const idleExpiry = Math.min(now + SESSION_IDLE_MS, absoluteExpiry);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE admin_login_attempts SET succeeded = 1 WHERE id = ? AND succeeded = 0')
          .run(loginAttempt.lastInsertRowid);
        const sessionResult = db.prepare(`
          INSERT INTO admin_sessions
            (admin_user_id, token_hash, csrf_token_hash, created_at, last_seen_at, expires_at, absolute_expires_at, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(admin.id, sha256(Buffer.from(rawSessionToken, 'base64url')), sha256(rawCsrfToken),
          now, now, idleExpiry, absoluteExpiry, String(req.headers['user-agent'] || '').slice(0, 500) || null);
        db.prepare(`
          INSERT INTO admin_session_csrf_tokens(session_id, token_hash, created_at)
          VALUES (?, ?, ?)
        `).run(sessionResult.lastInsertRowid, sha256(rawCsrfToken), now);
        db.prepare('UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(now, now, admin.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return reply(200, {
        user: { id: admin.id, username: admin.username },
        csrfToken: rawCsrfToken,
        expiresAt: idleExpiry,
      }, { 'Set-Cookie': makeSessionCookie(rawSessionToken, req, Math.floor(SESSION_IDLE_MS / 1000)) });
    }
    if (req.method === 'GET' && url.pathname === '/api/auth/session') {
      if (req.headers.origin && !originAllowed(req)) return reply(403, { error: 'Request Origin is not allowed' });
      const session = authenticateAdmin(req);
      if (!session) return reply(401, { error: 'Admin login required' }, { 'Set-Cookie': clearSessionCookie(req) });
      sessionRenewalCookie = makeSessionCookie(
        session.tokenBytes.toString('base64url'), req,
        Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
      );
      const csrfToken = randomToken();
      const csrfHash = sha256(csrfToken);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE admin_sessions SET csrf_token_hash = ? WHERE id = ? AND revoked_at IS NULL')
          .run(csrfHash, session.session_id);
        db.prepare(`
          INSERT INTO admin_session_csrf_tokens(session_id, token_hash, created_at)
          VALUES (?, ?, ?)
        `).run(session.session_id, csrfHash, Date.now());
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return reply(200, {
        user: { id: session.admin_user_id, username: session.username },
        csrfToken,
        expiresAt: session.expiresAt,
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
      const access = checkAdmin();
      if (access.error) return reply(access.error.status, { error: access.error.message });
      db.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
        .run(Date.now(), access.session.session_id);
      return reply(200, { ok: true }, { 'Set-Cookie': clearSessionCookie(req) });
    }
    if (req.method === 'GET' && url.pathname === '/api/public/question-sets') {
      return reply(200, readPublicQuestionSets());
    }
    const isAdminApi = url.pathname === '/api/question-sets'
      || url.pathname === '/api/dashboard'
      || /^\/api\/students\/[^/]+\/pin$/u.test(url.pathname)
      || /^\/api\/question-sets\/\d+(?:\/questions)?$/u.test(url.pathname);
    if (isAdminApi) {
      const access = checkAdmin();
      if (access.error) return reply(access.error.status, { error: access.error.message });
    }
    if (req.method === 'GET' && url.pathname === '/api/question-sets') {
      const ids = db.prepare('SELECT id FROM question_sets ORDER BY id DESC').all();
      return reply(200, ids.map(({ id }) => readSet(id)));
    }
    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
      const rawId = url.searchParams.get('question_set_id');
      const setId = rawId ? Number(rawId) : null;
      if (setId !== null && (!Number.isSafeInteger(setId) || setId < 1)) {
        return reply(400, { error: 'Invalid question_set_id' });
      }
      return reply(200, readDashboard(setId));
    }
    if (req.method === 'POST' && url.pathname === '/api/submissions') {
      const data = await readBody(req);
      const rawSetId = data.question_set_id;
      const setId = typeof rawSetId === 'number'
        ? rawSetId
        : (typeof rawSetId === 'string' && /^\d+$/u.test(rawSetId) ? Number(rawSetId) : NaN);
      const student = data.student === undefined ? data : data.student;
      if (!student || typeof student !== 'object' || Array.isArray(student)) {
        return reply(400, { error: 'student must be a JSON object' });
      }
      const studentCodeValue = student.student_code ?? student.studentCode;
      const fullNameValue = student.full_name ?? student.fullName;
      if (typeof studentCodeValue !== 'string' || typeof fullNameValue !== 'string') {
        return reply(400, { error: 'student_code and full_name must be strings' });
      }
      const studentCode = studentCodeValue.trim();
      const fullName = fullNameValue.trim();
      if (!Number.isSafeInteger(setId) || setId < 1 || !studentCode || !fullName || studentCode.length > 64 || fullName.length > 200 || !Array.isArray(data.answers)) {
        return reply(400, { error: 'question_set_id, student_code, full_name, and answers are required' });
      }
      const optionalStudentFields = [
        student.program_name ?? student.program,
        student.faculty_name ?? student.faculty,
        student.campus_name ?? student.campus,
      ];
      if (optionalStudentFields.some((value) => value != null && (typeof value !== 'string' || value.length > 200))) {
        return reply(400, { error: 'program_name, faculty_name, and campus_name must be strings no longer than 200 characters' });
      }
      const set = readSet(setId);
      if (!set) return reply(404, { error: 'Question set not found' });
      if (!isWithinSubmissionWindow(set)) {
        return reply(403, { error: 'ชุดคำถามนี้ไม่ได้เปิดรับคำตอบในขณะนี้' });
      }

      const submittedQuestionIds = new Set();
      const submittedAnswers = [];
      for (const answer of data.answers) {
        if (!answer || typeof answer !== 'object' || Array.isArray(answer)) {
          return reply(400, { error: 'Each answer must be a JSON object' });
        }
        const rawQuestionId = answer.question_id;
        const questionId = typeof rawQuestionId === 'number'
          ? rawQuestionId
          : (typeof rawQuestionId === 'string' && /^\d+$/u.test(rawQuestionId) ? Number(rawQuestionId) : NaN);
        if (!Number.isSafeInteger(questionId) || questionId < 1) {
          return reply(400, { error: 'question_id must be a positive integer' });
        }
        if (submittedQuestionIds.has(questionId)) {
          return reply(400, { error: `Duplicate question_id: ${questionId}` });
        }
        submittedQuestionIds.add(questionId);
        const question = set.questions.find((item) => item.id === questionId);
        if (!question) {
          return reply(400, { error: 'An answer references a question outside this set' });
        }
        const text = answer.answer_text ?? answer.answer;
        if (typeof text !== 'string' || text.length > 10000) {
          return reply(400, { error: 'answer_text must be a string no longer than 10000 characters' });
        }
        submittedAnswers.push({ question, questionId, text });
      }
      const missingRequired = set.questions.filter((question) =>
        Boolean(question.is_required) &&
        (!submittedQuestionIds.has(question.id) || !submittedAnswers.find((answer) => answer.questionId === question.id)?.text.trim()),
      );
      if (missingRequired.length) {
        return reply(400, {
          error: 'กรุณาตอบคำถามที่จำเป็นให้ครบ',
          missing_question_ids: missingRequired.map((question) => question.id),
        });
      }

      const previousSubmission = db.prepare(`
        SELECT 1 FROM submissions s JOIN students st ON st.id = s.student_id
        WHERE st.student_code = ? AND s.question_set_id = ? LIMIT 1
      `).get(studentCode, setId);
      if (previousSubmission) return reply(409, { error: 'ท่านได้ส่งคำตอบแล้ว' });
      const durationSeconds = data.duration_seconds ?? null;
      if (durationSeconds !== null && (!Number.isSafeInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 86400)) {
        return reply(400, { error: 'duration_seconds must be an integer between 0 and 86400' });
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
        `).get(studentCode, fullName, student.program_name ?? student.program ?? null,
          student.faculty_name ?? student.faculty ?? null, student.campus_name ?? student.campus ?? null);
        const gradedAnswers = submittedAnswers.map(({ question, questionId, text }) => {
          const accepted = question.accepted_answers.map((answerText) => ({
            id: db.prepare('SELECT id FROM accepted_answers WHERE question_id = ? AND answer_text = ?').get(question.id, answerText)?.id,
            answer_text: answerText,
            keywords: parseKeywords(answerText),
          }));
          const normalizedText = normalizeAnswer(text);
          const match = accepted.find((row) =>
            row.keywords.length > 0 && row.keywords.every((keyword) => normalizedText.includes(keyword)),
          );
          return {
            questionId,
            questionText: question.text,
            referenceAnswer: accepted.map((row) => row.answer_text).join(' / '),
            text,
            isCorrect: Boolean(match),
            matchedAnswerId: match?.id ?? null,
          };
        });
        const score = gradedAnswers.filter((answer) => answer.isCorrect).length;
        const submission = db.prepare(`
          INSERT INTO submissions(question_set_id, student_id, score, total_questions, duration_seconds)
          VALUES (?, ?, ?, ?, ?) RETURNING id
        `).get(setId, studentRow.id, score, set.questions.length, durationSeconds);
        const insertAnswer = db.prepare(`
          INSERT INTO answers(submission_id, question_id, question_text, reference_answer, answer_text, is_correct, matched_answer_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        gradedAnswers.forEach((answer) => insertAnswer.run(
          submission.id, answer.questionId, answer.questionText, answer.referenceAnswer,
          answer.text, answer.isCorrect ? 1 : 0, answer.matchedAnswerId,
        ));
        db.exec('COMMIT');
        return reply(201, { submission_id: Number(submission.id), score, total_questions: set.questions.length });
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    if (req.method === 'PUT' && parts[0] === 'api' && parts[1] === 'students' && parts[3] === 'pin' && parts.length === 4) {
      const studentCode = decodeURIComponent(parts[2]);
      const data = await readBody(req);
      if (typeof data.pinned !== 'boolean') return reply(400, { error: 'pinned must be a boolean' });
      const student = db.prepare('SELECT id FROM students WHERE student_code = ?').get(studentCode);
      if (!student) return reply(404, { error: 'Student not found' });
      if (data.pinned) {
        db.prepare('INSERT OR IGNORE INTO pinned_students(student_id) VALUES (?)').run(student.id);
      } else {
        db.prepare('DELETE FROM pinned_students WHERE student_id = ?').run(student.id);
      }
      return reply(200, { student_code: studentCode, isPinned: data.pinned });
    }
    if (req.method === 'POST' && url.pathname === '/api/question-sets') {
      const data = await readBody(req);
      const title = String(data.title || '').trim();
      if (!title) return reply(400, { error: 'title is required' });
      const result = db.prepare(`
        INSERT INTO question_sets(title, description, status, start_at, end_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(title, data.description || '', data.status || 'closed', data.start_at ?? null, data.end_at ?? null);
      return reply(201, readSet(Number(result.lastInsertRowid)));
    }
    if (parts[0] === 'api' && parts[1] === 'question-sets' && parts[2]) {
      const id = Number(parts[2]);
      if (!Number.isSafeInteger(id) || id < 1) return reply(400, { error: 'Invalid question set id' });
      const current = readSet(id);
      if (!current) return reply(404, { error: 'Question set not found' });

      if (req.method === 'PUT' && parts[3] === 'questions' && parts.length === 4) {
        const data = await readBody(req);
        if (!Array.isArray(data.questions)) return reply(400, { error: 'questions must be an array' });
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
        return reply(200, readSet(id));
      }

      if (req.method === 'PUT' && parts.length === 3) {
        const data = await readBody(req);
        const allowed = ['title', 'description', 'status', 'start_at', 'end_at'];
        const fields = allowed.filter((field) => Object.hasOwn(data, field));
        if (fields.includes('title') && !String(data.title).trim()) return reply(400, { error: 'title is required' });
        if (fields.length) {
          const assignments = fields.map((field) => `${field} = ?`).join(', ');
          db.prepare(`UPDATE question_sets SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(...fields.map((field) => data[field]), id);
        }
        return reply(200, readSet(id));
      }

      if (req.method === 'DELETE' && parts.length === 3) {
        db.prepare('DELETE FROM question_sets WHERE id = ?').run(id);
        return reply(204);
      }
    }
    if (url.pathname.startsWith('/api/')) return reply(404, { error: 'Not found' });
    if (await serveFrontend(req, res, url.pathname)) return;
    return reply(404, { error: 'Not found' });
  } catch (error) {
    const duplicateSubmission = error.message.includes('idx_submissions_student_question_set')
      || error.message.includes('submissions.student_id, submissions.question_set_id');
    const status = duplicateSubmission ? 409 : (error.statusCode || 400);
    if (duplicateSubmission) return reply(status, { error: 'ท่านได้ส่งคำตอบแล้ว' });
    return reply(status, { error: error.message });
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
