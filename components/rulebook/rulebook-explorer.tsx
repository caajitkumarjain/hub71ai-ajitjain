"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { SourceChip, VerifyBadge } from "@/components/brand/source-chip";
import type { RulebookRow } from "./dataset";
import { filterRulebook } from "./search";

export function RulebookExplorer({ rows, lanes }: { rows: RulebookRow[]; lanes: { id: string; label: string }[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "Step" | "Rule">("all");
  const [lane, setLane] = useState("all");
  const filtered = filterRulebook(rows, query, kind, lane);
  const inputClass = "mt-2 min-h-12 w-full rounded-lg border border-line bg-bg px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  return <section aria-labelledby="entries-heading" className="mt-12">
    <h2 id="entries-heading" className="font-display text-2xl">Inspect the steps and rules</h2>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-ink-muted">Search by title, authority, seed ID or dependency. Rule lanes come from the steps that reference them. Dates and confidence below are the metadata recorded in the seed dataset.</p>
    <div className="mt-6 grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[minmax(0,2fr)_1fr_1fr] sm:p-5">
      <label className="text-sm font-medium"><span className="inline-flex items-center gap-2"><Search aria-hidden="true" className="size-4" />Search the Rulebook</span><input className={inputClass} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try FTA, Tawtheeq or C-LIC" /></label>
      <label className="text-sm font-medium">Entry type<select className={inputClass} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">Steps and rules</option><option value="Step">Steps</option><option value="Rule">Rules</option></select></label>
      <label className="text-sm font-medium">Lane<select className={inputClass} value={lane} onChange={(event) => setLane(event.target.value)}><option value="all">All lanes</option>{lanes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    </div>
    <p role="status" className="my-4 text-sm text-ink-muted">{filtered.length} of {rows.length} entries shown</p>
    <div role="region" aria-label="Searchable Rulebook entries, scroll horizontally on small screens" tabIndex={0} className="max-w-full overflow-x-auto rounded-xl border border-line bg-surface focus-visible:outline-2 focus-visible:outline-primary">
      <table className="w-full min-w-[820px] table-fixed text-left text-sm">
        <caption className="sr-only">Seeded steps and rules with authority, lane, source and verification metadata</caption>
        <thead className="border-b border-line bg-surface-2 text-xs text-ink-muted"><tr><th scope="col" className="w-[38%] p-4 font-medium">Entry & dependencies</th><th scope="col" className="w-[24%] p-4 font-medium">Authority & lane</th><th scope="col" className="w-[38%] p-4 font-medium">Source & recorded verification</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.id} className="border-b border-line align-top last:border-0">
          <th scope="row" className="break-words p-4 font-normal"><span className="font-mono text-[11px] text-ink-muted">{row.kind} · {row.id}</span><p className="mt-1 font-semibold leading-6">{row.title}</p><p className="mt-2 text-xs leading-6 text-ink-muted">{row.description}</p>{row.kind === "Step" && <p className="mt-2 text-xs leading-5 text-ink-muted">Depends on: {row.dependsOn.join(", ") || "None recorded"}{row.ruleIds.length > 0 && <><br />Linked rules: {row.ruleIds.join(", ")}</>}</p>}</th>
          <td className="break-words p-4"><p className="leading-6">{row.authority}</p><p className="mt-2 text-xs leading-5 text-ink-muted">{row.lanes.map((id) => lanes.find((item) => item.id === id)?.label ?? id).join(" · ") || "No linked lane recorded"}</p></td>
          <td className="break-words p-4"><SourceChip {...row} verifiedOn={row.verifiedOn ?? undefined} /><p className="mt-2 text-xs leading-5 text-ink-muted">Verified on (seed): {row.verifiedOn ?? `UNKNOWN · verify with ${row.authority}`}<br />Confidence: {row.confidence}</p>{row.verify && <div className="mt-2"><VerifyBadge /></div>}</td>
        </tr>)}</tbody>
      </table>
      {filtered.length === 0 && <p className="p-6 text-sm leading-6 text-ink-muted">No seeded entries match these filters. Try another term or choose all lanes.</p>}
    </div>
    <p className="mt-3 text-xs leading-6 text-ink-muted">On a small screen, scroll inside the table to see the source column.</p>
  </section>;
}
