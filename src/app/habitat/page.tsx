import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { HabitatView } from "@/components/habitat/HabitatView";
import { bassPoints, flexPoints } from "@/lib/data";

export const metadata: Metadata = { title: "Habitat conditions | Astraxis" };

export default function HabitatPage() {
  const bass = bassPoints();
  const o2 = bass.map((b) => b.o2).filter((v): v is number => v !== null);
  return (
    <>
      <PageHeader title="Habitat conditions">
        Which NASA microgravity fire tests come closest to the oxygen-rich, low-pressure air planned for Moon bases and rovers, and how those tests ended.
      </PageHeader>
      <HabitatView flex={flexPoints()} bassTests={bass.length} bassO2={[Math.min(...o2), Math.max(...o2)]} />
    </>
  );
}
