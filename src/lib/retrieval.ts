import "server-only";
import { investigations, tests } from "./data";
import type { TestRecord } from "./types";

/* ------------------------------------------------------------------ query parsing */
export interface Criteria {
  investigation?: "PSI-69" | "PSI-25";
  fuel?: "Methanol" | "Heptane";
  gas?: "N2" | "CO2" | "He";
  outcome?: "Extinction" | "Disruption" | "Completion";
  o2Min?: number;
  o2Max?: number;
  pressure?: "low" | "one" | "high";
  materialClass?: string;
  pi?: string;
  testIds?: string[];
}

export interface Interpretation { text: string; assumed: boolean }

const MATERIALS: [RegExp, string][] = [
  [/\b(sibal|cotton|fiberglass|fabric|textile)\b/i, "cotton-fiberglass fabric (SIBAL)"],
  [/\bnomex\b/i, "Nomex fabric"],
  [/\bcandle|wax\b/i, "wax candle"],
  [/\bspher/i, "PMMA sphere section"],
  [/\brods?\b|cylinder/i, "PMMA rod"],
  [/\bfilms?\b|thin sheet/i, "PMMA thin film"],
  [/\bslabs?\b|thick (pmma|sheet)/i, "PMMA slab"],
];
const PIS = ["Bhattacharjee", "Ferkul", "Miller", "Olson", "Fernandez-Pello", "T'ien"];

