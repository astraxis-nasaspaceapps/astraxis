"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CHART } from "@/lib/palette";

/* ---------- scales ---------- */
export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain, [r0, r1] = range;
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 1) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/* ---------- measure width ---------- */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------- tooltip ---------- */
export interface TipState { x: number; y: number; content: ReactNode }

export function Tooltip({ tip, width }: { tip: TipState | null; width: number }) {
  return (
    <AnimatePresence>
      {tip && (
        <motion.div
          key="tip"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0, left: Math.min(Math.max(tip.x + 14, 8), width - 236), top: tip.y - 12 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="pointer-events-none absolute z-20 w-56 rounded-md border border-ink-700 bg-ink-950/95 px-3 py-2 text-xs shadow-xl shadow-black/40 backdrop-blur"
        >
          {tip.content}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="flex items-center gap-1.5 text-ink-300">
        {color && <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />}
        {label}
      </span>
      <span className="tabular-nums font-medium text-ink-100">{value}</span>
    </div>
  );
}

/* ---------- legend ---------- */
export function Legend({ items, shape = "dot" }: { items: { color: string; label: string; muted?: boolean }[]; shape?: "dot" | "rect" }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300">
      {items.map((i) => (
        <li key={i.label} className={`flex items-center gap-1.5 transition-opacity ${i.muted ? "opacity-35" : ""}`}>
          <span className={shape === "dot" ? "h-2.5 w-2.5 rounded-full" : "h-2.5 w-3 rounded-[2px]"} style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* ---------- axes ---------- */
export function AxisX({ ticks, x, y, label, width, format = String }: { ticks: number[]; x: (v: number) => number; y: number; label: string; width: number; format?: (v: number) => string }) {
  return (
    <g className="tabular-nums" fontSize={11} fill={CHART.muted}>
      <line x1={0} x2={width} y1={y} y2={y} stroke={CHART.axis} />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={y + 16} textAnchor="middle">{format(t)}</text>
      ))}
      <text x={width} y={y + 34} textAnchor="end" fill={CHART.muted}>{label}</text>
    </g>
  );
}

export function GridY({ ticks, y, width, format = String }: { ticks: number[]; y: (v: number) => number; width: number; format?: (v: number) => string }) {
  return (
    <g className="tabular-nums" fontSize={11} fill={CHART.muted}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={0} x2={width} y1={y(t)} y2={y(t)} stroke={CHART.grid} />
          <text x={-8} y={y(t) + 4} textAnchor="end">{format(t)}</text>
        </g>
      ))}
    </g>
  );
}

/* ---------- chart card ---------- */
export function ChartCard({
  title, description, children, legend, footer, table, count,
}: {
  title: string; description: ReactNode; children: ReactNode; legend?: ReactNode;
  footer: ReactNode; table: ReactNode; count?: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className="rounded-xl border border-ink-800 bg-ink-850/60 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-[17px] font-semibold text-ink-100">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-300">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          {count && <span className="text-xs tabular-nums text-ink-400">{count}</span>}
          <button
            onClick={() => setShowTable((s) => !s)}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-200 transition-colors hover:border-accent/50 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-accent"
            aria-pressed={showTable}
          >
            {showTable ? "Show chart" : "Show table"}
          </button>
        </div>
      </div>
      {legend && <div className="mt-4">{legend}</div>}
      <div className="mt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={showTable ? "t" : "c"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {showTable ? <div className="scroll-thin max-h-96 overflow-auto">{table}</div> : children}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 border-t border-ink-800 pt-3 text-xs leading-relaxed text-ink-400">{footer}</div>
    </section>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-xs tabular-nums">
      <thead className="sticky top-0 bg-ink-850 text-ink-400">
        <tr>{head.map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr>
      </thead>
      <tbody className="text-ink-200">
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-ink-800">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
