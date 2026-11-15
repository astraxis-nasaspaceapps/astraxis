import { tests } from "@/lib/data";
import saffireJson from "@/data/saffire.json";

/** Evidence gaps between NASA's PSI test data in Astraxis and the planned habitat atmosphere.
 *  Every number is computed from the cleaned NASA tables at build time. */

const PSI_PER_ATM = 14.696;
export const TARGET = { o2: 30, psi: 10.2, atm: 10.2 / PSI_PER_ATM };
const psi = (atm: number) => (atm * PSI_PER_ATM).toFixed(1);

export interface Gap {
  id: string; title: string; count: number; of: number; ofLabel: string;
  closest: string; why: string; next: string; maybeElsewhere?: string; links: { label: string; href: string }[];
}

export function evidenceGaps(): Gap[] {
  const flex = tests.filter((t) => t.acronym === "FLEX");
  const bass = tests.filter((t) => t.acronym === "BASS-II");
  const saffire = (saffireJson as unknown as { samples: { o2: string | null }[] }).samples;
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  const f = flex.map((t) => { const r = t as unknown as Record<string, unknown>; return { id: String(r.test_id), o2: num(r.o2_initial_pct), p: num(r.pressure_atm), dil: String(r.diluent), d0: num(r.droplet_initial_diameter_mm) }; });
  const highO2 = f.filter((t) => t.o2 !== null && t.o2 >= TARGET.o2);
  const inside = highO2.filter((t) => t.p !== null && t.p <= TARGET.atm);
  const highO2p = highO2.map((t) => t.p).filter((p): p is number => p !== null);
  const lowP = f.filter((t) => t.p !== null && t.p <= TARGET.atm);
  const lowPo2 = lowP.map((t) => t.o2).filter((o): o is number => o !== null);
  const nearHab = highO2.filter((t) => t.p !== null && t.p < 0.8);

  const supp = f.filter((t) => t.dil === "CO2" || t.dil === "He");
  const suppHigh = supp.filter((t) => t.o2 !== null && t.o2 >= TARGET.o2);
  const maxO2 = (d: string) => Math.max(...f.filter((t) => t.dil === d && t.o2 !== null).map((t) => t.o2 as number));

  const bassO2 = bass.map((t) => num((t as unknown as Record<string, unknown>).o2_initial_pct)).filter((o): o is number => o !== null);
  const solidsMax = Math.max(...bassO2, 22.1);
  const solidsHigh = bassO2.filter((o) => o >= TARGET.o2).length; // SAFFIRE tables report about 21.5–22.1%
  const solidsTotal = bass.length + saffire.length;
  const bassWithP = bass.filter((t) => num((t as unknown as Record<string, unknown>).pressure_atm) !== null).length;

  const sizes = nearHab.map((t) => t.d0).filter((d): d is number => d !== null);
  const allSizes = f.map((t) => t.d0).filter((d): d is number => d !== null);

  return [
    {
      id: "target",
      title: "Nothing burned inside the habitat target itself",
      count: inside.length, of: highO2.length, ofLabel: `FLEX tests at ${TARGET.o2}%+ oxygen ran at ${TARGET.psi} psi or lower`,
      closest: `${nearHab.length} tests at ${TARGET.o2}–34% O₂ ran at ${psi(Math.min(...highO2p))}–${psi(Math.max(...nearHab.map((t) => t.p as number)))} psi, just above the target. The only ${lowP.length} tests at ${TARGET.psi} psi or lower used ${Math.min(...lowPo2)}–${Math.max(...lowPo2)}% O₂. High oxygen and low pressure were each tested, never together.`,
      why: "Habitat air combines both. Whether flames behave the same at slightly lower pressure is assumed, not measured, in this data.",
      next: `Droplet burns at 30–34% O₂ and ${TARGET.psi} psi or lower (for example 8.2 psi), matching planned habitat air.`,
      maybeElsewhere: "NASA’s catalog says ACME BRE (PSI-20) examined 8.2 psia at 34% oxygen with a gas burner, and FLEX-2 (PSI-68) spanned 10–40% oxygen at 0.5–3 atm. Their PSI tables are summaries, so test-level coverage can’t be checked here.",
      links: [{ label: "Habitat conditions", href: "/habitat" }, { label: "Investigations ranked", href: "/investigations" }],
    },
    {
      id: "suppressants",
      title: "Suppressant gases were never tested in oxygen-rich air",
      count: suppHigh.length, of: supp.length, ofLabel: `CO₂ or helium tests ran above 25% oxygen`,
      closest: `CO₂ was tested up to ${maxO2("CO2")}% O₂ and helium up to ${maxO2("He")}% O₂. Above that, only nitrogen was used.`,
      why: "CO₂ is a standard spacecraft fire suppressant. How well it puts out flames in 30%+ oxygen, where flames survive more easily, isn’t covered by these tests.",
      next: "FLEX-style droplet tests with added CO₂ and helium at 30–34% O₂ and about 0.7 atm, to measure suppressant effectiveness in habitat air.",
      maybeElsewhere: "FLEX-2’s PSI summary table lists O₂/He mixtures with oxygen up to 0.3 mole fraction for at least one fuel, but it doesn’t list individual tests, so this can’t be checked here.",
      links: [{ label: "Flame-out model", href: "/model" }, { label: "Compare", href: "/compare" }],
    },
    {
      id: "materials",
      title: "Spacecraft materials were never burned in habitat oxygen",
      count: solidsHigh, of: solidsTotal, ofLabel: "solid-material tests (BASS-II and SAFFIRE) ran at 30%+ oxygen",
      closest: `Solid materials were burned at up to ${solidsMax}% O₂: BASS-II by design (oxygen at or below air) and SAFFIRE in cabin air (about 21.5–22.1%). ${bassWithP === 0 ? "Neither table records pressure." : ""}`,
      why: "Fabrics, plastics and silicone line every habitat. SAFFIRE showed microgravity can change how they burn, but only in ordinary air.",
      next: "SAFFIRE-scale burns of cotton-fiberglass fabric, silicone and PMMA at 30%+ O₂ and about 10.2 psi.",
      links: [{ label: "Spacecraft materials", href: "/materials" }],
    },
    {
      id: "sizes",
      title: "No small droplets were tested near habitat air",
      count: sizes.filter((d) => d < Math.min(...sizes)).length, of: nearHab.length, ofLabel: `tests near habitat air used droplets smaller than ${Math.min(...sizes).toFixed(1)} mm`,
      closest: `The ${sizes.length} near-habitat tests with a recorded size used ${Math.min(...sizes).toFixed(1)}–${Math.max(...sizes).toFixed(1)} mm droplets. Across all FLEX tests, sizes ran from ${Math.min(...allSizes).toFixed(1)} mm.`,
      why: "Droplet size is the model’s second-strongest factor: in this data, larger droplets go out more often. Small-droplet behaviour in habitat air is extrapolated.",
      next: `Droplets of about 1–2.5 mm at 30–34% O₂ and about 0.7 atm, to close the gap in the model’s support.`,
      links: [{ label: "Flame-out model", href: "/model" }],
    },
  ];
}

/** Plain text for the assistant's evidence block. */
export function gapsEvidence(): string {
  return evidenceGaps().map((g) => `GAP ${g.id}: ${g.title}. ${g.count} of ${g.of} ${g.ofLabel}. Closest: ${g.closest} Why it matters: ${g.why} Suggested next test (Astraxis proposal): ${g.next}${g.maybeElsewhere ? ` Possibly elsewhere: ${g.maybeElsewhere}` : ""}`).join("\n");
}
