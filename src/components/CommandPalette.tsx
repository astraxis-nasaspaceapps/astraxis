"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

export interface TestIndexEntry { id: string; testId: string; acronym: string; label: string }

type Item = { key: string; group: string; title: string; hint?: string; href: string };

const PAGES: Item[] = [
  { key: "p-overview", group: "Go to", title: "Overview", hint: "Every FLEX test at a glance", href: "/" },
  { key: "p-explorer", group: "Go to", title: "Experiment Explorer", hint: "Filter and inspect all 403 tests", href: "/explorer" },
  { key: "p-compare", group: "Go to", title: "Compare", hint: "Charts: outcome, flame-out size, burning rate vs oxygen", href: "/compare" },
  { key: "p-habitat", group: "Go to", title: "Habitat conditions", hint: "Tests nearest to Moon-base air: 30% O₂ or more at about 0.7 atm", href: "/habitat" },
  { key: "p-materials", group: "Go to", title: "Spacecraft materials (SAFFIRE)", hint: "Silicone, PMMA and fabric burned in orbit vs normal gravity", href: "/materials" },
  { key: "p-investigations", group: "Go to", title: "Investigations ranked", hint: "All 24 PSI combustion investigations ranked for habitat fire safety", href: "/investigations" },
  { key: "p-model", group: "Go to", title: "Flame-out model", hint: "Predict flame-out from oxygen, pressure, gas, fuel and droplet size", href: "/model" },
  { key: "p-assistant", group: "Go to", title: "Research Assistant", hint: "Ask a question, get cited NASA evidence", href: "/assistant" },
  { key: "p-sources", group: "Go to", title: "Sources and data notes", hint: "DOIs, files, units, cleaning decisions", href: "/sources" },
];

const PaletteCtx = createContext<{ open: () => void }>({ open: () => {} });
export const usePalette = () => useContext(PaletteCtx);

export function PaletteProvider({ tests, children }: { tests: TestIndexEntry[]; children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") !== null);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PaletteCtx.Provider value={{ open }}>
      {children}
      <AnimatePresence>{isOpen && <Palette tests={tests} onClose={() => setOpen(false)} />}</AnimatePresence>
    </PaletteCtx.Provider>
  );
}

function Palette({ tests, onClose }: { tests: TestIndexEntry[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase();
    const pages = s ? PAGES.filter((p) => `${p.title} ${p.hint}`.toLowerCase().includes(s)) : PAGES;
    const words = s.split(/\s+/).filter(Boolean);
    const hits = words.length
      ? tests
          .filter((t) => { const hay = `${t.testId} ${t.acronym} ${t.label}`.toLowerCase(); return words.every((w) => hay.includes(w)); })
          .sort((a, b) => Number(!a.testId.toLowerCase().startsWith(s)) - Number(!b.testId.toLowerCase().startsWith(s)))
          .slice(0, 7)
          .map((t) => ({ key: t.id, group: "Tests", title: t.testId, hint: `${t.acronym}, ${t.label}`, href: `/explorer?test=${encodeURIComponent(t.id)}` }))
      : [];
    const ask: Item[] = s.length > 2
      ? [{ key: "ask", group: "Ask", title: `Ask the assistant: “${q.trim()}”`, hint: "Answer with cited NASA tests", href: `/assistant?q=${encodeURIComponent(q.trim())}` }]
      : [];
    return [...hits, ...pages, ...ask];
  }, [q, tests]);

  const go = (it: Item | undefined) => { if (!it) return; onClose(); router.push(it.href); };

  let lastGroup = "";
  return (
    <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-ink-950/70 px-4 pt-[12vh] backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onMouseDown={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-label="Search Astraxis"
        initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="w-full max-w-xl overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-2xl shadow-black/50" onMouseDown={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); go(items[active]); }
            else if (e.key === "Escape") onClose();
          }}
          placeholder="Jump to a test ID or page, or type a question…"
          className="h-14 w-full border-b border-ink-800 bg-transparent px-5 text-[15px] text-ink-100 outline-none placeholder:text-ink-400" />
        <ul className="scroll-thin max-h-[52vh] overflow-y-auto p-2" role="listbox">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-400">No matches. Try a test ID like 189R001, a fuel, or a material.</li>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.key}>
                {header && <div className="px-3 pt-2 pb-1 text-xs font-semibold text-ink-400">{header}</div>}
                <button role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(it)}
                  className={`flex w-full items-baseline justify-between gap-4 rounded-lg px-3 py-2 text-left transition-colors ${i === active ? "bg-ink-800" : ""}`}>
                  <span className={`${it.group === "Tests" ? "font-mono" : ""} text-sm text-ink-100`}>{it.title}</span>
                  {it.hint && <span className="truncate text-xs text-ink-400">{it.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-4 border-t border-ink-800 px-4 py-2 text-[11px] text-ink-400">
          <span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