export function parseQuestion(q: string): { criteria: Criteria; notes: Interpretation[] } {
  const s = q.toLowerCase();
  const c: Criteria = {};
  const notes: Interpretation[] = [];

  // explicit test IDs
  const known = new Map<string, string[]>();
  for (const t of tests) known.set(t.test_id.toLowerCase(), [...(known.get(t.test_id.toLowerCase()) ?? []), t.record_id]);
  // "O2" is both oxygen and an Olson BASS-II test ID; only treat it as a test when written "test O2"
  const tokens = [...q.matchAll(/(test\s+)?\b([A-Za-z0-9]{2,8})\b/gi)];
  const ids = [...new Set(tokens.flatMap((m) => {
    const w = m[2].toLowerCase();
    if ((w === "o2" || w === "co2") && !m[1]) return [];
    return known.get(w) ?? [];
  }))];
  if (ids.length) { c.testIds = ids; notes.push({ text: `Specific tests named: ${ids.join(", ")}`, assumed: false }); }

  if (/\bflex\b|droplet|liquid fuel|methanol|heptane/.test(s)) c.investigation = "PSI-69";
  if (/\bbass|solid|pmma|plastic|fabric|nomex|rods?\b|films?\b|slabs?\b|sibal|candle|airflow|flow speed|wind tunnel|spacecraft material/.test(s)) {
    c.investigation = c.investigation === "PSI-69" ? undefined : "PSI-25";
  }
  if (c.investigation) notes.push({ text: `Investigation: ${c.investigation === "PSI-69" ? "FLEX (liquid fuel droplets)" : "BASS-II (solid materials)"}`, assumed: false });

  if (/methanol/.test(s) && !/heptane/.test(s)) c.fuel = "Methanol";
  if (/heptane/.test(s) && !/methanol/.test(s)) c.fuel = "Heptane";
  if (c.fuel) notes.push({ text: `Fuel: ${c.fuel}`, assumed: false });

  if (/\bco2\b|co₂|carbon dioxide/.test(s)) c.gas = "CO2";
  else if (/\bhelium\b|\bhe\b/.test(s)) c.gas = "He";
  else if (/nitrogen only|only nitrogen|\bn2 only|no suppressant|plain air/.test(s)) c.gas = "N2";
  if (c.gas) notes.push({ text: `Added gas: ${c.gas === "N2" ? "nitrogen only" : c.gas === "CO2" ? "CO₂" : "helium"}`, assumed: false });

  if (/went out|extinct|extinguish|flame[- ]?out/.test(s) && !/how|relat|affect|effect|compare|versus|vs\b/.test(s)) c.outcome = "Extinction";
  if (/disrupt/.test(s)) c.outcome = "Disruption";
  if (/burned? (away|to completion|completely)|completion/.test(s)) c.outcome = "Completion";
  if (c.outcome) notes.push({ text: `Outcome: ${c.outcome}`, assumed: false });

  // oxygen
  const num = "(\\d+(?:\\.\\d+)?)\\s*%?";
  let m: RegExpMatchArray | null;
  if ((m = s.match(new RegExp(`between\\s+${num}\\s*(?:and|-|to)\\s*${num}`)))) { c.o2Min = +m[1]; c.o2Max = +m[2]; }
  else if ((m = s.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*%\s*(?:o2|o₂|oxygen)?/))) { c.o2Min = +m[1]; c.o2Max = +m[2]; }
  else {
    if ((m = s.match(new RegExp(`(?:below|under|less than|lower than|<)\\s*${num}`)))) c.o2Max = +m[1];
    if ((m = s.match(new RegExp(`(?:above|over|more than|greater than|higher than|>)\\s*${num}`)))) c.o2Min = +m[1];
  }
  if (c.o2Min !== undefined || c.o2Max !== undefined) {
    notes.push({ text: `Initial O₂ ${c.o2Min !== undefined ? `≥ ${c.o2Min}%` : ""}${c.o2Min !== undefined && c.o2Max !== undefined ? " and " : ""}${c.o2Max !== undefined ? `≤ ${c.o2Max}%` : ""}`, assumed: false });
  } else if (/elevated oxygen|high oxygen|oxygen[- ]rich|enriched/.test(s)) {
    c.o2Min = 21.5; notes.push({ text: "“Elevated oxygen” read as above normal air (more than 21%)", assumed: true });
  } else if (/low oxygen|reduced oxygen|oxygen[- ]poor|vitiated/.test(s)) {
    c.o2Max = 20.5; notes.push({ text: "“Low oxygen” read as below normal air (less than 21%)", assumed: true });
  }

  if (/low pressure|reduced pressure|0\.7\s*atm/.test(s)) c.pressure = "low";
  else if (/high pressure|elevated pressure|[23]\s*atm/.test(s)) c.pressure = "high";
  else if (/\b1\s*atm|atmospheric pressure/.test(s)) c.pressure = "one";
  if (c.pressure) notes.push({ text: `Pressure: ${c.pressure === "low" ? "about 0.7 atm" : c.pressure === "one" ? "about 1 atm" : "2–3 atm"}`, assumed: false });

  for (const [re, cls] of MATERIALS) if (re.test(q)) { c.materialClass = cls; c.investigation = "PSI-25"; notes.push({ text: `Material: ${cls}`, assumed: false }); break; }
  for (const p of PIS) if (s.includes(p.toLowerCase().replace("'", "")) || s.includes(p.toLowerCase())) { c.pi = p; c.investigation = "PSI-25"; notes.push({ text: `Researcher: ${p}`, assumed: false }); break; }

  return { criteria: c, notes };
}

/* ------------------------------------------------------------------ search + ranking */
export interface RankedTest {
  id: string; testId: string; acronym: string; summary: string; matched: string[]; score: number; flags: number; o2: number | null;
}

const bandOk = (p: number | null, b: Criteria["pressure"]) =>
  !b || (p !== null && (b === "low" ? p < 0.8 : b === "one" ? p >= 0.8 && p < 1.5 : p >= 1.5));

