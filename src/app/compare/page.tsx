import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { CompareDashboard } from "@/components/compare/CompareDashboard";
import { bassPoints, flexPoints } from "@/lib/data";

export const metadata: Metadata = { title: "Compare | Astraxis" };

export default function ComparePage() {
  return (
    <>
      <PageHeader title="Compare">
        Patterns across NASA&apos;s microgravity fire tests, using measured values only. Hover any point for its numbers and click it to open the full test record.
      </PageHeader>
      <CompareDashboard flex={flexPoints()} bass={bassPoints()} />
    </>
  );
}
