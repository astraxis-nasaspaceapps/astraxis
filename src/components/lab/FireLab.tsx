"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { FlexPoint } from "@/lib/data";
import { predict, type FlexModel } from "@/lib/model";
import { OUTCOME, OUTCOME_ORDER } from "@/lib/palette";
import { ChartCard, DataTable, Legend, useWidth } from "@/components/charts/core";
import { Badge, Card } from "@/components/ui";

const PSI = 14.696;
const X0 = 8, X1 = 15.5, Y0 = 12, Y1 = 40;          // map extent: cabin pressure (psi), oxygen (%)
const TARGET = { o2: 30, psi: 10.2 };
type Fuel = "Methanol" | "Heptane";

const PRESETS = [
  { key: "earth", label: "Earth and ISS cabin air", o2: 21, psi: 14.7, note: "21% O₂ at 14.7 psi" },
  { key: "x265", label: "NASA exploration atmosphere", o2: 26.5, psi: 10.2, note: "26.5% O₂ at 10.2 psi (NASA, PSI-20 catalog)" },
  { key: "near", label: "Nearest tested to habitat air", o2: 34, psi: 10.4, note: "34% O₂ at 10.4 psi (FLEX tests)" },
  { key: "x34", label: "NASA exploration atmosphere", o2: 34, psi: 8.2, note: "34% O₂ at 8.2 psi (NASA, PSI-20 catalog)" },
];

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}
const heat = (p: number) => mix("#121d33", "#9085e9", Math.pow(p, 0.9));

function Flame({ fuel, prob, ratio, ratioN, untested }: { fuel: Fuel; prob: number; ratio: number; ratioN: number; untested: boolean }) {
  const S = 300, c = S / 2, r0 = 30;
  const goesOut = prob >= 0.5;
  const hue = fuel === "Methanol" ? { core: "#bfe6ff", mid: "#38bdf8", edge: "rgba(56,189,248,0)" } : { core: "#fff1c2", mid: "#f59e0b", edge: "rgba(245,158,11,0)" };
  // d²-law shrink: r(t) = r0·sqrt(1 − t/tb)
  const N = 12, endFrac = goesOut ? ratio : 0.06;
  const ts = Array.from({ length: N + 1 }, (_, i) => i / N);
  const rs = ts.map((t) => r0 * Math.sqrt(Math.max(0, 1 - t * (1 - endFrac * endFrac))));
  const burn = 0.08, stop = 0.86;                                   // share of the loop: ignition, end of burn
  const times = [0, burn, ...ts.slice(1).map((t) => burn + t * (stop - burn)), 1];
  const dropR = [r0, r0, ...rs.slice(1), goesOut ? rs[N] : 0];
  const flameR = [0, r0 * 3.1, ...rs.slice(1).map((r) => Math.max(r * 3.1, 8)), goesOut ? rs[N] * 2.2 : 0];
  const flameO = [0, 1, ...ts.slice(1).map((t, i) => (goesOut ? (i >= N - 2 ? 0 : 1) : t > 0.95 ? 0.3 : 1)), 0];
  const id = `fl-${fuel}`;
  const loop = { duration: 6.5, times, repeat: Infinity, repeatDelay: 1.2, ease: "linear" as const };
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="h-[240px] w-full" role="img"
      aria-label={untested ? "No prediction: NASA has not tested this atmosphere" : `Illustration: ${goesOut ? `the flame goes out early, leaving about ${Math.round(ratio * 100)}% of the droplet` : "the flame keeps burning until the droplet is gone"}`}>
      <defs>
        <radialGradient id={id}><stop offset="0.55" stopColor={hue.edge} /><stop offset="0.8" stopColor={hue.mid} stopOpacity="0.55" /><stop offset="0.9" stopColor={hue.core} stopOpacity="0.9" /><stop offset="1" stopColor={hue.edge} /></radialGradient>
        <radialGradient id={`${id}-d`} cx="0.38" cy="0.35"><stop offset="0" stopColor="#f1f5fb" /><stop offset="1" stopColor="#8fa3bf" /></radialGradient>
      </defs>
      <line x1={c - 120} y1={c} x2={c - r0 - 4} y2={c} stroke="#2a3b5c" strokeWidth={2} />
      {untested ? (
        <>
          <circle cx={c} cy={c} r={r0 * 3.1} fill="none" stroke="#3a4b6a" strokeWidth={2} strokeDasharray="6 8" />
          <circle cx={c} cy={c} r={r0} fill={`url(#${id}-d)`} opacity={0.5} />
          <text x={c} y={c + 8} textAnchor="middle" fontSize={26} fontWeight={700} fill="#0b1220">?</text>
        </>
      ) : (
        <>
          <motion.circle key={`f-${fuel}-${goesOut}-${ratio}`} cx={c} cy={c} fill={`url(#${id})`} initial={{ r: 0, opacity: 0 }} animate={{ r: flameR, opacity: flameO }} transition={loop} />
          <motion.circle key={`d-${fuel}-${goesOut}-${ratio}`} cx={c} cy={c} fill={`url(#${id}-d)`} initial={{ r: r0 }} animate={{ r: dropR }} transition={loop} />
        </>
      )}
      <text x={c} y={S - 10} textAnchor="middle" fontSize={11} fill="#93a3bf">
        {untested ? "No prediction outside NASA’s tested conditions" : ratioN > 0 && goesOut ? `Droplet left: ${Math.round(ratio * 100)}% of its size (median of ${ratioN} NASA tests)` : "Illustration of the model’s most likely outcome"}
      </text>
    </svg>
  );
}

