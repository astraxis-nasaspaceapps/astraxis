"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FlexPoint } from "@/lib/data";
import { OUTCOME, OUTCOME_ORDER, type OutcomeKey } from "@/lib/palette";
import { ChartCard, DataTable, Legend } from "@/components/charts/core";
import { Card } from "@/components/ui";

const PSI_PER_ATM = 14.696;
const TARGET_PSI = 10.2;
const TARGET_ATM = TARGET_PSI / PSI_PER_ATM; // ≈ 0.694 atm
const TARGET_O2 = 30;

type Col = "low" | "one" | "high";
const COLS: { key: Col; label: string; sub: string }[] = [
  { key: "low", label: "≈0.7 atm", sub: "10.3–10.5 psi" },
  { key: "one", label: "≈1 atm", sub: "sea level" },
  { key: "high", label: "2–3.1 atm", sub: "high pressure" },
];
const colOf = (p: number | null): Col | null => (p === null ? null : p < 0.8 ? "low" : p < 1.5 ? "one" : "high");

type Counts = Record<OutcomeKey, number>;
const empty = (): Counts => ({ Extinction: 0, Disruption: 0, Completion: 0 });
const tally = (pts: FlexPoint[]) => pts.reduce((c, p) => (c[p.end]++, c), empty());
const psi = (atm: number) => (atm * PSI_PER_ATM).toFixed(1);

function Bar({ counts, total }: { counts: Counts; total: number }) {
  return (
    <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-sm bg-ink-800">
      {OUTCOME_ORDER.map((k) =>
        counts[k] ? <div key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: OUTCOME[k].color }} /> : null,
      )}
    </div>
  );
}

function OutcomeLine({ counts, total }: { counts: Counts; total: number }) {
  return (
    <span className="tabular-nums">
      {OUTCOME_ORDER.map((k, i) => (
        <span key={k}>
          {i > 0 && ", "}
          {counts[k]} {OUTCOME[k].label.toLowerCase()}
        </span>
      ))}
      <span className="text-ink-400"> (of {total})</span>
    </span>
  );
}

