"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CHART } from "@/lib/palette";
import { AxisX, GridY, linear, niceTicks, Tooltip, useWidth, type TipState } from "./core";

export interface ScatterPoint {
  id: string;           // record_id, used for the Explorer deep link
  panel: string;
  x: number;
  y: number;
  color: string;
  tip: ReactNode;
}

const H = 296, M = { t: 26, r: 10, b: 44, l: 46 }, GAP = 28;

export function ScatterPanels({
  points, panels, xDomain, yDomain, xLabel, yLabel, yFormat = (v: number) => String(v), maxCols = 3,
}: {
  points: ScatterPoint[]; panels: string[]; xDomain: [number, number]; yDomain: [number, number];
  xLabel: string; yLabel: string; yFormat?: (v: number) => string; maxCols?: number;
}) {
  const router = useRouter();
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const cols = w < 640 ? 1 : Math.min(panels.length, maxCols);
  const pw = cols ? (w - GAP * (cols - 1)) / cols : 0;
  const iw = Math.max(0, pw - M.l - M.r), ih = H - M.t - M.b;
  const x = linear(xDomain, [0, iw]);
  const y = linear(yDomain, [ih, 0]);
  const xt = niceTicks(xDomain[0], xDomain[1], Math.max(3, Math.floor(iw / 70)));
  const yt = niceTicks(yDomain[0], yDomain[1], 5);

  const byPanel = useMemo(() => {
    const m: Record<string, ScatterPoint[]> = {};
    for (const p of points) (m[p.panel] ??= []).push(p);
    return m;
  }, [points]);

  function nearest(panel: string, mx: number, my: number) {
    let best: ScatterPoint | null = null, bd = 24 * 24; // 24px nearest-point hit radius
    for (const p of byPanel[panel] ?? []) {
      const d = (x(p.x) - mx) ** 2 + (y(p.y) - my) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  return (
    <div ref={ref} className="relative" onPointerLeave={() => { setTip(null); setActive(null); }}>
      {w > 0 && (
        <div className="grid gap-y-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: GAP }}>
          {panels.map((panel) => {
            const pts = byPanel[panel] ?? [];
            return (
              <div key={panel}>
                <div className="mb-1 flex items-baseline justify-between pl-[46px] text-sm">
                  <span className="font-medium text-ink-100">{panel}</span>
                  <span className="text-xs tabular-nums text-ink-400">{pts.length} tests</span>
                </div>
                <svg
                  width={pw} height={H} role="img" aria-label={`${panel}: ${yLabel} against ${xLabel}`}
                  onPointerMove={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const p = nearest(panel, e.clientX - r.left - M.l, e.clientY - r.top - M.t);
                    const host = (ref.current as HTMLDivElement).getBoundingClientRect();
                    if (!p) { setTip(null); setActive(null); return; }
                    setActive(p.id);
                    setTip({ x: r.left - host.left + M.l + x(p.x), y: r.top - host.top + M.t + y(p.y), content: <>{p.tip}<div className="mt-1.5 text-[11px] text-accent">Click to open in Explorer</div></> });
                  }}
                  onClick={() => active && router.push(`/explorer?test=${encodeURIComponent(active)}`)}
                  style={{ cursor: active ? "pointer" : "default" }}
                >
                  <g transform={`translate(${M.l},${M.t})`}>
                    <GridY ticks={yt} y={y} width={iw} format={yFormat} />
                    <AxisX ticks={xt} x={x} y={ih} label={xLabel} width={iw} />
                    <text x={-M.l + 2} y={-14} fontSize={11} fill={CHART.muted}>{yLabel}</text>
                    <AnimatePresence initial={false}>
                      {pts.map((p) => (
                        <motion.circle
                          key={p.id}
                          initial={{ r: 0, cx: x(p.x), cy: y(p.y) }}
                          animate={{ r: active === p.id ? 6 : 4, cx: x(p.x), cy: y(p.y), opacity: active && active !== p.id ? 0.45 : 0.92 }}
                          exit={{ r: 0, opacity: 0 }}
                          transition={{ cx: { type: "spring", stiffness: 170, damping: 22 }, cy: { type: "spring", stiffness: 170, damping: 22 }, r: { type: "tween", duration: 0.2 }, opacity: { duration: 0.2 } }}
                          fill={p.color}
                          stroke={CHART.surface}
                          strokeWidth={1.5}
                        />
                      ))}
                    </AnimatePresence>
                  </g>
                </svg>
              </div>
            );
          })}
        </div>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}
