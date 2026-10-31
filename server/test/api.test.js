import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let tempDir;
let databasePath;
let baseUrl;
let child;
let childOutput = '';

async function getFreePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => probe.listen(0, '127.0.0.1', resolve).once('error', reject));
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

function seedDatabase(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      program_name TEXT,
      faculty_name TEXT,
      campus_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE question_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','open','closed','scheduled')),
      start_at DATETIME,
      end_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES students(id) ON DELETE SET NULL
    );
    CREATE TABLE questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_set_id INTEGER NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('text','textarea','number','radio','checkbox','select','date','rating')),
      is_required INTEGER NOT NULL DEFAULT 1 CHECK(is_required IN (0,1)),
      position INTEGER NOT NULL DEFAULT 0 CHECK(position >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE accepted_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      answer_text TEXT NOT NULL
    );
    INSERT INTO question_sets(id,title,status) VALUES
      (1,'Open quiz','open'),
      (2,'Closed quiz','closed'),
      (3,'Not started','open'),
      (4,'Expired','open');
    UPDATE question_sets SET start_at = '2099-01-01T00:00' WHERE id = 3;
    UPDATE question_sets SET end_at = '2000-01-01T00:00' WHERE id = 4;
    INSERT INTO questions(id,question_set_id,text,type,is_required,position) VALUES
      (101,1,'Required prompt','textarea',1,0),
      (102,1,'Optional prompt','textarea',0,1),
      (201,2,'Closed prompt','textarea',1,0),
      (301,3,'Future prompt','textarea',1,0),
      (401,4,'Expired prompt','textarea',1,0);
    INSERT INTO accepted_answers(question_id,answer_text) VALUES (101,'expected answer'),(102,'optional key');
  `);
  db.close();
}

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API exited before starting: ${childOutput}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`API did not start: ${lastError?.message || childOutput}`);
}

async function postSubmission(data) {
  return fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

function payload(studentCode, answers, questionSetId = 1) {
  return {
    question_set_id: questionSetId,
    student: { student_code: studentCode, full_name: 'Test Student' },
    answers,
  };
}

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'quiz-game-api-test-'));
  databasePath = path.join(tempDir, 'test.sqlite3');
  seedDatabase(databasePath);
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [path.join(serverDir, 'server.js')], {
    cwd: serverDir,
    env: {
      ...process.env,
      API_PORT: String(port),
      QUESTION_DB_PATH: databasePath,
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8').on('data', (text) => { childOutput += text; });
  child.stderr.setEncoding('utf8').on('data', (text) => { childOutput += text; });
  await waitForServer();
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await once(child, 'exit');
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test('public question API only returns currently open questions and never answer keys', async () => {
  const response = await fetch(`${baseUrl}/api/public/question-sets`);
  assert.equal(response.status, 200);
  const sets = await response.json();
  assert.deepEqual(sets.map((set) => set.id), [1]);
  assert.equal(sets[0].questions.length, 2);
  assert.equal('accepted_answers' in sets[0].questions[0], false);
  assert.equal(JSON.stringify(sets).includes('expected answer'), false);
  assert.equal(JSON.stringify(sets).includes('optional key'), false);
});

test('CORS allows the configured frontend origin and omits access for other origins', async () => {
  const allowed = await fetch(`${baseUrl}/api/public/question-sets`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const denied = await fetch(`${baseUrl}/api/public/question-sets`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('open set accepts exact match and an omitted optional question; Exact Match score is unchanged', async () => {
  const response = await postSubmission(payload('student-open-1', [
    { question_id: 101, answer_text: 'expected answer' },
  ]));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { submission_id: 1, score: 1, total_questions: 2 });

  const duplicate = await postSubmission(payload('student-open-1', [
    { question_id: 101, answer_text: 'expected answer' },
  ]));
  assert.equal(duplicate.status, 409);
});

test('optional question may be included with an empty answer', async () => {
  const response = await postSubmission(payload('student-open-2', [
    { question_id: 101, answer_text: 'expected answer' },
    { question_id: 102, answer_text: '' },
  ]));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).score, 1);
});

test('closed, not-yet-open, and expired sets reject submissions', async () => {
  for (const [setId, questionId, studentCode] of [
    [2, 201, 'student-closed'],
    [3, 301, 'student-future'],
    [4, 401, 'student-expired'],
  ]) {
    const response = await postSubmission(payload(studentCode, [
      { question_id: questionId, answer_text: 'answer' },
    ], setId));
    assert.equal(response.status, 403);
  }
});

test('required answers, question ownership, duplicate IDs, and request types are validated', async () => {
  const missingRequired = await postSubmission(payload('student-missing', [
    { question_id: 102, answer_text: 'optional' },
  ]));
  assert.equal(missingRequired.status, 400);

  const foreignQuestion = await postSubmission(payload('student-foreign', [
    { question_id: 101, answer_text: 'expected answer' },
    { question_id: 201, answer_text: 'other quiz' },
  ]));
  assert.equal(foreignQuestion.status, 400);

  const duplicateQuestion = await postSubmission(payload('student-duplicate-question', [
    { question_id: 101, answer_text: 'expected answer' },
    { question_id: 101, answer_text: 'another answer' },
  ]));
  assert.equal(duplicateQuestion.status, 400);

  const wrongType = await postSubmission(payload('student-wrong-type', [
    { question_id: 101, answer_text: ['not', 'text'] },
  ]));
  assert.equal(wrongType.status, 400);
});

test('an incorrect answer remains incorrect under the existing Exact Match rule', async () => {
  const response = await postSubmission(payload('student-wrong-answer', [
    { question_id: 101, answer_text: 'different meaning' },
  ]));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).score, 0);
});

test('failure while inserting an answer rolls back student and submission writes', async () => {
  const db = new DatabaseSync(databasePath);
  db.exec(`CREATE TRIGGER fail_test_answer_insert BEFORE INSERT ON answers
    BEGIN SELECT RAISE(ABORT, 'forced test failure'); END;`);
  db.close();

  const response = await postSubmission(payload('student-rollback', [
    { question_id: 101, answer_text: 'expected answer' },
  ]));
  assert.equal(response.status, 400);

  const check = new DatabaseSync(databasePath);
  assert.equal(check.prepare('SELECT COUNT(*) AS count FROM students WHERE student_code = ?').get('student-rollback').count, 0);
  assert.equal(check.prepare('SELECT COUNT(*) AS count FROM submissions').get().count, 3);
  check.exec('DROP TRIGGER fail_test_answer_insert');
  check.close();
});
