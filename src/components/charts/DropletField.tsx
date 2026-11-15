"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { CHART, OUTCOME, OUTCOME_ORDER, type OutcomeKey } from "@/lib/palette";
import { Legend, Tooltip, TipRow, useWidth, type TipState } from "./core";

export interface DropletDot { id: string; testId: string; o2: number; end: OutcomeKey; fuel: string; diluent: string }

const M = { t: 8, b: 40, l: 4, r: 4 };

/**
 * One dot per FLEX test. Dots are grouped into whole-percent O2 columns and stacked
 * by outcome (flame out at the base). The single orchestrated load animation in the app.
 */
export function DropletField({ dots }: { dots: DropletDot[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [active, setActive] = useState<string | null>(null);
  // tighter dots on narrow screens so columns stay short
  const PITCH = w && w < 700 ? 6 : 10, R = w && w < 700 ? 2.3 : 3.6;

  const layout = useMemo(() => {
    const lo = 11, hi = 35;
    const iw = Math.max(0, w - M.l - M.r);
    const colW = iw / (hi - lo + 1);
    const perRow = Math.max(1, Math.floor((colW - 2) / PITCH));
    const groups = new Map<number, DropletDot[]>();
    for (const d of dots) {
      const k = Math.round(d.o2);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(d);
    }
    let maxRows = 0;
    const placed: (DropletDot & { cx: number; cy: number; col: number })[] = [];
    for (const [k, ds] of groups) {
      ds.sort((a, b) => OUTCOME_ORDER.indexOf(a.end) - OUTCOME_ORDER.indexOf(b.end) || a.testId.localeCompare(b.testId));
      const left = M.l + (k - lo) * colW + (colW - perRow * PITCH) / 2 + PITCH / 2;
      ds.forEach((d, i) => {
        const row = Math.floor(i / perRow), c = i % perRow;
        maxRows = Math.max(maxRows, row + 1);
        placed.push({ ...d, cx: left + c * PITCH, cy: -row * PITCH, col: k });
      });
    }
    const plotH = Math.max(120, maxRows * PITCH + 6);
    return { placed, plotH, colW, lo, hi, groups };
  }, [dots, w, PITCH]);

  const H = layout.plotH + M.t + M.b;
  const base = M.t + layout.plotH - PITCH / 2;
  const ticks = w && w < 700 ? [12, 18, 24, 30] : [12, 15, 18, 21, 24, 27, 30, 33];

  return (
    <div>
      <div ref={ref} className="relative" onPointerLeave={() => { setTip(null); setActive(null); }}>
        {w > 0 && (
          <svg width={w} height={H} role="img" aria-label="Every FLEX test as a dot, grouped by initial oxygen level and colored by how the test ended">
            {ticks.map((t) => {
              const x = M.l + (t - layout.lo) * layout.colW + layout.colW / 2;
              return (
                <g key={t} fontSize={11} fill={CHART.muted} className="tabular-nums">
                  <line x1={x} x2={x} y1={base + PITCH / 2 + 2} y2={base + PITCH / 2 + 6} stroke={CHART.axis} />
                  <text x={x} y={base + PITCH / 2 + 20} textAnchor="middle">{t}%</text>
                </g>
              );
            })}
            <line x1={M.l} x2={w - M.r} y1={base + PITCH / 2 + 2} y2={base + PITCH / 2 + 2} stroke={CHART.axis} />
            <text x={w - M.r} y={H - 4} textAnchor="end" fontSize={11} fill={CHART.muted}>Initial oxygen in the chamber (%)</text>
            {layout.placed.map((d) => (
              <motion.circle
                key={d.id}
                cx={d.cx}
                initial={reduce ? false : { cy: base - 140, opacity: 0 }}
                animate={{ cy: base + d.cy, opacity: active && active !== d.id ? 0.5 : 1, r: active === d.id ? R + 1.6 : R }}
                transition={{
                  cy: reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 16, delay: 0.25 + (d.col - layout.lo) * 0.045 + (-d.cy / PITCH) * 0.012 },
                  opacity: { duration: 0.35, delay: reduce ? 0 : 0.25 + (d.col - layout.lo) * 0.045 },
                  r: { duration: 0.15 },
                }}
                fill={OUTCOME[d.end].color}
                stroke={CHART.surface}
                strokeWidth={1}
                onPointerEnter={(e) => {
                  const host = (ref.current as HTMLDivElement).getBoundingClientRect();
                  const r = (e.currentTarget as SVGCircleElement).getBoundingClientRect();
                  setActive(d.id);
                  setTip({
                    x: r.left - host.left, y: r.top - host.top,
                    content: (
                      <>
                        <div className="mb-1 font-mono text-ink-100">{d.testId}</div>
                        <TipRow color={OUTCOME[d.end].color} label={OUTCOME[d.end].label} value="" />
                        <TipRow label="Initial O₂" value={`${d.o2}%`} />
                        <TipRow label="Fuel" value={d.fuel} />
                        <TipRow label="Added gas" value={d.diluent} />
                        <div className="mt-1.5 text-[11px] text-accent">Click to open this test</div>
                      </>
                    ),
                  });
                }}
                onClick={() => router.push(`/explorer?test=${encodeURIComponent(d.id)}`)}
                style={{ cursor: "pointer" }}
              />
            ))}
          </svg>
        )}
        <Tooltip tip={tip} width={w} />
      </div>
      <div className="mt-3">
        <Legend items={OUTCOME_ORDER.map((k) => ({ color: OUTCOME[k].color, label: `${OUTCOME[k].label} (${dots.filter((d) => d.end === k).length})` }))} />
      </div>
    </div>
  );
}
