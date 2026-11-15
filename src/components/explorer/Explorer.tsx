"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { CleaningLogEntry, FieldDictionary, Investigation, TestRecord } from "@/lib/types";
import { fmt } from "@/lib/format";
import { Badge } from "@/components/ui";
import { DetailPanel } from "./DetailPanel";

type SortKey = "investigation" | "test_id" | "date" | "material" | "o2" | "condition" | "outcome";

interface Props {
  tests: TestRecord[];
  investigations: Investigation[];
  fields: FieldDictionary;
  logByRecord: Record<string, CleaningLogEntry[]>;
}

const uniq = (xs: (string | null | undefined)[]) =>
  [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

function conditionCell(t: TestRecord) {
  if (t.acronym === "FLEX") {
    return { label: `${fmt(t.pressure_atm)} atm, ${t.diluent}`, sort: t.pressure_atm ?? -1 };
  }
  return {
    label: t.airflow_initial_cm_s !== null ? `${fmt(t.airflow_initial_cm_s)} cm/s${t.airflow_changed_during_test ? " →" : ""}` : "—",
    sort: t.airflow_initial_cm_s ?? -1,
  };
}

function outcomeCell(t: TestRecord) {
  if (t.acronym === "FLEX") return t.test_end ?? "—";
  return "Not in table";
}

function searchable(t: TestRecord) {
  return [t.test_id, t.record_id, t.fuel_or_material, t.material_class, t.pi, t.acronym,
    t.acronym === "FLEX" ? t.diluent : t.pi_focus, t.acronym === "FLEX" ? t.test_end : t.flow_configuration]
    .filter(Boolean).join(" ").toLowerCase();
}

export function Explorer({ tests, investigations, fields, logByRecord }: Props) {
  const [q, setQ] = useState("");
  const [inv, setInv] = useState<"all" | "PSI-69" | "PSI-25">("all");
  const [material, setMaterial] = useState("all");
  const [diluent, setDiluent] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [pi, setPi] = useState("all");
  const [o2Min, setO2Min] = useState("");
  const [o2Max, setO2Max] = useState("");
  const [quality, setQuality] = useState<"all" | "clean" | "flagged">("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "investigation", dir: 1 });
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(() => {
    const t = params.get("test");
    return t && tests.some((x) => x.record_id === t) ? t : null;
  });

  const scoped = useMemo(() => tests.filter((t) => inv === "all" || t.investigation_id === inv), [tests, inv]);
  const materials = useMemo(() => uniq(scoped.map((t) => t.acronym === "FLEX" ? t.fuel_or_material : t.material_class)), [scoped]);
  const pis = useMemo(() => uniq(tests.map((t) => t.pi)), [tests]);

  const rows = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const lo = o2Min === "" ? -Infinity : Number(o2Min);
    const hi = o2Max === "" ? Infinity : Number(o2Max);
    const out = scoped.filter((t) => {
      if (words.length) { const s = searchable(t); if (!words.every((w) => s.includes(w))) return false; }
      const mat = t.acronym === "FLEX" ? t.fuel_or_material : t.material_class;
      if (material !== "all" && mat !== material) return false;
      if (diluent !== "all" && (t.acronym !== "FLEX" || t.diluent !== diluent)) return false;
      if (outcome !== "all" && (t.acronym !== "FLEX" || t.test_end !== outcome)) return false;
      if (pi !== "all" && t.pi !== pi) return false;
      if (o2Min !== "" || o2Max !== "") {
        if (t.o2_initial_pct === null || t.o2_initial_pct < lo || t.o2_initial_pct > hi) return false;
      }
      if (quality === "clean" && t.quality_flags.length) return false;
      if (quality === "flagged" && !t.quality_flags.length) return false;
      return true;
    });
    const key = (t: TestRecord): string | number => {
      switch (sort.key) {
        case "investigation": return `${t.acronym === "FLEX" ? 0 : 1}-${String(t.test_number ?? 0).padStart(4, "0")}-${t.pi ?? ""}-${t.test_id}`;
        case "test_id": return t.test_id;
        case "date": return t.date ?? "";
        case "material": return t.fuel_or_material.toLowerCase();
        case "o2": return t.o2_initial_pct ?? -1;
        case "condition": return conditionCell(t).sort;
        case "outcome": return outcomeCell(t);
      }
    };
    const coll = new Intl.Collator(undefined, { numeric: true });
    return out.sort((a, b) => {
      const x = key(a), y = key(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : coll.compare(String(x), String(y));
      return c * sort.dir;
    });
  }, [scoped, q, material, diluent, outcome, pi, o2Min, o2Max, quality, sort]);

  // bring a deep-linked test (from a chart click) into view once
  useEffect(() => {
    const t = params.get("test");
    if (t) document.getElementById(`row-${t}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [params]);

  const selectedTest = selected ? tests.find((t) => t.record_id === selected) ?? null : null;
  const selectedInv = selectedTest ? investigations.find((i) => i.id === selectedTest.investigation_id) ?? null : null;

  const reset = () => { setQ(""); setInv("all"); setMaterial("all"); setDiluent("all"); setOutcome("all"); setPi("all"); setO2Min(""); setO2Max(""); setQuality("all"); };
  const th = (k: SortKey, label: string, cls = "") => (
    <th className={`sticky top-0 z-10 bg-ink-900 px-3 py-2.5 text-left font-medium ${cls}`}>
      <button onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))} className="inline-flex items-center gap-1 hover:text-ink-100">
        {label}<span className="text-ink-600">{sort.key === k ? (sort.dir === 1 ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
  const sel = "h-9 rounded-md border border-ink-700 bg-ink-850 px-2.5 text-sm text-ink-100 outline-none focus:border-accent/60";

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* filters */}
        <div className="space-y-3 border-b border-ink-800 px-8 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search test ID, fuel, material, researcher…" className={`${sel} w-80`} />
            <div className="flex rounded-md border border-ink-700 p-0.5">
              {(["all", "PSI-69", "PSI-25"] as const).map((v) => (
                <button key={v} onClick={() => { setInv(v); setMaterial("all"); }} className={`rounded px-3 py-1.5 text-xs ${inv === v ? "bg-ink-700 text-ink-100" : "text-ink-300 hover:text-ink-100"}`}>
                  {v === "all" ? "All investigations" : v === "PSI-69" ? "FLEX, liquid droplets" : "BASS-II, solids"}
                </button>
              ))}
            </div>
            <span className="ml-auto text-xs tabular-nums text-ink-400">{rows.length} of {tests.length} tests</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-300">
            <select value={material} onChange={(e) => setMaterial(e.target.value)} className={sel} aria-label="Fuel or material">
              <option value="all">Any fuel / material</option>
              {materials.map((m) => <option key={m}>{m}</option>)}
            </select>
            {inv !== "PSI-25" && (
              <>
                <select value={diluent} onChange={(e) => setDiluent(e.target.value)} className={sel} aria-label="Added diluent">
                  <option value="all">Any diluent (FLEX)</option>
                  <option value="N2">N₂ only</option><option value="CO2">CO₂ added</option><option value="He">He added</option>
                </select>
                <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={sel} aria-label="Test end">
                  <option value="all">Any test end (FLEX)</option>
                  <option>Extinction</option><option>Disruption</option><option>Completion</option>
                </select>
              </>
            )}
            {inv !== "PSI-69" && (
              <select value={pi} onChange={(e) => setPi(e.target.value)} className={sel} aria-label="Principal investigator">
                <option value="all">Any researcher (BASS-II)</option>
                {pis.map((p) => <option key={p}>{p}</option>)}
              </select>
            )}
            <span className="ml-1">Initial O₂ %</span>
            <input value={o2Min} onChange={(e) => setO2Min(e.target.value)} inputMode="decimal" placeholder="min" className={`${sel} w-16`} />
            <span>–</span>
            <input value={o2Max} onChange={(e) => setO2Max(e.target.value)} inputMode="decimal" placeholder="max" className={`${sel} w-16`} />
            <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} className={sel} aria-label="Data quality">
              <option value="all">All records</option><option value="clean">No data notes</option><option value="flagged">With data notes</option>
            </select>
            <button onClick={reset} className="ml-1 text-ink-400 underline-offset-2 hover:text-ink-100 hover:underline">Reset</button>
          </div>
        </div>

        {/* table */}
        <div className="scroll-thin min-h-0 flex-1 overflow-auto px-8 pb-6">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="text-xs text-ink-400">
              <tr className="[&>th]:border-b [&>th]:border-ink-800">
                {th("investigation", "Investigation")}
                {th("test_id", "Test ID")}
                {th("date", "Date")}
                {th("material", "Fuel / material")}
                {th("o2", "Initial O₂", "text-right")}
                {th("condition", "Pressure and gas, or airflow")}
                {th("outcome", "Test end")}
                <th className="sticky top-0 z-10 bg-ink-900 px-3 py-2.5 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const c = conditionCell(t);
                const active = t.record_id === selected;
                return (
                  <tr key={t.record_id} id={`row-${t.record_id}`} onClick={() => setSelected(t.record_id)}
                    className={`cursor-pointer transition-colors duration-150 [&>td]:border-b [&>td]:border-ink-850 [&>td]:px-3 [&>td]:py-2 ${active ? "bg-accent/10" : "hover:bg-ink-900"}`}>
                    <td><Badge tone={t.acronym === "FLEX" ? "accent" : "neutral"}>{t.acronym}</Badge></td>
                    <td className="whitespace-nowrap font-mono text-ink-100">{t.test_id}</td>
                    <td className="whitespace-nowrap tabular-nums text-ink-300">{t.date ?? "—"}</td>
                    <td className="max-w-[260px] truncate text-ink-100">{t.acronym === "FLEX" ? t.fuel_or_material : <span title={t.fuel_or_material}>{t.material_class}<span className="text-ink-400">, {t.pi}</span></span>}</td>
                    <td className="text-right tabular-nums">{t.o2_initial_pct !== null ? `${fmt(t.o2_initial_pct, 1)}%` : "—"}</td>
                    <td className="whitespace-nowrap tabular-nums text-ink-300">{c.label}</td>
                    <td className={`whitespace-nowrap ${t.acronym === "FLEX" ? "text-ink-100" : "text-ink-400 italic"}`}>{outcomeCell(t)}</td>
                    <td className="whitespace-nowrap">{t.quality_flags.length > 0 && <Badge tone="warn">{t.quality_flags.length} note{t.quality_flags.length > 1 ? "s" : ""}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="py-16 text-center text-sm text-ink-400">No tests match these filters.</p>}
        </div>
      </div>

      <AnimatePresence>
      {selectedTest && selectedInv && (
        <DetailPanel key={selectedTest.record_id} test={selectedTest} investigation={selectedInv} fields={fields} log={logByRecord[selectedTest.record_id] ?? []} onClose={() => setSelected(null)} />
      )}
      </AnimatePresence>
    </div>
  );
}
