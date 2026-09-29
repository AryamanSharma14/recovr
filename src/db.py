import sqlite3
import json
from src import config

def _conn():
    conn = sqlite3.connect(config.DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn

def init_db():
    with _conn() as conn:
        conn.executescript("""
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT UNIQUE NOT NULL,
  order_id TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  email TEXT, contact TEXT,
  error_source TEXT, error_step TEXT, error_reason TEXT, error_code TEXT,
  method TEXT, international INTEGER DEFAULT 0,
  card_network TEXT, card_type TEXT, card_issuer TEXT, card_iin TEXT,
  credential TEXT,
  chosen_rail TEXT,
  classification TEXT,
  classify_reason TEXT,
  confidence REAL,
  top_features TEXT,
  retry_at TEXT,
  attempts INTEGER DEFAULT 0,
  payment_link_id TEXT,
  payment_link_url TEXT,
  upi_intent_url TEXT,
  token_refreshed INTEGER DEFAULT 0,
  nudge_channel TEXT,
  nudge_message TEXT,
  nudge_reasoning TEXT,
  recovered INTEGER DEFAULT 0,
  recovered_at TEXT,
  merchant_cancelled INTEGER DEFAULT 0,
  raw_payload TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT, action TEXT, detail TEXT,
  ts TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS network_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credential TEXT NOT NULL,
  network TEXT,
  payment_id TEXT,
  ts TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_network_attempts_cred ON network_attempts(credential, ts);
CREATE TABLE IF NOT EXISTS active_downtime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT,
  issuer TEXT,
  started_at TEXT,
  status TEXT DEFAULT 'active',
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS downtime_queue (
  payment_id TEXT PRIMARY KEY,
  downtime_id INTEGER,
  queued_at TEXT DEFAULT (datetime('now'))
);
        """)
        # Databases created before the card/compliance columns existed need them backfilled;
        # CREATE TABLE IF NOT EXISTS silently leaves an older schema in place.
        have = {r["name"] for r in conn.execute("PRAGMA table_info(events)")}
        for col in ("method TEXT", "international INTEGER DEFAULT 0", "card_network TEXT",
                    "card_type TEXT", "card_issuer TEXT", "card_iin TEXT", "credential TEXT",
                    "chosen_rail TEXT", "claude_decision TEXT", "claude_reasoning TEXT",
                    "upi_intent_url TEXT", "token_refreshed INTEGER DEFAULT 0"):
            if col.split()[0] not in have:
                conn.execute(f"ALTER TABLE events ADD COLUMN {col}")


def record_network_attempt(credential: str, network: str, payment_id: str):
    with _conn() as conn:
        conn.execute(
            "INSERT INTO network_attempts (credential, network, payment_id) VALUES (?, ?, ?)",
            (credential, network, payment_id)
        )


def count_network_attempts(credential: str, hours: int) -> int:
    with _conn() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM network_attempts WHERE credential=? "
            "AND ts >= datetime('now', ?)",
            (credential, f"-{hours} hours")
        ).fetchone()[0]

def insert_event(data: dict):
    cols = ", ".join(data.keys())
    placeholders = ", ".join("?" * len(data))
    with _conn() as conn:
        conn.execute(
            f"INSERT OR IGNORE INTO events ({cols}) VALUES ({placeholders})",
            list(data.values())
        )

def update_event(payment_id: str, **fields):
    if not fields:
        return
    set_clause = ", ".join(f"{k}=?" for k in fields)
    with _conn() as conn:
        conn.execute(
            f"UPDATE events SET {set_clause} WHERE payment_id=?",
            [*fields.values(), payment_id]
        )

