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


def list_agents() -> list[dict]:
    with connect() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM agents ORDER BY name")]


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