function matches(t: TestRecord, c: Criteria, relax: Set<keyof Criteria>): string[] | null {
  const why: string[] = [];
  const active = (k: keyof Criteria) => c[k] !== undefined && !relax.has(k);
  if (c.testIds?.length) return c.testIds.includes(t.record_id) ? ["named in the question"] : null;
  if (active("investigation") && t.investigation_id !== c.investigation) return null;
  if (active("fuel")) { if (t.fuel_or_material !== c.fuel) return null; why.push(`fuel ${c.fuel}`); }
  if (active("gas")) { if (t.acronym !== "FLEX" || t.diluent !== c.gas) return null; why.push(`added gas ${c.gas}`); }
  if (active("outcome")) { if (t.acronym !== "FLEX" || t.test_end !== c.outcome) return null; why.push(`ended in ${c.outcome!.toLowerCase()}`); }
  if (active("o2Min") || active("o2Max")) {
    const o = t.o2_initial_pct;
    if (o === null) return null;
    if (active("o2Min") && o < (c.o2Min as number)) return null;
    if (active("o2Max") && o > (c.o2Max as number)) return null;
    why.push(`initial O₂ ${o}%`);
  }
  if (active("pressure")) { if (!bandOk(t.pressure_atm, c.pressure)) return null; why.push(`pressure ${t.pressure_atm} atm`); }
  if (active("materialClass")) { if (t.material_class !== c.materialClass) return null; why.push(t.material_class); }
  if (active("pi")) { if (t.pi !== c.pi) return null; why.push(`researcher ${c.pi}`); }
  return why;
}

function completeness(t: TestRecord): number {
  const v = t.acronym === "FLEX"
    ? [t.droplet_initial_diameter_mm, t.flame_extinction_diameter_mm, t.burning_rate, t.burn_time_s, t.pressure_atm]
    : [t.airflow_initial_cm_s, t.o2_initial_pct, t.o2_final_pct, t.co2_final_pct, t.co_final_ppm];
  return v.filter((x) => x !== null).length / v.length;
}

function summarize(t: TestRecord): string {
  if (t.acronym === "FLEX") {
    return `${t.fuel_or_material}, O₂ ${t.o2_initial_pct}%, ${t.diluent}, ${t.pressure_atm ?? "?"} atm, d0 ${t.droplet_initial_diameter_mm ?? "—"} mm, d_ext ${t.flame_extinction_diameter_mm ?? "—"} mm, burning rate ${t.burning_rate ?? "—"} (unit unverified), burn ${t.burn_time_s ?? "—"} s, end ${t.test_end ?? "—"}`;
  }
  return `${t.fuel_or_material} [${t.material_class}], PI ${t.pi}, O₂ ${t.o2_initial_pct ?? "—"}%→${t.o2_final_pct ?? "—"}%, airflow ${t.airflow_raw ?? "—"} cm/s, restrictors ${t.flow_restrictor ?? "—"}`;
}

export function search(c: Criteria) {
  // relax the narrowest criteria first if nothing matches, and say so
  const order: (keyof Criteria)[] = ["outcome", "pressure", "gas", "o2Min", "o2Max", "pi", "materialClass", "fuel"];
  const relax = new Set<keyof Criteria>();
  let hits: { t: TestRecord; why: string[] }[] = [];
  for (let i = 0; i <= order.length; i++) {
    hits = tests.flatMap((t) => { const w = matches(t, c, relax); return w ? [{ t, why: w }] : []; });
    if (hits.length || i === order.length) break;
    while (i < order.length && c[order[i]] === undefined) i++;
    if (i < order.length) relax.add(order[i]);
  }
  const ranked: RankedTest[] = hits
    .map(({ t, why }) => {
      const flags = t.quality_flags.length;
      const score = why.length * 2 + completeness(t) * 2 - Math.min(flags, 3) * 0.4;
      return { id: t.record_id, testId: t.test_id, acronym: t.acronym, summary: summarize(t), matched: why, score: Number(score.toFixed(2)), flags, o2: t.o2_initial_pct };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, undefined, { numeric: true }));
  return { ranked, relaxed: [...relax], subset: hits.map((h) => h.t) };
}

/* ------------------------------------------------------------------ evidence statistics */
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);

