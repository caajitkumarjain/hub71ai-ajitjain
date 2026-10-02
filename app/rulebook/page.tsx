import type { Metadata } from "next";
import { ArrowDownToLine, BookOpen } from "lucide-react";
import { Lane } from "@/lib/schemas";
import { laneLabels, rulebookCounts, rulebookCoverage, rulebookRows } from "@/components/rulebook/dataset";
import { RulebookExplorer } from "@/components/rulebook/rulebook-explorer";

export const metadata: Metadata = { title: "Rulebook", description: "Explore Manzil’s seeded Abu Dhabi dependency map, source references and verification metadata." };

export default function RulebookPage() {
  const coverage = rulebookCoverage();
  return <div className="min-w-0 py-12 md:py-16">
    <header className="max-w-4xl"><p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-primary-ink"><BookOpen aria-hidden="true" className="size-4" />The Manzil Rulebook</p>
      <h1 className="mt-5 font-display text-4xl leading-tight tracking-tight md:text-5xl">The first open dependency map of setting up in Abu Dhabi</h1>
      <p className="mt-5 max-w-3xl text-base leading-8 text-ink-muted">See the steps, the rules and the sources behind your path. Explore how arrival, residency, company, home, family and operations connect.</p>
      <a href="/api/rulebook" download="manzil-rulebook.json" className="oasis-button mt-6 inline-flex min-h-12 items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover hover:text-primary-hover-foreground"><ArrowDownToLine aria-hidden="true" className="size-4" />Download dataset (JSON)</a>
    </header>
    <dl className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-6">{[
      ["Seeded steps", rulebookCounts.steps], ["Seeded rules", rulebookCounts.rules], ["Jurisdictions", rulebookCounts.jurisdictions],
      ["Activities", rulebookCounts.activities], ["Journey lanes", rulebookCounts.lanes], ["Dependency links", rulebookCounts.dependencies],
    ].map(([label, count]) => <div key={label} className="rounded-xl border border-line bg-surface p-4"><dt className="text-xs leading-5 text-ink-muted">{label}</dt><dd className="mt-2 font-mono text-3xl">{count}</dd></div>)}</dl>
    <aside className="mt-6 rounded-xl border border-line bg-surface-2 p-5 text-sm leading-7 text-ink-muted"><strong className="font-semibold text-ink">A transparent starting point.</strong> This is a seeded research map, not a complete register of requirements. Verification dates reflect the supplied seed metadata; Manzil has not independently reverified every source. Timing and cost ranges are estimates. Unknown values remain unknown. Confirm current requirements with the named authority.</aside>
    <section aria-labelledby="coverage-heading" className="mt-12"><h2 id="coverage-heading" className="font-display text-2xl">Lane × authority coverage</h2><p className="mt-3 text-sm leading-7 text-ink-muted">Each cell counts seeded steps for that lane and authority. A dash means no step is recorded, not that no requirement exists. Authorities are shown exactly as recorded; rules appear in the searchable table below.</p>
      <div role="region" aria-label="Lane and authority coverage, scroll horizontally on small screens" tabIndex={0} className="mt-5 max-w-full overflow-x-auto rounded-xl border border-line bg-surface focus-visible:outline-2 focus-visible:outline-primary"><table className="w-full min-w-[680px] text-left text-sm"><caption className="sr-only">Number of seeded steps by authority and journey lane</caption><thead className="border-b border-line bg-surface-2 text-xs text-ink-muted"><tr><th scope="col" className="p-3 font-medium">Authority</th>{Lane.options.map((lane) => <th key={lane} scope="col" className="p-3 text-center font-medium">{laneLabels[lane]}</th>)}</tr></thead><tbody>{coverage.map((row) => <tr key={row.authority} className="border-b border-line last:border-0"><th scope="row" className="max-w-60 break-words p-3 text-xs font-medium leading-5">{row.authority}</th>{row.cells.map((cell) => <td key={cell.lane} className={`p-3 text-center font-mono text-xs ${cell.count ? "bg-primary-soft font-semibold text-ink" : "text-ink-muted"}`}>{cell.count || "—"}</td>)}</tr>)}</tbody></table></div>
    </section>
    <RulebookExplorer rows={rulebookRows()} lanes={Lane.options.map((id) => ({ id, label: laneLabels[id] }))} />
  </div>;
}
