import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { InvestigationRanking } from "@/components/investigations/InvestigationRanking";
import { catalog, CRITERIA, rankedInvestigations } from "@/lib/catalog";

export const metadata: Metadata = { title: "Investigations ranked | Astraxis" };

export default function InvestigationsPage() {
  return (
    <>
      <PageHeader title="Investigations ranked for habitat fire safety">
        All {catalog.investigations.length} combustion investigations in NASA&apos;s PSI repository, ranked by how closely they match what future habitats need: oxygen-rich, low-pressure air, real spacecraft materials and fire-safety hardware. Every mark is backed by a quote from NASA&apos;s own catalog entry.
      </PageHeader>
      <InvestigationRanking rows={rankedInvestigations()} criteria={CRITERIA} retrieved={catalog.retrieved} />
    </>
  );
}