def get_event(payment_id: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM events WHERE payment_id=?", (payment_id,)).fetchone()
        return dict(row) if row else None

def all_events() -> list[dict]:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM events ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

def log_audit(payment_id: str, action: str, detail: str = ""):
    with _conn() as conn:
        conn.execute(
            "INSERT INTO audit_log (payment_id, action, detail) VALUES (?, ?, ?)",
            (payment_id, action, detail)
        )


def get_audit_log(limit: int = 100, offset: int = 0, action: str | None = None,
                  payment_id: str | None = None) -> list[dict]:
    where, params = [], []
    if action:
        where.append("action=?")
        params.append(action)
    if payment_id:
        where.append("payment_id=?")
        params.append(payment_id)
    sql = "SELECT * FROM audit_log"
    if where:
        sql += " WHERE " + " AND ".join(where)
    # ts is second-granularity; id tiebreak keeps pagination stable within a second
    sql += " ORDER BY ts DESC, id DESC"
    with _conn() as conn:
        if limit == 0:
            rows = conn.execute(sql, params).fetchall()
        else:
            rows = conn.execute(sql + " LIMIT ? OFFSET ?", params + [limit, offset]).fetchall()
        return [dict(r) for r in rows]


def reset_db():
    """Clear all demo data, keep schema. Used by POST /simulate/reset."""
    with _conn() as conn:
        for table in ("events", "audit_log", "network_attempts", "active_downtime", "downtime_queue"):
            conn.execute(f"DELETE FROM {table}")


def active_downtime_for(method: str, issuer: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM active_downtime WHERE status='active' AND method=? AND (issuer=? OR issuer IS NULL) LIMIT 1",
            (method, issuer)
        ).fetchone()
        return dict(row) if row else None


def insert_downtime(method: str, issuer: str, started_at: str) -> int:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO active_downtime (method, issuer, started_at) VALUES (?, ?, ?)",
            (method, issuer, started_at)
        )
        return cur.lastrowid


def resolve_downtime(method: str, issuer: str, resolved_at: str):
    with _conn() as conn:
        conn.execute(
            "UPDATE active_downtime SET status='resolved', resolved_at=? "
            "WHERE status='active' AND method=? AND issuer=?",
            (resolved_at, method, issuer)
        )


def queue_for_downtime(payment_id: str, downtime_id: int):
    with _conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO downtime_queue (payment_id, downtime_id) VALUES (?, ?)",
            (payment_id, downtime_id)
        )


def drain_downtime_queue(method: str, issuer: str) -> list[str]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT dq.payment_id FROM downtime_queue dq "
            "JOIN active_downtime ad ON dq.downtime_id=ad.id "
            "WHERE ad.method=? AND ad.issuer=?",
            (method, issuer)
        ).fetchall()
        pids = [r[0] for r in rows]
        if pids:
            conn.execute(
                f"DELETE FROM downtime_queue WHERE payment_id IN ({','.join('?'*len(pids))})",
                pids
            )
        return pids


def all_active_downtimes() -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM active_downtime WHERE status='active' ORDER BY started_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def all_downtime_queued() -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT dq.payment_id, dq.queued_at, ad.method, ad.issuer "
            "FROM downtime_queue dq JOIN active_downtime ad ON dq.downtime_id=ad.id"
        ).fetchall()
        return [dict(r) for r in rows]


def issuer_failure_count(issuer: str, method: str, window_minutes: int = 15) -> int:
    """Count of failures for this issuer+method in the last window_minutes.
    All events in our DB are failures (payment.failed only), so this is a volume proxy."""
    with _conn() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM events WHERE card_issuer=? AND method=? "
            "AND created_at >= datetime('now', ?)",
            (issuer, method, f"-{window_minutes} minutes")
        ).fetchone()[0]


def get_decline_history(payment_id: str) -> list[dict]:
    """All events sharing the same order_id, ordered by created_at asc."""
    with _conn() as conn:
        row = conn.execute("SELECT order_id FROM events WHERE payment_id=?", (payment_id,)).fetchone()
        if not row or not row[0]:
            return []
        rows = conn.execute(
            "SELECT error_reason, created_at FROM events WHERE order_id=? ORDER BY created_at ASC",
            (row[0],)
        ).fetchall()
        return [dict(r) for r in rows]


def last_attempt_ts(credential: str) -> str | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT ts FROM network_attempts WHERE credential=? ORDER BY ts DESC LIMIT 1",
            (credential,)
        ).fetchone()
        return row[0] if row else None
