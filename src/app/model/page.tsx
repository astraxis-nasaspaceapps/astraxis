import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { ModelView } from "@/components/model/ModelView";
import { flexPoints } from "@/lib/data";
import { flexModel } from "@/lib/model";

export const metadata: Metadata = { title: "Flame-out model | Astraxis" };

export default function ModelPage() {
  return (
    <>
      <PageHeader title="Flame-out model">
        A predictive model trained on NASA&apos;s FLEX droplet tests: how likely a flame is to go out early, given oxygen, pressure, added gas, fuel and droplet size. It only predicts inside the conditions NASA actually tested, and it shows how many real tests back each prediction.
      </PageHeader>
      <ModelView model={flexModel} points={flexPoints()} />
    </>
  );
}
