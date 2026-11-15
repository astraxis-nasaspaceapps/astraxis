# Astraxis

**Microgravity fire safety evidence, searchable.** Astraxis turns NASA's International Space Station combustion
experiments into test-level records you can search, compare and trace back to the original NASA data, with an
AI research assistant that answers only from that evidence and cites every test it uses.

Built by team Astraxis for the **NASA Space Apps Challenge 2026**, challenge *Flame in Freefall: SI-Powered Fire
Safety Insights from Microgravity Combustion Data*.

## What it does
- **Overview**: every FLEX droplet test as one dot, by oxygen level and outcome.
- **Experiment Explorer**: 403 test records (274 FLEX, 129 BASS-II) with search, filters, units, data-quality notes
  and the original NASA row for each test.
- **Compare**: how tests ended by oxygen level, droplet size at flame-out, burning rate, and the BASS-II
  oxygen/airflow conditions map. Every chart has a table view, source and limitations.
- **Research Assistant**: finds and ranks matching tests, computes evidence statistics, then has an LLM explain
  them under strict rules (observations vs. interpretation vs. limits). Citations are checked on the server;
  any citation to a record the model was not shown is removed and marked "unverified".
- **Habitat conditions**: the FLEX tests nearest to planned Moon-base air (30%+ O₂ at about 10.2 psi). In the 17
  nearest tests none ended with the flame going out, against 25 of 26 at the same pressure with under 20% O₂.
- **Spacecraft materials (SAFFIRE)**: NASA's SAFFIRE I–III tables. In SAFFIRE-II, 5 of 9 samples burned less in
  microgravity than in NASA's 1-g comparison, while the cotton-fiberglass fabric burned its full length both ways.
- **Investigations ranked**: all 24 combustion investigations in NASA's PSI catalog, scored on five habitat
  fire-safety criteria, each mark backed by a quote from NASA's catalog entry.
- **Flame-out model**: a logistic model of FLEX flame-out (oxygen, pressure, added gas, fuel, droplet size).
  Cross-validated accuracy 83% vs 69% for always guessing; predicted probabilities match observed rates by oxygen
  band. It predicts only inside NASA's tested ranges and shows how many real tests back each prediction.
- **Ctrl+K search**: jump to any test ID or page, or send a question to the assistant.

## NASA data
| Investigation | Source | DOI |
|---|---|---|
| PSI-69 FLEX, Flame Extinguishment Experiment | `PSI-69_Experimental table_FLEX.csv` | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) |
| PSI-25 BASS-II, Burning and Suppression of Solids II | `BASS-II Test Matrix by PI Final.xlsx`, BASS-II data FAQ | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) |
| PSI-98 SAFFIRE-I, Spacecraft Fire Safety Experiment-I | `PSI-98_Experimental table_SAFFIRE-1.csv` | [10.60555/0t15-1z43](https://doi.org/10.60555/0t15-1z43) |
| PSI-99 SAFFIRE-II, Spacecraft Fire Experiment-II | `PSI-99_Experimental table_SAFFIRE-2.csv` | [10.60555/2chp-m469](https://doi.org/10.60555/2chp-m469) |
| PSI-100 SAFFIRE-III, Spacecraft Fire Experiment-III | `PSI-100_Experimental table_SAFFIRE-3.csv` | [10.60555/040q-4h36](https://doi.org/10.60555/040q-4h36) |
| All 24 PSI Combustion Science investigations | NASA PSI catalog entries (psi.nasa.gov), for the ranking | |

Also used for context: *BASS-II Summary Report* (NASA/TM-20210011385). All PSI data is CC0-1.0.
Cleaning rules and every cleaning decision are listed on the app's **Sources and data notes** page.

## Run locally
```bash
npm install
cp .env.example .env.local   # then fill in ONE AI provider (optional; the assistant works without it, minus the written explanation)
npm run dev                  # http://localhost:3000
```
Requires Node 20+. Next.js 16.4 (App Router, Cache Components), React, TypeScript, Tailwind CSS 4, Motion.
The data in `src/data/` is rebuilt from NASA's files by the Python scripts in [`pipeline/`](pipeline/README.md).

## Use of AI (SI) tools
Disclosed per NASA Space Apps rules:
- **In the product:** the Research Assistant calls a large language model (Azure OpenAI `gpt-4.1-mini` in our
  deployment) to write explanations. Its input is limited to NASA test records and statistics computed by our code,
  and its citations are validated by our code before display.
- **In development:** AI coding assistants (Anthropic Claude) were used to help write and review the application
  code, the data-cleaning pipeline and the documentation. The team defined the project idea, scope and data
  choices, inspected the NASA files, and tested and verified the results against the original NASA data.
- **Images:** the logo/icon was drawn as code with AI assistance; no AI-generated photos or video are used.

## Limitations
- Microgravity (ISS) results do not directly predict fire behaviour in lunar or Martian partial gravity.
- The FLEX burning-rate unit is not yet confirmed from a NASA document, so charts show it without a unit.
- The BASS-II test table contains conditions only; outcomes and spread rates are in NASA/TM-20210011385.
- SAFFIRE ran in ordinary cabin air (~21.5–22% O₂), not habitat oxygen; SAFFIRE-II has 9 samples.
- The investigation ranking uses NASA's catalog descriptions; "Not stated" means the catalog doesn't say.
- The flame-out model describes microgravity droplets only, predicts NASA's undefined "Test end" label, and is a
  research aid, not a fire-safety design tool.
