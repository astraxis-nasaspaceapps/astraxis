"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { CHART, OUTCOME, OUTCOME_ORDER, type OutcomeKey } from "@/lib/palette";
import { AxisX, GridY, linear, Tooltip, TipRow, useWidth, type TipState } from "./core";

export interface OutcomeBin { label: string; lo: number; counts: Record<OutcomeKey, number>; total: number }

const H = 260, M = { t: 22, r: 8, b: 40, l: 44 };

export function OutcomeBars({ bins }: { bins: OutcomeBin[] }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const iw = Math.max(0, w - M.l - M.r), ih = H - M.t - M.b;
  const band = bins.length ? iw / bins.length : 0;
  const bw = Math.min(56, band * 0.62);
  const y = linear([0, 1], [ih, 0]);

  return (
    <div ref={ref} className="relative" onPointerLeave={() => { setTip(null); setHover(null); }}>
      {w > 0 && (
        <svg width={w} height={H} role="img" aria-label="Share of FLEX test outcomes by initial oxygen level">
          <g transform={`translate(${M.l},${M.t})`}>
            <GridY ticks={[0, 0.25, 0.5, 0.75, 1]} y={y} width={iw} format={(v) => `${v * 100}%`} />
            {bins.map((b, i) => {
              const cx = band * i + band / 2;
              let acc = 0;
              const segs = OUTCOME_ORDER.filter((k) => b.counts[k] > 0).map((k) => {
                const share = b.counts[k] / b.total;
                const seg = { k, y0: acc, y1: acc + share };
                acc += share;
                return seg;
              });
              return (
                <g key={b.label}>
                  {segs.map((s, si) => {
                    const top = y(s.y1), h = y(s.y0) - y(s.y1);
                    const gap = si < segs.length - 1 ? 2 : 0; // 2px surface gap between stacked fills
                    const isTop = si === segs.length - 1;
                    const key = `${b.label}-${s.k}`;
                    return (
                      <motion.path
                        key={s.k}
                        initial={false}
                        animate={{ d: segPath(cx - bw / 2, top + gap, bw, Math.max(0, h - gap), isTop ? 4 : 0), opacity: hover && hover !== key ? 0.55 : 1 }}
                        transition={{ type: "spring", stiffness: 140, damping: 22 }}
                        fill={OUTCOME[s.k].color}
                        onPointerMove={(e) => {
                          const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                          setHover(key);
                          setTip({
                            x: e.clientX - r.left, y: e.clientY - r.top,
                            content: (
                              <>
                                <div className="mb-1 text-ink-100">{b.label} initial O₂</div>
                                <TipRow color={OUTCOME[s.k].color} label={OUTCOME[s.k].label} value={`${b.counts[s.k]} of ${b.total}`} />
                                <TipRow label="Share" value={`${Math.round((b.counts[s.k] / b.total) * 100)}%`} />
                              </>
                            ),
                          });
                        }}
                        style={{ cursor: "default" }}
                      />
                    );
                  })}
                  <text x={cx} y={-8} textAnchor="middle" fontSize={11} fill={CHART.muted} className="tabular-nums">n={b.total}</text>
                </g>
              );
            })}
            <g fontSize={11} fill={CHART.muted} className="tabular-nums">
              <line x1={0} x2={iw} y1={ih} y2={ih} stroke={CHART.axis} />
              {bins.map((b, i) => <text key={b.label} x={band * i + band / 2} y={ih + 16} textAnchor="middle">{b.label}</text>)}
              <text x={iw} y={ih + 34} textAnchor="end">Initial O₂ (%, 2-point bins)</text>
            </g>
          </g>
        </svg>
      )}
      <Tooltip tip={tip} width={w} />
    </div>
  );
}

// bar segment with optional rounded top corners (data end), square at the baseline side
function segPath(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  if (rr <= 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export { AxisX };
