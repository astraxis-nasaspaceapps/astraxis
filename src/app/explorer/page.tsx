import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/explorer/Explorer";
import { PageHeader } from "@/components/ui";
import { fieldDictionary, investigations, logByRecord, tests } from "@/lib/data";

export const metadata: Metadata = { title: "Experiment Explorer | Astraxis" };

export default function ExplorerPage() {
  return (
    <div className="flex h-screen min-h-[640px] flex-col">
      <PageHeader title="Experiment Explorer">
        Every row is one test from NASA&apos;s PSI repository. Select a test to see its conditions, measurements, data notes and the original NASA record.
      </PageHeader>
      {/* useSearchParams (deep links from charts) needs a Suspense boundary under Cache Components */}
      <Suspense fallback={<div className="px-8 py-6 text-sm text-ink-400">Loading tests…</div>}>
        <Explorer tests={tests} investigations={investigations} fields={fieldDictionary} logByRecord={logByRecord()} />
      </Suspense>
    </div>
  );
}
