"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

interface Ranked { id: string; testId: string; acronym: string; summary: string; matched: string[]; score: number; flags: number }
interface Band { band: string; tests: number; by_outcome: Record<string, number>; median_diameter_ratio_at_extinction: number | null; median_burning_rate_unit_unverified: number | null }
interface Result {
  question: string;
  interpretation: { text: string; assumed: boolean }[];
  matchCount: number;
  ranked: Ranked[];
  stats: { flex?: { tests: number; by_outcome: Record<string, number>; by_added_gas: Record<string, number>; o2_bands: Band[] }; bass_ii?: { tests: number; by_material: Record<string, number>; initial_o2_range_pct: number[] | null; initial_airflow_range_cm_s: number[] | null; note: string } };
  investigations: { id: string; title: string; doi: string }[];
  answer: string | null;
  provider: string | null;
  model: string | null;
  aiConfigured: boolean;
  warnings: string[];
  error?: string;
}

const EXAMPLES = [
  "How does oxygen concentration relate to flame extinction in the FLEX experiments?",
  "Which oxygen and airflow conditions were tested for PMMA rods in BASS-II?",
  "Did adding helium change how methanol droplets burned below 20% oxygen?",
  "What happened in heptane tests above 24% oxygen?",
];

/* ---------- answer rendering: headings, bullets, bold, citation chips ---------- */
const HEADINGS = ["What the NASA data shows", "Interpretation", "Limits of this evidence"];

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i} className="font-semibold text-ink-100">{p.slice(2, -2)}</strong>;
    if (p === "[unverified]") return <span key={i} className="mx-0.5 rounded border border-warn/40 bg-warn/10 px-1.5 py-px text-[11px] text-warn" title="The citation for this claim could not be verified against the evidence">unverified</span>;
    const m = p.match(/^\[([^\]]+)\]$/);
    if (m && m[1].split(/,\s*/).every((x) => /^PSI-\d+(:[\w-]+)?$/.test(x))) {
      return (
        <span key={i} className="mx-0.5 inline-flex flex-wrap gap-1 align-baseline">
          {m[1].split(/,\s*/).map((id) =>
            id.includes(":") ? (
              <Link key={id} href={`/explorer?test=${encodeURIComponent(id)}`} className="rounded border border-accent/30 bg-accent/10 px-1.5 py-px text-[11px] font-medium text-accent transition-colors hover:bg-accent/20">
                {id.split(":")[1]}
              </Link>
            ) : (
              <a key={id} href={`https://psi.nasa.gov/physci/repo/data/investigations/${id}`} target="_blank" rel="noreferrer" className="rounded border border-ink-600 px-1.5 py-px text-[11px] text-ink-200 hover:border-accent/50">{id}</a>
            ),
          )}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function Answer({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={out.length} className="my-2 list-disc space-y-1 pl-5">{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const l of lines) {
    const h = HEADINGS.find((x) => l.replace(/[#*:]/g, "").trim().toLowerCase() === x.toLowerCase());
    if (h) { flush(); out.push(<h3 key={out.length} className={`mt-5 mb-1.5 text-sm font-semibold first:mt-0 ${h === "Interpretation" ? "text-ink-300" : h === "Limits of this evidence" ? "text-warn" : "text-accent"}`}>{h}</h3>); continue; }
    if (/^[-•]\s+/.test(l)) { list.push(l.replace(/^[-•]\s+/, "")); continue; }
    flush();
    out.push(<p key={out.length} className="my-2">{inline(l)}</p>);
  }
  flush();
  return <div className="text-[15px] leading-relaxed text-ink-200">{out}</div>;
}

/* ---------- evidence views ---------- */
function FlexBands({ bands }: { bands: Band[] }) {
  return (
    <table className="w-full text-left text-xs tabular-nums">
      <thead className="text-ink-400"><tr><th className="py-1 font-medium">Initial O₂</th><th className="font-medium">Tests</th><th className="font-medium">Went out</th><th className="font-medium">Disrupted</th><th className="font-medium">Burned away</th><th className="font-medium">Droplet left at flame-out</th></tr></thead>
      <tbody className="text-ink-200">
        {bands.map((b) => (
          <tr key={b.band} className="border-t border-ink-800">
            <td className="py-1">{b.band.replace(" O2", "")}</td><td>{b.tests}</td>
            <td>{b.by_outcome.Extinction ?? 0}</td><td>{b.by_outcome.Disruption ?? 0}</td><td>{b.by_outcome.Completion ?? 0}</td>
            <td>{b.median_diameter_ratio_at_extinction !== null ? `${Math.round(b.median_diameter_ratio_at_extinction * 100)}% of diameter (median)` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Assistant() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const params = useSearchParams();
  const asked = useRef<string | null>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setQ(question); setBusy(true);
    try {
      const r = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question }) });
      setRes(await r.json());
    } catch {
      setRes({ error: "The assistant could not be reached. Check that the dev server is running." } as Result);
    } finally {
      setBusy(false);
    }
  }

  // questions arriving from the Overview ask box or the Ctrl+K search (?q=...) run straight away
  useEffect(() => {
    const incoming = params.get("q");
    if (incoming && asked.current !== incoming) { asked.current = incoming; ask(incoming); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="grid gap-8 px-5 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0">
        <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about the NASA tests, for example: how does helium affect methanol droplets?"
            className="h-12 min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-850 px-4 text-[15px] text-ink-100 outline-none transition-colors focus:border-accent/60" />
          <button disabled={busy || !q.trim()} className="h-12 rounded-lg bg-accent px-5 text-sm font-semibold text-ink-950 transition-opacity disabled:opacity-40">Ask</button>
        </form>
        {!res && !busy && (
          <div className="mt-5">
            <p className="text-sm text-ink-400">Try one of these:</p>
            <div className="mt-2 flex flex-col items-start gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => ask(e)} className="rounded-lg border border-ink-800 px-3.5 py-2 text-left text-sm text-ink-200 transition-colors hover:border-accent/40 hover:text-ink-100">{e}</button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {busy && (
            <motion.div key="busy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 flex items-center gap-3 text-sm text-ink-300">
              <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-accent" /></span>
              Searching 403 NASA test records and checking the evidence…
            </motion.div>
          )}
          {res && !busy && (
            <motion.article key={res.question} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="mt-6">
              {res.error ? <p className="text-sm text-warn">{res.error}</p> : (
                <>
                  <h2 className="text-lg font-semibold text-ink-100">{res.question}</h2>
                  {res.warnings.map((w) => <p key={w} className="mt-2 rounded-md border border-warn/25 bg-warn-dim/40 px-3 py-2 text-xs text-warn">{w}</p>)}
                  <div className="mt-4 rounded-xl border border-ink-800 bg-ink-900 p-6">
                    {res.answer ? (
                      <>
                        <Answer text={res.answer} />
                        <p className="mt-5 border-t border-ink-800 pt-3 text-xs text-ink-400">
                          AI-written explanation ({res.model}) grounded only in up to 30 matching records, spread across oxygen levels, and statistics over all {res.matchCount}. Citations were checked against that evidence. Click a test to see NASA&apos;s original record.
                        </p>
                      </>
                    ) : res.matchCount === 0 ? (
                      <p className="text-sm text-ink-300">No NASA tests in this dataset match that question. Astraxis currently covers FLEX (liquid fuel droplets) and BASS-II (solid materials).</p>
                    ) : (
                      <>
                        <p className="text-sm text-ink-300">
                          {res.aiConfigured ? "The AI explanation could not be generated, but here is the evidence." : "AI explanations are off: add Azure OpenAI, Anthropic or OpenAI settings to .env.local (see .env.example). The matching NASA evidence is below."}
                        </p>
                        {res.stats.flex && <div className="mt-4"><p className="mb-2 text-sm font-semibold text-ink-100">{res.stats.flex.tests} matching FLEX tests by oxygen level</p><FlexBands bands={res.stats.flex.o2_bands} /></div>}
                        {res.stats.bass_ii && <p className="mt-4 text-sm text-ink-300">{res.stats.bass_ii.tests} matching BASS-II tests. {res.stats.bass_ii.note}</p>}
                      </>
                    )}
                  </div>
                  {res.answer && res.stats.flex && (
                    <details className="mt-4 rounded-xl border border-ink-800 bg-ink-900 p-5 text-sm open:pb-5">
                      <summary className="cursor-pointer text-ink-200">Evidence table: {res.stats.flex.tests} FLEX tests by oxygen level</summary>
                      <div className="mt-3"><FlexBands bands={res.stats.flex.o2_bands} /></div>
                    </details>
                  )}
                </>
              )}
            </motion.article>
          )}
        </AnimatePresence>
      </div>

      {/* evidence column */}
      <aside className="min-w-0">
        {res && !res.error && !busy ? (
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="space-y-5">
            <section>
              <h3 className="text-xs font-semibold text-ink-300">How your question was read</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {res.interpretation.length ? res.interpretation.map((n) => (
                  <span key={n.text} className={`rounded-full border px-2.5 py-1 text-xs ${n.assumed ? "border-warn/30 text-warn" : "border-ink-700 text-ink-200"}`} title={n.assumed ? "Assumption: rephrase with a number to change it" : undefined}>{n.text}</span>
                )) : <span className="text-xs text-ink-400">No filters found, so all tests were considered.</span>}
              </div>
            </section>
            <section>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-semibold text-ink-300">Matching tests, ranked</h3>
                <span className="text-xs tabular-nums text-ink-400">{res.matchCount} found</span>
              </div>
              <p className="mt-1 text-xs text-ink-400">Ranked by how many conditions match and how complete the measurements are, spread across oxygen levels. Records with data notes rank lower.</p>
              <ol className="scroll-thin mt-3 max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
                {res.ranked.map((r, i) => (
                  <motion.li key={r.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.025 }}>
                    <Link href={`/explorer?test=${encodeURIComponent(r.id)}`} className="block rounded-lg border border-ink-800 px-3 py-2 transition-colors hover:border-accent/40 hover:bg-ink-900">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-sm text-ink-100">{r.testId}</span>
                        <span className="text-[11px] text-ink-400">{r.acronym}{r.flags ? `, ${r.flags} data note${r.flags > 1 ? "s" : ""}` : ""}</span>
                      </div>
                      {r.matched.length > 0 && <div className="mt-0.5 text-xs text-accent/90">Matched: {r.matched.join(", ")}</div>}
                    </Link>
                  </motion.li>
                ))}
              </ol>
              {res.matchCount > res.ranked.length && <p className="mt-2 text-xs text-ink-400">Showing the top {res.ranked.length}. Use the Explorer filters to see all.</p>}
            </section>
          </motion.div>
        ) : (
          <div className="rounded-xl border border-dashed border-ink-800 p-5 text-sm leading-relaxed text-ink-400">
            Answers use only NASA test records in Astraxis. Each one shows how your question was read, which tests matched and why, and links every cited test to its original record.
          </div>
        )}
      </aside>
    </div>
  );
}
