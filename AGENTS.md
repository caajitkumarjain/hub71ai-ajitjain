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

## HARD TIMELINE (Abu Dhabi time, UTC+4): this overrides the clock times in the spec's §15-S

The judges check GitHub commit time and SHA. **Code freeze is 15:30.** Nothing is committed after that.

| Deadline | Must be merged + pushed to GitHub `main` |
|---|---|
| 13:00 | Phase 2A pushed on `main`; Phase 2B committed on branch `phase-b`, with `main` merged into it |
| 14:10 | Phase 3A (on `main`) + Phase 3B (on `phase-b`) done; `phase-b` merged into `main`, everything wired and pushed |
| 14:05 | Agent Control Room (/agents) committed on branch `phase-c`; merged into `main` in the 14:10 merge together with `phase-b` |
| 14:45 | Bawsala jurisdiction navigator committed on `phase-c` (after the Agents page; upgrades the existing jurisdiction engine/card, no duplicates) |
| 14:50 | Phase 4 on `main` (admin + fixtures + Rulebook + README) AND, in parallel on `phase-b`, the Company Setup Studio (/company) |
| 15:00 | `phase-b` (Company Studio) merged into `main` and pushed |
| 15:15 | Phase 5 (acceptance checklist §17-S passes on the live URL) |
| 15:30 | Final push. FREEZE. |

**Clock rules for every task:**
1. Run `Get-Date` at the start of the task and again before each major step.
2. Fifteen minutes before your phase deadline, stop adding features. Make what exists pass `pnpm test` and `pnpm build`, then commit and push. A working smaller feature beats a broken bigger one.
3. If the deadline passes mid-feature, revert or disable the unfinished part (feature flag or hidden route), push the working state, and report what was cut.
4. If behind at 14:10, cut in this order:
   1. hiring stepper;
   2. "Where to set up" card;
   3. Mission Pack streaming;
   4. admin live-runs table.
5. **Never cut:**
   - Path timeline
   - Bank Fix animation
   - Revenue what-if
   - Ask Manzil + theatre
   - Friction Radar
   - Source chips
6. Push to GitHub after every phase, not just at the end, so a valid timestamped commit always exists.
