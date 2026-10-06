"use client";

import { useEffect, useState } from "react";

type Agent = { id: string; name: string; role: string; soul: string; status: string };
type Approval = { id: string; agent: string; action: string; risk: string; detail: string; status: string };
type FeedItem = { id?: string; type: string; data: any; ts?: string };

function ColonyTemplates({ refresh }: { refresh: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/colonies").then((r) => r.json()).then(setList).catch(() => {});
  }, []);
  const load = async (name: string) => {
    setBusy(name);
    await fetch(`/api/colonies/${encodeURIComponent(name)}/load`, { method: "POST" });
    setBusy(null);
    refresh();
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((c) => (
        <div key={c.name} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-5">
          <div className="text-base font-semibold">{c.name}</div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{c.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.agents.map((a: string) => (
              <span key={a} className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-[11px] text-zinc-400">
                {a}
              </span>
            ))}
          </div>
          <button
            onClick={() => load(c.name)}
            disabled={busy === c.name}
            className="mt-4 rounded-lg bg-emerald-500/90 px-4 py-1.5 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy === c.name ? "Loading…" : "Load colony"}
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [message, setMessage] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [runtime, setRuntime] = useState("demo");
  const [navUrl, setNavUrl] = useState("");
  const [tick, setTick] = useState(0);
  const [briefing, setBriefing] = useState<any[]>([]);
  const [colonyInput, setColonyInput] = useState("");
  const [colonyLog, setColonyLog] = useState<any[]>([]);
  const [colonyBusy, setColonyBusy] = useState(false);
  const [safety, setSafety] = useState("balanced");
  const [tab, setTab] = useState<"overview" | "colony" | "inbox" | "templates" | "computer" | "activity">("overview");
  const [activity, setActivity] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = () =>
      fetch("/api/briefing").then((r) => r.json()).then(setBriefing).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetch("/api/safety").then((r) => r.json()).then((d) => setSafety(d.profile)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/pause").then((r) => r.json()).then((d) => setPaused(d.paused)).catch(() => {});
  }, []);

  useEffect(() => {
    const load = () =>
      fetch("/api/activity").then((r) => r.json()).then(setActivity).catch(() => {});
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const togglePause = async () => {
    const next = !paused;
    setPaused(next);
    await fetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: next }),
    });
  };

  const refresh = async () => {
    const [a, ap, h] = await Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/approvals").then((r) => r.json()),
      fetch("/api/health").then((r) => r.json()),
    ]);
    setAgents(a);
    setApprovals(ap);
    setRuntime(h.runtime);
    if (!selected && a[0]) setSelected(a[0].id);
  };

  useEffect(() => {
    refresh();
  }, []);

  const setSafetyProfile = async (profile: string) => {
    setSafety(profile);
    await fetch("/api/safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    refresh();
  };

  const decide = async (id: string, decision: string) => {
    await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    refresh();
  };

  const sendColony = async () => {
    if (!colonyInput.trim() || colonyBusy) return;
    setColonyBusy(true);
    setColonyLog([{ type: "user", text: colonyInput }]);
    const msg = colonyInput;
    setColonyInput("");
    const res = await fetch("/api/colony/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.replace(/^data: /, "");
        try {
          const evt = JSON.parse(line);
          setColonyLog((l) => [...l, evt]);
        } catch {}
      }
    }
    setColonyBusy(false);
  };

  const send = async () => {
    if (!message.trim() || !selected) return;
    setFeed([]);
    const { run_id } = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: selected, message }),
    }).then((r) => r.json());
    setMessage("");
    const es = new EventSource(`/api/runs/${run_id}/events`);
    es.onmessage = (e) => {
      const item = JSON.parse(e.data);
      setFeed((f) => [...f, item]);
      if (item.type === "done" || item.type === "error") es.close();
    };
  };

  const pending = approvals.filter((a) => a.status === "pending");

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-100">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-800/70 bg-zinc-950/80 p-5">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-black text-black">N</div>
          <span className="text-lg font-bold tracking-tight">Nest</span>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          {([
            ["overview", "Overview"],
            ["colony", "Colony chat"],
            ["inbox", `Inbox${pending.length ? ` · ${pending.length}` : ""}`],
            ["templates", "Templates"],
            ["computer", "Computer"],
            ["activity", "Activity"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-2 text-left transition ${
                tab === key ? "bg-zinc-900 text-emerald-300" : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-600">Safety dial</div>
          <div className="flex gap-1.5">
            {["cautious", "balanced", "bold"].map((p) => (
              <button
                key={p}
                onClick={() => setSafetyProfile(p)}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  safety === p ? "border-emerald-500/70 bg-emerald-950/60 text-emerald-300" : "border-zinc-800 text-zinc-500"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="mt-4 text-[11px] text-zinc-600">
            runtime <span className="text-emerald-500">{runtime}</span>
          </div>
          <button
            onClick={togglePause}
            className={`mt-3 w-full rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              paused ? "border-red-500/70 bg-red-950/50 text-red-300" : "border-zinc-800 text-zinc-400 hover:border-red-900 hover:text-red-400"
            }`}
          >
            {paused ? "■ Colony paused — resume" : "■ Kill switch — pause colony"}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 lg:p-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            {tab === "overview" && "Overview"}
            {tab === "colony" && "Colony chat"}
            {tab === "inbox" && "Approvals inbox"}
            {tab === "templates" && "Colony templates"}
            {tab === "computer" && "Agent computer"}
            {tab === "activity" && "Live activity"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Your colony of agents, always on. {pending.length ? `${pending.length} decision(s) waiting on you.` : "Everything is on track."}
          </p>
        </header>

        {tab === "overview" && (
          <>
            <section className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[
                ["Agents online", String(agents.length), "across one colony"],
                ["Pending approvals", String(pending.length), "waiting on you"],
                ["Briefs logged", String(briefing.length), "routine runs"],
                ["Runtime", runtime, runtime === "demo" ? "no keys needed" : "Hermes Agent"],
              ].map(([k, v, s]) => (
                <div key={k} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-5">
                  <div className="text-xs uppercase tracking-widest text-zinc-500">{k}</div>
                  <div className="mt-2 text-3xl font-bold">{v}</div>
                  <div className="mt-1 text-xs text-zinc-600">{s}</div>
                </div>
              ))}
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">Morning briefing</h2>
              <div className="space-y-2.5">
                {briefing.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-600">
                    Routines fire on a schedule — the colony's overnight work lands here.
                  </p>
                )}
                {briefing.map((b, i) => (
                  <div key={i} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-4">
                    <div className="text-sm">
                      <span className="font-semibold text-emerald-400">{b.agent}</span>{" "}
                      <span className="text-zinc-500">· {b.task}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">{b.summary}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">The colony</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {agents.map((a) => (
                  <div
                    role="button"
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition ${
                      selected === a.id ? "border-emerald-500/70 bg-zinc-900" : "border-zinc-800/70 bg-zinc-900/60 hover:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-950 text-sm font-bold text-emerald-300">
                        {a.name[0]}
                      </div>
                      <div>
                        <div className="font-semibold">{a.name}</div>
                        <div className="text-[11px] uppercase tracking-wider text-zinc-600">{a.role}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">status: {a.status}</div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const next = prompt(`${a.name}'s soul (persona):`, a.soul);
                        if (next !== null) {
                          await fetch(`/api/agents/${a.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ soul: next }),
                          });
                          refresh();
                        }
                      }}
                      className="mt-2 text-[11px] text-zinc-600 underline underline-offset-2 hover:text-emerald-400"
                    >
                      edit soul
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 grid gap-8 lg:grid-cols-2">
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">Quick run</h2>
                <div className="flex gap-2">
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={`Ask ${agents.find((a) => a.id === selected)?.name ?? "an agent"} to do something...`}
                    className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-sm outline-none focus:border-emerald-700"
                  />
                  <button onClick={send} className="rounded-xl bg-emerald-500/90 px-5 py-2.5 text-sm font-semibold text-black">
                    Run
                  </button>
                </div>
                <div className="mt-3 space-y-2 font-mono text-xs">
                  {feed.map((f, i) => (
                    <div key={i} className="rounded-xl border border-zinc-900 bg-zinc-900/50 p-2.5">
                      <span className="text-emerald-500">{f.type}</span>{" "}
                      <span className="text-zinc-400">{JSON.stringify(f.data).slice(0, 140)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-500">Approvals</h2>
                <p className="text-sm text-zinc-500">
                  {pending.length} pending — open the Inbox tab to review and approve what the colony wants to
                  publish, pay, or send.
                </p>
              </div>
            </section>
          </>
        )}

        {tab === "colony" && (
          <section>
            <div className="mb-4 flex gap-2">
              <input
                value={colonyInput}
                onChange={(e) => setColonyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendColony()}
                placeholder="Ask the colony... e.g. 'write about AI agents for solopreneurs'"
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-sm outline-none focus:border-emerald-700"
              />
              <button
                onClick={sendColony}
                disabled={colonyBusy}
                className="rounded-xl bg-emerald-500/90 px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
              >
                {colonyBusy ? "Working…" : "Convene"}
              </button>
            </div>
            <div className="space-y-2.5">
              {colonyLog.map((m, i) => (
                <div key={i} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-4 text-sm">
                  {m.type === "user" && <span className="font-semibold text-emerald-400">You: {m.text}</span>}
                  {m.type === "agent_start" && (
                    <span className="text-xs uppercase tracking-widest text-zinc-500">{m.agent} is working…</span>
                  )}
                  {m.type === "agent_message" && (
                    <>
                      <span className="font-semibold text-emerald-400">{m.agent}</span>{" "}
                      <span className="text-zinc-300">{m.text}</span>
                    </>
                  )}
                  {m.type === "approval" && (
                    <span className="text-amber-300">
                      Publisher → staged for approval: {m.approval.action} ({m.approval.risk} risk, {m.approval.status})
                    </span>
                  )}
                  {m.type === "event" && (
                    <span className="font-mono text-xs text-zinc-600">
                      {m.agent} · {m.event?.type} {JSON.stringify(m.event?.data ?? "").slice(0, 80)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "inbox" && (
          <section className="space-y-3">
            {pending.map((a) => (
              <div key={a.id} className="rounded-2xl border border-zinc-800/70 bg-zinc-900/60 p-5">
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      a.risk === "high" ? "bg-red-950 text-red-300" : a.risk === "medium" ? "bg-amber-950 text-amber-300" : "bg-emerald-950 text-emerald-300"
                    }`}
                  >
                    {a.risk} risk
                  </span>
                  <span className="text-zinc-400">
                    {a.agent} · <span className="font-mono text-xs">{a.action}</span>
                  </span>
                </div>
                {a.action === "post_to_x" ? (
                  <div className="mt-3 rounded-xl border border-zinc-800 bg-black p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      🕊️ Your Brand <span className="font-normal text-zinc-500">@yourbrand · now</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">{a.detail}</p>
                    <div className="mt-3 flex gap-8 text-xs text-zinc-600">
                      <span>💬 Reply</span>
                      <span>🔁 Repost</span>
                      <span>❤️ Like</span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">{a.detail}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <button onClick={() => decide(a.id, "approved")} className="rounded-lg bg-emerald-500/90 px-4 py-1.5 text-sm font-semibold text-black">
                    Approve
                  </button>
                  <button onClick={() => decide(a.id, "denied")} className="rounded-lg bg-zinc-800 px-4 py-1.5 text-sm text-zinc-300">
                    Deny
                  </button>
                </div>
              </div>
            ))}
            {pending.length === 0 && (
              <p className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-600">
                Inbox zero. The colony is behaving.
              </p>
            )}
          </section>
        )}

        {tab === "templates" && <ColonyTemplates refresh={refresh} />}

        {tab === "activity" && (
          <section className="space-y-2 font-mono text-xs">
            {activity.length === 0 && (
              <p className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-600">
                Nothing yet — the colony will log every thought, tool call, and message here.
              </p>
            )}
            {[...activity].reverse().map((e, i) => (
              <div key={e.id ?? i} className="rounded-xl border border-zinc-900 bg-zinc-900/50 p-2.5">
                <span className="text-emerald-500">{e.agent}</span>{" "}
                <span className="text-zinc-500">· {e.type} ·</span>{" "}
                <span className="text-zinc-400">{JSON.stringify(e.data).slice(0, 140)}</span>
              </div>
            ))}
          </section>
        )}

        {tab === "computer" && (
          <section>
            <div className="mb-4 flex gap-2">
              <input
                value={navUrl}
                onChange={(e) => setNavUrl(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && navUrl.trim()) {
                    await fetch("/sandbox/api/navigate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: navUrl }),
                    });
                    setNavUrl("");
                  }
                }}
                placeholder="Navigate the agent's browser... (e.g. news.ycombinator.com)"
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-sm outline-none focus:border-emerald-700"
              />
            </div>
            <img
              src={`/sandbox/api/screen?t=${tick}`}
              alt="Agent computer"
              className="w-full rounded-2xl border border-zinc-800 shadow-2xl"
            />
          </section>
        )}
      </main>
    </div>
  );
}
