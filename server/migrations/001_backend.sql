CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, account TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS user_documents (
  user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, body TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL, PRIMARY KEY(user_id,kind)
);
CREATE TABLE IF NOT EXISTS coin_ledger (
  user_id TEXT NOT NULL REFERENCES users(id), entry_id TEXT NOT NULL, delta INTEGER NOT NULL,
  ref_key TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,entry_id), UNIQUE(user_id,ref_key)
);
CREATE TABLE IF NOT EXISTS task_submissions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS official_config (key TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, action TEXT NOT NULL, target TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), mime TEXT NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('active','finished')), body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journey_members (
  journey_id TEXT NOT NULL REFERENCES journeys(id), user_id TEXT NOT NULL REFERENCES users(id),
  joined_at TEXT NOT NULL, PRIMARY KEY(journey_id,user_id)
);
