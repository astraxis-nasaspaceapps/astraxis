// Chart colors. Validated with the dataviz palette validator on the app's dark
// chart surface (#0f1829): both sets pass all checks with --pairs all.
// Color follows the entity: never reassign by rank or filter state.

export const DILUENT = {
  N2: { color: "#3987e5", label: "N₂ only" },
  CO2: { color: "#d95926", label: "CO₂ added" },
  He: { color: "#199e70", label: "He added" },
} as const;
export type DiluentKey = keyof typeof DILUENT;
export const DILUENT_ORDER: DiluentKey[] = ["N2", "CO2", "He"];

export const OUTCOME = {
  Extinction: { color: "#9085e9", label: "Flame went out" },
  Disruption: { color: "#d55181", label: "Droplet disrupted" },
  Completion: { color: "#c98500", label: "Burned to completion" },
} as const;
export type OutcomeKey = keyof typeof OUTCOME;
export const OUTCOME_ORDER: OutcomeKey[] = ["Extinction", "Disruption", "Completion"];

export const SINGLE_SERIES = "#3987e5";

export const CHART = {
  surface: "#0f1829",
  grid: "#1c2a44",
  axis: "#2a3b5c",
  muted: "#93a3bf",
  text: "#e6ecf5",
};
