"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock3, ListChecks, LoaderCircle, Route, ShieldCheck } from "lucide-react";
import type { PathNode, Profile } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { SourceChip } from "@/components/brand/source-chip";
import { exposureSummary, loadJourney, readJourney, type Journey } from "./journey-client";
import { priya, readProfile, saveProfile } from "./profile-storage";
import { SwimlaneTimeline } from "./swimlane-timeline";
import { StepDrawer } from "./step-drawer";
import { JurisdictionCard } from "./jurisdiction-card";
import { DownloadMenu } from "@/components/export/download-menu";
import styles from "./path.module.css";

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(0);
  useEffect(() => {
    const from = previous.current; previous.current = value;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(value); return; }
    const started = performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min((now - started) / 450, 1);
      setDisplay(progress === 1 ? value : Math.round(from + (value - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span><span className="sr-only">{value.toLocaleString("en-US")}</span><span aria-hidden="true">{display.toLocaleString("en-US")}</span></span>;
}

export function PathWorkspace() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState("");
  const [storageNotice, setStorageNotice] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const saved = readProfile();
    const current = saved ?? structuredClone(priya);
    setProfile(current);
    if (!saved && !saveProfile(current)) setStorageNotice("Browser storage is unavailable. Changes last for this session only.");
    const existing = readJourney(current);
    if (existing) { setJourney(existing); return; }
    const controller = new AbortController(); request.current = controller;
    void loadJourney(current, undefined, controller.signal).then(setJourney).catch(() => { if (!controller.signal.aborted) setError("We couldn’t load your path. Your details are still saved. Please try again."); });
    return () => controller.abort();
  }, []);
  useEffect(() => () => request.current?.abort(), []);

  function openStep(node: PathNode) { setNotice(""); setSelectedId(node.id); }
  async function markDone() {
    if (!profile || !journey || !selectedId || updating) return;
    const next: Profile = { ...profile, stepStatus: { ...profile.stepStatus, [selectedId]: "done" } };
    const controller = new AbortController(); request.current = controller;
    setUpdating(true); setNotice("");
    try {
      const refreshed = await loadJourney(next, undefined, controller.signal);
      if (!saveProfile(next)) setStorageNotice("Browser storage is unavailable. Changes last for this session only.");
      setProfile(next); setJourney(refreshed);
      setNotice("Step marked done. Your timeline has been updated.");
    } catch {
      if (!controller.signal.aborted) setNotice("The path service is unavailable. This step hasn’t been changed. Try again when the service is back.");
    } finally { if (!controller.signal.aborted) setUpdating(false); }
  }
  async function retry() {
    if (!profile || updating) return;
    const controller = new AbortController(); request.current = controller;
    setUpdating(true); setError("");
    try { setJourney(await loadJourney(profile, undefined, controller.signal)); }
    catch { if (!controller.signal.aborted) setError("We couldn’t load your path. Please try again."); }
    finally { if (!controller.signal.aborted) setUpdating(false); }
  }

  if (!journey || !profile) return <section className="py-20" aria-live="polite" aria-busy={!error}><p className={styles.eyebrow}>Your next chapter</p><h1 className="mt-4 font-display text-4xl">Your path</h1>{error ? <><p role="alert" className="mt-8 text-ink-muted">{error}</p><Button className="mt-5" onClick={retry} disabled={updating}>Try again</Button><Link href="/start" className="ml-5 underline underline-offset-4">Edit my details</Link></> : <p className="mt-8 flex items-center gap-3 text-ink-muted"><LoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" />Putting your steps in order…</p>}</section>;
  const { path } = journey;
  const selected = path.nodes.find((node) => node.id === selectedId);
  const opportunities = path.parallelOpportunities.filter((item) => path.nodes.some((node) => node.id === item.stepId && node.status !== "done"));
  const opportunity = opportunities.find((item) => item.stepId === "F-ATTEST") ?? opportunities[0];
  const opportunityMessage = opportunity?.stepId === "F-ATTEST"
    ? `Start marriage and birth certificate attestation ${profile.inUAE ? "now" : "before you land"} — it can run alongside your company set-up.`
    : opportunity?.message.replace(" (Manzil Jurisdiction Twin)", "").replace(" (Bankability pre-check)", "");
  const exposure = exposureSummary(journey.obligations);
  const done = path.nodes.filter((node) => node.status === "done").length;
  const progress = path.nodes.length ? done / path.nodes.length * 100 : 0;
  const savedProportion = path.naiveDays ? Math.min(100, path.savedDays / path.naiveDays * 100) : 0;
  return <section className="py-12 md:py-16">
    {storageNotice && <p role="status" className="mb-4 text-xs text-ink-muted">{storageNotice}</p>}
    <header className={styles.missionControl}>
      <div className={styles.missionHeading}><div className={styles.welcome}><p className={styles.missionEyebrow}><span aria-hidden="true" />Mission control</p><h1>Welcome, {profile.name}.</h1><p>Your path to Abu Dhabi, one clear step at a time.</p></div><Link href="/start" className={styles.editDetails}>Edit my details<ArrowUpRight aria-hidden="true" className="size-4" /></Link></div>
      <div className={styles.journeyProgress}>
        <div className={styles.progressCaption}><span><CheckCircle2 aria-hidden="true" />Your progress</span><span><strong>{done}</strong> / {path.nodes.length} steps done</span></div>
        <div className={styles.progressTrack} role="progressbar" aria-label="Journey steps completed" aria-valuemin={0} aria-valuemax={path.nodes.length || 1} aria-valuenow={done} aria-valuetext={`${done} of ${path.nodes.length} steps done`}><span className={styles.progressFill} style={{ "--progress": `${progress}%` } as CSSProperties} /></div>
      </div>
      <div className={styles.missionMetrics} aria-label="Your path at a glance">
        <article className={`${styles.metricCard} ${styles.readyCard}`}><div><p className={styles.metricLabel}>Ready in <span>· estimate</span></p><p className={styles.metricValue}>~<CountUp value={path.optimizedDays} /> <span>days</span></p><p className={styles.metricNote}>vs ~{path.naiveDays} days step by step</p></div><div className={styles.readyRing} role="img" aria-label={`${path.savedDays} estimated days saved through parallel steps`} title={`${path.savedDays} estimated days saved through parallel steps`}><svg viewBox="0 0 80 80" aria-hidden="true"><circle className={styles.ringTrack} cx="40" cy="40" r="33" /><circle className={styles.ringValue} cx="40" cy="40" r="33" pathLength="100" strokeDasharray={`${savedProportion} 100`} /></svg><Clock3 aria-hidden="true" /></div></article>
        <article className={styles.metricCard}><div className={styles.metricTop}><p className={styles.metricLabel}>Your whole journey</p><ListChecks aria-hidden="true" /></div><p className={styles.metricValue}><CountUp value={path.nodes.length} /> <span>steps</span></p><p className={styles.metricNote}>From your arrival to everyday life</p></article>
        <article className={styles.metricCard}><div className={styles.metricTop}><p className={styles.metricLabel}>AED at stake</p><ShieldCheck aria-hidden="true" /></div><p className={styles.metricValue}>{exposure ? <CountUp value={exposure.total} /> : <span className={styles.unknownValue}>UNKNOWN</span>}</p><p className={styles.metricNote}>{exposure ? `Next 12 months${exposure.unknown ? " · excludes unknown penalties" : ""}` : "Verify with the relevant authorities"}</p>{exposure && exposure.rows.length > 0 && <details className={styles.exposureSources}><summary>Sources & amounts</summary><ul>{exposure.rows.map((row, index) => <li key={`${row.ruleId}-${row.dueDate}-${index}`}><p>{row.title} · {row.penaltyDisplay}</p><SourceChip {...row} /></li>)}</ul></details>}</article>
      </div>
    </header>
    {opportunity && <div className={styles.firstStep}><div className={styles.firstStepContent}><span className={styles.firstStepIcon}><Route aria-hidden="true" /></span><div><h2>Do this first</h2><p>{opportunityMessage}</p></div></div><Button onClick={() => { const node = path.nodes.find((item) => item.id === opportunity.stepId); if (!node) return; const target = document.getElementById(`step-${node.id}`); target?.scrollIntoView({ block: "center", behavior: "instant" }); target?.focus({ preventScroll: true }); openStep(node); }}>Show me<ArrowRight aria-hidden="true" /></Button></div>}
    <section aria-labelledby="timeline-title" className="mt-10"><div className="mb-5 flex flex-wrap items-baseline justify-between gap-3"><h2 id="timeline-title" className="font-display text-2xl">The way forward</h2><div className="flex flex-wrap items-center gap-3"><p className="text-xs text-ink-muted">Select a step to see what you need</p><DownloadMenu options={[{ label: "Checklist tracker (Excel)", request: { kind: "checklist", profile } }]} /></div></div><SwimlaneTimeline path={path} selectedId={selectedId} onSelect={openStep} /><p className="mt-4 text-xs leading-6 text-ink-muted">Gold = sets your finish date · Emerald = done · Amber dot = verify with authority</p><p className="mt-1 text-xs leading-5 text-ink-muted">Timing is an estimate. Dates run from your arrival; negative days are before you land.</p></section>
    {path.excludedSteps.length > 0 && <details className="mt-5 text-xs text-ink-muted"><summary className="min-h-11 cursor-pointer py-3">Steps outside this path</summary><ul className="space-y-3 pb-4">{path.excludedSteps.map((step) => <li key={step.stepId}><span className="font-mono">{step.stepId}</span> · {step.reason}</li>)}</ul></details>}
    <div className="mt-10"><JurisdictionCard comparisons={journey.jurisdictions} profile={profile} /></div>
    {selected && <StepDrawer key={selected.id} node={selected} nodes={path.nodes} profile={profile} updating={updating} notice={notice} onClose={() => setSelectedId(undefined)} onDone={markDone} />}
  </section>;
}
