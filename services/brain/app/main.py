from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from . import store
from .runtime import AgentRun, Runtime
from .scheduler import briefing, scheduler

RUNS: dict[str, AgentRun] = {}
runtime = Runtime()


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.init_db()
    import asyncio as _a

    task = _a.create_task(scheduler(runtime))
    yield
    task.cancel()


app = FastAPI(title="Nest Brain", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.get("/api/health")
def health():
    return {"ok": True, "runtime": "hermes" if runtime.hermes else "demo"}


@app.get("/api/agents")
def agents():
    return store.list_agents()


@app.get("/api/approvals")
def approvals():
    return store.list_approvals()


@app.get("/api/briefing")
def get_briefing():
    return briefing()


class Decision(BaseModel):
    decision: str  # approved | denied


@app.post("/api/approvals/{approval_id}")
def decide(approval_id: str, body: Decision):
    if body.decision not in ("approved", "denied"):
        raise HTTPException(400, "decision must be approved or denied")
    row = store.decide_approval(approval_id, body.decision)
    if not row:
        raise HTTPException(404)
    return row


class ChatRequest(BaseModel):
    agent_id: str
    message: str


@app.post("/api/chat")
async def chat(body: ChatRequest):
    agent = store.get_agent(body.agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    run = AgentRun(id=uuid.uuid4().hex[:8], agent_id=agent["id"], message=body.message)
    RUNS[run.id] = run
    await runtime.run(run, agent)
    return {"run_id": run.id}


@app.get("/api/runs/{run_id}/events")
async def run_events(run_id: str):
    run = RUNS.get(run_id)
    if not run:
        raise HTTPException(404)

    async def gen():
        async for event in run.stream():
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
