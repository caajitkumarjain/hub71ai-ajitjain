"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Circle, LoaderCircle, Plus, X } from "lucide-react";
import { Profile, RevenueModel, Jurisdiction } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { priya, readProfile, saveProfile } from "./profile-storage";
import { checks, loadJourney, type CheckId, type CheckState } from "./journey-client";
import styles from "./path.module.css";

const emptyProfile: Profile = {
  id: "founder", name: "", nationality: "", arrivalDate: "", inUAE: false,
  spouse: false, childrenAges: [], businessDescription: "", revenueModel: "saas",
  fundingUSD: 0, revenue12mAED: 0, hires12m: 0, stepStatus: {}, documents: [], locale: "en",
};
const modelLabels: Record<Profile["revenueModel"], string> = {
  saas: "Software / SaaS", services: "Services", trading: "Trading", marketplace: "Marketplace",
  manufacturing: "Manufacturing", fnb: "Food & drink", other: "Other",
};
const locationLabels = { adgm: "ADGM", mainland: "Mainland", hub71: "Hub71", masdar: "Masdar", kezad: "KEZAD", twofour54: "twofour54" };
const pendingChecks = (): Record<CheckId, CheckState> => ({ path: "pending", bank: "pending", obligations: "pending", jurisdictions: "pending" });

