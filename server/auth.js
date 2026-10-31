import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export const SCRYPT_OPTIONS = Object.freeze({ N: 32768, r: 8, p: 1, keyLength: 64, maxmem: 64 * 1024 * 1024 });

export function ensureAuthSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(username)) BETWEEN 3 AND 100),
      password_hash BLOB NOT NULL CHECK(length(password_hash) = 64),
      password_salt BLOB NOT NULL CHECK(length(password_salt) = 16),
      scrypt_n INTEGER NOT NULL CHECK(scrypt_n >= 16384 AND (scrypt_n & (scrypt_n - 1)) = 0),
      scrypt_r INTEGER NOT NULL CHECK(scrypt_r BETWEEN 1 AND 32),
      scrypt_p INTEGER NOT NULL CHECK(scrypt_p BETWEEN 1 AND 16),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      id INTEGER PRIMARY KEY,
      admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
      token_hash BLOB NOT NULL UNIQUE CHECK(length(token_hash) = 32),
      csrf_token_hash BLOB NOT NULL CHECK(length(csrf_token_hash) = 32),
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      absolute_expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      user_agent TEXT,
      CHECK(expires_at > created_at),
      CHECK(absolute_expires_at >= expires_at)
    );
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_expiry
      ON admin_sessions(admin_user_id, expires_at);
    CREATE INDEX IF NOT EXISTS idx_admin_sessions_active_expiry
      ON admin_sessions(expires_at) WHERE revoked_at IS NULL;

    CREATE TABLE IF NOT EXISTS admin_session_csrf_tokens (
      session_id INTEGER NOT NULL REFERENCES admin_sessions(id) ON DELETE CASCADE,
      token_hash BLOB NOT NULL CHECK(length(token_hash) = 32),
      created_at INTEGER NOT NULL,
      PRIMARY KEY(session_id, token_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_admin_csrf_session_created
      ON admin_session_csrf_tokens(session_id, created_at DESC);
    CREATE TRIGGER IF NOT EXISTS admin_session_revoke_csrf
    AFTER UPDATE OF revoked_at ON admin_sessions
    WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
    BEGIN
      DELETE FROM admin_session_csrf_tokens WHERE session_id = NEW.id;
    END;

    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      id INTEGER PRIMARY KEY,
      account_key_hash BLOB NOT NULL CHECK(length(account_key_hash) = 32),
      ip_key_hash BLOB NOT NULL CHECK(length(ip_key_hash) = 32),
      attempted_at INTEGER NOT NULL,
      succeeded INTEGER NOT NULL CHECK(succeeded IN (0, 1))
    );
    CREATE INDEX IF NOT EXISTS idx_login_account_time
      ON admin_login_attempts(account_key_hash, attempted_at);
    CREATE INDEX IF NOT EXISTS idx_login_ip_time
      ON admin_login_attempts(ip_key_hash, attempted_at);

    CREATE TRIGGER IF NOT EXISTS admin_deactivation_revokes_sessions
    AFTER UPDATE OF is_active ON admin_users
    WHEN OLD.is_active = 1 AND NEW.is_active = 0
    BEGIN
      UPDATE admin_sessions SET revoked_at = NEW.updated_at
      WHERE admin_user_id = NEW.id AND revoked_at IS NULL;
      DELETE FROM admin_session_csrf_tokens
      WHERE session_id IN (SELECT id FROM admin_sessions WHERE admin_user_id = NEW.id);
    END;
  `);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest();
}

export function randomToken() {
  return randomBytes(32).toString('base64url');
}

export async function createPasswordHash(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, SCRYPT_OPTIONS.keyLength, {
    N: SCRYPT_OPTIONS.N,
    r: SCRYPT_OPTIONS.r,
    p: SCRYPT_OPTIONS.p,
    maxmem: SCRYPT_OPTIONS.maxmem,
  });
  return { salt, hash: Buffer.from(hash), parameters: SCRYPT_OPTIONS };
}

export async function verifyPassword(password, salt, expectedHash, parameters) {
  const hash = await scryptAsync(password, salt, parameters.keyLength, {
    N: parameters.N,
    r: parameters.r,
    p: parameters.p,
    maxmem: 64 * 1024 * 1024,
  });
  const actual = Buffer.from(hash);
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
