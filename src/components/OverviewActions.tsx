"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const TASKS = [
  { href: "/explorer", title: "Find specific tests", body: "Filter by fuel, material, added gas, oxygen level or outcome." },
  { href: "/compare", title: "See what oxygen changes", body: "How tests ended, and when flames went out, across oxygen levels." },
  { href: "/sources", title: "Check the evidence trail", body: "DOIs, source files, units and every data-cleaning decision." },
];

export function OverviewActions() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)]">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/assistant?q=${encodeURIComponent(q.trim())}`); }}
        className="flex flex-col justify-between gap-3 rounded-xl border border-accent/25 bg-accent/[0.06] p-5">
        <label htmlFor="ov-ask" className="text-sm font-semibold text-ink-100">Ask the NASA evidence</label>
        <div className="flex gap-2">
          <input id="ov-ask" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Does CO₂ change when heptane flames go out?"
            className="h-10 min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 text-sm text-ink-100 outline-none transition-colors focus:border-accent/60" />
          <button disabled={!q.trim()} className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-ink-950 transition-opacity disabled:opacity-40">Ask</button>
        </div>
        <p className="text-xs text-ink-400">Answers cite the exact ISS tests they use.</p>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        {TASKS.map((t) => (
          <Link key={t.href} href={t.href} className="group rounded-xl border border-ink-800 bg-ink-900 p-5 transition-colors hover:border-ink-600 hover:bg-ink-850">
            <div className="text-sm font-semibold text-ink-100 group-hover:text-accent">{t.title}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{t.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
