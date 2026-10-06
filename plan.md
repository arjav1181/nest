# Nest — Project Plan

> **A colony of always-on AI agents that run your one-person content business.**
> The open-source answer to Grok Bot, OpenAI Dots, and Meta Muse — built for everyone, free forever.

*Name: **Nest** — a home for your colony of agents (editor, researcher, clipper, publisher, analyst) that live together and work. Trademark + domain check pending.*

## Vision

Meta Muse, OpenAI Dots, and xAI Grok Bot are closed walled gardens where one
vendor's model runs one agent in one app. We build the open equivalent: a
**consumer-grade, self-hosted (or local) colony of AI agents** that work
together 24/7 to run real businesses — starting with a one-person **content
business** (YouTube, X, newsletter, shorts) that researches, writes, clips,
publishes, and tracks revenue.

Free forever. MIT. Local-first. Pluggable models. Your keys, your data, your
agents.

## The killer demo (day one)

> "Wake up to a content business that worked overnight."
>
> The researcher agent finds trending topics → the writer drafts the newsletter
> → the clipper cuts 5 shorts → the publisher schedules everything → the
> analyst reports what worked — all with you approving the risky steps.

One command, Docker, a browser tab, and a "morning briefing" card: what the
colony did, what it needs your call on, and what it earned.

## Target user

- v0.1: developers/creators who can run one install command
- v1: non-technical creators (one-click desktop installer, templates, guided onboarding)

## Positioning vs. the three giants

| | Grok Bot | Dots | Muse | **Nest** |
|---|---|---|---|---|
| Models | Grok only | GPT only | Muse only | Any (BYO key / local / OpenRouter) |
| License | Closed | Closed | Closed | MIT |
| Data | Vendor cloud | Vendor cloud | Muse Secure VM | Your machine |
| Multi-agent | Shared VM | Teams of dots | Single agent | Colony with group chat |
| Business framing | General assistant | General assistant | Personal tasks | Business-in-a-box (content) |

## Core pillars

1. **Always-on colony** — agents named, persistent, with avatars/personas, running on schedules
2. **Their own computers** — per-agent Docker sandbox: browser, terminal, filesystem
3. **Real memory** — remembers your voice, past posts, analytics, mistakes (Hermes memory layer)
4. **Skills & routines** — teach once, saved as reusable automations
5. **Smart safety rail** — the thing that makes autonomous *business* agents trustworthy (below)
6. **Human control where it counts** — smart, not naggy

## The Smart Safety Rail (flagship subsystem)

Instead of "approve everything" (annoying) or "auto-allow under $X" (naive),
every agent action gets a risk score from a policy engine:

- **Reversibility** — draft saved? trivially reversible → auto-run
- **Blast radius** — posts to 500k followers? money moves? sends email? → escalate
- **Confidence & history** — action type the agent has done well 50 times vs. first attempt
- **Money/visibility gates** — configurable hard rules: *no payment or public post ships without a human tap*
- **Budget envelopes** — per-agent weekly spend cap, hard-stop at 0
- **Simulation first** — agent rehearses the action on a draft/staging copy, human can preview
- **Full audit log** — every action, reason, and tool call inspectable and replayable
- **Kill switch** — pause one agent or the whole colony instantly

UI: a single **Approvals inbox** with risk badges, preview of what will happen,
one-tap approve/edit/deny. Colony's risk posture is a dial: Cautious → Balanced → Bold.

## Product surface (web app)

- **Home / Briefing** — what the colony did overnight, approvals waiting, revenue snapshot
- **Colony view** — agent cards (avatar, status, current task, spend this week)
- **Chat / group chat** — talk to one agent or the whole colony; agents @mention each other
- **Approvals inbox** — the safety rail's queue
- **Activity feed** — live stream of tool calls, browser screenshots, results
- **Computer view** — watch the agent's browser/terminal live (noVNC / Playwright stream)
- **Skills & routines** — template gallery + saved routines with schedules
- **Business dashboard** — content pipeline, scheduled posts, analytics, revenue (starter integrations: X, YouTube, beehiiv/Substack, Stripe)