export function HabitatView({ flex, bassTests, bassO2: [bassLo, bassHi] }: { flex: FlexPoint[]; bassTests: number; bassO2: [number, number] }) {
  const near = useMemo(() => flex.filter((p) => p.o2 >= TARGET_O2 && colOf(p.pAtm) === "low"), [flex]);
  const sameO2Sea = useMemo(() => flex.filter((p) => p.o2 >= TARGET_O2 && colOf(p.pAtm) === "one"), [flex]);
  const lowPLowO2 = useMemo(() => flex.filter((p) => p.o2 < 20 && colOf(p.pAtm) === "low"), [flex]);
  const nearC = tally(near), seaC = tally(sameO2Sea), lowC = tally(lowPLowO2);
  const pMin = Math.min(...near.map((p) => p.pAtm as number)), pMax = Math.max(...near.map((p) => p.pAtm as number));

  const o2Levels = useMemo(() => [...new Set(flex.map((p) => p.o2))].sort((a, b) => b - a), [flex]);
  const grid = useMemo(() => {
    const m = new Map<string, FlexPoint[]>();
    for (const p of flex) {
      const c = colOf(p.pAtm);
      if (!c) continue;
      const k = `${p.o2}|${c}`;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return m;
  }, [flex]);
  const [hover, setHover] = useState<string | null>(null);
  const hovered = hover ? grid.get(hover) : undefined;
  const [hO2, hCol] = hover ? hover.split("|") : [];

  const tableRows = o2Levels.flatMap((o2) =>
    COLS.flatMap((c) => {
      const pts = grid.get(`${o2}|${c.key}`);
      if (!pts) return [];
      const t = tally(pts);
      return [[`${o2}%`, c.label, pts.length, t.Extinction, t.Disruption, t.Completion]];
    }),
  );

  return (
    <div className="space-y-6 px-5 py-6 md:px-8">
      <Card className="p-5">
        <div className="text-sm text-accent">The target, from the challenge brief</div>
        <p className="mt-1 max-w-3xl text-[15px] leading-relaxed text-ink-200">
          Moon base and rover atmospheres are expected to run at <b className="text-ink-100">30% oxygen or more</b> at{" "}
          <b className="text-ink-100">10.2 psi or less</b> (about {TARGET_ATM.toFixed(2)} atm). Richer oxygen helps crews at low pressure, but it also changes how fires behave.
          This page shows which NASA tests come closest to that air, and what happened in them.
        </p>
      </Card>

      <section>
        <h2 className="text-lg font-semibold text-ink-100">The nearest tested conditions</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-300">
          {near.length} FLEX droplet tests ran at {TARGET_O2}% oxygen or more and {pMin.toFixed(2)}–{pMax.toFixed(2)} atm ({psi(pMin)}–{psi(pMax)} psi), just above the 10.2 psi target. No NASA test in PSI-69 or PSI-25 sits inside the target exactly.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-ink-400">Nearest to habitat air: ≥30% O₂, ≈0.7 atm</div>
            <div className="mt-1 text-3xl font-semibold text-ink-100 tabular-nums">{nearC.Extinction} of {near.length}</div>
            <div className="mt-0.5 text-sm text-ink-300">flames went out</div>
            <div className="mt-3"><Bar counts={nearC} total={near.length} /></div>
            <div className="mt-2 text-xs text-ink-300"><OutcomeLine counts={nearC} total={near.length} /></div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-ink-400">Same oxygen at sea-level pressure: ≥30% O₂, ≈1 atm</div>
            <div className="mt-1 text-3xl font-semibold text-ink-100 tabular-nums">{seaC.Extinction} of {sameO2Sea.length}</div>
            <div className="mt-0.5 text-sm text-ink-300">flames went out</div>
            <div className="mt-3"><Bar counts={seaC} total={sameO2Sea.length} /></div>
            <div className="mt-2 text-xs text-ink-300"><OutcomeLine counts={seaC} total={sameO2Sea.length} /></div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-ink-400">Same pressure, less oxygen: below 20% O₂, ≈0.7 atm</div>
            <div className="mt-1 text-3xl font-semibold text-ink-100 tabular-nums">{lowC.Extinction} of {lowPLowO2.length}</div>
            <div className="mt-0.5 text-sm text-ink-300">flames went out</div>
            <div className="mt-3"><Bar counts={lowC} total={lowPLowO2.length} /></div>
            <div className="mt-2 text-xs text-ink-300"><OutcomeLine counts={lowC} total={lowPLowO2.length} /></div>
          </Card>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-300">
          Observation: none of the FLEX tests nearest to habitat air ended with the flame going out; each ended with the droplet disrupting or burning away. At the same pressure with less oxygen, most flames went out. These are counts from NASA&apos;s table, not a prediction for a habitat. <Link href="/model" className="text-accent hover:underline">Explore these conditions in the flame-out model</Link>. <Link href="/gaps" className="text-accent hover:underline">See what hasn&apos;t been tested yet</Link>.
        </p>
      </section>

      <ChartCard
        title="Where NASA tested, against the habitat target"
        description="Every FLEX test by starting oxygen (rows) and chamber pressure (columns). Each cell shows how many tests ran there and how they ended. The outlined cells are the nearest tested conditions to habitat air."
        count={`${flex.filter((p) => p.pAtm !== null).length} tests`}
        legend={<Legend shape="rect" items={OUTCOME_ORDER.map((k) => ({ color: OUTCOME[k].color, label: OUTCOME[k].label }))} />}
        footer={<>Source: NASA PSI-69 FLEX experimental table (DOI 10.60555/mbq8-0451). Pressure grouped from NASA&apos;s recorded chamber pressure. One test without a recorded pressure is left out. Outcome categories are NASA&apos;s &ldquo;Test end&rdquo; values.</>}
        table={<DataTable head={["Initial O₂", "Pressure", "Tests", "Flame went out", "Droplet disrupted", "Burned to completion"]} rows={tableRows} />}
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[520px] gap-1" style={{ gridTemplateColumns: "64px repeat(3, minmax(0, 1fr))" }} onMouseLeave={() => setHover(null)}>
            <div />
            {COLS.map((c) => (
              <div key={c.key} className="pb-1 text-center text-xs text-ink-300">
                {c.label}<div className="text-[11px] text-ink-400">{c.sub}</div>
              </div>
            ))}
            {o2Levels.map((o2) => (
              <div key={o2} className="contents">
                <div className="flex items-center justify-end pr-2 text-xs tabular-nums text-ink-300">{o2}% O₂</div>
                {COLS.map((c) => {
                  const k = `${o2}|${c.key}`;
                  const pts = grid.get(k);
                  const target = o2 >= TARGET_O2 && c.key === "low";
                  if (!pts) return <div key={k} className={`h-9 rounded ${target ? "border border-dashed border-accent/50" : "bg-ink-900/40"}`} />;
                  const t = tally(pts);
                  return (
                    <button
                      key={k}
                      type="button"
                      onMouseEnter={() => setHover(k)}
                      onFocus={() => setHover(k)}
                      aria-label={`${o2}% oxygen, ${c.label}: ${pts.length} tests; ${t.Extinction} flame went out, ${t.Disruption} disrupted, ${t.Completion} burned to completion`}
                      className={`flex h-9 items-center gap-2 rounded px-2 text-left transition-colors ${target ? "border-2 border-accent bg-accent/10" : "border border-ink-800 bg-ink-900 hover:border-ink-600"} ${hover === k ? "border-ink-400" : ""}`}
                    >
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-200">{pts.length}</span>
                      <Bar counts={t} total={pts.length} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 min-h-10 rounded border border-ink-800 bg-ink-900 px-3 py-2 text-xs text-ink-300" aria-live="polite">
          {hovered ? (
            <>
              <span className="text-ink-100">{hO2}% O₂, {COLS.find((c) => c.key === hCol)?.label}:</span>{" "}
              <OutcomeLine counts={tally(hovered)} total={hovered.length} />. Tests: {hovered.slice(0, 8).map((p) => p.testId).join(", ")}{hovered.length > 8 ? ` and ${hovered.length - 8} more` : ""}.
            </>
          ) : (
            "Point at a cell to see its outcomes and test IDs."
          )}
        </div>
      </ChartCard>

      <section>
        <h2 className="text-lg font-semibold text-ink-100">The {near.length} tests nearest to habitat air</h2>
        <p className="mt-1 text-sm text-ink-300">Open any test to see NASA&apos;s original record.</p>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
            <thead className="border-b border-ink-800 text-xs text-ink-400">
              <tr>
                <th className="px-3 py-2 font-medium">Test</th><th className="px-3 py-2 font-medium">Fuel</th><th className="px-3 py-2 font-medium">O₂</th>
                <th className="px-3 py-2 font-medium">Pressure</th><th className="px-3 py-2 font-medium">Added gas</th><th className="px-3 py-2 font-medium">Test end</th>
              </tr>
            </thead>
            <tbody className="text-ink-200">
              {[...near].sort((a, b) => b.o2 - a.o2 || a.fuel.localeCompare(b.fuel)).map((p) => (
                <tr key={p.id} className="border-b border-ink-850 last:border-0">
                  <td className="px-3 py-1.5"><Link href={`/explorer?test=${encodeURIComponent(p.id)}`} className="font-mono text-accent hover:underline">{p.testId}</Link></td>
                  <td className="px-3 py-1.5">{p.fuel}</td>
                  <td className="px-3 py-1.5">{p.o2}%</td>
                  <td className="px-3 py-1.5">{(p.pAtm as number).toFixed(3)} atm ({psi(p.pAtm as number)} psi)</td>
                  <td className="px-3 py-1.5">{p.diluent === "N2" ? "N₂ only" : p.diluent}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: OUTCOME[p.end].color }} />{OUTCOME[p.end].label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink-100">Our two data sets, by coverage of habitat conditions</h2>
        <p className="mt-1 max-w-3xl text-sm text-ink-300">
          Ranked by whether an investigation tested oxygen at 30% or more, recorded low chamber pressure, and has tests near the target. This ranks coverage of conditions, not the quality of the science. <Link href="/investigations" className="text-accent hover:underline">See all 24 PSI combustion investigations ranked</Link>.
        </p>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-ink-800 text-xs text-ink-400">
              <tr>
                <th className="px-3 py-2 font-medium">Rank</th><th className="px-3 py-2 font-medium">Investigation</th><th className="px-3 py-2 font-medium">Oxygen tested</th>
                <th className="px-3 py-2 font-medium">Pressure in the data</th><th className="px-3 py-2 font-medium">Tests near target</th>
              </tr>
            </thead>
            <tbody className="text-ink-200">
              <tr className="border-b border-ink-850">
                <td className="px-3 py-2 tabular-nums">1</td>
                <td className="px-3 py-2">FLEX (PSI-69), fuel droplets</td>
                <td className="px-3 py-2 tabular-nums">{Math.min(...flex.map((p) => p.o2))}–{Math.max(...flex.map((p) => p.o2))}%</td>
                <td className="px-3 py-2">Recorded, ≈0.7 to 3.1 atm</td>
                <td className="px-3 py-2 tabular-nums">{near.length}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 tabular-nums">2</td>
                <td className="px-3 py-2">BASS-II (PSI-25), solid materials</td>
                <td className="px-3 py-2 tabular-nums">{bassLo}–{bassHi}% (starting)</td>
                <td className="px-3 py-2">Not recorded in the test table</td>
                <td className="px-3 py-2 tabular-nums">0 of {bassTests}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-ink-100">What this can&apos;t tell you</h2>
        <ul className="mt-2 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-300">
          <li>All tests ran in microgravity on the ISS. PSI has no Moon or Mars gravity data, so these results do not predict fire behaviour in a lunar or Martian habitat.</li>
          <li>The nearest tests ran at 10.3–10.5 psi, slightly above the 10.2 psi target, and used nitrogen as the only added gas.</li>
          <li>These are single fuel droplets of methanol or heptane, not spacecraft materials such as fabrics, plastics or wiring.</li>
          <li>NASA&apos;s files do not define the &ldquo;Test end&rdquo; categories. &ldquo;Droplet disrupted&rdquo; is not the same as a safe outcome.</li>
          <li>BASS-II burned solid materials but tops out near 22% oxygen and does not record pressure in its test table, so it cannot speak to habitat air.</li>
        </ul>
      </Card>
    </div>
  );
}
