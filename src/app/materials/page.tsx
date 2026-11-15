import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import saffireJson from "@/data/saffire.json";

export const metadata: Metadata = { title: "Spacecraft materials (SAFFIRE) | Astraxis" };

type Sample = {
  record_id: string; investigation_id: string; acronym: string; sample: string; material: string | null; thickness: string | null; size: string;
  airflow: string | null; direction: string | null; o2: string | null; burn_time: string | null;
  ug_burn_length: string | null; ug_spread: string | null; g1_burn_length: string | null; g1_spread: string | null; comparison: string | null;
};
const data = saffireJson as unknown as {
  investigations: { id: string; acronym: string; title: string; doi: string; file: string }[];
  samples: Sample[]; cleaning_log: { record_id: string; field: string; issue: string }[]; comparison_rule: string;
  summary: Record<string, number>;
};

const CMP: Record<string, { label: string; tone: "accent" | "warn" | "neutral" }> = {
  less: { label: "Burned less in microgravity", tone: "accent" },
  full_both: { label: "Burned full length in both", tone: "warn" },
  neither: { label: "Barely burned in either", tone: "neutral" },
  not_comparable: { label: "Not comparable", tone: "neutral" },
};

const flagsFor = (id: string) => data.cleaning_log.filter((l) => l.record_id === id);

export default function MaterialsPage() {
  const s2 = data.samples.filter((s) => s.investigation_id === "PSI-99");
  const big = data.samples.filter((s) => s.investigation_id !== "PSI-99");
  const n = s2.length;
  return (
    <>
      <PageHeader title="Spacecraft materials in orbit (SAFFIRE)">
        NASA&apos;s Spacecraft Fire Experiments burned real spacecraft materials inside an empty Cygnus cargo ship after it left the ISS, at a scale too risky to try with a crew aboard. SAFFIRE-II also lists how each material burned in normal gravity, which tests whether NASA&apos;s ground screening matches space.
      </PageHeader>
      <div className="space-y-6 px-5 py-6 md:px-8">
        <div className="grid gap-4 md:grid-cols-4">
          {(["less", "full_both", "neither", "not_comparable"] as const).map((k) => (
            <Card key={k} className="p-4">
              <div className="text-3xl font-semibold tabular-nums text-ink-100">{data.summary[k] ?? 0} of {n}</div>
              <div className="mt-1 text-sm text-ink-300">{CMP[k].label}</div>
            </Card>
          ))}
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-ink-300">
          Observation: in SAFFIRE-II, three of the four silicone samples, the PMMA sample and one unlabeled sample burned less in microgravity than in NASA&apos;s 1-g comparison. The cotton-fiberglass fabric (SIBAL, sample 2-5) and one unlabeled sample burned their full 29 cm both ways, spreading at 2.1–2.6 mm/s in orbit. Nine small samples in ordinary cabin air: a pattern worth noting, not a general rule.
        </p>

        <Card className="overflow-x-auto">
          <div className="border-b border-ink-800 px-4 py-3">
            <h2 className="text-base font-semibold text-ink-100">SAFFIRE-II: microgravity against normal gravity, sample by sample</h2>
            <p className="mt-0.5 text-xs text-ink-400">Values exactly as written in NASA&apos;s table. {data.comparison_rule}</p>
          </div>
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b border-ink-800 text-xs text-ink-400">
              <tr>{["Sample", "Material", "Thickness", "O₂ (%)", "Flow", "Microgravity burn length", "Microgravity spread", "1-g burn length", "1-g spread", "Result"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="text-ink-200">
              {s2.map((s) => {
                const f = flagsFor(s.record_id);
                return (
                  <tr key={s.record_id} className="border-b border-ink-850 align-top last:border-0">
                    <td className="px-3 py-2 font-mono text-ink-100">{s.sample}</td>
                    <td className="px-3 py-2">{s.material ?? <span className="text-ink-500">blank in NASA&apos;s table</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{s.thickness}{f.some((x) => x.field === "thickness") && <span className="ml-1"><Badge tone="warn">note</Badge></span>}</td>
                    <td className="px-3 py-2 tabular-nums">{s.o2}</td>
                    <td className="px-3 py-2">{s.airflow}, {s.direction?.toLowerCase()}</td>
                    <td className="px-3 py-2">{s.ug_burn_length}</td>
                    <td className="px-3 py-2">{s.ug_spread}</td>
                    <td className="px-3 py-2">{s.g1_burn_length}</td>
                    <td className="px-3 py-2">{s.g1_spread}</td>
                    <td className="px-3 py-2">{s.comparison && <Badge tone={CMP[s.comparison].tone}>{CMP[s.comparison].label}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card className="overflow-x-auto">
          <div className="border-b border-ink-800 px-4 py-3">
            <h2 className="text-base font-semibold text-ink-100">SAFFIRE-I and III: large fabric sheets</h2>
            <p className="mt-0.5 text-xs text-ink-400">Sheets of SIBAL cotton-fiberglass fabric about 94 × 41 cm, burned with the airflow (concurrent) and against it (opposed).</p>
          </div>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-ink-800 text-xs text-ink-400">
              <tr>{["Experiment", "Sample", "Material", "Thickness", "Size", "Airflow", "Direction", "O₂ (%)", "Burn time (s)"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="text-ink-200">
              {big.map((s) => (
                <tr key={s.record_id} className="border-b border-ink-850 last:border-0">
                  <td className="px-3 py-2">{s.acronym}</td><td className="px-3 py-2 font-mono">{s.sample}</td><td className="px-3 py-2">{s.material}</td>
                  <td className="px-3 py-2">{s.thickness}</td><td className="px-3 py-2">{s.size}</td><td className="px-3 py-2">{s.airflow}</td>
                  <td className="px-3 py-2">{s.direction}</td><td className="px-3 py-2">{s.o2 ?? <span className="text-ink-500">not in table</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{s.burn_time ?? <span className="text-ink-500">not in table</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink-100">Data notes</h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-300">
              {data.cleaning_log.map((l, i) => <li key={i}><span className="font-mono text-xs text-ink-400">{l.record_id}</span> {l.issue}</li>)}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="text-base font-semibold text-ink-100">What this can&apos;t tell you</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-300">
              <li>These burns ran in ordinary cabin air (about 21.5–22% oxygen), not the 30%+ oxygen planned for habitats, and the tables don&apos;t record pressure.</li>
              <li>Nine SAFFIRE-II samples, 5 cm wide, with burn lengths partly written in words (&ldquo;Complete&rdquo;, &ldquo;~ 0&rdquo;). That is too few for a statistical model.</li>
              <li>Results are from microgravity in orbit and do not predict lunar or Martian gravity.</li>
            </ul>
            <div className="mt-4 space-y-1 text-xs text-ink-400">
              {data.investigations.map((v) => <div key={v.id}>{v.acronym} ({v.id}), DOI {v.doi}: &ldquo;{v.file}&rdquo;</div>)}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
