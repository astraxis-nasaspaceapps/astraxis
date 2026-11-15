"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { FlexPoint } from "@/lib/data";
import { crossoverO2, predict, type FlexModel, type Inputs } from "@/lib/model";
import { DILUENT, OUTCOME } from "@/lib/palette";
import { ChartCard, DataTable, useWidth } from "@/components/charts/core";
import { Badge, Card } from "@/components/ui";

type Gas = "N2" | "CO2" | "He";
type Fuel = "Methanol" | "Heptane";
const PSI_PER_ATM = 14.696;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const PRESETS: { label: string; fuel: Fuel; gas: Gas; o2: number; p: number; d0: number; gasPct: number }[] = [
  { label: "Nearest to habitat air: 34% O₂, 0.7 atm", fuel: "Methanol", gas: "N2", o2: 34, p: 0.71, d0: 3.4, gasPct: 0 },
  { label: "Ordinary air: 21% O₂, 1 atm", fuel: "Methanol", gas: "N2", o2: 21, p: 1.0, d0: 2.5, gasPct: 0 },
  { label: "CO₂ suppressant: 18% O₂, 30% CO₂", fuel: "Heptane", gas: "CO2", o2: 18, p: 1.0, d0: 3.0, gasPct: 30 },
];

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between text-sm"><span className="text-ink-300">{label}</span><span className="font-medium tabular-nums text-ink-100">{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1.5 w-full accent-sky-400" />
      <div className="flex justify-between text-[11px] text-ink-500 tabular-nums"><span>{fmt(min)}</span><span>tested range</span><span>{fmt(max)}</span></div>
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${value === o.v ? "border-accent/60 bg-accent/15 text-ink-100" : "border-ink-700 text-ink-300 hover:border-ink-500"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Curve({ model, x, gasO2 }: { model: FlexModel; x: Inputs; gasO2: [number, number] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240, ml = 44, mr = 16, mt = 12, mb = 36;
  const iw = Math.max(0, w - ml - mr), ih = H - mt - mb;
  const [lo, hi] = gasO2;
  const pts = useMemo(() => { const a: [number, number][] = []; for (let o = lo; o <= hi + 1e-9; o += 0.25) a.push([o, predict(model, { ...x, o2: o })]); return a; }, [model, x, lo, hi]);
  const sx = (o: number) => ml + ((o - lo) / (hi - lo || 1)) * iw;
  const sy = (p: number) => mt + (1 - p) * ih;
  const d = pts.map(([o, p], i) => `${i ? "L" : "M"}${sx(o).toFixed(1)},${sy(p).toFixed(1)}`).join("");
  const ticks = []; for (let o = Math.ceil(lo / 2) * 2; o <= hi; o += 2) ticks.push(o);
  const hv = hover !== null ? predict(model, { ...x, o2: hover }) : null;
  return (
    <div ref={ref} className="relative">
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label="Predicted chance of flame-out across the tested oxygen range"
          onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const o = lo + ((e.clientX - r.left - ml) / iw) * (hi - lo); setHover(o >= lo && o <= hi ? Math.round(o * 2) / 2 : null); }}
          onMouseLeave={() => setHover(null)}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}><line x1={ml} x2={ml + iw} y1={sy(t)} y2={sy(t)} stroke="#1c2a44" strokeDasharray={t === 0.5 ? "4 4" : undefined} /><text x={ml - 8} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="#93a3bf">{pct(t)}</text></g>
          ))}
          <line x1={ml} x2={ml + iw} y1={mt + ih} y2={mt + ih} stroke="#2a3b5c" />
          {ticks.map((t) => <text key={t} x={sx(t)} y={mt + ih + 16} textAnchor="middle" fontSize={11} fill="#93a3bf">{t}%</text>)}
          <text x={ml + iw} y={H - 4} textAnchor="end" fontSize={11} fill="#93a3bf">Initial oxygen (%)</text>
          <path d={d} fill="none" stroke="#9085e9" strokeWidth={2} />
          <circle cx={sx(clamp(x.o2, lo, hi))} cy={sy(predict(model, x))} r={6} fill="#9085e9" stroke="#0f1829" strokeWidth={2} />
          {hover !== null && hv !== null && (
            <g><line x1={sx(hover)} x2={sx(hover)} y1={mt} y2={mt + ih} stroke="#93a3bf" strokeOpacity={0.5} /><circle cx={sx(hover)} cy={sy(hv)} r={4} fill="#e6ecf5" /></g>
          )}
        </svg>
      )}
      <div className="mt-1 min-h-5 text-xs text-ink-300" aria-live="polite">
        {hover !== null && hv !== null ? <>At {hover}% O₂: <span className="text-ink-100">{pct(hv)}</span> predicted chance the flame goes out.</> : "Point along the curve to read the prediction at any oxygen level."}
      </div>
    </div>
  );
}