export function StartForm() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [group, setGroup] = useState(0);
  const [age, setAge] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [states, setStates] = useState(pendingChecks);
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => { const saved = readProfile(); if (saved) setProfile(saved); return () => controller.current?.abort(); }, []);
  useEffect(() => { if (busy) dialog.current?.showModal(); else dialog.current?.close(); }, [busy]);
  function patch<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile((current) => ({ ...current, [key]: value })); }
  function addChild() {
    const value = Number(age);
    if (age === "" || !Number.isInteger(value) || value < 0 || value > 18) { setError("Enter a child’s age from 0 to 18."); return; }
    patch("childrenAges", [...profile.childrenAges, value]); setAge(""); setError("");
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsed = Profile.safeParse({ ...profile, name: profile.name.trim(), nationality: profile.nationality.trim(), businessDescription: profile.businessDescription.trim() });
    if (!parsed.success || !parsed.data.name || !parsed.data.nationality || !parsed.data.businessDescription) { setError("Complete your name, nationality, arrival date and business description."); return; }
    if (age !== "") { setError("Add the child’s age, or clear the age field before building your path."); return; }
    saveProfile(parsed.data);
    setError(""); setStates(pendingChecks()); setBusy(true);
    const request = new AbortController(); controller.current = request;
    try {
      await Promise.all([
        loadJourney(parsed.data, (id, state) => setStates((current) => ({ ...current, [id]: state })), request.signal),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      if (!request.signal.aborted) router.push("/path");
    } catch {
      if (!request.signal.aborted) { setBusy(false); setError("We couldn’t load your path. Your details are kept in this session; please try again."); }
    }
  }
  return <section className="mx-auto max-w-3xl py-12 md:py-20">
    <p className={styles.eyebrow}>A new chapter starts here</p>
    <div className="mt-5 rounded-2xl border border-line bg-surface p-5 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="font-display text-4xl leading-tight tracking-tight">Tell us about you</h1><Button type="button" size="sm" variant="secondary" onClick={() => { setProfile(structuredClone(priya)); setError(""); setAge(""); }}>Use example: Priya</Button></div>
      <p className="mt-4 leading-6 text-ink-muted">A few details to put your move, your family and your business in the right order.</p>
      <nav aria-label="Form sections" className="my-8 grid grid-cols-3 gap-2">{["You", "Family", "Business"].map((label, index) => <a key={label} href={`#form-${index}`} onClick={() => setGroup(index)} aria-current={group === index ? "step" : undefined} className={`border-t-2 pt-3 text-sm ${group === index ? "border-primary text-ink" : "border-line text-ink-muted"}`}>{label}</a>)}</nav>
      <form onSubmit={submit} className={styles.form}>
        <fieldset id="form-0" onFocus={() => setGroup(0)}><legend>You</legend>
          <div className={styles.fields}><label>Your name<input autoComplete="given-name" value={profile.name} onChange={(event) => patch("name", event.target.value)} required maxLength={100} /></label>
          <label>Nationality<input autoComplete="country-name" value={profile.nationality} onChange={(event) => patch("nationality", event.target.value)} placeholder="e.g. India" required maxLength={100} /></label>
          <div><span className={styles.label}>Are you in the UAE?</span><div className={styles.segment}>{[{ value: false, text: "Not yet" }, { value: true, text: "Yes, I’m here" }].map(({ value, text }) => <button key={text} type="button" aria-pressed={profile.inUAE === value} onClick={() => patch("inUAE", value)}>{text}</button>)}</div></div>
          <label>{profile.inUAE ? "Your arrival date" : "Planned arrival date"}<input type="date" value={profile.arrivalDate} onChange={(event) => patch("arrivalDate", event.target.value)} required /></label></div>
        </fieldset>
        <fieldset id="form-1" onFocus={() => setGroup(1)}><legend>Family</legend>
          <div className={styles.fields}><div><span className={styles.label}>Moving with a spouse?</span><div className={styles.segment}>{[{ value: false, text: "No" }, { value: true, text: "Yes" }].map(({ value, text }) => <button key={text} type="button" aria-pressed={profile.spouse === value} onClick={() => patch("spouse", value)}>{text}</button>)}</div></div>
          <div><label htmlFor="child-age">Children’s ages <span className="font-normal text-ink-muted">(optional)</span></label><div className="mt-2 flex gap-2"><input id="child-age" aria-describedby="child-help" type="number" min={0} max={18} step={1} value={age} onChange={(event) => setAge(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addChild(); } }} placeholder="Age" /><Button type="button" variant="secondary" size="icon" aria-label="Add child" onClick={addChild}><Plus /></Button></div><p id="child-help" className="mt-2 text-xs text-ink-muted">Add each child, aged 0–18.</p></div></div>
          {profile.childrenAges.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{profile.childrenAges.map((childAge, index) => <button className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm" type="button" key={index} aria-label={`Remove child ${index + 1}, age ${childAge}`} onClick={() => patch("childrenAges", profile.childrenAges.filter((_, i) => i !== index))}>Age {childAge}<X aria-hidden="true" className="size-3" /></button>)}</div>}
        </fieldset>
        <fieldset id="form-2" onFocus={() => setGroup(2)}><legend>Business</legend>
          <label>What are you building?<textarea rows={3} required maxLength={2000} value={profile.businessDescription} onChange={(event) => patch("businessDescription", event.target.value)} placeholder="What you sell, who your customers are and where they are based." /></label>
          <div className="mt-5"><span className={styles.label}>How will you earn revenue?</span><div className={`${styles.segment} ${styles.wrap}`}>{RevenueModel.options.map((model) => <button type="button" key={model} aria-pressed={profile.revenueModel === model} onClick={() => patch("revenueModel", model)}>{modelLabels[model]}</button>)}</div></div>
          <div className={`${styles.fields} mt-5`}><label>Revenue in the next 12 months · AED<input inputMode="decimal" type="number" min={0} step="any" required value={Number.isFinite(profile.revenue12mAED) ? profile.revenue12mAED : ""} onChange={(event) => patch("revenue12mAED", event.target.valueAsNumber)} /></label><label>Planned hires<input inputMode="numeric" type="number" min={0} step={1} required value={Number.isFinite(profile.hires12m) ? profile.hires12m : ""} onChange={(event) => patch("hires12m", event.target.valueAsNumber)} /></label></div>
          <details className="mt-5"><summary className="cursor-pointer py-2 text-sm text-ink-muted">More business details (optional)</summary><div className={`${styles.fields} mt-4`}><label>Funding · USD<input type="number" min={0} step="any" value={Number.isFinite(profile.fundingUSD) ? profile.fundingUSD : ""} onChange={(event) => patch("fundingUSD", event.target.valueAsNumber)} /></label><label>Where to set up<select value={profile.jurisdiction ?? ""} onChange={(event) => patch("jurisdiction", event.target.value ? Jurisdiction.parse(event.target.value) : undefined)}><option value="">Help me choose</option>{Jurisdiction.options.map((id) => <option key={id} value={id}>{locationLabels[id]}</option>)}</select></label><label>Driving licence country<input value={profile.drivingLicenceCountry ?? ""} onChange={(event) => patch("drivingLicenceCountry", event.target.value || undefined)} placeholder="e.g. India" /></label></div></details>
        </fieldset>
        {error && <p role="alert" className="text-coral">{error}</p>}
        <Button type="submit" size="lg" disabled={busy} className="w-full">Build my path<ArrowRight aria-hidden="true" /></Button>
        <p className="text-center text-xs leading-5 text-ink-muted">Details stay in this browser when storage is available.<br />Manzil prepares; you submit through official channels.</p>
      </form>
    </div>
    <dialog ref={dialog} className={styles.compileDialog} aria-labelledby="compile-title" onCancel={(event) => { event.preventDefault(); controller.current?.abort(); setBusy(false); }}>
      <p className={styles.eyebrow}>Connecting the dots</p><h2 id="compile-title" className="mt-3 font-display text-3xl">One path, made for you.</h2>
      <div className="my-8 space-y-5" aria-live="polite">{checks.map(({ id, label }) => <div key={id} className="flex items-center gap-3">{states[id] === "ready" ? <Check className="size-5 text-primary-ink" aria-hidden="true" /> : states[id] === "pending" ? <LoaderCircle className="size-5 animate-spin text-primary-ink" aria-hidden="true" /> : <Circle className="size-5 text-ink" aria-hidden="true" />}<div><p>{label}</p><p className="text-xs text-ink-muted">{states[id] === "ready" ? "Ready" : states[id] === "unavailable" ? "Unavailable — no result yet" : "Waiting for result…"}</p></div></div>)}</div>
      <Button variant="ghost" onClick={() => { controller.current?.abort(); setBusy(false); }}>Back to my details</Button>
    </dialog>
  </section>;
}