## Agent roles (content business starter colony)

| Agent | Job |
|---|---|
| Radar | Watch trends, competitors, & mentions; propose content ideas |
| Writer | Draft newsletters/posts in your voice (learns from edits) |
| Editor | Review, fact-check, style-pass drafts |
| Clipper | Turn long-form into shorts with captions |
| Publisher | Schedule & post across platforms (approval-gated) |
| Analyst | Weekly report: what worked, what to do next |
| Bookkeeper | Track costs & revenue, weekly P&L note |

Templates ship for other colonies later: dev shop, research desk, support desk.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Agent runtime (default) | Hermes Agent (MIT) | Memory, skills, cron, MCP, sandbox backends — no from-scratch loop |
| Control plane | Python + FastAPI | Same ecosystem as Hermes |
| Web UI | Next.js + Tailwind + shadcn/ui | Fast, beautiful, screenshot-ready |
| Storage | SQLite local → hosted-by-user Postgres optional | Zero-setup |
| Sandboxes | Docker per agent (browser via Playwright, noVNC) | The "own computer" pillar |
| Realtime | SSE/WebSocket event bus | Live activity feed, live browser |
| Models | Provider-agnostic (OpenRouter, OpenAI, Anthropic, Grok, Ollama) | Pluggable brains |
| Packaging | Docker Compose local; Tauri/Electron later for consumer | `nest up` |

## Repo layout

```
nest/
├── plan.md
├── compose.yaml
├── apps/web/              # Next.js app
├── services/brain/        # FastAPI control plane: colony, approvals, budgets, feed
├── services/sandbox/      # per-agent VM/browser launcher (Docker backend)
├── packages/protocol/     # event + agent protocol types shared everywhere
├── colonies/              # starter colony templates (content, dev, research)
└── docs/
```

## Roadmap

### v0.1 — One agent, one loop, one demo
- Install command, web app with chat, one Hermes-powered agent
- Activity feed (tool calls, results), local Docker sandbox, SOUL-style persona
- Demo: "Radar + Writer draft a newsletter from yesterday's X trends"

### v0.2 — Colony + memory + routines
- Multiple agents, group chat with handoffs
- Hermes memory: voice learning, past-content recall
- Cron routines + morning briefing card

### v0.3 — Safety rail + approvals inbox
- Risk-scored actions, approval inbox with previews, budget envelopes, audit log, kill switch

### v0.4 — The computer, live
- Per-agent browser sandbox, live view in UI, Publisher agent with real scheduling

### v1.0 — Business in a box
- Content colony template end-to-end (Radar→Writer→Editor→Clipper→Publisher→Analyst→Bookkeeper)
- Analytics + revenue dashboard, desktop installer, docs site, demo video, HN launch

## OSS / community strategy

- MIT, no telemetry by default, clear trademark hygiene, no affiliation with xAI/OpenAI/Meta
- README with 30-second GIF of morning briefing + live browser
- Discord, weekly public changelog, "colony recipes" cookbook, good first issues
- Upstream contributions back to Hermes Agent where shared improvements appear

## Key decisions

1. **Name:** **Nest** — confirm trademark and domain before public launch
2. **Business shape:** content business first (Radar→Publisher colony); other colony templates later
3. **Safety:** smart risk-scored rail, not approve-everything, not blind auto-allow
4. **OSS only** — free forever, self-hosted; no hosted tiers planned
5. **Consumer direction**: beautiful simple UI now, one-click installer by v1
6. **Runtime:** Hermes Agent as default brain; protocol layer so other runtimes plug in later

## Open questions

- Final name + domain + trademark search
- Hermes integration depth: subprocess daemon vs. library import
- Best OSS browser-streaming for "watch the agent": noVNC vs. Playwright screencast
- Which platforms get real publishing integrations first (X API costs money — maybe start with beehiiv/Substack/draft-export)
- Voice: text-first at v0.1, voice input/output later
