from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

import yaml

from . import store
from .runtime import AgentRun, Runtime

COLONIES = Path(__file__).parent.parent.parent.parent / "colonies"
BRIEFING: list[dict] = []


def load_routines() -> list[dict]:
    path = COLONIES / "content.yaml"
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text())
    return data.get("routines", [])


def briefing() -> list[dict]:
    return BRIEFING[-20:]


async def scheduler(runtime: Runtime, interval_seconds: int = 45) -> None:
    await asyncio.sleep(5)
    while True:
        for routine in load_routines():
            agent = next(
                (a for a in store.list_agents() if a["name"] == routine["agent"]),
                None,
            )
            if not agent:
                continue
            run = AgentRun(
                id=uuid.uuid4().hex[:8], agent_id=agent["id"], message=routine["task"]
            )
            await runtime.run(run, agent)
            # demo loop emits events async; give it a moment then record the reply
            await asyncio.sleep(4)
            last = [e for e in run.events if e["type"] == "message"]
            BRIEFING.append(
                {
                    "agent": agent["name"],
                    "task": routine["task"],
                    "summary": last[-1]["data"]["text"] if last else "(no output)",
                    "ts": run.events[-1]["ts"] if run.events else None,
                }
            )
        await asyncio.sleep(interval_seconds)
