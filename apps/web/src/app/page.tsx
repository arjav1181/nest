"use client";

import { useEffect, useState } from "react";

type Agent = { id: string; name: string; role: string; soul: string; status: string };
type Approval = { id: string; agent: string; action: string; risk: string; detail: string; status: string };
type FeedItem = { id?: string; type: string; data: any; ts?: string };

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [message, setMessage] = useState("");
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [runtime, setRuntime] = useState("demo");
  const [navUrl, setNavUrl] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1500);
    return () => clearInterval(t);
  }, []);

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

  const decide = async (id: string, decision: string) => {
    await fetch(`/api/approvals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    refresh();
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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <header className="mb-8 flex items-baseline justify-between">
        <h1 className="text-4xl font-bold tracking-tight">Nest</h1>
        <span className="text-sm text-zinc-500">runtime: {runtime}</span>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id)}
            className={`rounded-xl border p-4 text-left transition ${
              selected === a.id ? "border-emerald-500 bg-zinc-900" : "border-zinc-800 bg-zinc-900/50"
            }`}
          >
            <div className="text-lg font-semibold">{a.name}</div>
            <div className="text-xs text-zinc-500">{a.role} · {a.status}</div>
          </button>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">Computer</h2>
        <div className="mb-3 flex gap-2">
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
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-700"
          />
        </div>
        <img
          src={`/sandbox/api/screen?t=${tick}`}
          alt="Agent computer"
          className="w-full rounded-xl border border-zinc-800"
        />
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold">Approvals inbox</h2>
          <div className="space-y-3">
            {approvals.filter((a) => a.status === "pending").map((a) => (
              <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${a.risk === "high" ? "bg-red-900/60 text-red-300" : "bg-amber-900/60 text-amber-300"}`}>{a.risk}</span>
                  <span className="text-zinc-400">{a.agent} · {a.action}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-300">{a.detail}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => decide(a.id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-1 text-sm">Approve</button>
                  <button onClick={() => decide(a.id, "denied")} className="rounded-lg bg-zinc-800 px-3 py-1 text-sm">Deny</button>
                </div>
              </div>
            ))}
            {approvals.filter((a) => a.status === "pending").length === 0 && (
              <p className="text-sm text-zinc-600">Inbox zero. Colony is behaving.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-xl font-semibold">Activity</h2>
          <div className="mb-3 flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={`Ask ${agents.find((a) => a.id === selected)?.name ?? "an agent"} to do something...`}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-emerald-700"
            />
            <button onClick={send} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium">Run</button>
          </div>
          <div className="space-y-2 font-mono text-xs">
            {feed.map((f, i) => (
              <div key={i} className="rounded-lg border border-zinc-900 bg-zinc-900/40 p-2">
                <span className="text-emerald-500">{f.type}</span>{" "}
                <span className="text-zinc-400">{JSON.stringify(f.data).slice(0, 140)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
