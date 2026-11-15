import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { FireLab } from "@/components/lab/FireLab";
import { flexPoints } from "@/lib/data";
import { flexModel } from "@/lib/model";

export const metadata: Metadata = { title: "Habitat Fire Lab | Astraxis" };

export default function LabPage() {
  return (
    <>
      <PageHeader title="Habitat Fire Lab">
        Design a habitat atmosphere and see what NASA&apos;s microgravity evidence says a fire would do in it. Pick any mix of oxygen and cabin pressure, including the atmospheres NASA has considered for crews. Where NASA never tested, the lab says so instead of guessing.
      </PageHeader>
      <FireLab model={flexModel} points={flexPoints()} />
    </>
  );
}
