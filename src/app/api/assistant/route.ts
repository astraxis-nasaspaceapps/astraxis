import { activeProvider, complete } from "@/lib/llm";
import { catalogEvidence, catalog, rankedInvestigations, CRITERIA } from "@/lib/catalog";
import saffireJson from "@/data/saffire.json";
import { gapsEvidence } from "@/lib/gaps";
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
8. If a PSI CATALOG RANKING is in the evidence, never state any rank, score or ordering yourself: when the question asks which investigations matter most, the server inserts the exact ranked list at the top of your answer. You may discuss the investigations named in that ranking, citing them as [PSI-20]. Make clear that catalog-only investigations are judged from NASA's catalog descriptions, not their test data, and that PSI-69 and PSI-25 have full test data in Astraxis and SAFFIRE I–III (PSI-98, PSI-99, PSI-100) have small test tables. Only ever cite IDs of the form PSI-<number> or PSI-<number>:<record>; never cite section names.
9. If SAFFIRE SAMPLES are in the evidence, quote burn lengths exactly as NASA wrote them (e.g. "~ 0", "Complete"); never turn words into numbers. Say they ran in ordinary cabin air (about 21.5–22% O2), not habitat oxygen. Cite samples as [PSI-99:2-1].
10. If EVIDENCE GAPS are in the evidence, report each gap with its counts exactly as given and present suggested tests as Astraxis proposals, not NASA plans.
11. Plain text only. You may use "- " bullets and **bold**. Under 260 words.`;

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

  const askAboutInvestigations = /investigation|experiment|relevan|rank|habitat|spacecraft|moon base|rover|which (study|studies)|most useful|equipment|saffire|bass\b|same\b|acme/i.test(q);
  const askForRanking = askAboutInvestigations && /\b(most|rank\w*|relevan\w*|important|best|priorit\w*|top|matter\w*|useful)\b|which (psi )?(investigation|experiment|stud)/i.test(q) && /investigation|experiment|stud(y|ies)|dataset|data set/i.test(q);
  const askAboutMaterials = /material|fabric|saffire|silicone|pmma|nomex|sibal|plastic|cotton|cabin|1-g|normal gravity|screening/i.test(q);
  const saffire = saffireJson as unknown as { samples: { record_id: string; acronym: string; material: string | null; thickness: string | null; o2: string | null; direction: string | null; burn_time: string | null; ug_burn_length: string | null; ug_spread: string | null; g1_burn_length: string | null; g1_spread: string | null; comparison: string | null }[]; summary: Record<string, number> };
  const saffireEvidence = askAboutMaterials
    ? `SAFFIRE SAMPLES (NASA PSI-98/99/100 experimental tables; spacecraft materials burned in an uncrewed Cygnus vehicle after it left the ISS; values exactly as NASA wrote them; summary of the 9 SAFFIRE-II samples: ${JSON.stringify(saffire.summary)}):\n` +
      saffire.samples.map((x) => `${x.record_id} (${x.acronym}): ${x.material ?? "material blank in NASA's table"}, thickness ${x.thickness}, O2 ${x.o2 ?? "not in table"}, flow ${x.direction}, burn time ${x.burn_time ?? "not in table"}${x.ug_burn_length !== null ? `, microgravity burn length ${x.ug_burn_length}, microgravity spread ${x.ug_spread}, 1-g burn length ${x.g1_burn_length}, 1-g spread ${x.g1_spread}, result ${x.comparison}` : ""}`).join("\n")
    : "";
  const askAboutGaps = /gap|missing|untested|not (been )?tested|test next|next experiment|should (nasa )?test|future (test|experiment)|unknown|what.*(lack|need)/i.test(q);
  if (provider && ranked.length) {
    const evidence = [
      `QUESTION: ${q}`,
      `HOW THE QUESTION WAS INTERPRETED: ${notes.map((n) => n.text + (n.assumed ? " (assumption)" : "")).join("; ") || "no filters; all tests"}`,
      relaxed.length ? `LOOSENED CONDITIONS: ${relaxed.join(", ")}` : "",
      `INVESTIGATIONS: ${JSON.stringify(context)}`,
      `STATISTICS OVER ALL ${subset.length} MATCHING TESTS: ${JSON.stringify(stats)}`,
      `TOP ${top.length} MATCHING TEST RECORDS (record ID: summary):`,
      ...top.map((r) => `${r.id}: ${r.summary}${r.flags ? ` [has ${r.flags} data note(s)]` : ""}`),
      saffireEvidence,
      askAboutGaps ? `EVIDENCE GAPS (computed by Astraxis from the FLEX, BASS-II and SAFFIRE tables; suggested tests are Astraxis proposals, not NASA plans):\n${gapsEvidence()}` : "",
      askAboutInvestigations ? `PSI CATALOG RANKING (all ${catalog.investigations.length} PSI combustion investigations, ranked by 5 habitat fire-safety criteria: 30%+ O2, low pressure, spacecraft materials, fire-safety use, flight data; evidence quoted from NASA's catalog):\n${catalogEvidence()}` : "",
    ].filter(Boolean).join("\n");
    try {
      const r = await complete(SYSTEM, evidence);
      model = r.model;
      // Citation check: keep only IDs that exist in the evidence the model was given.
      // Allowed = exactly the records the model was shown, plus the matched investigations.
      const allowed = new Set<string>([...top.map((x) => x.id), ...invIds, ...(askAboutInvestigations ? catalog.investigations.map((i) => i.id) : []), ...(askAboutMaterials ? [...saffire.samples.map((x) => x.record_id), "PSI-98", "PSI-99", "PSI-100"] : [])]);
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
      // Never cite section names like [PSI CATALOG RANKING].
      answer = answer.replace(/\s*\[(?!PSI-\d)[A-Z][A-Z ]+\]/g, "");
      if (askForRanking) {
        const top5 = rankedInvestigations().slice(0, 5);
        const lines = top5.map((r) => {
          const met = CRITERIA.filter((c) => r.criteria[c.key].v === true).map((c) => c.short).join(", ");
          return `- Rank ${r.rank}, ${r.score} of 5 criteria: **${r.acronym || r.title}** [${r.id}], ${r.inAstraxis ? "full test data in Astraxis" : "catalog description only"}. Meets: ${met}.`;
        });
        const block = [`- Astraxis ranks all ${catalog.investigations.length} PSI combustion investigations on 5 habitat fire-safety criteria, using NASA's catalog descriptions. The top five:`, ...lines].join("\n");
        answer = /What the NASA data shows/i.test(answer)
          ? answer.replace(/(What the NASA data shows[^\n]*\n)/i, `$1${block}\n`)
          : `What the NASA data shows\n${block}\n\n${answer}`;
      }
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
