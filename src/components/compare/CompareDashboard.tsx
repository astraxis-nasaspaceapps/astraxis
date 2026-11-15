"use client";

import { useMemo, useState } from "react";
import type { BassPoint, FlexPoint } from "@/lib/data";
import { DILUENT, DILUENT_ORDER, OUTCOME, OUTCOME_ORDER, SINGLE_SERIES, type DiluentKey, type OutcomeKey } from "@/lib/palette";
import { ChartCard, DataTable, Legend, TipRow } from "@/components/charts/core";
import { OutcomeBars, type OutcomeBin } from "@/components/charts/OutcomeBars";
import { ScatterPanels, type ScatterPoint } from "@/components/charts/ScatterPanels";

type Fuel = "both" | "Methanol" | "Heptane";
type Pressure = "all" | "low" | "one" | "high";
const PRESSURE: Record<Pressure, string> = { all: "All pressures", low: "≈0.7 atm", one: "≈1 atm", high: "2–3 atm" };
const inBand = (p: number | null, b: Pressure) =>
  b === "all" || (p !== null && (b === "low" ? p < 0.8 : b === "one" ? p >= 0.8 && p < 1.5 : p >= 1.5));

const SRC_FLEX = (
  <>Source: NASA PSI-69 FLEX experimental table (DOI 10.60555/mbq8-0451). Each point is one ISS test; values as reported by NASA.</>
);

