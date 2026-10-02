"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, Check, LoaderCircle, X } from "lucide-react";
import type { PathNode, Profile } from "@/lib/schemas";
import { Rule } from "@/lib/schemas";
import rawRules from "@/data/rules.json";
import { Button } from "@/components/ui/button";
import { safeSourceUrl, SourceChip, VerifyBadge } from "@/components/brand/source-chip";
import { shortTitle } from "./swimlane-timeline";
import { useMissionPack } from "./use-mission-pack";
import { DurationReport } from "./duration-report";
import styles from "./path.module.css";

const rules = Rule.array().parse(rawRules);
export function StepDrawer({ node, nodes, profile, updating, notice, onClose, onDone }: {
  node: PathNode; nodes: PathNode[]; profile: Profile; updating: boolean; notice: string;
  onClose: () => void; onDone: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const mission = useMissionPack();
  const unlocks = nodes.filter((next) => next.dependsOn.includes(node.id));
  const linkedRules = rules.filter((rule) => node.ruleIds.includes(rule.id));
  const officialUrl = safeSourceUrl(node.officialUrl);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);
  const why = node.id === "F-ATTEST" ? "Start certificate attestation before arrival so it can run alongside your company set-up."
    : node.id === "H-TAWTH" ? "Register your home tenancy to unlock the next steps for your home and family."
    : node.id === "F-SCHOOL" ? node.description
    : unlocks.length ? `This step unlocks ${unlocks.map(shortTitle).join(", ")}.` : "Complete this step as part of getting settled and running your business.";
  return <dialog ref={dialog} className={styles.drawer} aria-labelledby="step-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget && event.clientX < event.currentTarget.getBoundingClientRect().left) onClose(); }}>
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-3"><span className="text-xs text-ink-muted">Your path / Step details</span><Button size="icon" variant="ghost" aria-label="Close step details" onClick={onClose}><X /></Button></div>
    <div className="space-y-7 p-6 sm:p-8">
      <header><div className="mb-3 flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-ink-muted">{node.id}</span>{node.verify && <VerifyBadge />}{node.critical && <span className="rounded-full bg-gold/15 px-2 py-1 text-xs">Critical step</span>}{node.status === "done" && <span className="text-sm text-primary-ink">Done</span>}</div><h2 id="step-title" className="font-display text-3xl leading-tight">{shortTitle(node)}</h2><p className="mt-2 text-sm text-ink-muted">{node.authority}</p></header>
      <section><h3 className="mb-2 font-medium">Why</h3><p className="leading-6 text-ink-muted">{why}</p></section>
      <section><h3 className="mb-3 font-medium">You’ll need</h3>{node.documents.length ? <ul className="space-y-3">{node.documents.map((document) => <li key={document}><label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-4 accent-primary" />{document}</label></li>)}</ul> : <p className="text-sm leading-6 text-ink-muted">UNKNOWN · verify the document checklist with {node.authority}.</p>}</section>
      <section className="rounded-xl border border-line bg-bg p-4"><p className="font-medium">Takes ~{node.durationDays.likely} days <span className="text-xs font-normal text-ink-muted">· estimate</span></p><p className="mt-2">Costs {node.costAED ? `AED ${node.costAED.min.toLocaleString("en-US")}–${node.costAED.max.toLocaleString("en-US")} · estimate` : `UNKNOWN · verify with ${node.authority}`}</p><div className="mt-3"><SourceChip {...node} /></div></section>
      <DurationReport key={node.id} stepId={node.id} profile={profile} />
      <section><h3 className="mb-3 font-medium">Unlocks next</h3>{unlocks.length ? <ul className="space-y-2 text-sm text-ink-muted">{unlocks.map((next) => <li key={next.id} className="flex items-center gap-2"><ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-primary-ink" />{shortTitle(next)}</li>)}</ul> : <p className="text-sm text-ink-muted">No further steps depend on this one.</p>}</section>
      {linkedRules.length > 0 && <section><h3 className="mb-3 font-medium">Sources & linked rules</h3><div className="space-y-4">{linkedRules.map((rule) => <div key={rule.id}><p className="mb-2 text-sm">{rule.title} {rule.verify && <VerifyBadge />}</p><SourceChip {...rule} /></div>)}</div></section>}
      {officialUrl ? <Button asChild variant="outline" className="w-full"><a href={officialUrl} target="_blank" rel="noopener noreferrer">Official link<ArrowUpRight aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a></Button> : <p className="text-sm text-ink-muted">UNKNOWN · verify the official link with {node.authority}.</p>}
      <div className="grid gap-3"><Button onClick={() => mission.prepare(profile, node.id)} disabled={mission.busy}>{mission.busy && <LoaderCircle aria-hidden="true" className="animate-spin" />}Prepare it for me</Button><Button variant="secondary" onClick={onDone} disabled={updating || node.status === "done"}>{updating ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}{updating ? "Updating your path…" : node.status === "done" ? "Marked done" : "Mark done"}</Button></div>
      {notice && <p role="status" className="text-sm leading-6 text-ink-muted">{notice}</p>}
      {mission.status && <p role="status" className="text-sm leading-6 text-ink-muted">{mission.status}</p>}
      {mission.result && <section aria-live="polite" className="rounded-xl border border-line bg-bg p-4"><div className="mb-3 flex gap-3 text-xs"><span className="uppercase tracking-wide">Draft · {mission.result.status}</span>{mission.cached && <span className="rounded-full bg-surface-2 px-2">cached</span>}</div><p className="whitespace-pre-wrap break-words text-sm leading-6">{mission.result.answer_md}</p></section>}
      <p className="text-xs leading-5 text-ink-muted">Manzil prepares and explains. You submit through official channels.</p>
    </div>
  </dialog>;
}
