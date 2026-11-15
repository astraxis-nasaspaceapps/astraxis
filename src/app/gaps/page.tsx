import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { evidenceGaps, TARGET } from "@/lib/gaps";

export const metadata: Metadata = { title: "Evidence gaps | Astraxis" };

export default function GapsPage() {
  const gaps = evidenceGaps();
  return (
    <>
      <PageHeader title="Evidence gaps: what NASA should test next">
        Astraxis checks NASA&apos;s microgravity fire data against the air planned for Moon bases and rovers ({TARGET.o2}% oxygen or more at {TARGET.psi} psi or less). These are the conditions habitats need that no test in the data covers. Every count is computed from NASA&apos;s tables.
      </PageHeader>
      <div className="space-y-6 px-5 py-6 md:px-8">
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink-800 text-xs text-ink-400">
              <tr><th className="px-4 py-2.5 font-medium">What a habitat needs to know</th><th className="px-4 py-2.5 font-medium">Tests in the data</th><th className="px-4 py-2.5 font-medium">Suggested next test</th></tr>
            </thead>
            <tbody className="text-ink-200">
              {gaps.map((g) => (
                <tr key={g.id} className="border-b border-ink-850 align-top last:border-0">
                  <td className="px-4 py-3"><a href={`#${g.id}`} className="font-medium text-ink-100 hover:text-accent">{g.title}</a></td>
                  <td className="px-4 py-3 tabular-nums"><span className="text-lg font-semibold text-ink-100">{g.count}</span> <span className="text-ink-400">of {g.of}</span></td>
                  <td className="px-4 py-3 text-ink-300">{g.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {gaps.map((g, i) => (
            <Card key={g.id} className="scroll-mt-6 p-5" >
              <div id={g.id} className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-accent">Gap {i + 1}</span>
                <span className="text-xs tabular-nums text-ink-400">{g.count} of {g.of} {g.ofLabel}</span>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-ink-100">{g.title}</h2>
              <dl className="mt-3 space-y-3 text-sm leading-relaxed">
                <div><dt className="text-xs text-ink-400">Closest evidence</dt><dd className="text-ink-200">{g.closest}</dd></div>
                <div><dt className="text-xs text-ink-400">Why it matters</dt><dd className="text-ink-200">{g.why}</dd></div>
                <div><dt className="text-xs text-ink-400">Suggested next test (our proposal)</dt><dd className="text-ink-100">{g.next}</dd></div>
                {g.maybeElsewhere && <div><dt className="text-xs text-ink-400">Possibly covered elsewhere</dt><dd className="text-ink-300">{g.maybeElsewhere}</dd></div>}
              </dl>
              <div className="mt-4 flex flex-wrap gap-4 text-xs">
                {g.links.map((l) => <Link key={l.href} href={l.href} className="text-accent hover:underline">{l.label}</Link>)}
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-100">How to read this</h2>
          <ul className="mt-2 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-300">
            <li>A gap means no test in the FLEX, BASS-II or SAFFIRE tables in Astraxis covers that combination. Other PSI investigations may have, where noted, but their tables don&apos;t let us check test by test.</li>
            <li>The suggested tests are Astraxis&apos;s proposals, based on where the data stops, not NASA plans.</li>
            <li>All of these are microgravity questions. Lunar and Martian gravity are a further gap that no PSI data covers.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
