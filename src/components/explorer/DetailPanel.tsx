"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { CleaningLogEntry, FieldDictionary, Investigation, TestRecord } from "@/lib/types";
import { FLAG_LABELS, fmt } from "@/lib/format";
import { Badge } from "@/components/ui";

type Row = { key: string; label: string; value: string | null };

function rowsFor(t: TestRecord): { conditions: Row[]; measurements: Row[] } {
  const pct = (v: number | null) => (v === null ? null : `${fmt(v, 2)} %`);
  if (t.acronym === "FLEX") {
    return {
      conditions: [
        { key: "fuel_or_material", label: "Fuel", value: t.fuel_or_material },
        { key: "pressure_mmhg", label: "Ambient pressure", value: t.pressure_mmhg === null ? null : `${fmt(t.pressure_mmhg, 1)} mmHg (${fmt(t.pressure_atm, 2)} atm)` },
        { key: "o2_initial_pct", label: "Initial O₂", value: pct(t.o2_initial_pct) },
        { key: "n2_initial_pct", label: "Initial N₂", value: pct(t.n2_initial_pct) },
        { key: "co2_initial_pct", label: "Initial CO₂", value: pct(t.co2_initial_pct) },
        { key: "he_initial_pct", label: "Initial He", value: pct(t.he_initial_pct) },
        { key: "flow_configuration", label: "Flow", value: t.flow_configuration },
      ],
      measurements: [
        { key: "droplet_initial_diameter_mm", label: "Initial droplet diameter", value: t.droplet_initial_diameter_mm === null ? null : `${fmt(t.droplet_initial_diameter_mm)} mm` },
        { key: "flame_extinction_diameter_mm", label: "Diameter at visible flame extinction", value: t.flame_extinction_diameter_mm === null ? null : `${fmt(t.flame_extinction_diameter_mm)} mm` },
        { key: "burning_rate", label: "Burning rate", value: t.burning_rate === null ? null : `${fmt(t.burning_rate)}` },
        { key: "burn_time_s", label: "Burn time", value: t.burn_time_s === null ? null : `${fmt(t.burn_time_s)} s` },
        { key: "test_end", label: "Test end", value: t.test_end },
      ],
    };
  }
  return {
    conditions: [
      { key: "fuel_or_material", label: "Material (as logged)", value: t.fuel_or_material },
      { key: "material_class", label: "Material class", value: t.material_class },
      { key: "thickness_mm", label: "Thickness", value: t.thickness_mm === null ? null : `${fmt(t.thickness_mm, 3)} mm` },
      { key: "rod_diameter_in", label: "Rod diameter", value: t.rod_diameter_in === null ? null : `${fmt(t.rod_diameter_in, 3)} in` },
      { key: "pi", label: "Principal investigator", value: t.pi },
      { key: "pi_focus", label: "PI test series", value: t.pi_focus },
      { key: "flow_configuration", label: "Flow configuration", value: t.flow_configuration },
      { key: "o2_initial_pct", label: "Initial O₂ (calibrated)", value: pct(t.o2_initial_pct) },
      { key: "airflow_initial_cm_s", label: "Initial airflow", value: t.airflow_initial_cm_s === null ? null : `${fmt(t.airflow_initial_cm_s)} cm/s` },
      { key: "airflow_sequence_cm_s", label: "Airflow sequence", value: t.airflow_sequence_cm_s.length > 1 ? `${t.airflow_sequence_cm_s.map((v) => fmt(v)).join(" → ")} cm/s` : null },
      { key: "airflow_raw", label: "Airflow (crew log, verbatim)", value: t.airflow_raw },
      { key: "flow_restrictor", label: "Flow restrictor plates", value: t.flow_restrictor === null ? null : fmt(t.flow_restrictor) },
    ],
    measurements: [
      { key: "o2_final_pct", label: "Final O₂", value: pct(t.o2_final_pct) },
      { key: "co2_initial_pct", label: "Initial CO₂", value: pct(t.co2_initial_pct) },
      { key: "co2_final_pct", label: "Final CO₂", value: pct(t.co2_final_pct) },
      { key: "co_initial_ppm", label: "Initial CO", value: t.co_initial_over_range ? ">1000 ppm (over range)" : t.co_initial_ppm === null ? null : `${fmt(t.co_initial_ppm)} ppm` },
      { key: "co_final_ppm", label: "Final CO", value: t.co_final_over_range ? ">1000 ppm (over range)" : t.co_final_ppm === null ? null : `${fmt(t.co_final_ppm)} ppm` },
      { key: "still_frames", label: "Still frames captured", value: t.still_frames === null ? null : fmt(t.still_frames) },
    ],
  };
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="border-t border-ink-800 px-5 py-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold text-ink-300">{title}</h3>
        {hint && <span className="text-[10px] text-ink-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function DetailPanel({ test, investigation, fields, log, onClose }: {
  test: TestRecord; investigation: Investigation; fields: FieldDictionary; log: CleaningLogEntry[]; onClose: () => void;
}) {
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const { conditions, measurements } = rowsFor(test);
  const flaggedFields = new Set(log.map((l) => l.field));
  const missing = [...conditions, ...measurements].filter((r) => r.value === null && r.key !== "airflow_sequence_cm_s" && r.key !== "rod_diameter_in" && r.key !== "thickness_mm" && r.key !== "flow_configuration");

  useEffect(() => {
    if (!showRaw || raw) return;
    let alive = true;
    fetch(`/data/raw-${test.investigation_id.toLowerCase()}.json`)
      .then((r) => r.json())
      .then((all: Record<string, Record<string, unknown>>) => alive && setRaw(all[test.record_id] ?? {}))
      .catch(() => alive && setRaw({ error: "Could not load source row" }));
    return () => { alive = false; };
  }, [showRaw, raw, test.record_id, test.investigation_id]);

  const table = (rows: Row[]) => (
    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-4 gap-y-1.5 text-sm">
      {rows.filter((r) => r.value !== null).map((r) => {
        const f = fields[r.key];
        return (
          <div key={r.key} className="contents">
            <dt className="text-ink-400">{r.label}</dt>
            <dd className="tabular-nums text-ink-100">
              {r.value}
              {f && f.unit_verified === false && <span className="ml-1.5"><Badge tone="warn">unit unverified</Badge></span>}
              {flaggedFields.has(r.key) && <span className="ml-1.5 text-warn" title="See data notes">●</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );

  const src = test.source;
  return (
    <motion.aside
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      className="scroll-thin fixed inset-0 z-50 flex w-full flex-col overflow-y-auto bg-ink-900 md:static md:inset-auto md:z-auto md:w-[440px] md:shrink-0 md:border-l md:border-ink-800"
    >
      <div className="flex items-start justify-between px-5 pt-5 pb-4">
        <div>
          <div className="flex items-center gap-2"><Badge tone="accent">{test.acronym}</Badge><span className="text-xs text-ink-400">{investigation.id}</span></div>
          <h2 className="mt-2 font-mono text-xl text-ink-100">{test.test_id}</h2>
          <p className="mt-0.5 text-xs text-ink-400">Test record from {test.date ?? "an unknown date"}</p>
        </div>
        <button onClick={onClose} className="rounded px-2 py-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Close">✕</button>
      </div>

      <Section title="Test conditions">{table(conditions)}</Section>
      <Section title="Measurements" hint="as reported by NASA">
        {table(measurements)}
        {test.acronym === "BASS-II" && (
          <p className="mt-3 text-xs leading-relaxed text-ink-400">
            Flame spread rates and test outcomes are not in the BASS-II test table. They are reported in NASA/TM-20210011385 (Appendix A and PI chapters).
          </p>
        )}
      </Section>

      {missing.length > 0 && (
        <Section title="Not available for this test">
          <p className="text-sm text-ink-300">{missing.map((m) => m.label).join(", ")}</p>
        </Section>
      )}

      {log.length > 0 && (
        <Section title={`Data notes (${log.length})`}>
          <ul className="space-y-2.5">
            {log.map((l, i) => (
              <li key={i} className="rounded-md border border-warn/20 bg-warn-dim/40 px-3 py-2 text-xs leading-relaxed">
                <div className="text-warn">{FLAG_LABELS[l.flag] ?? l.flag}</div>
                <div className="mt-0.5 text-ink-300">
                  Field <span className="font-mono">{l.field}</span> · source value <span className="font-mono">“{l.raw_value}”</span> · {l.action}
                </div>
                {l.note && <div className="mt-0.5 text-ink-400">{l.note}</div>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="About the investigation" hint="applies to every test">
        <p className="text-sm text-ink-100">{investigation.title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-300">{investigation.summary}</p>
        <p className="mt-2 text-xs text-ink-400">{investigation.platform} · {investigation.hardware.join("; ")}</p>
      </Section>

      <Section title="Source">
        <div className="space-y-1 text-xs text-ink-300">
          <div>File: <span className="font-mono text-ink-100">{src.file}</span>{src.sheet ? <> · sheet <span className="font-mono">{src.sheet}</span></> : null}{src.line ? <> · line {src.line}</> : null}{src.row ? <> · row {src.row}</> : null}</div>
          <div>DOI: <a className="text-accent hover:underline" href={`https://doi.org/${investigation.doi}`} target="_blank" rel="noreferrer">{investigation.doi}</a> · {investigation.license}</div>
          <a className="inline-block text-accent hover:underline" href={src.url} target="_blank" rel="noreferrer">Open {investigation.id} on NASA PSI</a>
        </div>
        <button onClick={() => setShowRaw((s) => !s)} className="mt-3 rounded-md border border-ink-700 px-2.5 py-1.5 text-xs text-ink-200 hover:border-accent/50">
          {showRaw ? "Hide" : "Show"} original NASA row
        </button>
        {showRaw && (
          <pre className="scroll-thin mt-2 max-h-72 overflow-auto rounded-md bg-ink-950 p-3 text-[11px] leading-relaxed text-ink-300">
            {raw ? JSON.stringify(raw, null, 2) : "Loading…"}
          </pre>
        )}
      </Section>
    </motion.aside>
  );
}
