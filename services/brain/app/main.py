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


class SoulUpdate(BaseModel):
    soul: str


@app.patch("/api/agents/{agent_id}")
def update_agent(agent_id: str, body: SoulUpdate):
    row = store.update_agent(agent_id, body.soul)
    if not row:
        raise HTTPException(404)
    return row


@app.get("/api/briefing")
def get_briefing():
    return briefing()


@app.get("/api/activity")
def get_activity(limit: int = 50):
    from .runtime import ACTIVITY

    return ACTIVITY[-limit:]


@app.get("/api/skills")
def get_skills():
    return store.list_skills()


class SkillIn(BaseModel):
    name: str
    agent: str
    steps: str


@app.post("/api/skills")
def create_skill(body: SkillIn):
    return store.add_skill(body.name, body.agent, body.steps)


@app.delete("/api/skills/{skill_id}")
def remove_skill(skill_id: str):
    store.delete_skill(skill_id)
    return {"ok": True}


@app.get("/api/rules")
def get_rules():
    return store.list_rules()


class RuleIn(BaseModel):
    action: str
    mode: str  # allow | require_approval | block


@app.post("/api/rules")
def create_rule(body: RuleIn):
    if body.mode not in ("allow", "require_approval", "block"):
        raise HTTPException(400, "mode must be allow | require_approval | block")
    return store.add_rule(body.action, body.mode)


@app.delete("/api/rules/{rule_id}")
def remove_rule(rule_id: str):
    store.delete_rule(rule_id)
    return {"ok": True}


@app.get("/api/pause")
def get_pause():
    return {"paused": store.get_setting("paused", "false") == "true"}


class PauseReq(BaseModel):
    paused: bool


@app.post("/api/pause")
def set_pause(body: PauseReq):
    store.set_setting("paused", "true" if body.paused else "false")
    return {"paused": body.paused}


@app.get("/api/colonies")
def list_colonies():
    from pathlib import Path

    colonies = Path(__file__).parent.parent.parent.parent / "colonies"
    out = []
    for f in sorted(colonies.glob("*.yaml")):
        import yaml

        data = yaml.safe_load(f.read_text())
        out.append(
            {
                "name": data.get("name", f.stem),
                "description": data.get("description", ""),
                "agents": [a["name"] for a in data.get("agents", [])],
            }
        )
    return out


@app.post("/api/colonies/{name}/load")
def load_colony(name: str):
    from pathlib import Path

    import yaml

    colonies = Path(__file__).parent.parent.parent.parent / "colonies"
    match = None
    for f in colonies.glob("*.yaml"):
        data = yaml.safe_load(f.read_text())
        if data.get("name") == name:
            match = data
            break
    if not match:
        raise HTTPException(404, "colony template not found")
    store.set_agents(match.get("agents", []))
    store.set_setting("colony", match.get("name", name))
    return {"loaded": name, "agents": len(match.get("agents", []))}


class SafetyProfile(BaseModel):
    profile: str  # cautious | balanced | bold


@app.get("/api/safety")
def get_safety():
    return {"profile": store.get_setting("safety", "balanced")}


@app.post("/api/safety")
def set_safety(body: SafetyProfile):
    if body.profile not in ("cautious", "balanced", "bold"):
        raise HTTPException(400, "profile must be cautious | balanced | bold")
    store.set_setting("safety", body.profile)
    return {"profile": body.profile}


class Decision(BaseModel):
    decision: str  # approved | denied


@app.post("/api/approvals/{approval_id}")
def decide(approval_id: str, body: Decision):
    if body.decision not in ("approved", "denied"):
        raise HTTPException(400, "decision must be approved or denied")
    row = store.decide_approval(approval_id, body.decision)
    if not row:
        raise HTTPException(404)
    from .runtime import ACTIVITY, now

    ACTIVITY.append(
        {
            "agent": row["agent"],
            "id": uuid.uuid4().hex[:8],
            "type": "message",
            "data": {"text": f"Owner {body.decision}: {row['action']} — {row['detail'][:80]}"},
            "ts": now(),
        }
    )
    return row


class ChatRequest(BaseModel):
    agent_id: str
    message: str


@app.post("/api/chat")
async def chat(body: ChatRequest):
    agent = store.get_agent(body.agent_id)
    if not agent:
        raise HTTPException(404, "agent not found")
    if store.get_setting("paused", "false") == "true":
        raise HTTPException(409, "colony is paused — resume via the kill switch")
    run = AgentRun(id=uuid.uuid4().hex[:8], agent_id=agent["id"], message=body.message, agent_name=agent["name"])
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


COLONY_PIPELINE = ["Radar", "Writer", "Editor", "Publisher"]

ROLE_BRIEFS = {
    "Radar": "scouts trends/competitors and frames the opportunity",
    "Writer": "drafts the actual deliverable in the owner's voice",
    "Editor": "flags risks, fact-checks, and tightens the draft",
    "Publisher": "packages it for scheduling and requests human approval",
    "Analyst": "predicts what the data will say and success metrics",
    "Bookkeeper": "estimates cost/effort and payback",
    "Clipper": "turns the draft into short-form clips",
}


class ColonyRequest(BaseModel):
    message: str


@app.post("/api/colony/chat")
async def colony_chat(body: ColonyRequest):
    async def gen():
        import asyncio

        agents = {a["name"]: a for a in store.list_agents()}
        thread: list[dict] = []
        for name in COLONY_PIPELINE:
            agent = agents.get(name)
            if not agent:
                continue
            run = AgentRun(
                id=uuid.uuid4().hex[:8],
                agent_id=agent["id"],
                message=f"[Colony thread] Owner said: {body.message}\n"
                + "\n".join(f"{t['agent']}: {t['text']}" for t in thread),
                agent_name=agent["name"],
            )
            await runtime.run(run, agent)
            yield f"data: {json.dumps({'type': 'agent_start', 'agent': name})}\n\n"
            while True:
                done = any(e["type"] in ("done", "error") for e in run.events)
                for e in run.events:
                    if e.get("_sent"):
                        continue
                    e["_sent"] = True
                    if e["type"] == "message":
                        yield f"data: {json.dumps({'type': 'agent_message', 'agent': name, 'text': e['data']['text']})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'event', 'agent': name, 'event': e})}\n\n"
                if done:
                    break
                await asyncio.sleep(0.3)
            last = [e for e in run.events if e["type"] == "message"]
            if last:
                thread.append({"agent": name, "text": last[-1]["data"]["text"]})
        # finishing the pipeline stages a publish for approval — unless the owner runs bold
        if thread:
            draft = next((t["text"] for t in reversed(thread) if t["agent"] in ("Writer", "Editor")), thread[-1]["text"])
            profile = store.get_setting("safety", "balanced")
            status = "approved" if profile == "bold" else "pending"
            rule = store.find_rule("post_to_x")
            risk = "low" if profile == "bold" else "high"
            if rule:
                status = {"allow": "approved", "require_approval": "pending", "block": "blocked"}[rule["mode"]]
                if rule["mode"] == "allow":
                    risk = "low"
            approval = store.add_approval(
                "Publisher",
                "post_to_x",
                risk,
                f"{draft[:240]}",
                status,
            )
            yield f"data: {json.dumps({'type': 'approval', 'approval': approval})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")
