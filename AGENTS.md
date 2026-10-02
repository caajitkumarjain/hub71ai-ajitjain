# AGENTS.md: working rules for Codex on Manzil

Source of truth: `MANZIL-CODEX-BUILD-SPEC.md`. Build per §15-S (4.5-hour plan, parallel tasks); the 4.5-HOUR MODE box and all "-S" sections override earlier sections. Redeploy to Vercel after each phase.

1. **No invented facts.** Fees, penalties, deadlines, thresholds and durations come ONLY from `data/rules.json` and `data/steps.json` as specified in §9–10. Missing facts render `UNKNOWN · verify with <authority>`.
2. **Engines compute, agents explain.** All dates, totals, scores and critical paths come from pure functions in `lib/engines/*`, each with vitest tests. Agents call tools; they never do arithmetic.
3. **Draft-only.** Nothing submits, sends, pays or contacts anyone on the user's behalf.
4. **Agent results** follow `AgentResult` (complete | abstain | escalate) and pass the Verifier (§7.4) before reaching the UI.
5. **Model IDs come from env vars.** Look up exact IDs in the OpenAI docs; never hardcode or guess them.
6. **Security.** `OPENAI_API_KEY` is server-only. Realtime uses ephemeral secrets. Admin is passcode-gated. Uploads are size/MIME-checked and never persisted server-side.
7. **Dependencies.** Install only packages named in §2. Use exact pinned versions, from the default npm registry only.
8. **Code style.** TypeScript strict. kebab-case files, PascalCase components, camelCase functions. Every boundary is validated by a zod schema.
9. **UI.** Use the §4 tokens only (no ad-hoc hex values in components). No purple AI gradients, no emoji icons, no lorem ipsum. Respect reduced motion. Mobile at 375 px with no horizontal scroll.
10. **Honesty in the UI.**
    - Estimates are labelled "estimate".
    - The synthetic cohort is labelled.
    - Fallback fixtures show a "cached" chip.
    - Fixtures are recorded from real runs, never hand-written.
11. **Done means verified.** Before saying a phase is done, run `pnpm test` and `pnpm build`, and check the phase's "Done when" against the deployed URL.