function AtmosphereMap({ model, fuel, d0, pts, sel, onPick }: { model: FlexModel; fuel: Fuel; d0: number; pts: FlexPoint[]; sel: { o2: number; psi: number }; onPick: (o2: number, psi: number) => void }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hov, setHov] = useState<{ o2: number; psi: number } | null>(null);
  const H = 360, ml = 48, mr = 16, mt = 14, mb = 40;
  const iw = Math.max(0, w - ml - mr), ih = H - mt - mb;
  const sx = (v: number) => ml + ((v - X0) / (X1 - X0)) * iw, sy = (v: number) => mt + (1 - (v - Y0) / (Y1 - Y0)) * ih;
  const minP = model.ranges.p[0] * PSI, maxO2 = model.ranges.o2[1], minO2 = model.ranges.o2[0];
  const tested = (o2: number, psi: number) => psi >= minP - 1e-6 && o2 <= maxO2 && o2 >= minO2;
  const dx = 0.25, dy = 1;
  const cells = useMemo(() => {
    const out: { psi: number; o2: number; p: number | null }[] = [];
    for (let psi = X0; psi < X1 - 1e-9; psi += dx) for (let o2 = Y0; o2 < Y1 - 1e-9; o2 += dy) {
      const cp = psi + dx / 2, co = o2 + dy / 2;
      out.push({ psi, o2, p: tested(co, cp) ? predict(model, { o2: co, p: cp / PSI, heptane: fuel === "Heptane" ? 1 : 0, co2: 0, he: 0, d0 }) : null });
    }
    return out;
  }, [model, fuel, d0]); // eslint-disable-line react-hooks/exhaustive-deps
  const dots = pts.filter((t) => t.fuel === fuel && t.diluent === "N2" && t.pAtm !== null && t.pAtm * PSI <= X1 && t.pAtm * PSI >= X0);
  const hp = hov && tested(hov.o2, hov.psi) ? predict(model, { o2: hov.o2, p: hov.psi / PSI, heptane: fuel === "Heptane" ? 1 : 0, co2: 0, he: 0, d0 }) : null;
  const pick = (e: React.MouseEvent<SVGSVGElement>, click: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    const psi = X0 + ((e.clientX - r.left - ml) / iw) * (X1 - X0), o2 = Y0 + (1 - (e.clientY - r.top - mt) / ih) * (Y1 - Y0);
    if (psi < X0 || psi > X1 || o2 < Y0 || o2 > Y1) { setHov(null); return; }
    const v = { psi: Math.round(psi * 10) / 10, o2: Math.round(o2 * 2) / 2 };
    setHov(v); if (click) onPick(v.o2, v.psi);
  };
  return (
    <div ref={ref}>
      {w > 0 && (
        <svg width={w} height={H} className="cursor-crosshair" role="img" aria-label="Map of predicted flame-out chance by oxygen and cabin pressure, with NASA tests, the habitat target and NASA exploration atmospheres"
          onMouseMove={(e) => pick(e, false)} onMouseLeave={() => setHov(null)} onClick={(e) => pick(e, true)}>
          <defs>
            <pattern id="untested" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#0d1526" /><line x1="0" y1="0" x2="0" y2="8" stroke="#24324c" strokeWidth="3" /></pattern>
          </defs>
          {cells.map((c) => (
            <rect key={`${c.psi}-${c.o2}`} x={sx(c.psi)} y={sy(c.o2 + dy)} width={sx(c.psi + dx) - sx(c.psi) + 0.5} height={sy(c.o2) - sy(c.o2 + dy) + 0.5} fill={c.p === null ? "url(#untested)" : heat(c.p)} />
          ))}
          {/* untested labels */}
          <text x={sx((X0 + minP) / 2)} y={sy(21)} textAnchor="middle" fontSize={11} fill="#7d8fa6" transform={`rotate(-90 ${sx((X0 + minP) / 2)} ${sy(21)})`}>Below NASA’s tested pressure</text>
          <text x={sx(12.8)} y={sy(37.2)} textAnchor="middle" fontSize={11} fill="#7d8fa6">Above NASA’s tested oxygen</text>
          {/* habitat target */}
          <rect x={sx(X0)} y={sy(Y1)} width={sx(TARGET.psi) - sx(X0)} height={sy(TARGET.o2) - sy(Y1)} fill="none" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6 5" />
          <text x={sx(X0) + 6} y={sy(Y1) + 16} fontSize={11} fontWeight={600} fill="#7dd3fc">Moon-base target</text>
          {/* 50% contour hint: grid lines */}
          {[10, 12, 14].map((t) => <line key={t} x1={sx(t)} x2={sx(t)} y1={mt + ih} y2={mt + ih + 4} stroke="#2a3b5c" />)}
          {/* real tests */}
          {dots.map((t, i) => (
            <circle key={t.id} cx={sx((t.pAtm as number) * PSI) + ((i % 5) - 2) * 2.2} cy={sy(t.o2) + ((Math.floor(i / 5) % 3) - 1) * 2.2} r={3.4} fill={OUTCOME[t.end].color} stroke="#e6ecf5" strokeWidth={1} />
          ))}
          {/* NASA atmospheres */}
          {PRESETS.filter((p) => p.key !== "near").map((p) => (
            <g key={p.key}>
              <rect x={sx(p.psi) - 6} y={sy(p.o2) - 6} width={12} height={12} transform={`rotate(45 ${sx(p.psi)} ${sy(p.o2)})`} fill="#f8fafc" stroke="#0b1220" strokeWidth={2} />
              <text x={p.psi > 13 ? sx(p.psi) - 12 : sx(p.psi) + 12} y={sy(p.o2) + 4} textAnchor={p.psi > 13 ? "end" : "start"} fontSize={11} fontWeight={600} fill="#e6ecf5">{p.o2}% · {p.psi} psi</text>
            </g>
          ))}
          {/* selection */}
          <circle cx={sx(sel.psi)} cy={sy(sel.o2)} r={10} fill="none" stroke="#f8fafc" strokeWidth={2.5} />
          {/* axes */}
          <line x1={ml} x2={ml + iw} y1={mt + ih} y2={mt + ih} stroke="#2a3b5c" />
          {[8, 9, 10, 11, 12, 13, 14, 15].map((t) => <text key={t} x={sx(t)} y={mt + ih + 16} textAnchor="middle" fontSize={11} fill="#93a3bf">{t}</text>)}
          <text x={ml + iw} y={H - 4} textAnchor="end" fontSize={11} fill="#93a3bf">Cabin pressure (psi)</text>
          {[12, 16, 20, 24, 28, 32, 36, 40].map((t) => <text key={t} x={ml - 8} y={sy(t) + 4} textAnchor="end" fontSize={11} fill="#93a3bf">{t}%</text>)}
          <text x={10} y={mt + 2} fontSize={11} fill="#93a3bf" transform={`rotate(-90 10 ${mt + 2})`} textAnchor="end">Oxygen</text>
        </svg>
      )}
      <div className="mt-1 min-h-5 text-xs text-ink-300" aria-live="polite">
        {hov ? (hp !== null ? <>{hov.o2}% O₂ at {hov.psi} psi: <span className="text-ink-100">{Math.round(hp * 100)}%</span> predicted chance of flame-out. Click to load it.</> : <>{hov.o2}% O₂ at {hov.psi} psi: not tested by NASA, so no prediction. Click to see the gap.</>) : "Point anywhere on the map, or click to load that atmosphere."}
      </div>
    </div>
  );
}

