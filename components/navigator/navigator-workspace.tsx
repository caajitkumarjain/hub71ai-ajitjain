"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { Profile } from "@/lib/schemas";
import { navigate, flipPoints } from "@/lib/engines/jurisdiction-twin";
import jurisdictions from "@/data/jurisdictions.json";
import jurisdictionRules from "@/data/jurisdiction-rules.json";
import { priya, readProfile, saveProfile } from "@/components/path/profile-storage";
import { loadJourney } from "@/components/path/journey-client";
import { Button } from "@/components/ui/button";
import { AgentTheatre } from "@/components/agent/agent-theatre";
import { useAgentStream } from "@/components/agent/use-agent-stream";
import { BawsalaAvatar } from "./bawsala-avatar";
import styles from "./navigator.module.css";

const locations = [{ value: "mainland", label: "UAE mainland" }, { value: "freezone", label: "Free zones" }, { value: "abroad", label: "Abroad" }, { value: "government", label: "Government" }] as const;
const priorities = [{ key: "cost", label: "Cost" }, { key: "marketAccess", label: "Market access" }, { key: "tax", label: "Tax" }, { key: "investorAppeal", label: "Investor appeal" }, { key: "speed", label: "Speed" }, { key: "visas", label: "Visas" }] as const;
const money = (value: number) => `AED ${Math.round(value).toLocaleString("en-US")}`;
const nameOf = (id: string) => jurisdictions.find((item) => item.id === id)?.name ?? id;

function BinaryQuestion({ legend, value, onChange }: { legend: string; value?: boolean; onChange: (value: boolean) => void }) {
  return <fieldset className={styles.question}><legend>{legend}</legend><div className={styles.choices}>{[true, false].map((answer) => <label className={styles.choice} key={String(answer)}><input type="radio" name={legend} checked={value === answer} onChange={() => onChange(answer)} />{answer ? "Yes" : "No"}</label>)}</div></fieldset>;
}

