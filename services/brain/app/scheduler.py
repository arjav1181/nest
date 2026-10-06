from __future__ import annotations

import asyncio
import uuid
from pathlib import Path

import yaml

from . import store
from .runtime import AgentRun, Runtime

COLONIES = Path(__file__).parent.parent.parent.parent / "colonies"
BRIEFING: list[dict] = []


def load_routines(colony: str = "content-business") -> list[dict]:
    if not COLONIES.exists():
        return []
    import yaml

    for f in COLONIES.glob("*.yaml"):
        data = yaml.safe_load(f.read_text())
        if data.get("name") == colony:
            return data.get("routines", [])
    return []


def briefing() -> list[dict]:
    return BRIEFING[-20:]


async def scheduler(runtime: Runtime, interval_seconds: int = 45) -> None:
    await asyncio.sleep(5)
    while True:
        from . import store

        if store.get_setting("paused", "false") == "true":
            await asyncio.sleep(interval_seconds)
            continue
        colony = store.get_setting("colony", "content-business")
        for routine in load_routines(colony):
            agent = next(
                (a for a in store.list_agents() if a["name"] == routine["agent"]),
                None,
            )
            if not agent:
                continue
            run = AgentRun(
                id=uuid.uuid4().hex[:8], agent_id=agent["id"], message=routine["task"], agent_name=agent["name"]
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