export function CompareDashboard({ flex, bass }: { flex: FlexPoint[]; bass: BassPoint[] }) {
  const [fuel, setFuel] = useState<Fuel>("both");
  const [gases, setGases] = useState<Record<DiluentKey, boolean>>({ N2: true, CO2: true, He: true });
  const [pressure, setPressure] = useState<Pressure>("all");
  const [hideFlagged, setHideFlagged] = useState(true);

  const slice = useMemo(
    () => flex.filter((p) => (fuel === "both" || p.fuel === fuel) && gases[p.diluent] && inBand(p.pAtm, pressure)),
    [flex, fuel, gases, pressure],
  );
  const panels = fuel === "both" ? ["Methanol", "Heptane"] : [fuel];
  const flagged = (p: FlexPoint, fields: string[]) => hideFlagged && fields.some((f) => p.flags.includes(f));

  /* chart 1: outcome share by O2 bin */
  const bins: OutcomeBin[] = useMemo(() => {
    const m = new Map<number, OutcomeBin>();
    for (const p of slice) {
      const lo = Math.floor(p.o2 / 2) * 2;
      const b = m.get(lo) ?? { label: `${lo}–${lo + 2}%`, lo, counts: { Extinction: 0, Disruption: 0, Completion: 0 }, total: 0 };
      b.counts[p.end]++; b.total++; m.set(lo, b);
    }
    return [...m.values()].sort((a, b) => a.lo - b.lo);
  }, [slice]);
  const low = slice.filter((p) => p.o2 < 20), high = slice.filter((p) => p.o2 >= 24);
  const lowExt = low.filter((p) => p.end === "Extinction").length;
  const highDis = high.filter((p) => p.end === "Disruption").length;

  /* chart 2: fraction of droplet left at extinction */
  const ratioPts: ScatterPoint[] = slice
    .filter((p) => p.end === "Extinction" && p.dExt !== null && p.d0 !== null && p.d0 > 0 && !flagged(p, ["flame_extinction_diameter_mm", "droplet_initial_diameter_mm"]))
    .map((p) => ({
      id: p.id, panel: p.fuel, x: p.o2, y: (p.dExt as number) / (p.d0 as number), color: DILUENT[p.diluent].color,
      tip: (
        <>
          <div className="mb-1 font-mono text-ink-100">{p.testId}</div>
          <TipRow label="Droplet left at flame-out" value={`${(((p.dExt as number) / (p.d0 as number)) * 100).toFixed(0)}% of diameter`} />
          <TipRow label="Diameters" value={`${p.d0} → ${p.dExt} mm`} />
          <TipRow color={DILUENT[p.diluent].color} label={DILUENT[p.diluent].label} value={`${p.o2}% O₂`} />
          <TipRow label="Pressure" value={p.pAtm !== null ? `${p.pAtm} atm` : "—"} />
        </>
      ),
    }));
  const extTotal = slice.filter((p) => p.end === "Extinction").length;

  /* chart 3: burning rate vs O2 */
  const ratePts: ScatterPoint[] = slice
    .filter((p) => p.rate !== null && !flagged(p, ["burning_rate"]))
    .map((p) => ({
      id: p.id, panel: p.fuel, x: p.o2, y: p.rate as number, color: DILUENT[p.diluent].color,
      tip: (
        <>
          <div className="mb-1 font-mono text-ink-100">{p.testId}</div>
          <TipRow label="Burning rate (unit unverified)" value={p.rate} />
          <TipRow color={DILUENT[p.diluent].color} label={DILUENT[p.diluent].label} value={`${p.o2}% O₂`} />
          <TipRow label="Test end" value={OUTCOME[p.end].label} />
        </>
      ),
    }));
  const rateMax = Math.max(0.8, ...ratePts.map((p) => p.y));

  /* chart 4: BASS-II conditions coverage */
  const group = (m: string) => (m === "cotton-fiberglass fabric (SIBAL)" ? "Cotton-fiberglass fabric" : ["PMMA thin film", "PMMA slab", "PMMA rod"].includes(m) ? m : "Other solids");
  const bassPts: ScatterPoint[] = bass
    .filter((b) => b.o2 !== null && b.airflow !== null)
    .map((b) => ({
      id: b.id, panel: group(b.materialClass), x: b.o2 as number, y: b.airflow as number, color: SINGLE_SERIES,
      tip: (
        <>
          <div className="mb-1 font-mono text-ink-100">{b.testId} <span className="font-sans text-ink-400">· {b.pi}</span></div>
          <div className="mb-1 text-ink-300">{b.material}</div>
          <TipRow label="Initial O₂" value={`${b.o2}%`} />
          <TipRow label="Initial airflow" value={`${b.airflow} cm/s`} />
          {b.changed && <TipRow label="Crew log" value={b.airflowRaw ?? ""} />}
        </>
      ),
    }));
  const bassPanels = ["PMMA thin film", "PMMA slab", "PMMA rod", "Cotton-fiberglass fabric", "Other solids"];

  const pill = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${on ? "border-ink-600 bg-ink-800 text-ink-100" : "border-ink-800 text-ink-400 hover:text-ink-200"}`;
  const diluentLegend = <Legend items={DILUENT_ORDER.map((k) => ({ color: DILUENT[k].color, label: DILUENT[k].label, muted: !gases[k] }))} />;

  return (
    <div className="space-y-6 px-8 py-6">
      {/* one filter row scopes every FLEX chart below */}
      <div className="sticky top-0 z-30 -mx-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-ink-800 bg-ink-950/85 px-8 py-3 backdrop-blur">
        <div className="flex items-center gap-1.5" role="group" aria-label="Fuel">
          {(["both", "Methanol", "Heptane"] as Fuel[]).map((f) => (
            <button key={f} className={pill(fuel === f)} onClick={() => setFuel(f)} aria-pressed={fuel === f}>{f === "both" ? "Both fuels" : f}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Added gas">
          {DILUENT_ORDER.map((k) => (
            <button key={k} className={`${pill(gases[k])} flex items-center gap-1.5`} aria-pressed={gases[k]}
              onClick={() => setGases((g) => ({ ...g, [k]: !g[k] }))}>
              <span className="h-2 w-2 rounded-full" style={{ background: DILUENT[k].color, opacity: gases[k] ? 1 : 0.35 }} />
              {DILUENT[k].label}
            </button>
          ))}
        </div>
        <select value={pressure} onChange={(e) => setPressure(e.target.value as Pressure)} aria-label="Pressure"
          className="h-8 rounded-md border border-ink-700 bg-ink-850 px-2 text-xs text-ink-100 outline-none focus:border-accent/60">
          {(Object.keys(PRESSURE) as Pressure[]).map((k) => <option key={k} value={k}>{PRESSURE[k]}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-300">
          <input type="checkbox" checked={hideFlagged} onChange={(e) => setHideFlagged(e.target.checked)} className="accent-sky-400" />
          Leave out values with data notes
        </label>
        <span className="ml-auto text-xs tabular-nums text-ink-400">{slice.length} of {flex.length} FLEX tests</span>
      </div>

      {low.length > 0 && high.length > 0 && (
        <p className="max-w-3xl text-[15px] leading-relaxed text-ink-200">
          In this selection, <strong className="text-ink-100">{lowExt} of {low.length}</strong> tests below 20% oxygen ended with the flame going out.
          At 24% oxygen and above, <strong className="text-ink-100">{highDis} of {high.length}</strong> ended with the droplet disrupting instead.
        </p>
      )}

      <ChartCard
        title="How each test ended, by oxygen level"
        description="Share of FLEX droplet tests in each oxygen band that ended with the flame going out, the droplet disrupting, or the droplet burning away completely."
        count={`${slice.length} tests`}
        legend={<Legend shape="rect" items={OUTCOME_ORDER.map((k) => ({ color: OUTCOME[k].color, label: OUTCOME[k].label }))} />}
        table={<DataTable head={["Initial O₂", ...OUTCOME_ORDER.map((k) => OUTCOME[k].label), "Tests"]} rows={bins.map((b) => [b.label, ...OUTCOME_ORDER.map((k: OutcomeKey) => b.counts[k]), b.total])} />}
        footer={<>{SRC_FLEX} Outcome categories are NASA&apos;s “Test end” values; their exact definitions are still being confirmed. Bands mix fuels, pressures and droplet sizes unless filtered.</>}
      >
        {bins.length ? <OutcomeBars bins={bins} /> : <Empty />}
      </ChartCard>

      <ChartCard
        title="How much droplet was left when the flame went out"
        description="For tests where the flame went out, the droplet's diameter at flame-out divided by its starting diameter. Higher means the flame died earlier, with more fuel left."
        count={`${ratioPts.length} of ${extTotal} flame-out tests plotted`}
        legend={diluentLegend}
        table={<DataTable head={["Test", "Fuel", "Initial O₂ %", "Added gas", "Start mm", "At flame-out mm", "Ratio"]} rows={ratioPts.map((p) => { const f = flex.find((x) => x.id === p.id)!; return [f.testId, f.fuel, f.o2, DILUENT[f.diluent].label, f.d0 ?? "", f.dExt ?? "", p.y.toFixed(2)]; })} />}
        footer={<>{SRC_FLEX} Only flame-out tests with both diameters reported are plotted. NASA varied droplet size on purpose while searching for limits, so this is a descriptive pattern, not a controlled comparison.</>}
      >
        {ratioPts.length ? <ScatterPanels points={ratioPts} panels={panels} xDomain={[10, 36]} yDomain={[0, 1.05]} xLabel="Initial O₂ (%)" yLabel="Diameter at flame-out ÷ starting diameter" yFormat={(v) => v.toFixed(2)} /> : <Empty />}
      </ChartCard>

      <ChartCard
        title="Burning rate against oxygen level"
        description="How fast each droplet burned, as reported by NASA, plotted against the starting oxygen level."
        count={`${ratePts.length} tests plotted`}
        legend={diluentLegend}
        table={<DataTable head={["Test", "Fuel", "Initial O₂ %", "Added gas", "Burning rate", "Test end"]} rows={ratePts.map((p) => { const f = flex.find((x) => x.id === p.id)!; return [f.testId, f.fuel, f.o2, DILUENT[f.diluent].label, f.rate ?? "", OUTCOME[f.end].label]; })} />}
        footer={<>{SRC_FLEX} <span className="text-warn">The burning-rate unit is not yet confirmed from a NASA document (likely mm²/s, the burning-rate constant), so the axis is left without a unit.</span></>}
      >
        {ratePts.length ? <ScatterPanels points={ratePts} panels={panels} xDomain={[10, 36]} yDomain={[0, Math.ceil(rateMax * 10) / 10]} xLabel="Initial O₂ (%)" yLabel="Burning rate (unit unverified)" /> : <Empty />}
      </ChartCard>

      <div className="pt-4">
        <h2 className="text-lg font-semibold text-ink-100">Solid materials: conditions tested in BASS-II</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-300">
          The BASS-II test table records the conditions each solid sample was burned under, not how it burned. This map shows which oxygen and airflow combinations were tested for each material, so researchers can see where evidence exists and where it doesn&apos;t.
        </p>
      </div>
      <ChartCard
        title="Starting oxygen and airflow for each solid-material test"
        description="Each point is one BASS-II test at its starting conditions. Many tests changed airflow during the burn; the crew log is in each tooltip."
        count={`${bassPts.length} of ${bass.length} tests have both values`}
        table={<DataTable head={["Test", "Researcher", "Material", "Initial O₂ %", "Initial airflow cm/s", "Crew airflow log"]} rows={bass.map((b) => [b.testId, b.pi, b.material, b.o2 ?? "", b.airflow ?? "", b.airflowRaw ?? ""])} />}
        footer={<>Source: NASA PSI-25 BASS-II test matrix (DOI 10.60555/4qc4-de67) and BASS-II data FAQ. Airflow is the duct sensor reading in cm/s (about one minute response time). Flame spread rates and outcomes are in NASA/TM-20210011385, not in this table.</>}
      >
        <ScatterPanels points={bassPts} panels={bassPanels} xDomain={[13, 23]} yDomain={[0, 55]} xLabel="Initial O₂ (%)" yLabel="Initial airflow (cm/s)" maxCols={3} />
      </ChartCard>
    </div>
  );
}

function Empty() {
  return <p className="py-16 text-center text-sm text-ink-400">No tests match these filters. Turn an added gas back on or widen the pressure range.</p>;
}