export function FireLab({ model, points }: { model: FlexModel; points: FlexPoint[] }) {
  const [fuel, setFuel] = useState<Fuel>("Methanol");
  const [d0, setD0] = useState(3.0);
  const [sel, setSel] = useState({ o2: 34, psi: 10.4 });
  const minP = model.ranges.p[0] * PSI, maxO2 = model.ranges.o2[1];
  const untestedWhy = sel.psi < minP - 1e-6 ? `NASA’s FLEX tests never went below ${minP.toFixed(2)} psi.` : sel.o2 > maxO2 ? `NASA’s FLEX tests never went above ${maxO2}% oxygen.` : null;
  const prob = predict(model, { o2: sel.o2, p: sel.psi / PSI, heptane: fuel === "Heptane" ? 1 : 0, co2: 0, he: 0, d0 });
  const near = points.filter((t) => t.fuel === fuel && t.diluent === "N2" && t.pAtm !== null && Math.abs(t.o2 - sel.o2) <= 2 && Math.abs(t.pAtm * PSI - sel.psi) <= 1.5);
  const nearOut = near.filter((t) => t.end === "Extinction").length;
  const ratios = points.filter((t) => t.fuel === fuel && t.end === "Extinction" && t.dExt !== null && t.d0 && Math.abs(t.o2 - sel.o2) <= 3).map((t) => (t.dExt as number) / (t.d0 as number)).sort((a, b) => a - b);
  const ratio = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0.6;
  const inTarget = sel.o2 >= TARGET.o2 && sel.psi <= TARGET.psi;

  return (
    <div className="space-y-6 px-5 py-6 md:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-400">Load an atmosphere:</span>
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => setSel({ o2: p.o2, psi: p.psi })} aria-pressed={sel.o2 === p.o2 && sel.psi === p.psi}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${sel.o2 === p.o2 && sel.psi === p.psi ? "border-accent/60 bg-accent/15 text-ink-100" : "border-ink-700 text-ink-300 hover:border-accent/50 hover:text-ink-100"}`}>
            {p.label}: {p.o2}%, {p.psi} psi
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard
          title="Where fires go out, across habitat atmospheres"
          description={`Chance a ${fuel.toLowerCase()} droplet flame goes out early (${d0.toFixed(1)} mm, nitrogen as the other gas). Dots: real NASA tests. Diamonds: atmospheres NASA has considered for crews. Hatched: never tested, so no prediction.`}
          count={`${model.n} tests trained on`}
          legend={<div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-xs text-ink-300"><span>Chance of flame-out:</span><span className="h-2.5 w-28 rounded-sm" style={{ background: `linear-gradient(90deg, ${heat(0)}, ${heat(0.5)}, ${heat(1)})` }} /><span>0% to 100%</span></span>
            <Legend items={OUTCOME_ORDER.map((k) => ({ color: OUTCOME[k].color, label: `NASA test: ${OUTCOME[k].label.toLowerCase()}` }))} />
          </div>}
          footer={<>Model: logistic regression on {model.n} FLEX tests (DOI 10.60555/mbq8-0451), 83% accurate on tests it hadn&apos;t seen. NASA exploration atmospheres from the ACME BRE catalog entry (PSI-20, DOI 10.60555/vb93-3y72). Moon-base target from the challenge brief.</>}
          table={<DataTable head={["Atmosphere", "Oxygen", "Pressure", "Predicted chance of flame-out"]} rows={PRESETS.map((p) => {
            const ok = p.psi >= minP - 1e-6 && p.o2 <= maxO2;
            return [p.label, `${p.o2}%`, `${p.psi} psi`, ok ? `${Math.round(predict(model, { o2: p.o2, p: p.psi / PSI, heptane: fuel === "Heptane" ? 1 : 0, co2: 0, he: 0, d0 }) * 100)}%` : "not tested, no prediction"];
          })} />}
        >
          <AtmosphereMap model={model} fuel={fuel} d0={d0} pts={points} sel={sel} onPick={(o2, psi) => setSel({ o2, psi })} />
        </ChartCard>

        <Card className="flex flex-col p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="text-sm text-ink-300">Selected atmosphere</div>
            {inTarget && <Badge tone="accent">Inside the Moon-base target</Badge>}
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-ink-100">{sel.o2}% oxygen at {sel.psi} psi</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["Methanol", "Heptane"] as Fuel[]).map((f) => (
              <button key={f} type="button" onClick={() => setFuel(f)} aria-pressed={fuel === f}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${fuel === f ? "border-accent/60 bg-accent/15 text-ink-100" : "border-ink-700 text-ink-300 hover:border-ink-500"}`}>{f}</button>
            ))}
          </div>
          <label className="mt-3 block text-sm text-ink-300">
            <span className="flex justify-between"><span>Droplet size</span><span className="tabular-nums text-ink-100">{d0.toFixed(1)} mm</span></span>
            <input type="range" min={1.2} max={4.6} step={0.1} value={d0} onChange={(e) => setD0(Number(e.target.value))} className="mt-1 w-full accent-sky-400" />
          </label>

          <div className="mt-2 rounded-lg border border-ink-800 bg-[#070c16]">
            <Flame fuel={fuel} prob={prob} ratio={ratio} ratioN={ratios.length} untested={!!untestedWhy} />
          </div>

          {untestedWhy ? (
            <div className="mt-4 space-y-2 text-sm">
              <div className="text-lg font-semibold text-ink-100">NASA hasn&apos;t tested this atmosphere</div>
              <p className="text-ink-300">{untestedWhy} So Astraxis won&apos;t guess. This is one of the evidence gaps a future ISS experiment could close.</p>
              <div className="flex flex-wrap gap-4 pt-1 text-sm">
                <Link href="/gaps" className="text-accent hover:underline">See the evidence gaps</Link>
                <button type="button" onClick={() => setSel({ o2: 34, psi: 10.4 })} className="text-accent hover:underline">Load the nearest tested atmosphere</button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-semibold tabular-nums text-ink-100">{Math.round(prob * 100)}%</span>
                <span className="text-ink-300">predicted chance the flame goes out early</span>
              </div>
              <p className="text-ink-300">{prob >= 0.5 ? "Most likely: the flame goes out before the droplet is used up." : "Most likely: the flame keeps burning until the droplet burns away or breaks apart."}</p>
              <p className="text-ink-300">
                <Badge tone={near.length >= 5 ? "accent" : near.length >= 2 ? "neutral" : "warn"}>{near.length >= 5 ? "Strong data support" : near.length >= 2 ? "Some data support" : "Thin data support"}</Badge>{" "}
                {near.length ? `${near.length} similar NASA test${near.length > 1 ? "s" : ""} nearby: ${nearOut} flame${nearOut === 1 ? "" : "s"} went out.` : "No NASA test sits close to this atmosphere, so treat it as an interpolation."}
              </p>
            </div>
          )}
          <p className="mt-auto pt-4 text-xs leading-relaxed text-ink-400">The flame animation illustrates the model&apos;s most likely outcome for a single droplet in microgravity; it is not a simulation. Methanol is drawn with a faint blue flame and heptane with a sooty yellow one. Results don&apos;t transfer to lunar or Martian gravity. <Link href="/model" className="text-accent hover:underline">How the model works</Link></p>
        </Card>
      </div>
    </div>
  );
}
