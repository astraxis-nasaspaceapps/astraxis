import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { Assistant } from "@/components/assistant/Assistant";

export const metadata: Metadata = { title: "Research Assistant | Astraxis" };

export default function AssistantPage() {
  return (
    <>
      <PageHeader title="Research Assistant">
        Ask a question about NASA&apos;s microgravity fire tests. Astraxis finds and ranks the matching test records, then explains them using only that evidence, with every test cited.
      </PageHeader>
      {/* useSearchParams (?q=) needs a Suspense boundary under Cache Components */}
      <Suspense fallback={null}>
        <Assistant />
      </Suspense>
    </>
  );
}
