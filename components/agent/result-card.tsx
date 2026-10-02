import { ArrowUpRight, Check, FileText, Info, Quote } from "lucide-react";
import type { AgentAnswer } from "@/lib/agents/contracts";
import type { Profile, TraceEvent } from "@/lib/schemas";
import { DownloadMenu } from "@/components/export/download-menu";
import { PackPreview } from "@/components/export/pack-preview";
import rules from "@/data/rules.json";
import steps from "@/data/steps.json";
import jurisdictions from "@/data/jurisdictions.json";
import activities from "@/data/activities.json";
import { AgentTheatre } from "./agent-theatre";
import { SafeMarkdown, safeActionHref, safeHref } from "./safe-markdown";

const sources = new Map<string, { title: string; authority: string; sourceUrl?: string | null; officialUrl?: string; verifiedOn?: string; confidence: string }>([...rules, ...steps, ...jurisdictions.map((source) => ({ ...source, title: source.name, authority: source.name }))].map((source) => [source.id, source]));
const activityIds = new Set(activities.map((activity) => activity.id));

export function EvidenceSourceChips({ evidence }: { evidence: readonly string[] }) {
  if (!evidence.length) return null;
  return <div className="mt-5 border-t border-line pt-4"><p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-muted">Sources behind this answer</p><div className="flex flex-wrap gap-2">
    {[...new Set(evidence)].map((id) => {
      if (/^BK-0[1-7]$/.test(id)) return <span key={id} title="Computed by Manzil’s deterministic bankability engine." className="rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[11px] text-ink">{id} · Manzil pre-flight check</span>;
      if (activityIds.has(id)) return <span key={id} title="Illustrative activity from the seed catalogue; verify the official code with the licensing authority." className="rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[11px] text-ink">{id} · Activity seed</span>;
      const source = sources.get(id);
      const href = safeHref(source?.sourceUrl ?? source?.officialUrl ?? "");
      return href && source ? <a key={id} href={href} target="_blank" rel="noopener noreferrer" title={`${source.title} · ${source.authority} · verified ${source.verifiedOn ?? "date unknown"} · ${source.confidence} confidence`} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[11px] text-ink transition-colors hover:border-gold">
        <FileText aria-hidden="true" className="size-3 shrink-0" /><span className="break-words"><span className="block">{id} · {source.authority}</span><span className="mt-0.5 block text-[10px] text-ink-muted">{source.verifiedOn ? `Checked ${source.verifiedOn}` : "Date unknown"} · {source.confidence}</span></span><ArrowUpRight aria-hidden="true" className="size-3 shrink-0" /><span className="sr-only">opens source in a new tab</span>
      </a> : <span key={id} className="rounded-md border border-line px-2 py-1.5 text-[11px] text-ink-muted">{id} · UNKNOWN · verify with {source?.authority ?? "the relevant authority"}</span>;
    })}
  </div></div>;
}

export function ResultCard({ result, events = [], isRunning = false, profile }: { result: AgentAnswer; events?: readonly TraceEvent[]; isRunning?: boolean; profile?: Profile | null }) {
  const cached = events.some((event) => event.kind === "fallback");
  const isArabic = /^(ar(?:-|$)|arabic$|العربية$)/i.test(result.language);
  return <article className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm" aria-label="Manzil answer">
    <div className="p-5" dir={isArabic ? "rtl" : "ltr"} lang={result.language}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${result.status === "complete" ? "bg-teal/10 text-teal" : "bg-amber/10 text-amber"}`}>
          {result.status === "complete" ? <Check aria-hidden="true" className="size-3" /> : <Info aria-hidden="true" className="size-3" />}{result.status}
        </span>
        {cached && <span className="rounded-full border border-line px-2 py-1 text-[10px] text-ink-muted">cached</span>}
        <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted">Draft guidance</span>
      </div>
      <SafeMarkdown text={result.answer_md} />
      {result.status === "complete" && result.pack && <div className="mt-5 space-y-4">{profile && <DownloadMenu options={[{ label: "Mission Pack (Word)", request: { kind: "document", document: "mission-pack", profile, pack: result.pack } }]} />}<PackPreview pack={result.pack} /></div>}
      {Boolean(result.activityMatches?.length) && <section className="mt-5 space-y-3" aria-label="Suggested activities"><h4 className="text-xs font-medium text-ink">Activities to explore</h4>{result.activityMatches?.map((match) => <div key={match.activityId} className="rounded-xl border border-line bg-bg p-3"><p className="font-medium text-ink">{match.activityId.replaceAll("-", " ")}</p><p className="mt-1 text-xs leading-6 text-ink-muted">{match.reason}</p></div>)}</section>}
      {Boolean(result.bankReview?.length) && <section className="mt-5 space-y-3" aria-label="AI review"><div><h4 className="text-xs font-medium text-ink">AI review</h4><p className="mt-1 text-[11px] leading-5 text-ink-muted">Questions to help you prepare. This is not a bank decision.</p></div>{result.bankReview?.map((finding, index) => <div key={index} className="rounded-xl border border-line bg-bg p-4"><p className="text-sm font-medium">{finding.title}</p><blockquote className="my-3 flex gap-2 border-l-2 border-gold pl-3 text-xs italic leading-6 text-ink-muted"><Quote aria-hidden="true" className="mt-1 size-3 shrink-0" /><span>{finding.evidenceQuote}</span></blockquote><p className="text-xs leading-6">{finding.question}</p></div>)}</section>}
      {result.authority_to_verify && <p className="mt-4 rounded-lg bg-amber/10 p-3 text-xs leading-6 text-ink">Verify with {result.authority_to_verify} before acting.</p>}
      <EvidenceSourceChips evidence={result.evidence} />
      {result.next_actions.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{result.next_actions.map((action, index) => {
        const href = safeActionHref(action.href);
        return href ? <a key={`${href}-${index}`} href={href} className="inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-lg border border-gold px-3 py-2 text-xs font-medium leading-5 hover:bg-gold/10"><span className="break-words">{action.label}</span><ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" /></a> : null;
      })}</div>}
    </div>
    <AgentTheatre events={events} isRunning={isRunning} />
  </article>;
}
