import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const hashToken = (token) => createHash("sha256").update(token).digest("hex");
const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const derived = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  try {
    const [algorithm, salt, expectedHex] = stored.split(":"); if (algorithm !== "scrypt") return false;
    const actual = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }); const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export class SerenityDatabase {
  constructor(filename) {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL DEFAULT '',
        password_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL, expires_at TEXT NOT NULL, user_agent TEXT NOT NULL DEFAULT '', ip_hash TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_user_id ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expires_at ON auth_sessions(expires_at);
      CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, revision INTEGER NOT NULL DEFAULT 0,
        data_json TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `);
    this.statements = {
      insertUser: this.db.prepare("INSERT INTO users (id,email,display_name,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?)"),
      userByEmail: this.db.prepare("SELECT * FROM users WHERE email = ?"),
      userById: this.db.prepare("SELECT id,email,display_name,created_at FROM users WHERE id = ?"),
      insertData: this.db.prepare("INSERT INTO user_data (user_id,revision,data_json,updated_at) VALUES (?,0,?,?)"),
      getData: this.db.prepare("SELECT revision,data_json,updated_at FROM user_data WHERE user_id = ?"),
      updateData: this.db.prepare("UPDATE user_data SET revision=revision+1,data_json=?,updated_at=? WHERE user_id=? AND revision=?"),
      insertSession: this.db.prepare("INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at,user_agent,ip_hash) VALUES (?,?,?,?,?,?)"),
      authByToken: this.db.prepare("SELECT u.id,u.email,u.display_name,u.created_at,s.expires_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?"),
      deleteSession: this.db.prepare("DELETE FROM auth_sessions WHERE token_hash=?"),
      deleteExpired: this.db.prepare("DELETE FROM auth_sessions WHERE expires_at < ?")
    };
  }

  createUser({ email, password, displayName = "" }) {
    const now = new Date().toISOString(); const id = randomUUID(); const normalizedEmail = normalizeEmail(email);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.statements.insertUser.run(id, normalizedEmail, String(displayName).trim().slice(0, 40), hashPassword(password), now, now);
      this.statements.insertData.run(id, JSON.stringify(null), now); this.db.exec("COMMIT");
    } catch (error) { this.db.exec("ROLLBACK"); if (String(error.message).includes("UNIQUE")) throw new Error("EMAIL_EXISTS"); throw error; }
    return this.publicUser(this.statements.userById.get(id));
  }

  authenticate(email, password) {
    const row = this.statements.userByEmail.get(normalizeEmail(email)); if (!row || !verifyPassword(password, row.password_hash)) return null;
    return this.publicUser(row);
  }

  createSession(userId, { userAgent = "", ip = "", days = 30 } = {}) {
    const token = randomBytes(32).toString("base64url"); const now = new Date(); const expires = new Date(now.getTime() + days * 86400000);
    this.statements.insertSession.run(hashToken(token), userId, now.toISOString(), expires.toISOString(), String(userAgent).slice(0, 240), hashToken(ip).slice(0, 24));
    return { token, expiresAt: expires };
  }

  getUserBySession(token) {
    if (!token) return null; const row = this.statements.authByToken.get(hashToken(token)); if (!row) return null;
    if (new Date(row.expires_at) <= new Date()) { this.statements.deleteSession.run(hashToken(token)); return null; }
    return this.publicUser(row);
  }

  deleteSession(token) { if (token) this.statements.deleteSession.run(hashToken(token)); }
  cleanup() { this.statements.deleteExpired.run(new Date().toISOString()); }

  getData(userId) {
    const row = this.statements.getData.get(userId); if (!row) return { revision: 0, data: null, updatedAt: null };
    let data = null; try { data = JSON.parse(row.data_json); } catch { /* A corrupt copy should not take down auth. */ }
    return { revision: row.revision, data, updatedAt: row.updated_at };
  }

  saveData(userId, data, expectedRevision) {
    const now = new Date().toISOString(); const current = this.getData(userId); const revision = Number.isInteger(expectedRevision) ? expectedRevision : current.revision;
    const result = this.statements.updateData.run(JSON.stringify(data), now, userId, revision);
    if (result.changes !== 1) { const error = new Error("REVISION_CONFLICT"); error.current = this.getData(userId); throw error; }
    return this.getData(userId);
  }

  publicUser(row) { return row ? { id: row.id, email: row.email, displayName: row.display_name || "", createdAt: row.created_at } : null; }
  close() { this.db.close(); }
}

export const passwordPolicy = (password) => typeof password === "string" && password.length >= 10 && password.length <= 200;
export const emailPolicy = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)) && normalizeEmail(email).length <= 254;

