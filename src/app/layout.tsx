import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar, SidebarFallback } from "@/components/Sidebar";
import { Providers } from "@/components/Providers";
import { PaletteProvider } from "@/components/CommandPalette";
import { tests } from "@/lib/data";
import "@fontsource-variable/public-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Astraxis | Microgravity Fire Safety Research",
  description:
    "Search, compare and interpret NASA microgravity combustion investigations (PSI) for spacecraft fire safety.",
};

// Slim index of every test for the Ctrl+K search (id, label only).
const testIndex = tests.map((t) => ({
  id: t.record_id,
  testId: t.test_id,
  acronym: t.acronym,
  label: `${t.acronym === "FLEX" ? t.fuel_or_material : t.material_class}${t.o2_initial_pct !== null ? `, ${t.o2_initial_pct}% O₂` : ""}${t.pi ? `, ${t.pi}` : ""}`,
}));

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans md:flex-row">
        <Providers>
          <PaletteProvider tests={testIndex}>
            <Suspense fallback={<SidebarFallback />}>
              <Sidebar />
            </Suspense>
            <main className="min-w-0 flex-1">{children}</main>
          </PaletteProvider>
        </Providers>
      </body>
    </html>
  );
}
