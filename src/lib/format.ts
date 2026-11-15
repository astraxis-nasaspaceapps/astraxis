// Human-readable descriptions for pipeline quality flags.
export const FLAG_LABELS: Record<string, string> = {
  dash_no_value: "Value marked with a dash in the NASA source (no value)",
  approximate: "Value marked approximate (~) in the NASA source",
  zero_ambiguous: "Reported as 0; meaning not documented, shown as unavailable",
  invalid_value: "Physically invalid value removed",
  duplicate_identifier: "Test identifier appears more than once in the source",
  composition_sum_off: "Gas fractions do not sum to 1 (within 0.02)",
  implausible_value: "Implausible value kept but flagged for review",
  negative_sensor_reading: "Small negative sensor reading (sensor offset)",
  airflow_free_text: "Airflow parsed from crew free-text notes",
  airflow_ambiguous: "Airflow entry ambiguous; not parsed",
  no_leading_number: "No starting airflow value could be read",
  over_range: "CO sensor over range (>1000 ppm)",
  lower_bound_only: "Source gives only a lower bound",
  unparseable: "Value could not be read",
};

export function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits).replace(/\.?0+$/, "");
}
