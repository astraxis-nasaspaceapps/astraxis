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
- **Ctrl+K search**: jump to any test ID or page, or send a question to the assistant.

## NASA data
| Investigation | Source | DOI |
|---|---|---|
| PSI-69 FLEX, Flame Extinguishment Experiment | `PSI-69_Experimental table_FLEX.csv` | [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451) |
| PSI-25 BASS-II, Burning and Suppression of Solids II | `BASS-II Test Matrix by PI Final.xlsx`, BASS-II data FAQ | [10.60555/4qc4-de67](https://doi.org/10.60555/4qc4-de67) |

Also used for context: *BASS-II Summary Report* (NASA/TM-20210011385). All PSI data is CC0-1.0.
Cleaning rules and every cleaning decision are listed on the app's **Sources and data notes** page.

## Run locally
```bash
npm install
cp .env.example .env.local   # then fill in ONE AI provider (optional; the assistant works without it, minus the written explanation)
npm run dev                  # http://localhost:3000
```
Requires Node 20+. Next.js 16.4 (App Router, Cache Components), React, TypeScript, Tailwind CSS 4, Motion.
The dataset in `src/data/` is produced by a separate Python pipeline (`build_dataset.py`).

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