export function ModelView({ model, points }: { model: FlexModel; points: FlexPoint[] }) {
  const [fuel, setFuel] = useState<Fuel>("Methanol");
  const [gas, setGas] = useState<Gas>("N2");
  const [gasPct, setGasPct] = useState(20);
  const [o2, setO2] = useState(21);
  const [p, setP] = useState(1.0);
  const [d0, setD0] = useState(2.5);
  const gasO2 = model.o2ByDiluent[gas] as [number, number];
  const o2c = clamp(o2, gasO2[0], gasO2[1]);
  const gr = gas === "CO2" ? model.diluentRanges.CO2 : gas === "He" ? model.diluentRanges.He : [0, 0];
  const gasPctC = gas === "N2" ? 0 : clamp(gasPct, gr[0], gr[1]);
  const x: Inputs = { o2: o2c, p, heptane: fuel === "Heptane" ? 1 : 0, co2: gas === "CO2" ? gasPctC : 0, he: gas === "He" ? gasPctC : 0, d0 };
  const prob = predict(model, x);
  const cross = crossoverO2(model, x);
  const r = model.ranges;

  const similar = points.filter((t) => t.fuel === fuel && t.diluent === gas && Math.abs(t.o2 - o2c) <= 2 && t.pAtm !== null && Math.abs(t.pAtm - p) <= 0.25 && (t.d0 === null || Math.abs(t.d0 - d0) <= 1));
  const simOut = similar.filter((t) => t.end === "Extinction").length;
  const support = similar.length >= 5 ? "strong" : similar.length >= 2 ? "some" : "thin";

  const apply = (s: (typeof PRESETS)[number]) => { setFuel(s.fuel); setGas(s.gas); setO2(s.o2); setP(s.p); setD0(s.d0); if (s.gasPct) setGasPct(s.gasPct); };
  const chosen = model.cv.models.find((m) => m.chosen)!;
  const base = model.cv.models[0];
  const effects = model.features.map((f, i) => ({ f, perUnit: Math.exp(model.coef[i] / model.scale[i]) }));
  const eff = (f: string) => effects.find((e) => e.f === f)!.perUnit;
  const times = (v: number) => (v >= 1 ? `×${v.toFixed(2)}` : `×${v.toFixed(2)}`);

  return (
    <div className="space-y-6 px-5 py-6 md:px-8">
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs text-ink-400">Try:</span>
        {PRESETS.map((s) => <button key={s.label} type="button" onClick={() => apply(s)} className="rounded-full border border-ink-700 px-3 py-1 text-sm text-ink-300 transition-colors hover:border-accent/50 hover:text-ink-100">{s.label}</button>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Card className="space-y-5 p-5">
          <div><div className="mb-2 text-sm text-ink-300">Fuel</div><Seg value={fuel} onChange={setFuel} options={[{ v: "Methanol", label: "Methanol" }, { v: "Heptane", label: "Heptane" }]} /></div>
          <div><div className="mb-2 text-sm text-ink-300">Added gas</div><Seg value={gas} onChange={setGas} options={[{ v: "N2", label: DILUENT.N2.label }, { v: "CO2", label: DILUENT.CO2.label }, { v: "He", label: DILUENT.He.label }]} /></div>
          {gas !== "N2" && <Slider label={gas === "CO2" ? "CO₂ in the chamber" : "Helium in the chamber"} value={gasPctC} min={gr[0]} max={gr[1]} step={5} onChange={setGasPct} fmt={(v) => `${v}%`} />}
          <Slider label="Initial oxygen" value={o2c} min={gasO2[0]} max={gasO2[1]} step={1} onChange={setO2} fmt={(v) => `${v}%`} />
          <Slider label="Chamber pressure" value={p} min={Math.ceil(r.p[0] * 100) / 100} max={Math.floor(r.p[1] * 100) / 100} step={0.01} onChange={setP} fmt={(v) => `${v.toFixed(2)} atm (${(v * PSI_PER_ATM).toFixed(1)} psi)`} />
          <Slider label="Initial droplet diameter" value={d0} min={Math.ceil(r.d0[0] * 10) / 10} max={Math.floor(r.d0[1] * 10) / 10} step={0.1} onChange={setD0} fmt={(v) => `${v.toFixed(1)} mm`} />
          <p className="text-xs leading-relaxed text-ink-400">Sliders stop at the edges of what NASA tested. {gas !== "N2" && `Tests with ${gas === "CO2" ? "CO₂" : "helium"} only went up to ${gasO2[1]}% oxygen.`}</p>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="text-sm text-ink-300">Predicted chance the flame goes out early</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-5xl font-semibold tabular-nums text-ink-100">{pct(prob)}</span>
              <span className="text-sm text-ink-300">{prob >= 0.5 ? `more likely than not (NASA “${OUTCOME.Extinction.label.toLowerCase()}”)` : "less likely than not"}</span>
            </div>
            <p className="mt-2 text-sm text-ink-300">
              {cross >= gasO2[0] && cross <= gasO2[1]
                ? <>With these other settings, the model puts the 50/50 point at about <span className="text-ink-100">{cross.toFixed(1)}% oxygen</span>.</>
                : <>With these other settings, the 50/50 point falls outside the tested oxygen range ({gasO2[0]}–{gasO2[1]}%).</>}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-800 pt-3 text-sm">
              <Badge tone={support === "thin" ? "warn" : support === "strong" ? "accent" : "neutral"}>{support === "strong" ? "Strong data support" : support === "some" ? "Some data support" : "Thin data support"}</Badge>
              <span className="text-ink-300">
                {similar.length
                  ? <>{similar.length} similar NASA test{similar.length > 1 ? "s" : ""} (same fuel and gas, O₂ within 2 points, similar pressure and size): {simOut} flame{simOut === 1 ? "" : "s"} went out.</>
                  : <>No NASA test closely matches these settings, so treat this as an interpolation.</>}
              </span>
            </div>
            {similar.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {similar.slice(0, 12).map((t) => (
                  <Link key={t.id} href={`/explorer?test=${encodeURIComponent(t.id)}`} className="inline-flex items-center gap-1 rounded border border-ink-700 px-1.5 py-0.5 font-mono text-[11px] text-ink-200 hover:border-accent/50">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: OUTCOME[t.end].color }} />{t.testId}
                  </Link>
                ))}
                {similar.length > 12 && <span className="text-xs text-ink-400">and {similar.length - 12} more</span>}
              </div>
            )}
          </Card>

          <ChartCard
            title="Chance of flame-out across the tested oxygen range"
            description="For the fuel, gas, pressure and droplet size you picked. The dot is your current setting; the dashed line is 50%."
            footer={<>Model: logistic regression on {model.n} FLEX tests (DOI 10.60555/mbq8-0451). Predictions are shown only inside the tested oxygen range for the chosen gas.</>}
            table={<DataTable head={["Initial O₂", "Predicted chance of flame-out"]} rows={Array.from({ length: gasO2[1] - gasO2[0] + 1 }, (_, i) => gasO2[0] + i).map((o) => [`${o}%`, pct(predict(model, { ...x, o2: o }))])} />}
          >
            <Curve model={model} x={x} gasO2={gasO2} />
          </ChartCard>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-100">How well it predicts</h2>
          <p className="mt-1 text-sm text-ink-300">Tested on tests it hadn&apos;t seen: {model.cv.method}. {model.excluded} of 274 tests without a recorded pressure or droplet size were left out.</p>
          <table className="mt-3 w-full text-left text-sm tabular-nums">
            <thead className="text-xs text-ink-400"><tr><th className="py-1.5 font-medium">Model</th><th className="py-1.5 font-medium">Accuracy</th><th className="py-1.5 font-medium">AUC</th></tr></thead>
            <tbody className="text-ink-200">
              {model.cv.models.map((m) => (
                <tr key={m.name} className={`border-t border-ink-850 ${m.chosen ? "text-ink-100" : ""}`}>
                  <td className="py-1.5 pr-3">{m.name}{m.chosen && <span className="ml-2"><Badge tone="accent">used here</Badge></span>}</td>
                  <td className="py-1.5">{pct(m.accuracy)}</td><td className="py-1.5">{m.auc.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs leading-relaxed text-ink-400">The simple model ({pct(chosen.accuracy)}) beats always guessing the most common outcome ({pct(base.accuracy)}) and matches a far more complex model, so we use the one whose workings can be shown.</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-100">Do its probabilities match reality?</h2>
          <p className="mt-1 text-sm text-ink-300">Share of flames that actually went out, against the model&apos;s average prediction for tests it hadn&apos;t seen.</p>
          <table className="mt-3 w-full text-left text-sm tabular-nums">
            <thead className="text-xs text-ink-400"><tr><th className="py-1.5 font-medium">Oxygen band</th><th className="py-1.5 font-medium">Tests</th><th className="py-1.5 font-medium">Actually went out</th><th className="py-1.5 font-medium">Predicted</th></tr></thead>
            <tbody className="text-ink-200">
              {model.calibration.map((c) => <tr key={c.band} className="border-t border-ink-850"><td className="py-1.5">{c.band}</td><td className="py-1.5">{c.n}</td><td className="py-1.5">{pct(c.observed)}</td><td className="py-1.5">{pct(c.predicted)}</td></tr>)}
            </tbody>
          </table>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-ink-100">What moves the prediction</h2>
        <ul className="mt-2 grid gap-x-8 gap-y-1.5 text-sm text-ink-300 md:grid-cols-2">
          <li><span className="text-ink-100">+1 point of oxygen</span>: odds of flame-out {times(eff("o2"))} (less likely)</li>
          <li><span className="text-ink-100">+1 mm droplet size</span>: odds {times(eff("d0"))} (more likely)</li>
          <li><span className="text-ink-100">+10 points of CO₂</span>: odds {times(eff("co2") ** 10)}</li>
          <li><span className="text-ink-100">+10 points of helium</span>: odds {times(eff("he") ** 10)}</li>
          <li><span className="text-ink-100">Heptane instead of methanol</span>: odds {times(eff("heptane"))}</li>
          <li><span className="text-ink-100">+1 atm of pressure</span>: odds {times(eff("p"))}, so no clear effect in 0.7–3 atm</li>
        </ul>
        <p className="mt-2 text-xs text-ink-400">Each effect holds the other factors fixed. These are associations in NASA&apos;s test data, not proven causes.</p>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-ink-100">What this model can&apos;t do</h2>
        <ul className="mt-2 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-300">
          <li>It is trained on microgravity droplets on the ISS. It does not predict fires in lunar or Martian gravity, or fires of spacecraft materials such as fabrics and plastics.</li>
          <li>It predicts NASA&apos;s &ldquo;Test end&rdquo; label, whose definitions are not given in the downloaded files. A flame that doesn&apos;t go out early is not a safe outcome.</li>
          <li>It only covers the ranges NASA tested, and the sliders stop there. The &ldquo;data support&rdquo; badge shows when few real tests sit near your settings.</li>
          <li>It is a research aid for exploring the evidence, not a fire-safety design tool.</li>
        </ul>
      </Card>
    </div>
  );
}
