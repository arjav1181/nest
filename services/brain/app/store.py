from __future__ import annotations

import json
import sqlite3
import uuid
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "nest.db"

SEED_AGENTS = [
    ("Radar", "Watches trends and competitors; proposes content ideas.", "radar"),
    ("Writer", "Drafts newsletters and posts in your voice.", "writer"),
    ("Editor", "Fact-checks and style-passes drafts.", "editor"),
    ("Clipper", "Turns long-form into captioned shorts.", "clipper"),
    ("Publisher", "Schedules and posts across platforms.", "publisher"),
    ("Analyst", "Reports what worked and what to do next.", "analyst"),
    ("Bookkeeper", "Tracks costs and revenue.", "bookkeeper"),
]


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY, name TEXT, role TEXT, soul TEXT, status TEXT DEFAULT 'idle'
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS approvals (
                id TEXT PRIMARY KEY, agent TEXT, action TEXT, risk TEXT, detail TEXT, status TEXT DEFAULT 'pending'
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY, value TEXT
            )"""
        )
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES ('safety', 'balanced')"
        )
        count = conn.execute("SELECT COUNT(*) c FROM agents").fetchone()["c"]
        if count == 0:
            for name, soul, role in SEED_AGENTS:
                conn.execute(
                    "INSERT INTO agents (id, name, role, soul) VALUES (?,?,?,?)",
                    (uuid.uuid4().hex[:8], name, role, soul),
                )
            conn.execute(
                "INSERT INTO approvals (id, agent, action, risk, detail) VALUES (?,?,?,?,?)",
                (uuid.uuid4().hex[:8], "Publisher", "post_to_x", "high", "Publish '5 trends shaping AI agents this week' to @yourhandle (draft attached)"),
            )
            conn.execute(
                "INSERT INTO approvals (id, agent, action, risk, detail) VALUES (?,?,?,?,?)",
                (uuid.uuid4().hex[:8], "Bookkeeper", "pay_invoice", "medium", "Pay $29/mo OpenRouter invoice (auto-renewal)"),
            )


def get_setting(key: str, default: str = "") -> str:
    with connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )


def add_approval(agent: str, action: str, risk: str, detail: str, status: str = "pending") -> dict:
    appr = (uuid.uuid4().hex[:8], agent, action, risk, detail, status)
    with connect() as conn:
        conn.execute(
            "INSERT INTO approvals (id, agent, action, risk, detail, status) VALUES (?,?,?,?,?,?)",
            appr,
        )
        row = conn.execute("SELECT * FROM approvals WHERE id=?", (appr[0],)).fetchone()
        return dict(row)


def set_agents(agents: list[dict]) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM agents")
        for a in agents:
            conn.execute(
                "INSERT INTO agents (id, name, role, soul) VALUES (?,?,?,?)",
                (uuid.uuid4().hex[:8], a["name"], a.get("role", "agent"), a.get("soul", "")),
            )


def list_agents() -> list[dict]:
    with connect() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM agents ORDER BY name")]


def update_agent(agent_id: str, soul: str) -> dict | None:
    with connect() as conn:
        conn.execute("UPDATE agents SET soul=? WHERE id=?", (soul, agent_id))
        row = conn.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
        return dict(row) if row else None


def set_agent_status(agent_id: str, status: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE agents SET status=? WHERE id=?", (status, agent_id))


def get_agent(agent_id: str) -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM agents WHERE id=?", (agent_id,)).fetchone()
        return dict(row) if row else None


def list_approvals() -> list[dict]:
    with connect() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM approvals ORDER BY rowid DESC")]


def decide_approval(approval_id: str, decision: str) -> dict | None:
    with connect() as conn:
        conn.execute("UPDATE approvals SET status=? WHERE id=?", (decision, approval_id))
        row = conn.execute("SELECT * FROM approvals WHERE id=?", (approval_id,)).fetchone()
        return dict(row) if row else None
