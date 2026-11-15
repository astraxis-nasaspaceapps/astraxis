"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { CriterionKey, RankedInvestigation } from "@/lib/catalog";
import { Badge, Card } from "@/components/ui";

type Crit = { key: CriterionKey; short: string; label: string };

function Mark({ v }: { v: boolean | null }) {
  if (v === true) return <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent"><span aria-hidden>●</span>Yes</span>;
  if (v === false) return <span className="text-[13px] text-ink-400">No</span>;
  return <span className="text-[13px] text-ink-500">Not stated</span>;
}

export function InvestigationRanking({ rows, criteria, retrieved }: { rows: RankedInvestigation[]; criteria: Crit[]; retrieved: string }) {
  const [flightOnly, setFlightOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const shown = rows.filter((r) => !flightOnly || r.criteria.flight.v === true);
  const top = rows.slice(0, 3);

  return (
    <div className="space-y-6 px-5 py-6 md:px-8">
      <div className="grid gap-4 md:grid-cols-3">
        {top.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span>Rank {r.rank}</span><span className="tabular-nums">{r.score} of 5 criteria</span>
            </div>
            <div className="mt-1 text-lg font-semibold text-ink-100">{r.acronym || r.id}</div>
            <div className="text-xs text-ink-400">{r.id}</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              {r.insideTarget ? `Habitat-level oxygen and low pressure: ${r.criteria.o2.ev}` : r.criteria.materials.v ? `Spacecraft materials: ${r.criteria.materials.ev}` : r.criteria.safety.ev}
            </p>
            <div className="mt-3">{r.inAstraxis ? <Badge tone="accent">{r.dataLabel}</Badge> : <Badge>Catalog description only</Badge>}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4 text-sm leading-relaxed text-ink-300">
        <span className="font-medium text-ink-100">How the score works.</span> One point for each criterion NASA&apos;s catalog entry states: {criteria.map((c) => c.label.toLowerCase()).join("; ")}. Ties go first to investigations that state both habitat oxygen and low pressure, then to flight data. &ldquo;Not stated&rdquo; scores zero, so investigations with short catalog entries may rank lower than their science deserves. This ranks relevance to habitat fire safety, not scientific quality.
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-300">
          <input type="checkbox" checked={flightOnly} onChange={(e) => setFlightOnly(e.target.checked)} className="accent-sky-400" />
          Flight experiments only
        </label>
        <span className="text-xs text-ink-400 tabular-nums">{shown.length} of {rows.length} investigations</span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-ink-800 text-xs text-ink-400">
            <tr>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Investigation</th>
              {criteria.map((c) => <th key={c.key} className="px-3 py-2 font-medium" title={c.label}>{c.short}</th>)}
              <th className="px-3 py-2 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="text-ink-200">
            {shown.map((r) => {
              const isOpen = open === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className={`cursor-pointer border-b border-ink-850 transition-colors hover:bg-ink-900 ${isOpen ? "bg-ink-900" : ""}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                    <td className="px-3 py-2 tabular-nums text-ink-300">{r.rank}</td>
                    <td className="px-3 py-2">
                      <button type="button" aria-expanded={isOpen} className="text-left" onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : r.id); }}>
                        <span className="font-medium text-ink-100">{r.acronym || "Ground study"}</span> <span className="text-xs text-ink-400">{r.id}</span>
                        <span className="block max-w-[340px] truncate text-xs text-ink-400">{r.title}</span>
                      </button>
                      {r.inAstraxis && <span className="mt-1 block"><Badge tone="accent">{r.dataLabel}</Badge></span>}
                    </td>
                    {criteria.map((c) => <td key={c.key} className="px-3 py-2"><Mark v={r.criteria[c.key].v} /></td>)}
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-ink-100">{r.score}/5</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-ink-800 bg-ink-900/60">
                      <td />
                      <td colSpan={criteria.length + 2} className="px-3 pb-4 pt-1">
                        <dl className="grid gap-x-6 gap-y-2 text-xs md:grid-cols-[180px_1fr]">
                          {criteria.map((c) => (
                            <div key={c.key} className="contents">
                              <dt className="text-ink-400">{c.short}: <Mark v={r.criteria[c.key].v} /></dt>
                              <dd className="text-ink-300">{r.criteria[c.key].ev}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs">
                          <a href={r.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">Open NASA&apos;s PSI page for {r.id}</a>
                          {r.id === "PSI-69" && <Link href="/habitat" className="text-accent hover:underline">See its tests nearest to habitat air</Link>}
                          {r.inAstraxis && r.dataHref && <Link href={r.dataHref} className="text-accent hover:underline">Browse its data in Astraxis</Link>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-ink-100">What this ranking can&apos;t tell you</h2>
        <ul className="mt-2 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-300">
          <li>Marks come from NASA&apos;s catalog descriptions (retrieved {retrieved}), not from each investigation&apos;s full data. FLEX (PSI-69) and BASS-II (PSI-25) have full test tables in Astraxis, and SAFFIRE I–III (PSI-98, 99, 100) have their test tables on the Spacecraft materials page; FLEX&apos;s oxygen mark also uses its table.</li>
          <li>&ldquo;Not stated&rdquo; means the catalog entry doesn&apos;t say, not that the investigation didn&apos;t test it.</li>
          <li>All flight investigations ran in microgravity. None of them can predict fire behaviour in lunar or Martian gravity.</li>
        </ul>
      </Card>
    </div>
  );
}
