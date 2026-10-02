# Manzil

Phase 1 foundation for the 4.5-hour build in `MANZIL-CODEX-BUILD-SPEC.md` §15-S. The 4.5-hour box and all `-S` sections take precedence.

## Run

Use the exact pnpm version in `packageManager` (12.8.1) with Node 22.15+.

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
```

The project is linked to Vercel as `manzil`. Deploy with `vercel --prod`.

## Foundation scope

- Seven routes: `/`, `/start`, `/path`, `/bank`, `/deadlines`, `/admin`, `/admin/login`.
- §4 tokens and four Google fonts, Tailwind, shadcn button, GeoPattern, responsive top bar, persistent Sand/Night themes.
- §6 Zod schemas and inferred types, with supporting seed/result contracts. `PathResult` includes §8.2's `nullCostCount`.
- 35 steps, 19 rules, 6 jurisdictions, 12 activities, 3 personas, the licence-exchange list and 9 eval cases.
- All seven named functions in §8 are exported from `lib/engines/index.ts` with explicit signatures and throwing TODO bodies.

The routes are placeholders. Engine implementations, API routes, agents, admin authentication and recorded fixtures belong to later phases. `/admin` contains no operational data. No model calls or credentials are needed for this scaffold. Copy `.env.example` when implementing the runtime; model IDs remain environment-driven.

## Seed conventions

`scripts/generate-seeds.py` transcribes the provided specification. Regulatory values are retained as supplied, not independently reverified. Unknown fees stay `null`; no additional regulatory facts or document requirements are introduced. General source references use homepages; research-brief references without a URL remain `null`.

The specification does not give Omar or Lena arrival dates: their schema-required demo date defaults to Priya's `2026-10-12`. Other unspecified profile fields use the §6 defaults. Country names use India, Egypt and Germany. The GCC licence-exchange entry is expanded into its six member states and retains `verify: true`.

USD penalties retain their native amount and use the specified 3.6725 peg. The Tawtheeq AED 50 renewal fee is preserved in `penaltyNote`, with `penaltyAED: null` because it is not a penalty. Conditional and capped penalties retain their qualifications in `penaltyNote`; later engines must respect them. Jurisdiction costs not supplied in the spec remain unknown.

Tests compare the seed tables with the supplied spec, validate every seed, check references/cycles, and cover schema rejection and theme storage failures. Engine behavior tests will be added when the TODO implementations are built.
