"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "./Logo";
import { usePalette } from "./CommandPalette";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/lab", label: "Habitat Fire Lab" },
  { href: "/explorer", label: "Experiment Explorer" },
  { href: "/compare", label: "Compare" },
  { href: "/habitat", label: "Habitat conditions" },
  { href: "/materials", label: "Spacecraft materials" },
  { href: "/investigations", label: "Investigations ranked" },
  { href: "/model", label: "Flame-out model" },
  { href: "/gaps", label: "Evidence gaps" },
  { href: "/assistant", label: "Research Assistant" },
  { href: "/sources", label: "Sources and data notes" },
];

const isActive = (active: string | null, href: string) => active !== null && (href === "/" ? active === "/" : active.startsWith(href));

function SearchButton({ className = "" }: { className?: string }) {
  const { open } = usePalette();
  return (
    <button onClick={open} className={`flex items-center gap-2 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-left text-sm text-ink-400 transition-colors hover:border-accent/40 hover:text-ink-200 ${className}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="9" cy="9" r="5.5" /><path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" /></svg>
      <span className="flex-1 whitespace-nowrap">Search…</span>
      <kbd className="whitespace-nowrap rounded border border-ink-700 px-1.5 text-[10px] text-ink-400">Ctrl K</kbd>
    </button>
  );
}

function NavLinks({ active, layoutId, onNavigate }: { active: string | null; layoutId: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => {
        const on = isActive(active, n.href);
        return (
          <Link key={n.href} href={n.href} onClick={onNavigate} aria-current={on ? "page" : undefined}
            className={`relative rounded-md px-3 py-2 text-sm transition-colors ${on ? "text-ink-100" : "text-ink-300 hover:text-ink-100"}`}>
            {on && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-md bg-ink-800 shadow-[inset_2px_0_0_var(--color-accent)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
            <span className="relative">{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function Shell({ active }: { active: string | null }) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900 md:flex">
        <Link href="/" className="block px-5 pt-6 pb-6"><Logo /></Link>
        <div className="px-3 pb-4"><SearchButton className="w-full" /></div>
        <div className="px-3"><NavLinks active={active} layoutId="nav-active" /></div>
        <div className="mt-auto border-t border-ink-800 px-5 py-4 text-xs leading-relaxed text-ink-400">
          Data from NASA Physical Sciences Informatics, PSI-69 and PSI-25 (CC0-1.0).
          <br />
          Built for NASA Space Apps 2026, Flame in Freefall.
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink-800 bg-ink-900/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/"><Logo compact /></Link>
        <div className="flex items-center gap-2">
          <SearchButton className="!px-2.5 [&>span]:hidden [&>kbd]:hidden" />
          <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Menu"
            className="rounded-md border border-ink-700 px-2.5 py-2 text-ink-200">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" /></svg>
          </button>
        </div>
      </header>
      <AnimatePresence>
        {menu && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}
            className="sticky top-[57px] z-30 border-b border-ink-800 bg-ink-900 px-3 py-2 md:hidden">
            <NavLinks active={active} layoutId="nav-active-mobile" onNavigate={() => setMenu(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function Sidebar() {
  return <Shell active={usePathname()} />;
}

export function SidebarFallback() {
  return <Shell active={null} />;
}
