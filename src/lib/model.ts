import modelJson from "@/data/model_flex.json";

export type Feature = "o2" | "p" | "heptane" | "co2" | "he" | "d0";
export interface FlexModel {
  target: string; features: Feature[]; labels: Record<Feature, string>;
  mean: number[]; scale: number[]; coef: number[]; intercept: number;
  ranges: Record<Feature, [number, number]>; n: number; excluded: number; flameOutRate: number;
  cv: { method: string; models: { name: string; accuracy: number; auc: number; brier?: number; chosen?: boolean }[] };
  calibration: { band: string; n: number; observed: number; predicted: number }[];
  diluentRanges: { CO2: [number, number]; He: [number, number] };
  o2ByDiluent: { N2: [number, number]; CO2: [number, number]; He: [number, number] };
}
export const flexModel = modelJson as FlexModel;

export type Inputs = Record<Feature, number>;

export function predict(m: FlexModel, x: Inputs): number {
  const z = m.features.reduce((s, f, i) => s + (m.coef[i] * (x[f] - m.mean[i])) / m.scale[i], m.intercept);
  return 1 / (1 + Math.exp(-z));
}

/** Oxygen level at which the model gives a 50% chance of flame-out, holding the other inputs fixed. */
export function crossoverO2(m: FlexModel, x: Inputs): number {
  const io = m.features.indexOf("o2");
  const rest = m.features.reduce((s, f, i) => (i === io ? s : s + (m.coef[i] * (x[f] - m.mean[i])) / m.scale[i]), m.intercept);
  return m.mean[io] - (rest * m.scale[io]) / m.coef[io];
}
