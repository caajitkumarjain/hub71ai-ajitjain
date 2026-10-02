"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, LoaderCircle, Minus, Plus, RotateCcw } from "lucide-react";
import { Profile, type WhatIfResult } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { exposureSummary } from "@/components/path/journey-client";
import { priya, readProfile } from "@/components/path/profile-storage";
import { dateLabel, nextDeadline, obligationKey, positionToRevenue, requestScenario, revenueLabels, revenueStops, revenueToPosition, scenarioChanges, type Scenario } from "./deadline-client";
import { ObligationList } from "./obligation-list";
import styles from "./deadlines.module.css";

type Session = { baseline: Profile; draft: Scenario };
const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function DeadlinesWorkspace() {
  const [session, setSession] = useState<Session | null>(null);
  const [amountText, setAmountText] = useState("");
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const appliedProfile = useRef<Profile | null>(null);
  const hasResult = useRef(false);
  const reduced = useReducedMotion();
  const revenue = session?.draft.revenue12mAED;
  const hires = session?.draft.hires12m;

  useEffect(() => {
    const baseline = readProfile() ?? structuredClone(priya);
    appliedProfile.current = baseline;
    setAmountText(String(baseline.revenue12mAED));
    setSession({ baseline, draft: { revenue12mAED: baseline.revenue12mAED, hires12m: baseline.hires12m } });
  }, []);

  useEffect(() => {
    if (revenue === undefined || hires === undefined || !appliedProfile.current) return;
    const controller = new AbortController();
    const previous = appliedProfile.current;
    const scenario = { revenue12mAED: revenue, hires12m: hires };
    setBusy(true); setError("");
    const timer = window.setTimeout(() => {
      void requestScenario(previous, scenario, controller.signal).then((updated) => {
        if (controller.signal.aborted) return;
        appliedProfile.current = Profile.parse({ ...previous, ...scenario });
        hasResult.current = true; setResult(updated);
      }).catch(() => {
        if (!controller.signal.aborted) setError("We couldn’t update your deadlines. Please try again.");
      }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, hasResult.current ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [revenue, hires, retry]);

  function setRevenue(value: number) {
    setAmountText(String(value));
    setSession((current) => current ? { ...current, draft: { ...current.draft, revenue12mAED: value } } : null);
  }
  function reset() {
    if (!session) return;
    setRevenue(session.baseline.revenue12mAED);
    setSession((current) => current ? { ...current, draft: { revenue12mAED: current.baseline.revenue12mAED, hires12m: current.baseline.hires12m } } : null);
  }

  const rows = result?.after ?? [];
  const exposure = exposureSummary(result ? rows : null);
  const next = nextDeadline(rows);
  const changes = result ? scenarioChanges(result.diff) : [];
  const addedIds = new Set(result?.diff.added.map(obligationKey));
  const amountValid = amountText.trim() !== "" && Number.isFinite(Number(amountText)) && Number(amountText) >= 0;
  const isScenario = session && (session.draft.revenue12mAED !== session.baseline.revenue12mAED || session.draft.hires12m !== session.baseline.hires12m);

  return <section className="py-12 md:py-16">
    <header className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className={styles.eyebrow}>Keep moving forward</p><h1 className="mt-4 font-display text-4xl leading-tight tracking-tight">Deadlines</h1><p className="mt-3 text-ink-muted">Know what’s due, and see what changes as you grow.</p></div><Link href="/start" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-ink">Edit my details<ArrowRight className="size-4" aria-hidden="true" /></Link></header>
    <div className="mb-8 grid gap-4 md:grid-cols-2" aria-label="Deadline summary" aria-busy={busy}>
      <article className="rounded-xl border border-line bg-surface p-6 sm:p-7"><p className="text-sm text-ink-muted">AED at stake</p><p className="mt-4 font-display text-5xl leading-tight" data-exposure>{exposure ? money.format(exposure.total) : "—"}</p><p className="mt-3 text-xs leading-5 text-ink-muted">Next 12 months{exposure?.unknown ? " · excludes unknown penalties" : ""}</p><p className="mt-2 text-xs leading-5 text-ink-muted">Amounts and sources appear with each obligation below.</p></article>
      <article className="rounded-xl border border-line bg-surface p-6 sm:p-7"><p className="text-sm text-ink-muted">Next deadline</p>{next ? <><p className="mt-4 font-display text-3xl leading-tight"><time dateTime={next.row.dueDate!}>{dateLabel(next.row.dueDate!)}</time></p><p className="mt-3 text-sm font-medium">{next.row.title}</p><p className="mt-2 text-xs text-ink-muted">{next.daysLeft === 0 ? "Due today" : `${next.daysLeft} days left`} · {next.row.authority}</p></> : <p className="mt-4 text-sm leading-6 text-ink-muted">{result ? "No upcoming dated deadline was returned. Check the obligations below for dates to verify." : "Finding your next deadline…"}</p>}</article>
    </div>

    <section aria-labelledby="what-if-title" className="mb-6 rounded-xl border border-gold/40 bg-surface p-5 sm:p-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 id="what-if-title" className="font-display text-2xl">What if your plans change?</h2><p className="mt-2 text-xs text-ink-muted">Explore a scenario before updating your saved details.</p></div>{isScenario && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs">Scenario preview</span>}</div>
      <div className={styles.controls}>
        <div className="min-w-0"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><label htmlFor="revenue-slider" className="text-sm font-medium">Revenue in the next 12 months</label><div className={styles.amount}><span aria-hidden="true">AED</span><input aria-label="Revenue amount in AED" type="number" inputMode="decimal" min="0" step="any" value={amountText} disabled={!session} aria-invalid={!amountValid && !!session} onChange={(event) => { setAmountText(event.target.value); const value = Number(event.target.value); if (event.target.value.trim() !== "" && Number.isFinite(value) && value >= 0) setSession((current) => current ? { ...current, draft: { ...current.draft, revenue12mAED: value } } : null); }} /></div></div>
          <input id="revenue-slider" aria-label="Revenue in the next 12 months" aria-valuetext={`AED ${money.format(revenue ?? 0)}`} type="range" min="0" max="700" step="1" list="revenue-stops" disabled={!session} value={revenueToPosition(revenue ?? 0)} onChange={(event) => setRevenue(positionToRevenue(Number(event.target.value)))} className={styles.slider} />
          <datalist id="revenue-stops">{revenueStops.map((value, index) => <option key={value} value={index * 100} label={`AED ${revenueLabels[index]}`} />)}</datalist>
          <div className={styles.scale} aria-hidden="true">{revenueLabels.map((label) => <span key={label}>{label}</span>)}</div>
          <p className="mt-3 text-xs leading-5 text-ink-muted">{!amountValid && session ? "Enter a valid, non-negative revenue amount to update this scenario." : "Drag between the marked amounts, or enter an exact figure."}</p>
        </div>
        <div><p id="hiring-label" className="text-sm font-medium">Hiring?</p><div className={styles.stepper} role="group" aria-labelledby="hiring-label"><Button variant="ghost" size="icon" aria-label="Decrease planned hires" disabled={hires === undefined || hires <= 0} onClick={() => setSession((current) => current ? { ...current, draft: { ...current.draft, hires12m: Math.max(0, current.draft.hires12m - 1) } } : null)}><Minus aria-hidden="true" /></Button><output aria-label="Planned hires" className="w-10 text-center text-lg font-medium">{hires ?? 0}</output><Button variant="ghost" size="icon" aria-label="Increase planned hires" disabled={hires === undefined || hires >= 20} onClick={() => setSession((current) => current ? { ...current, draft: { ...current.draft, hires12m: Math.min(20, current.draft.hires12m + 1) } } : null)}><Plus aria-hidden="true" /></Button></div><p className="mt-2 text-xs text-ink-muted">People in the next 12 months</p></div>
      </div>
      <div className="mt-5 flex min-h-11 flex-wrap items-center justify-between gap-2 border-t border-line pt-4"><p role="status" className="flex items-center gap-2 text-xs text-ink-muted">{busy ? <><LoaderCircle className="size-4 animate-spin text-gold" aria-hidden="true" />Updating your deadlines…</> : error ? "Scenario could not be updated" : <><Check className="size-4 text-teal" aria-hidden="true" />{isScenario ? "Scenario ready" : "Showing your current details"}</>}</p><Button variant="ghost" size="sm" onClick={reset} disabled={!session || !isScenario}><RotateCcw aria-hidden="true" />Reset to my details</Button></div>
    </section>

    {error && <div role="alert" className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-coral/30 bg-coral/5 p-4"><div className="flex-1"><p className="text-sm leading-6">{error}</p>{result && appliedProfile.current && <p className="mt-1 text-xs text-ink-muted">Showing the last successful scenario: AED {money.format(appliedProfile.current.revenue12mAED)} revenue, {appliedProfile.current.hires12m} planned hires.</p>}</div><Button variant="secondary" size="sm" onClick={() => setRetry((value) => value + 1)} disabled={busy}>Try again</Button></div>}
    <div aria-live="polite" aria-atomic="true" className="mb-8 flex min-h-9 flex-wrap gap-2" data-scenario-diff>
      <AnimatePresence initial={false}>{changes.map(({ kind, row }) => <motion.span key={`${kind}:${row.ruleId}`} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reduced ? 0 : .2 }} className={styles.diff} data-kind={kind}>{kind}: {row.title}{row.dueDate && kind !== "Removed" ? ` · ${dateLabel(row.dueDate)}` : ""}</motion.span>)}</AnimatePresence>
      {!busy && !error && result && changes.length === 0 && <p className="self-center text-xs text-ink-muted">No obligations added, removed or changed.</p>}
    </div>
    <section aria-labelledby="obligations-title" aria-busy={busy}><div className="mb-6 flex flex-wrap items-baseline justify-between gap-3"><h2 id="obligations-title" className="font-display text-2xl">Your calendar</h2><p className="text-xs text-ink-muted">Dates and amounts from the rulebook</p></div>{result ? <ObligationList obligations={rows} addedIds={addedIds} /> : <p className="rounded-xl border border-line bg-surface p-7 text-sm text-ink-muted">{busy ? "Finding the obligations that apply to your profile…" : "Your calendar will appear after a successful check."}</p>}</section>
    <p className="mt-8 text-xs leading-6 text-ink-muted">Projected dates and threshold-crossing dates are estimates. Open “Why this applies” for assumptions and check each source before acting.</p>
  </section>;
}
