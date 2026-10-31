import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPasswordHash, ensureAuthSchema } from './auth.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(process.env.QUESTION_DB_PATH || path.join(directory, 'question.db'));
const [command, suppliedUsername] = process.argv.slice(2);

if (!existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

function promptHidden(label) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('Run this command in an interactive terminal so the password can be hidden.'));
      return;
    }
    process.stdout.write(label);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    let value = '';
    const finish = (error) => {
      input.off('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') return finish(new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else value += character;
      }
    };
    input.on('data', onData);
  });
}

async function main() {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  ensureAuthSchema(db);
  const username = String(suppliedUsername || '').trim();

  if (command === 'create') {
    if (username.length < 3 || username.length > 100) {
      throw new Error('Usage: node admin-cli.js create <username> (username must be 3–100 characters)');
    }
    if (db.prepare('SELECT 1 FROM admin_users WHERE username = ?').get(username)) {
      throw new Error('That admin username already exists.');
    }
    const password = await promptHidden('New admin password (minimum 12 characters): ');
    const confirmation = await promptHidden('Confirm password: ');
    if (password.length < 12) throw new Error('Password must be at least 12 characters.');
    if (password !== confirmation) throw new Error('Passwords do not match.');
    const { salt, hash, parameters } = await createPasswordHash(password);
    const now = Date.now();
    db.prepare(`
      INSERT INTO admin_users
        (username, password_hash, password_salt, scrypt_n, scrypt_r, scrypt_p, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hash, salt, parameters.N, parameters.r, parameters.p, now, now);
    console.log(`Admin account created: ${username}`);
  } else if (command === 'disable') {
    if (!username) throw new Error('Usage: node admin-cli.js disable <username>');
    const result = db.prepare(`
      UPDATE admin_users SET is_active = 0, updated_at = ? WHERE username = ? COLLATE NOCASE AND is_active = 1
    `).run(Date.now(), username);
    if (!result.changes) throw new Error('Active admin account not found.');
    console.log(`Admin account disabled and sessions revoked: ${username}`);
  } else {
    throw new Error('Usage: node admin-cli.js create <username> | disable <username>');
  }
  db.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
