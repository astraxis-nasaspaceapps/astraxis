import "server-only";
import investigationsJson from "@/data/investigations.json";
import testsJson from "@/data/tests.json";
import fieldsJson from "@/data/field_dictionary.json";
import logJson from "@/data/cleaning_log.json";
import type {
  CleaningLogEntry,
  FieldDictionary,
  Investigation,
  TestRecord,
} from "./types";

export const investigations = investigationsJson as Investigation[];
export const tests = testsJson as unknown as TestRecord[];
export const fieldDictionary = fieldsJson as FieldDictionary;
export const cleaningLog = logJson as CleaningLogEntry[];

export function logByRecord(): Record<string, CleaningLogEntry[]> {
  const out: Record<string, CleaningLogEntry[]> = {};
  for (const e of cleaningLog) (out[e.record_id] ??= []).push(e);
  return out;
}

export function datasetStats() {
  const flex = tests.filter((t) => t.acronym === "FLEX");
  const bass = tests.filter((t) => t.acronym === "BASS-II");
  return {
    total: tests.length,
    flex: flex.length,
    bass: bass.length,
    flagged: tests.filter((t) => t.quality_flags.length > 0).length,
    logEntries: cleaningLog.length,
  };
}

/* ---------- chart-ready slices (plain objects, safe to pass to client components) ---------- */
export interface FlexPoint {
  id: string; testId: string; fuel: string; o2: number; pAtm: number | null;
  diluent: "N2" | "CO2" | "He"; d0: number | null; dExt: number | null;
  rate: number | null; burn: number | null; end: "Extinction" | "Disruption" | "Completion";
  flags: string[];
}

export function flexPoints(): FlexPoint[] {
  const log = logByRecord();
  return tests.flatMap((t) =>
    t.acronym === "FLEX" && t.o2_initial_pct !== null && t.test_end
      ? [{
          id: t.record_id, testId: t.test_id, fuel: t.fuel_or_material, o2: t.o2_initial_pct,
          pAtm: t.pressure_atm, diluent: t.diluent, d0: t.droplet_initial_diameter_mm,
          dExt: t.flame_extinction_diameter_mm, rate: t.burning_rate, burn: t.burn_time_s, end: t.test_end,
          flags: [...new Set((log[t.record_id] ?? []).map((e) => e.field))],
        }]
      : [],
  );
}

export interface BassPoint {
  id: string; testId: string; pi: string; material: string; materialClass: string;
  o2: number | null; airflow: number | null; airflowRaw: string | null; changed: boolean; flags: string[];
}

export function bassPoints(): BassPoint[] {
  return tests.flatMap((t) =>
    t.acronym === "BASS-II"
      ? [{
          id: t.record_id, testId: t.test_id, pi: t.pi, material: t.fuel_or_material, materialClass: t.material_class,
          o2: t.o2_initial_pct, airflow: t.airflow_initial_cm_s, airflowRaw: t.airflow_raw,
          changed: t.airflow_changed_during_test, flags: t.quality_flags,
        }]
      : [],
  );
}
