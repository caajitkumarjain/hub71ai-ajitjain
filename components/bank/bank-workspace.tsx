"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ChevronDown, ClipboardCheck, LoaderCircle, RefreshCw } from "lucide-react";
import { BankabilityResult, type Finding, type Profile } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { postProfile } from "@/components/path/journey-client";
import { priya, readProfile, saveProfile } from "@/components/path/profile-storage";
import { applyBankFix, prioritizeFindings } from "./bank-client";
import { ScoreRing } from "./score-ring";
import styles from "./bank.module.css";

function BankOfficerSlot() {
  // Phase 3A integration slot: replace this body with useAgentStream from components/agent.
  // A pending slot must not impersonate a live bank-officer response.
  return <section aria-label="Bank officer note placeholder" data-bank-officer-slot className="rounded-xl border border-dashed border-line bg-surface/50 p-5 sm:p-6">
    <div className="flex flex-wrap items-center gap-3"><h2 className="font-display text-xl">From the bank officer</h2><span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] text-ink-muted">Note pending</span></div>
    <p className="mt-3 text-sm leading-6 text-ink-muted">A bank officer’s review will appear here. No review has run yet.</p>
  </section>;
}

export function BankWorkspace() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [result, setResult] = useState<BankabilityResult | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fixed, setFixed] = useState<Finding[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const current = readProfile() ?? structuredClone(priya);
    setProfile(current);
    if (!saveProfile(current)) setNotice("Browser storage is unavailable. Your changes last for this session only.");
    const request = new AbortController(); controller.current = request;
    void postProfile("bankability", current, BankabilityResult, request.signal)
      .then((value) => { if (!request.signal.aborted) setResult(value); })
      .catch(() => { if (!request.signal.aborted) setError("We couldn’t check your bank readiness. Please try again."); })
      .finally(() => { if (!request.signal.aborted) setBusy(false); });
    return () => controller.current?.abort();
  }, []);

  async function recheck() {
    if (!profile || busy) return;
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const value = await postProfile("bankability", profile, BankabilityResult, request.signal);
      if (!request.signal.aborted) { setResult(value); setFixed((items) => items.filter((item) => !value.findings.some((finding) => finding.checkId === item.checkId))); }
    } catch { if (!request.signal.aborted) setError("We couldn’t refresh this check. Your previous result is still shown."); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }

  async function fix(finding: Finding) {
    if (!profile || busy) return;
    if (!finding.fixAction) { setExpanded((current) => current === finding.checkId ? null : finding.checkId); return; }
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    setBusy(true); setError("");
    try {
      const updated = await applyBankFix(profile, finding, request.signal);
      if (request.signal.aborted) return;
      const stored = saveProfile(updated.profile);
      setProfile(updated.profile); setResult(updated.result);
      if (!updated.result.findings.some((item) => item.checkId === finding.checkId)) setFixed((items) => [finding, ...items.filter((item) => item.checkId !== finding.checkId)]);
      setNotice(stored ? "Profile updated and bank readiness rechecked. Confirm the activity with your licensing authority before applying." : "Profile updated for this session. Browser storage is unavailable; confirm the activity with your licensing authority before applying.");
      setExpanded(null);
    } catch { if (!request.signal.aborted) setError("We couldn’t apply this fix. Your profile and score haven’t changed. Please try again."); }
    finally { if (!request.signal.aborted) setBusy(false); }
  }

  const findings = prioritizeFindings(result?.findings ?? []);
  const visible = findings.slice(0, Math.max(1, 4 - fixed.length));
  return <section className="py-12 md:py-16">
    <header className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className={styles.eyebrow}>Prepare with confidence</p><h1 className="mt-4 font-display text-4xl leading-tight tracking-tight">Bank check</h1><p className="mt-3 text-ink-muted">See what a bank will question before you apply.</p></div><Link href="/start" className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-ink">Edit my details<ArrowRight className="size-4" aria-hidden="true" /></Link></header>
    {error && <div role="alert" className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-coral/30 bg-coral/5 p-4"><p className="flex-1 text-sm leading-6">{error}</p><Button variant="secondary" size="sm" onClick={recheck} disabled={busy}>Try again</Button></div>}
    {!result ? <div role="status" aria-busy={busy} className="rounded-xl border border-line bg-surface p-10 text-ink-muted">{busy ? <span className="flex items-center gap-3"><LoaderCircle aria-hidden="true" className="size-5 animate-spin text-gold" />Checking your profile…</span> : "Your readiness score will appear after a successful check."}</div> : <div className={styles.workspace}>
      <aside className="h-fit rounded-2xl border border-line bg-surface p-6 text-center sm:p-8"><ScoreRing score={result.score} band={result.band} /><p className="mx-auto mt-7 max-w-64 text-sm leading-6 text-ink-muted">A Manzil pre-flight check, not a bank decision.</p><div className="mt-7 border-t border-line pt-5"><p className="text-xs text-ink-muted">Prepared for {profile?.name}</p><Button variant="ghost" size="sm" className="mt-2" onClick={recheck} disabled={busy}><RefreshCw aria-hidden="true" className={busy ? "animate-spin" : ""} />Recheck profile</Button></div></aside>
      <div className="min-w-0 space-y-6"><BankOfficerSlot />
        <div className="flex items-center justify-between gap-4"><h2 className="font-display text-2xl">Before you apply</h2><span className="text-xs text-ink-muted">Highest priority first</span></div>
        <div className="space-y-4" aria-busy={busy}>
          <AnimatePresence initial={false}>
            {fixed.slice(0, 3).map((finding) => <motion.article layout={!reducedMotion} key={`fixed-${finding.checkId}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : .25 }} data-fixed-id={finding.checkId} className="flex items-center gap-3 rounded-xl border border-teal/30 bg-teal/5 px-5 py-4"><Check className="size-5 shrink-0 text-teal" aria-hidden="true" /><div><p className="text-sm font-medium">{finding.title}</p><p role="status" className="mt-1 text-xs text-teal">Fixed in your profile</p></div></motion.article>)}
            {visible.map((finding) => <motion.article layout={!reducedMotion} key={finding.checkId} data-finding-id={finding.checkId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0, overflow: "hidden" }} transition={{ duration: reducedMotion ? 0 : .28 }} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="p-5 sm:p-6"><div className="mb-3 flex items-center gap-2"><span className="font-mono text-[11px] text-ink-muted">{finding.checkId}</span><span className={styles.severity} data-severity={finding.severity}>{finding.severity === "high" ? "High priority" : finding.severity === "medium" ? "Needs attention" : "To prepare"}</span></div>
                <h3 className="text-base font-semibold leading-6">{finding.title}</h3><p className="mt-2 text-sm leading-6 text-ink-muted">{finding.whyBankCares}</p>
                <div className="mt-4 rounded-lg bg-bg p-4"><p className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">The fix</p><p className="mt-2 text-sm leading-6">{finding.fix}</p></div>
                <Button className="mt-4" variant={finding.fixAction ? "default" : "secondary"} disabled={busy} aria-expanded={!finding.fixAction ? expanded === finding.checkId : undefined} onClick={() => fix(finding)}>Fix this{busy && finding.fixAction ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : finding.fixAction ? <ArrowRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}</Button>
                {expanded === finding.checkId && <div className="mt-4 border-t border-line pt-4 text-sm leading-6 text-ink-muted"><p>This check needs supporting evidence. Follow the guidance above, then update your details or completed steps and recheck.</p><Link href={finding.checkId === "BK-02" || finding.checkId === "BK-04" ? "/path" : "/start"} className="mt-2 inline-flex min-h-11 items-center gap-2 font-medium text-ink underline underline-offset-4">{finding.checkId === "BK-02" || finding.checkId === "BK-04" ? "Open your path" : "Review your details"}<ArrowRight className="size-4" aria-hidden="true" /></Link></div>}
              </div>
            </motion.article>)}
          </AnimatePresence>
          {findings.length === 0 && <div className="rounded-xl border border-teal/30 bg-teal/5 p-6"><ClipboardCheck className="mb-3 size-6 text-teal" aria-hidden="true" /><h3 className="font-medium">No gaps found in this pre-flight check</h3><p className="mt-2 text-sm leading-6 text-ink-muted">Confirm the bank’s current requirements before applying. This check does not promise approval.</p></div>}
        </div>
        {findings.length > visible.length && <p className="text-xs leading-5 text-ink-muted">Showing the highest-priority findings. As you resolve them, the next checks appear here.</p>}
        {notice && <p role="status" className="text-sm leading-6 text-ink-muted">{notice}</p>}
        <p className="text-xs leading-5 text-ink-muted">Official activity codes vary by authority · verify. A fix updates your Manzil profile only.</p>
      </div>
    </div>}
  </section>;
}