export function NavigatorWorkspace() {
  const [profile, setProfile] = useState<Profile>(priya);
  const [loaded, setLoaded] = useState(false);
  const [calcInputs, setCalcInputs] = useState({ annualProfitAED: 0, mainlandRevenueSharePct: 0, visas: 1, years: 3, annualRevenueAED: 0 });
  const [weights, setWeights] = useState({ cost: 1, marketAccess: 1, tax: 1, investorAppeal: 1, speed: 1, visas: 1 });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [bankPack, setBankPack] = useState<{ text: string; jurisdiction: string } | null>(null);
  const agent = useAgentStream();
  useEffect(() => {
    const saved = readProfile() ?? structuredClone(priya);
    setProfile(saved);
    setCalcInputs((previous) => ({ ...previous, annualRevenueAED: saved.revenue12mAED, visas: Math.max(1, 1 + saved.hires12m) }));
    setLoaded(true);
  }, []);
  const prefs = useMemo(() => ({ weights }), [weights]);
  const result = useMemo(() => navigate(profile, prefs, calcInputs), [profile, prefs, calcInputs]);
  const flips = useMemo(() => flipPoints(profile, prefs, calcInputs), [profile, prefs, calcInputs]);
  const winner = result.winner;
  const answered = Number(Boolean(profile.customerLocations?.length)) + Number(profile.regulatedFinancialActivity !== undefined) + Number(profile.raisingForeignInvestment !== undefined) + Number(profile.physicalGoods !== undefined);
  const ready = loaded && answered === 4;

  function updateProfile(patch: Partial<Profile>) {
    agent.reset(); setNotice(""); setBankPack(null);
    setProfile((previous) => Profile.parse({ ...previous, ...patch }));
  }
  function updateCalculator(key: keyof typeof calcInputs, raw: string) {
    const number = Number(raw);
    if (!Number.isFinite(number) || number < 0) return;
    const value = key === "mainlandRevenueSharePct" ? Math.min(100, number) : key === "years" ? Math.min(10, Math.max(1, Math.round(number))) : key === "visas" ? Math.min(100, Math.round(number)) : Math.min(1_000_000_000_000, number);
    agent.reset(); setNotice(""); setBankPack(null); setCalcInputs((previous) => ({ ...previous, [key]: value }));
  }
  async function explain() {
    if (!ready) return;
    await agent.send({ intent: "navigator", locale: "en", profile, messages: [{ role: "user", content: `Help me decide where to set up. My interview facts are in my profile. Use these calculator inputs exactly: ${JSON.stringify(calcInputs)} and priorities: ${JSON.stringify(prefs)}. Call the navigation, simulation and flip-point tools. Explain the recommendation, runner-up, deal-breakers checked, confidence and what would change your mind. Cite rule and jurisdiction ids. Draft only.` }] });
  }
  async function useLocation() {
    if (!winner || !ready || busy) return;
    setBusy(true); setNotice("");
    const next = Profile.parse({ ...profile, jurisdiction: winner.jurisdictionId });
    try {
      const journey = await loadJourney(next);
      if (!journey.bank || !journey.obligations) throw new Error("The refresh was incomplete");
      const persisted = saveProfile(next);
      setProfile(next);
      setBankPack({ jurisdiction: winner.jurisdictionId, text: [
        "MANZIL - DRAFT BANK PREPARATION PACK", "You review and submit through official channels.",
        `Founder: ${next.name}`, `Location: ${winner.name}`, `Business: ${next.businessDescription}`,
        `Activity: ${next.activityCode ?? "UNKNOWN - verify with licensing authority"}`,
        `Readiness: ${journey.bank.band} (${journey.bank.score}/100, planning score)`,
        "", "DOCUMENTS DECLARED", ...next.documents.map((document) => `- ${document.docType}`),
        "", "CHECKS TO RESOLVE", ...journey.bank.findings.flatMap((finding) => [`${finding.checkId}: ${finding.title}`, finding.whyBankCares, `Next step: ${finding.fix}`, ""]),
        "LOCATION EVIDENCE", ...winner.evidence, "", "LOCATION CHECKS", ...winner.warnings,
        "", "UNKNOWN - VERIFY", ...winner.unknowns, "", "This draft is not a bank application or an approval decision.",
      ].join("\n") });
      setNotice(`Path, deadlines and bank pack updated for ${winner.name}.${persisted ? "" : " Browser storage is unavailable; saved for this session."}`);
    } catch { setNotice("Your location has not changed. We could not update all journey checks; please try again."); }
    finally { setBusy(false); }
  }

  return <div className={styles.workspace}>
    <Link href="/path" className="mb-5 inline-flex items-center gap-2 text-xs text-ink-muted hover:text-ink"><ArrowLeft size={13} aria-hidden="true" />Back to your path</Link>
    <header className={styles.hero}><div><p className={styles.eyebrow}>Your location navigator</p><h1>Bawsala<span className="text-primary-ink">.</span></h1><p className={styles.subtitle}>Bawsala — finds where your company belongs.</p><p className={styles.heroNote}><ShieldCheck size={14} aria-hidden="true" />Evidence-led. Draft-only. Always your decision.</p></div><BawsalaAvatar winner={winner?.jurisdictionId} size={120} /></header>
    {notice && <div role="status" className={styles.notice}>{notice} <Link href="/path" className={styles.smallLink}>View your path</Link>{bankPack && <a className={`${styles.smallLink} ml-3`} href={`data:text/plain;charset=utf-8,${encodeURIComponent(bankPack.text)}`} download={`manzil-${bankPack.jurisdiction}-bank-pack.txt`}>Download draft bank pack</a>}</div>}
    <div className={styles.layout}>
      <div className={styles.column}>
        <section className={styles.panel} aria-labelledby="interview-title"><div className={styles.panelBody}><div className={styles.panelHead}><h2 id="interview-title">Let’s find your fit</h2><span className={styles.counter}>{answered}/4 answered</span></div><p className={styles.intro}>A few things I need to know before recommending a location.</p>
          <fieldset className={styles.question}><legend>Who will your customers be?</legend><div className={styles.choices}>{locations.map((location) => <label className={styles.choice} key={location.value}><input type="checkbox" checked={profile.customerLocations?.includes(location.value) ?? false} onChange={(event) => { const current = profile.customerLocations ?? []; updateProfile({ customerLocations: event.target.checked ? [...current, location.value] : current.filter((item) => item !== location.value) }); }} />{location.label}</label>)}</div></fieldset>
          <BinaryQuestion legend="Will you offer regulated financial services?" value={profile.regulatedFinancialActivity} onChange={(regulatedFinancialActivity) => updateProfile({ regulatedFinancialActivity })} />
          <BinaryQuestion legend="Are you raising from foreign investors?" value={profile.raisingForeignInvestment} onChange={(raisingForeignInvestment) => updateProfile({ raisingForeignInvestment })} />
          <BinaryQuestion legend="Will you handle physical goods?" value={profile.physicalGoods} onChange={(physicalGoods) => updateProfile({ physicalGoods })} />
        </div></section>
        <section className={`${styles.panel} ${styles.winner}`} aria-labelledby="recommendation-title" aria-live="polite"><div className={styles.panelBody}>
          <div className={styles.winnerTop}><div><p className={styles.eyebrow}>{ready ? "Bawsala recommends" : "Your provisional fit"}</p><h3 id="recommendation-title">{winner?.name ?? "Let’s review your options"}</h3></div><span className={styles.chip}>{ready ? result.confidence : "Low"} confidence</span></div>
          <p className={styles.muted}>{ready ? "Based on your answers and current priorities." : "Answer all four questions to check your deal-breakers."}{result.runnerUp && ` Runner-up: ${result.runnerUp.name}.`}</p>
          {winner && <><ul className={styles.reasons}>{winner.reasons.slice(0, 3).map((reason) => <li key={reason}><Check aria-hidden="true" />{reason}</li>)}</ul>
          <div className={styles.dealbreakers}><h4>Deal-breakers checked</h4>
            <div className={styles.deal} data-warning={profile.regulatedFinancialActivity === undefined}>{profile.regulatedFinancialActivity === undefined ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}<span>{profile.regulatedFinancialActivity === undefined ? "Financial regulation: awaiting your answer." : profile.regulatedFinancialActivity ? "Regulated finance: only ADGM remains in this comparison. Confirm activity authorisation with FSRA." : "No regulated financial activity declared."}</span></div>
            <div className={styles.deal} data-warning={winner.warnings.includes("R-DUAL")}>{winner.warnings.includes("R-DUAL") ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}<span>{winner.warnings.includes("R-DUAL") ? "Mainland access: dual licence or relevant authorisation needs verification. [R-DUAL]" : "No dual-licence trigger identified from the current inputs. [R-DUAL]"}</span></div>
            <div className={styles.deal} data-warning={winner.warnings.includes("R-QFZP")}>{winner.warnings.includes("R-QFZP") ? <X aria-hidden="true" /> : <Check aria-hidden="true" />}<span>{winner.warnings.includes("R-QFZP") ? "Free-zone tax qualification needs review; zero tax is not assumed. [R-QFZP]" : "Tax estimate checked against the current scenario; confirm eligibility and substance. [R-CT, R-QFZP]"}</span></div>
          </div>
          <div className={styles.changeMind}><h4>What would change my mind</h4>{flips.length ? flips.slice(0, 3).map((flip, index) => <p key={`${flip.input}-${index}`}>{flip.explanation}</p>) : <p>No change in the leading location within the tested sales and profit ranges. Different priorities, confirmed fees or activity eligibility could change the result.</p>}</div>
          <Button className={styles.action} onClick={useLocation} disabled={!ready || busy}>{busy ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{busy ? "Updating your journey…" : "Use this location"}</Button>
          <Button variant="outline" className="mt-3 w-full" disabled={!ready || agent.isRunning} onClick={explain}>{agent.isRunning ? <LoaderCircle className="motion-safe:animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}{agent.isRunning ? "Bawsala is checking…" : "Ask Bawsala to explain"}</Button>
          </>}
          {agent.error && <p role="alert" className="mt-4 text-xs leading-6 text-ink-muted">{agent.error} The calculator remains available.</p>}
          {agent.result && <div className={styles.answer}><p className={styles.eyebrow}>{agent.result.status === "complete" ? "Verified explanation" : agent.result.status}</p><p>{agent.result.answer_md}</p><p className={styles.muted}>Evidence: {agent.result.evidence.join(" · ")}</p></div>}
        </div><AgentTheatre events={agent.events} isRunning={agent.isRunning} /></section>
      </div>
      <section className={styles.panel} aria-labelledby="calculator-title"><div className={styles.panelBody}><div className={styles.panelHead}><h2 id="calculator-title">Explore the numbers</h2><span className={styles.chip}>Live estimate</span></div><p className={styles.intro}>Change an input. See how the recommendation moves.</p>
        <div className={styles.inputGrid}>
          <label className={styles.field}>Annual taxable profit · AED<input aria-label="Annual taxable profit AED" type="number" min="0" max="1000000000000" step="10000" value={calcInputs.annualProfitAED} onChange={(event) => updateCalculator("annualProfitAED", event.target.value)} /></label>
          <label className={styles.field}>Mainland revenue share · %<input aria-label="Mainland revenue share percent" type="number" min="0" max="100" step="1" value={calcInputs.mainlandRevenueSharePct} onChange={(event) => updateCalculator("mainlandRevenueSharePct", event.target.value)} /></label>
          <label className={styles.field}>Visas needed<input aria-label="Visas needed" type="number" min="0" max="100" step="1" value={calcInputs.visas} onChange={(event) => updateCalculator("visas", event.target.value)} /></label>
          <label className={styles.field}>Planning horizon · years<input aria-label="Planning horizon years" type="number" min="1" max="10" step="1" value={calcInputs.years} onChange={(event) => updateCalculator("years", event.target.value)} /></label>
          <label className={`${styles.field} col-span-2`}>Annual revenue · AED (needed for the qualifying-income test)<input aria-label="Annual revenue AED" type="number" min="0" max="1000000000000" step="10000" value={calcInputs.annualRevenueAED} onChange={(event) => updateCalculator("annualRevenueAED", event.target.value)} /></label>
        </div>
        <details className={styles.priorities}><summary>Your priorities <span className={styles.muted}>· equal by default</span></summary><div className={styles.sliderGrid}>{priorities.map(({ key, label }) => <label className={styles.slider} key={key}><span>{label}<strong>{weights[key]}</strong></span><input type="range" min="0" max="5" step="1" aria-label={`${label} priority`} value={weights[key]} onChange={(event) => { agent.reset(); setWeights((previous) => ({ ...previous, [key]: Number(event.target.value) })); }} /></label>)}</div></details>
        <p className={styles.muted}>Ranked by fit, not price alone · {calcInputs.years}-year estimate</p>
        <div className={styles.rankings}>{result.rankings.map((entry) => <article className={styles.rank} key={entry.jurisdictionId} data-first={winner?.jurisdictionId === entry.jurisdictionId} data-knocked={entry.knockouts.length > 0}>
          <div className={styles.rankHead}><strong>{entry.name}</strong><span>{entry.knockouts.length ? "Ruled out" : `${entry.fitScore}/100 fit`}</span></div><div className={styles.bar} aria-hidden="true"><span style={{ width: `${entry.fitScore}%` }} /></div>
          {entry.knockouts.length ? <p className={styles.muted}>{entry.knockouts.join(" ")}</p> : <><div className={styles.costs}><span>Known cost: {money(entry.totalCostAED)}</span><span>Tax: {money(entry.taxEstimateAED)}</span></div><p className={styles.muted}>Combined: {money(entry.totalAED)} · estimate, verify</p></>}
          {entry.unknowns.length > 0 && <details className={styles.unknown}><summary>UNKNOWN · verify ({entry.unknowns.length})</summary><ul>{entry.unknowns.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></details>}
          {entry.warnings.length > 0 && <p className={styles.unknown}>Review: {entry.warnings.join(" · ")}</p>}
        </article>)}</div>
        <p className="mt-5 text-[10px] leading-5 text-ink-muted">Unknown costs are excluded, so these are partial totals. Tax is a simplified scenario estimate, not a determination of qualifying income. Mainland sales alone do not establish tax eligibility. Verify licensing, substance and tax treatment with the relevant authority.</p>
        <details className={styles.sources}><summary>Evidence & assumptions</summary><p className="mt-3 leading-5">Fit is a comparison model, not an official eligibility score. Missing speed, visa and cost facts lower confidence. Each source retains its verification status.</p>{jurisdictions.map((item) => <div className={styles.sourceRow} key={item.id}><strong>{nameOf(item.id)}</strong> · {item.verifiedOn} · {item.verify ? "verify" : "source recorded"}{item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></>}</div>)}{jurisdictionRules.map((rule) => <div className={styles.sourceRow} key={rule.id}><strong>{rule.id}</strong> · {rule.verifiedOn} · {rule.verify ? "verify" : "source recorded"} · <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer">Rule source</a></div>)}</details>
      </div></section>
    </div>
  </div>;
}
