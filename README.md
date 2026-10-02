# Manzil — Arrive. Build. Belong.

**Live demo: [manzil-flame-delta.vercel.app](https://manzil-flame-delta.vercel.app)**

Manzil connects an Abu Dhabi founder’s arrival, residency, company, home, family and operations into one sourced path. Deterministic engines compute the plan; OpenAI agents explain it and prepare drafts. Nothing submits forms, sends messages, pays or contacts an authority for you.

## The three-minute judges’ journey

1. **0:00–0:40 — Start with Priya.** On the home page, choose the Priya demo. Open **Your path** to see dependencies, parallel work and the estimated finish date. Select a step to inspect its documents, source and next steps.
2. **0:40–1:15 — Fix bank readiness.** Open **Bank check**. Priya begins at **52**; apply the proposed activity fix to reach **82**. This is a preparation score, not a bank decision. Inspect the findings and source-backed explanation.
3. **1:15–1:50 — Change the revenue scenario.** Open **Deadlines** and try **AED 400,000** in the revenue what-if. Inspect the VAT obligation and its source. The engine computes the change; estimates and unknowns remain labelled.
4. **1:50–2:30 — Watch agents work.** Open **Ask Manzil** and ask “Why is my bank score low?”. Watch the Agent Theatre show handoffs, tools and verification. Open **Agents** to inspect an agent’s contract, guardrails and acceptance cases.
5. **2:30–3:00 — Inspect the evidence.** Open the footer’s **Rulebook**, search for an authority or seed ID, inspect the verification metadata and download the JSON dataset. For the operator view: **/admin — passcode given at the desk**.

Useful links: [Path](https://manzil-flame-delta.vercel.app/path) · [Bank](https://manzil-flame-delta.vercel.app/bank) · [Deadlines](https://manzil-flame-delta.vercel.app/deadlines) · [Agents](https://manzil-flame-delta.vercel.app/agents) · [Rulebook](https://manzil-flame-delta.vercel.app/rulebook) · [Admin](https://manzil-flame-delta.vercel.app/admin).

## How it works

- **Pure engines:** `lib/engines` evaluates conditions, compiles the dependency graph and critical path, compares jurisdiction costs, scores bank readiness, computes obligations and runs what-if scenarios. Fees, deadlines, penalties and estimates come from the seeds; missing values stay unknown.
- **OpenAI Agents SDK:** `lib/agents/run.ts` uses the TypeScript `@openai/agents` SDK, a real `Runner`, Responses models and `withTrace`. The Concierge hands off to Pathfinder, Bank Officer, Deadline Sentinel or Mission Builder. Activity Matcher supports activity selection, including the Bank Officer’s nested tool workflow.
- **Typed tools:** agents call validated tools such as `compile_path`, `get_step`, `explain_dependencies`, `compare_jurisdictions`, `run_bankability`, `compute_obligations`, `what_if`, `get_activity` and `get_rules`. Tools receive the validated session profile and call the deterministic engines. Models do not calculate dates, totals or scores.
- **Input guardrails:** requests for instruction overrides, secrets or unauthorised external action are stopped with an `escalate` result. Requests, profiles, tool arguments and result boundaries use Zod schemas.
- **Output verification:** every candidate result is checked before answer text reaches the UI. The verifier checks its `complete | abstain | escalate` contract, seeded evidence IDs, current tool evidence, exact numeric tokens, prohibited promises and response language. Activity suggestions must use seeded IDs; bank-review quotes must occur exactly in the profile’s business description. A failed candidate receives one repair attempt, then the run abstains.
- **Tracing and budgets:** streamed events identify agents, handoffs, tool calls/results, guardrail decisions and verifier results in the Agent Theatre. SDK tracing is enabled for live runs with sensitive trace data disabled. Call limits, estimated USD limits, timeouts and cancellation bound each run. Raw unverified model deltas are not shown as an answer.

The Agent Fleet directory also presents declared contracts for Company Studio specialists and the deterministic Input Guardrail and Verifier. Contract acceptance cases describe expected behaviour; they are separate from recorded runtime evaluations. Unknown run metrics display as unknown.

## Sources and the Rulebook

The public dataset contains **35 steps, 19 rules, 6 jurisdictions and 12 activities**, plus the driving-licence exchange seed. The Rulebook derives its counts, dependency links and lane × authority coverage directly from those records. Its search table exposes source links, recorded verification dates, confidence and verification flags. [Download the dataset](https://manzil-flame-delta.vercel.app/api/rulebook).

`data/steps.json` and `data/rules.json` are the source of regulatory facts. Source links and verification metadata are retained in the UI; a recorded date is not a claim that every source has been independently rechecked today. The map is a seeded research starting point, not an exhaustive official register. Estimates are labelled; incomplete costs, conditional penalties and missing sources remain explicit. Confirm current requirements with the named authority.

## Recorded demo fallback and data limits

Four fixtures were recorded from actual production runs: **E1, E2, E8 and bank-note**, each approved by the verifier. When enabled by `DEMO_FALLBACK`, outage fallback is restricted to the exact recorded question and matching Priya profile. It does not answer arbitrary questions with an unrelated recording. Replayed results are marked **cached**. If neither a verified live answer nor a matching recorded result is available, the system abstains.

Profiles and progress are stored in the browser when local storage is available. Server run history uses **bounded, process-local ephemeral memory**: it can reset on restart or deployment, differs between serverless instances, and is not durable shared storage. Live telemetry may be unavailable; absent measurements are not fabricated. Admin views and the labelled synthetic cohort should be read with those limits in mind. The synthetic cohort is demonstration data, not observed founder outcomes.

## Run locally

Use Node **22.15+** and the exact package-manager version in `package.json` (**pnpm 12.8.1**).

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Set `OPENAI_API_KEY` on the server for live agent runs. Configure `OPENAI_MODEL_REASONING` and `OPENAI_MODEL_FAST` for the deployment’s available models; model configuration lives in `lib/agents/config.ts`. `ADMIN_PASSCODE` is server-only and must never be committed. `RUN_MAX_CALLS`, `RUN_BUDGET_USD`, `DEMO_FALLBACK` and `DATA_MODE` control the bounded demo runtime. `.env.example` lists the supported settings without secrets. Deterministic engine tests do not require an API key.

```powershell
pnpm test
pnpm build
```

Tests cover seed validation, engine behaviour, API validation, real SDK execution with a scripted model provider, handoffs and tools, guardrails, verification and repair, budgets, cancellation, multilingual responses, fixture replay, Rulebook export and search. Browser checks additionally exercise the live Priya flow, themes, keyboard interaction and 375px layouts. Accessibility audits and browser checks are recorded during deployment; passing a score does not replace manual review.

The project is linked to Vercel as `manzil`. Deploy the verified build with `vercel --prod`; keep production credentials in Vercel environment settings. `MANZIL-CODEX-BUILD-SPEC.md` defines the build, with its 4.5-hour mode and `-S` sections taking precedence; `AGENTS.md` records the delivery rules and timeline.
