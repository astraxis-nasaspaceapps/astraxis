import { activeProvider, complete } from "@/lib/llm";
import { evidenceStats, investigationContext, parseQuestion, search, stratify } from "@/lib/retrieval";

const SYSTEM = `You are the Astraxis research assistant. You explain NASA microgravity combustion evidence to researchers and engineers.

Rules, all mandatory:
1. Use ONLY the EVIDENCE provided in the user message. No outside facts, no numbers that are not in the evidence, no literature you remember.
2. Cite every specific claim. Cite individual tests by their FULL record ID in square brackets exactly as given, e.g. [PSI-69:070] or [PSI-69:070, PSI-69:071]; never abbreviate IDs. Cite aggregate statistics with the investigation ID, e.g. [PSI-69].
3. Structure the answer in three short parts with these exact headings on their own lines:
   What the NASA data shows
   Interpretation
   Limits of this evidence
   "What the NASA data shows" contains only observations from the evidence. "Interpretation" may explain possible mechanisms in general physical terms, but every sentence must be hedged ("likely", "may", "is consistent with"), and it must not introduce new numbers. "Limits of this evidence" names missing data, confounders and caveats from the evidence.
4. Never predict fire behaviour on the Moon, Mars or in partial gravity. If asked, say microgravity data cannot answer that.
5. If the evidence cannot answer the question, say so plainly and say what data would be needed.
6. The FLEX burning-rate unit is unverified: never attach a unit to burning-rate values. Band medians of burning rate are over ALL tests in the band, not only tests that ended in extinction.
7. BASS-II records contain test conditions only, not outcomes or flame spread rates: never claim BASS-II outcomes.
8. Plain text only. You may use "- " bullets and **bold**. Under 260 words.`;

export async function POST(req: Request) {
  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  const q = (question ?? "").trim().slice(0, 500);
  if (!q) return Response.json({ error: "Ask a question about the NASA tests." }, { status: 400 });

  const { criteria, notes } = parseQuestion(q);
  const { ranked, relaxed, subset } = search(criteria);
  const stats = evidenceStats(subset);
  const invIds = [...new Set(subset.map((t) => t.investigation_id))];
  const context = investigationContext(invIds.length ? invIds : ["PSI-69", "PSI-25"]);
  const top = stratify(ranked, 30);

  const warnings: string[] = [];
  if (/\b(mars|martian|moon|lunar|partial gravity|reduced gravity on|planet)/i.test(q)) {
    warnings.push("These are microgravity (ISS) results. They cannot predict fire behaviour on the Moon, Mars or in other partial-gravity environments, so this question can only be answered for microgravity.");
  }
  if (relaxed.length) warnings.push(`No tests matched every condition, so these were loosened: ${relaxed.join(", ")}.`);

  let answer: string | null = null;
  let model: string | null = null;
  const provider = activeProvider();

  if (provider && ranked.length) {
    const evidence = [
      `QUESTION: ${q}`,
      `HOW THE QUESTION WAS INTERPRETED: ${notes.map((n) => n.text + (n.assumed ? " (assumption)" : "")).join("; ") || "no filters; all tests"}`,
      relaxed.length ? `LOOSENED CONDITIONS: ${relaxed.join(", ")}` : "",
      `INVESTIGATIONS: ${JSON.stringify(context)}`,
      `STATISTICS OVER ALL ${subset.length} MATCHING TESTS: ${JSON.stringify(stats)}`,
      `TOP ${top.length} MATCHING TEST RECORDS (record ID: summary):`,
      ...top.map((r) => `${r.id}: ${r.summary}${r.flags ? ` [has ${r.flags} data note(s)]` : ""}`),
    ].filter(Boolean).join("\n");
    try {
      const r = await complete(SYSTEM, evidence);
      model = r.model;
      // Citation check: keep only IDs that exist in the evidence the model was given.
      // Allowed = exactly the records the model was shown, plus the matched investigations.
      const allowed = new Set<string>([...top.map((x) => x.id), ...invIds]);
      const removed: string[] = [];
      answer = r.text.replace(/\[([^\]]+)\]/g, (full, inner: string) => {
        // expand shorthand like "PSI-69:059, 066" to "PSI-69:059, PSI-69:066" so every ID gets checked
        let prefix = "";
        const ids = inner.split(/[,;]\s*/).map((x) => x.trim()).map((x) => {
          const m = x.match(/^(PSI-\d+):/);
          if (m) { prefix = m[1]; return x; }
          return prefix && /^[\w-]+$/.test(x) && !/^PSI-/.test(x) ? `${prefix}:${x}` : x;
        });
        const looksLikeCitation = ids.every((x) => /^PSI-\d+(:[\w-]+)?$/.test(x));
        if (!looksLikeCitation) return full;
        const ok = ids.filter((x) => allowed.has(x));
        ids.filter((x) => !allowed.has(x)).forEach((x) => removed.push(x));
        return ok.length ? `[${ok.join(", ")}]` : "[unverified]";
      });
      if (removed.length) warnings.push(`${removed.length} citation(s) pointed to records the assistant was not shown (${[...new Set(removed)].join(", ")}). They were removed and the claims marked “unverified”.`);
    } catch (e) {
      warnings.push(`The AI explanation is unavailable right now (${(e as Error).message.slice(0, 120)}). The evidence below is unaffected.`);
    }
  }

  return Response.json({
    question: q,
    interpretation: notes,
    relaxed,
    matchCount: ranked.length,
    // list the records the assistant actually used first, then the rest of the ranking
    ranked: [...top, ...ranked.filter((r) => !top.some((t) => t.id === r.id))].slice(0, 50),
    stats,
    investigations: context,
    answer,
    provider: answer ? provider : null,
    model,
    aiConfigured: !!provider,
    warnings,
  });
}