export function evidenceStats(subset: TestRecord[]) {
  const flex = subset.filter((t) => t.acronym === "FLEX");
  const bass = subset.filter((t) => t.acronym === "BASS-II");
  const out: Record<string, unknown> = {};
  if (flex.length) {
    const bands = [[0, 16], [16, 20], [20, 24], [24, 40]] as const;
    out.flex = {
      tests: flex.length,
      by_outcome: count(flex.map((t) => (t.acronym === "FLEX" ? t.test_end ?? "unknown" : ""))),
      by_added_gas: count(flex.map((t) => (t.acronym === "FLEX" ? t.diluent : ""))),
      by_fuel: count(flex.map((t) => t.fuel_or_material)),
      o2_bands: bands.map(([lo, hi]) => {
        const b = flex.filter((t) => t.o2_initial_pct !== null && t.o2_initial_pct >= lo && t.o2_initial_pct < hi);
        const ext = b.filter((t) => t.acronym === "FLEX" && t.test_end === "Extinction");
        return {
          // label with the oxygen values actually present, so a filtered band never overstates its range
          band: (() => { const v = b.map((t) => t.o2_initial_pct as number); const a = Math.min(...v), z = Math.max(...v); return a === z ? `${a}% O2` : `${a}–${z}% O2`; })(),
          tests: b.length,
          by_outcome: count(b.map((t) => (t.acronym === "FLEX" ? t.test_end ?? "unknown" : ""))),
          median_diameter_ratio_at_extinction: r2(median(ext.flatMap((t) => (t.acronym === "FLEX" && t.flame_extinction_diameter_mm && t.droplet_initial_diameter_mm ? [t.flame_extinction_diameter_mm / t.droplet_initial_diameter_mm] : [])))),
          median_burning_rate_unit_unverified: r2(median(b.flatMap((t) => (t.acronym === "FLEX" && t.burning_rate !== null ? [t.burning_rate] : [])))),
        };
      }).filter((b) => b.tests > 0),
      records_with_data_notes: flex.filter((t) => t.quality_flags.length).length,
    };
  }
  if (bass.length) {
    const o2 = bass.flatMap((t) => (t.o2_initial_pct !== null ? [t.o2_initial_pct] : []));
    const air = bass.flatMap((t) => (t.acronym === "BASS-II" && t.airflow_initial_cm_s !== null ? [t.airflow_initial_cm_s] : []));
    out.bass_ii = {
      tests: bass.length,
      by_material: count(bass.map((t) => t.material_class)),
      by_researcher: count(bass.map((t) => t.pi ?? "")),
      initial_o2_range_pct: o2.length ? [Math.min(...o2), Math.max(...o2)] : null,
      initial_airflow_range_cm_s: air.length ? [Math.min(...air), Math.max(...air)] : null,
      tests_where_airflow_changed: bass.filter((t) => t.acronym === "BASS-II" && t.airflow_changed_during_test).length,
      note: "The BASS-II test table has conditions and gas readings only. Flame spread rates and outcomes are NOT in this dataset.",
      records_with_data_notes: bass.filter((t) => t.quality_flags.length).length,
    };
  }
  return out;
}

function count(xs: string[]) {
  return xs.reduce<Record<string, number>>((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {});
}

export function investigationContext(ids: string[]) {
  return investigations
    .filter((i) => ids.includes(i.id))
    .map((i) => ({ id: i.id, title: i.title, doi: i.doi, summary: i.summary, limitations: i.known_limitations }));
}

/** Pick up to n records spread evenly across O2 bands (best-ranked first within each band),
 *  so a broad question shows the model the whole range, not 30 tests at 21% O2. */
export function stratify(ranked: RankedTest[], n = 30): RankedTest[] {
  const band = (o: number | null) => (o === null ? "none" : o < 16 ? "a" : o < 20 ? "b" : o < 24 ? "c" : "d");
  const groups = new Map<string, RankedTest[]>();
  for (const r of ranked) { const k = `${r.acronym}-${band(r.o2)}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  const lists = [...groups.values()];
  const out: RankedTest[] = [];
  for (let i = 0; out.length < n && lists.some((l) => l.length > i); i++) for (const l of lists) if (l[i] && out.length < n) out.push(l[i]);
  return out;
}
