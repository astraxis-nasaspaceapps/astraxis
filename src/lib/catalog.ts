import catalogJson from "@/data/psi_catalog.json";

export type CriterionKey = "o2" | "lowp" | "materials" | "safety" | "flight";
export interface Criterion { v: boolean | null; ev: string }
export interface CatalogInvestigation {
  id: string; acronym: string; title: string; subarea: string; url: string; inAstraxis: boolean;
  criteria: Record<CriterionKey, Criterion>;
}
export interface RankedInvestigation extends CatalogInvestigation { score: number; rank: number; insideTarget: boolean }

export const CRITERIA: { key: CriterionKey; short: string; label: string }[] = [
  { key: "o2", short: "30%+ O₂", label: "Tested oxygen at 30% or more (the habitat level)" },
  { key: "lowp", short: "Low pressure", label: "Tested pressure near 10.2 psi (≈0.7 atm) or lower" },
  { key: "materials", short: "Spacecraft materials", label: "Burned or heated spacecraft materials such as fabrics and plastics" },
  { key: "safety", short: "Fire-safety use", label: "Studied suppression, smoke or fire detection, or material flammability limits" },
  { key: "flight", short: "Flight data", label: "Flight data from microgravity, not ground modeling" },
];

export const catalog = catalogJson as { retrieved: string; source: string; investigations: CatalogInvestigation[] };

/** Rank by number of criteria met; ties go to investigations that tested both habitat oxygen and low pressure,
 *  then flight data, then accession number. Tied scores share a rank. */
export function rankedInvestigations(): RankedInvestigation[] {
  const scored = catalog.investigations.map((i) => ({
    ...i,
    score: Object.values(i.criteria).filter((c) => c.v === true).length,
    insideTarget: i.criteria.o2.v === true && i.criteria.lowp.v === true,
  }));
  scored.sort((a, b) =>
    b.score - a.score || Number(b.insideTarget) - Number(a.insideTarget) || Number(b.criteria.flight.v) - Number(a.criteria.flight.v) ||
    Number(a.id.slice(4)) - Number(b.id.slice(4)));
  let rank = 0, last = -1;
  return scored.map((s, i) => {
    if (s.score !== last) { rank = i + 1; last = s.score; }
    return { ...s, rank };
  });
}

/** Compact text for the assistant's evidence block. */
export function catalogEvidence(): string {
  return rankedInvestigations()
    .map((r) => {
      const met = CRITERIA.filter((c) => r.criteria[c.key].v === true).map((c) => `${c.short}: ${r.criteria[c.key].ev}`);
      return `${r.id} ${r.acronym || "(ground study)"} "${r.title}" | rank ${r.rank}, score ${r.score}/5 | ${r.inAstraxis ? "full test data in Astraxis" : "catalog description only"}${met.length ? " | " + met.join(" | ") : ""}`;
    })
    .join("\n");
}
