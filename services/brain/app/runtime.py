from __future__ import annotations

import asyncio
import json
import os
import shutil
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncIterator, Literal

EventType = Literal["thought", "tool_call", "tool_result", "message", "error", "done"]


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AgentRun:
    id: str
    agent_id: str
    message: str
    events: list[dict] = field(default_factory=list)
    subscribers: list[asyncio.Queue] = field(default_factory=list)

    def emit(self, type: EventType, data: dict) -> dict:
        event = {"id": uuid.uuid4().hex[:8], "type": type, "data": data, "ts": now()}
        self.events.append(event)
        for q in self.subscribers:
            q.put_nowait(event)
        return event

    async def stream(self) -> AsyncIterator[dict]:
        q: asyncio.Queue = asyncio.Queue()
        for e in self.events:
            yield e
        self.subscribers.append(q)
        try:
            while True:
                event = await q.get()
                yield event
                if event["type"] == "done" or event["type"] == "error":
                    break
        finally:
            self.subscribers.remove(q)


class Runtime:
    """Agent loop backend. Hermes Agent when available, demo loop otherwise."""

    def __init__(self) -> None:
        self.hermes = shutil.which("hermes")

    async def run(self, run: AgentRun, agent: dict) -> None:
        if self.hermes:
            asyncio.create_task(self._run_hermes(run, agent))
        else:
            asyncio.create_task(self._run_demo(run, agent))

    async def _run_hermes(self, run: AgentRun, agent: dict) -> None:
        cmd = [self.hermes, "run", "--json", "--message", run.message]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={**os.environ},
            )
            assert proc.stdout is not None
            async for line in proc.stdout:
                try:
                    payload = json.loads(line)
                    run.emit(payload.get("type", "message"), payload)
                except json.JSONDecodeError:
                    run.emit("message", {"text": line.decode().rstrip()})
            code = await proc.wait()
            run.emit("done" if code == 0 else "error", {"exit_code": code})
        except FileNotFoundError:
            await self._run_demo(run, agent)

    async def _run_demo(self, run: AgentRun, agent: dict) -> None:
        await asyncio.sleep(0.3)
        run.emit("thought", {"text": f"{agent['name']} is thinking about: {run.message}"})
        await asyncio.sleep(0.7)
        run.emit("tool_call", {"name": "web_search", "args": {"q": run.message}})
        await asyncio.sleep(0.9)
        run.emit("tool_result", {"name": "web_search", "summary": f"Top results for '{run.message}' gathered."})
        await asyncio.sleep(0.5)
        run.emit("message", {"text": (
            f"Demo-mode {agent['name']} here. I researched '{run.message}' and drafted a plan. "
            "Install the Hermes Agent runtime and set a model key to go live."
        )})
        run.emit("done", {})
