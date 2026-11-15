import Link from "next/link";
import { Badge } from "@/components/ui";
import { DropletField } from "@/components/charts/DropletField";
import { OverviewActions } from "@/components/OverviewActions";
import { datasetStats, flexPoints, investigations, tests } from "@/lib/data";
import { DILUENT } from "@/lib/palette";

export default function Overview() {
  const s = datasetStats();
  const flex = flexPoints();
  const bass = tests.filter((t) => t.acronym === "BASS-II");
  const dots = flex.map((p) => ({ id: p.id, testId: p.testId, o2: p.o2, end: p.end, fuel: p.fuel, diluent: DILUENT[p.diluent].label }));
  const low = flex.filter((p) => p.o2 < 20);
  const lowExt = low.filter((p) => p.end === "Extinction").length;
  const range = (xs: (number | null)[], d = 1) => {
    const v = xs.filter((x): x is number => x !== null);
    const r = (n: number) => String(Number(n.toFixed(d)));
    return `${r(Math.min(...v))}–${r(Math.max(...v))}`;
  };

  return (
    <div className="pb-12">
      <section className="border-b border-ink-800 px-5 pt-10 pb-8 md:px-8">
        <div className="max-w-3xl">
          <h1 className="text-[28px] md:text-[34px] leading-[1.15] font-semibold tracking-[-0.015em] text-ink-100">
            {s.flex} fuel droplets burned on the International Space Station
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-300">
            Each dot is one test from NASA&apos;s Flame Extinguishment Experiment, placed by the oxygen level in the chamber and colored by how it ended.
            Below 20% oxygen, {lowExt} of {low.length} flames went out before the droplet burned away. Click any dot to see the full NASA record.
          </p>
        </div>
        <div className="mt-8">
          <DropletField dots={dots} />
        </div>
      </section>

      <section className="border-b border-ink-800 px-5 py-6 md:px-8">
        <OverviewActions />
      </section>

      <section className="px-5 pt-8 md:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-100">Two ISS investigations, one searchable record</h2>
          <p className="text-sm text-ink-400">
            {s.total} tests · {s.flagged} carry data notes from {s.logEntries} logged cleaning decisions
          </p>
        </div>
        <div className="mt-5 grid gap-px overflow-hidden rounded-xl border border-ink-800 bg-ink-800 lg:grid-cols-2">
          {investigations.map((inv) => {
            const isFlex = inv.id === "PSI-69";
            return (
              <article key={inv.id} className="flex flex-col bg-ink-900 p-7">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">{inv.acronym}</Badge>
                  <span className="text-xs text-ink-400">{inv.id}, {inv.fuel_phase}</span>
                </div>
                <h3 className="mt-3 text-[17px] font-semibold text-ink-100">{inv.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">{inv.summary}</p>
                <dl className="mt-5 grid grid-cols-3 gap-4 text-sm">
                  <div><dt className="text-xs text-ink-400">Tests</dt><dd className="mt-0.5 font-semibold text-ink-100">{isFlex ? s.flex : s.bass}</dd></div>
                  <div><dt className="text-xs text-ink-400">Initial O₂</dt><dd className="mt-0.5 font-semibold text-ink-100">{range((isFlex ? flex.map((p) => p.o2) : bass.map((t) => t.o2_initial_pct)))}%</dd></div>
                  {isFlex ? (
                    <div><dt className="text-xs text-ink-400">Pressure</dt><dd className="mt-0.5 font-semibold text-ink-100">{range(flex.map((p) => p.pAtm))} atm</dd></div>
                  ) : (
                    <div><dt className="text-xs text-ink-400">Initial airflow</dt><dd className="mt-0.5 font-semibold text-ink-100">{range(bass.map((t) => (t.acronym === "BASS-II" ? t.airflow_initial_cm_s : null)), 0)} cm/s</dd></div>
                  )}
                </dl>
                <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-6 text-sm">
                  <Link href="/explorer" className="font-medium text-accent hover:underline">Browse {inv.acronym} tests</Link>
                  <Link href="/compare" className="text-ink-200 hover:text-ink-100 hover:underline">Compare results</Link>
                  <a href={`https://doi.org/${inv.doi}`} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-ink-100">DOI {inv.doi}</a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-5 pt-10 md:px-8">
        <h2 className="text-lg font-semibold text-ink-100">How to read this evidence</h2>
        <div className="mt-4 grid gap-8 text-sm leading-relaxed text-ink-300 md:grid-cols-3">
          <p><span className="font-medium text-ink-100">Measured, not modelled.</span> Every value comes from a NASA test table and is shown as reported, with its unit and source file.</p>
          <p><span className="font-medium text-ink-100">Nothing silently fixed.</span> Missing, approximate or implausible values carry a data note you can inspect, down to the original NASA row.</p>
          <p><span className="font-medium text-ink-100">Microgravity is not the Moon or Mars.</span> These ISS results do not directly predict fire behaviour in lunar or Martian partial gravity.</p>
        </div>
      </section>
    </div>
  );
}
