import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="border-b border-ink-800 px-5 pt-8 pb-6 md:px-8">
      {eyebrow && <div className="mb-1 text-sm text-accent">{eyebrow}</div>}
      <h1 className="text-[28px] font-semibold tracking-[-0.01em] text-ink-100">{title}</h1>
      {children && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">{children}</div>}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-ink-800 bg-ink-900 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" }) {
  const t =
    tone === "accent"
      ? "border-accent/30 bg-accent/10 text-accent"
      : tone === "warn"
        ? "border-warn/30 bg-warn/10 text-warn"
        : "border-ink-700 bg-ink-850 text-ink-300";
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>;
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div>
      <div className="text-xs text-ink-400">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold text-ink-100">{value}</div>
      {note && <div className="mt-0.5 text-xs text-ink-400">{note}</div>}
    </div>
  );
}
