import type { Metadata } from "next";
import { Badge, Card, PageHeader } from "@/components/ui";
import { cleaningLog, fieldDictionary, investigations } from "@/lib/data";
import { FLAG_LABELS } from "@/lib/format";

export const metadata: Metadata = { title: "Sources & Data Notes | Astraxis" };

export default function SourcesPage() {
  const counts = cleaningLog.reduce<Record<string, number>>((a, e) => ((a[e.flag] = (a[e.flag] ?? 0) + 1), a), {});
  return (
    <>
      <PageHeader title="Sources and data notes">
        Astraxis uses NASA Physical Sciences Informatics (PSI) data released under CC0-1.0. This page lists the source files, known limitations, field units and every cleaning decision.
      </PageHeader>
      <div className="space-y-6 px-8 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {investigations.map((inv) => (
            <Card key={inv.id} className="p-6">
              <div className="flex items-center gap-2"><Badge tone="accent">{inv.acronym}</Badge><span className="text-xs text-ink-400">{inv.id}</span></div>
              <h2 className="mt-2 font-medium text-ink-100">{inv.title}</h2>
              <p className="mt-1 text-xs text-ink-400">
                DOI <a href={`https://doi.org/${inv.doi}`} className="text-accent hover:underline" target="_blank" rel="noreferrer">{inv.doi}</a> · {inv.license} · {inv.investigation_start} to {inv.investigation_end}
              </p>
              <h3 className="mt-4 text-xs font-semibold text-ink-300">Source files</h3>
              <ul className="mt-1 space-y-0.5 font-mono text-xs text-ink-200">{inv.source_files.map((f) => <li key={f}>{f}</li>)}</ul>
              {inv.related_report && (
                <p className="mt-3 text-xs text-ink-300">Related report: {inv.related_report.title} ({inv.related_report.id}). {inv.related_report.note}</p>
              )}
              <h3 className="mt-4 text-xs font-semibold text-ink-300">Known limitations</h3>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-ink-300">{inv.known_limitations.map((l) => <li key={l}>{l}</li>)}</ul>
              <a href={inv.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-accent hover:underline">Open on NASA PSI</a>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h2 className="font-medium text-ink-100">Fields and units</h2>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
            <thead className="text-left text-xs text-ink-400"><tr><th className="py-1.5 pr-4 font-medium">Field</th><th className="pr-4 font-medium">Unit</th><th className="font-medium">Note</th></tr></thead>
            <tbody>
              {Object.entries(fieldDictionary).map(([k, f]) => (
                <tr key={k} className="border-t border-ink-800 align-top">
                  <td className="py-1.5 pr-4 text-ink-100">{f.label}</td>
                  <td className="pr-4 font-mono text-ink-200">{f.unit ?? "—"}{f.unit_verified === false && <span className="ml-2"><Badge tone="warn">unverified</Badge></span>}</td>
                  <td className="text-ink-400">{f.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>

        <Card className="p-6">
          <h2 className="font-medium text-ink-100">Cleaning decisions ({cleaningLog.length})</h2>
          <p className="mt-1 text-sm text-ink-400">Each record&apos;s individual notes are shown in the Experiment Explorer.</p>
          <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([flag, n]) => (
              <li key={flag} className="flex justify-between gap-4 border-b border-ink-800 py-1.5"><span className="text-ink-300">{FLAG_LABELS[flag] ?? flag}</span><span className="font-mono text-ink-100">{n}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
