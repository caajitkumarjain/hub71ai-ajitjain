"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Logo } from "@/components/brand/logo";
import { CoverDiagram } from "./cover-diagram";
import styles from "./cover.module.css";

type Phase = "problem" | "transition" | "solution";
type Props = { stepCount: number; penaltyAED: number | null; penaltySourceUrl: string };

function Arrow({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function CoverIntro({ stepCount, penaltyAED, penaltySourceUrl }: Props) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("problem");
  const [replay, setReplay] = useState(0);
  const cover = useRef<HTMLDivElement>(null);
  const reduced = Boolean(reducedMotion);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setPhase("solution"); return; }
    setPhase("problem");
    const straighten = window.setTimeout(() => setPhase("transition"), 3500);
    const reveal = window.setTimeout(() => setPhase("solution"), 5000);
    return () => { clearTimeout(straighten); clearTimeout(reveal); };
  }, [replay, reducedMotion]);

  useEffect(() => {
    cover.current?.focus({ preventScroll: true });
    // This route sits inside the shared layout; keep its covered chrome out of the tab order.
    const main = cover.current?.closest("main");
    const siblings = main?.parentElement ? Array.from(main.parentElement.children).filter((element): element is HTMLElement => element instanceof HTMLElement && element !== main) : [];
    const previous = siblings.map((element) => ({ element, inert: element.inert }));
    previous.forEach(({ element }) => { element.inert = true; });
    const enter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest("a, button, input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault(); router.push("/");
    };
    window.addEventListener("keydown", enter);
    return () => { window.removeEventListener("keydown", enter); previous.forEach(({ element, inert }) => { element.inert = inert; }); };
  }, [router]);

  function restart() {
    cover.current?.scrollTo({ top: 0, behavior: "instant" });
    setPhase(reduced ? "solution" : "problem"); setReplay((value) => value + 1);
  }

  return <div ref={cover} tabIndex={-1} data-theme="night" data-phase={phase} className={styles.cover} aria-label="Welcome to Manzil">
    <div className={styles.background} aria-hidden="true"><div className={styles.heroWash} /><div className={styles.aurora} /><div className={styles.auroraSecond} /><svg className={styles.pattern} width="100%" height="100%"><defs><pattern id="welcome-star-pattern" width="132" height="132" patternUnits="userSpaceOnUse"><path d="m66 39 7.8 12.8 14.1-7.9-7.9 14.3L93 66l-13 7.8 7.9 14.1-14.1-7.9L66 93l-7.8-13-14.1 7.9 7.9-14.1L39 66l13-7.8-7.9-14.3 14.1 7.9Z" fill="none" stroke="currentColor" strokeWidth=".8" /></pattern></defs><rect width="100%" height="100%" fill="url(#welcome-star-pattern)" /></svg></div>
    <header className={styles.header}><Logo /><div className={styles.headerActions}><span className={styles.location}>ABU DHABI, UAE</span><Link href="/" className={styles.skip}>Skip intro<Arrow /></Link></div></header>

    <div className={styles.story}>
      <section className={styles.problem} aria-labelledby="welcome-problem-title" inert={phase === "solution" && undefined}>
        <div className={styles.heading}><p className={styles.eyebrow}><span />THE AMBITION IS SIMPLE</p><h1 id="welcome-problem-title">Moving to Abu Dhabi<br />to build a company?</h1><p className={styles.subtitle}>{stepCount} steps. 12 authorities. No one tells you the order.</p></div>
        <div className={styles.desktopDiagram}><CoverDiagram key={`problem-${replay}`} phase={phase === "solution" ? "transition" : phase} reducedMotion={reduced} /></div>
        <div className={styles.mobileDiagram}><CoverDiagram phase="problem" reducedMotion={reduced} compact /></div>
        <div className={styles.facts}>
          <article><p><strong>700+</strong> government services on TAMM</p><a href="https://www.dge.gov.ae/en/news/department-of-government-enablement-abu-dhabi-enhances-tamm-platform" target="_blank" rel="noopener noreferrer">Source: Department of Government Enablement ↗</a></article>
          <article><p><strong>{penaltyAED === null ? "UNKNOWN" : `AED ${penaltyAED.toLocaleString("en-US")}`}</strong> fine for late Corporate Tax registration</p><a href={penaltySourceUrl} target="_blank" rel="noopener noreferrer">Source: FTA · conditional waivers may apply ↗</a></article>
          <article><p>Banks can reject when your licence doesn’t match your business</p><a href="https://rulebook.centralbank.ae/en/entiresection/4008" target="_blank" rel="noopener noreferrer">CBUAE due diligence · individual bank review ↗</a></article>
        </div>
        <p className={styles.scopeNote}>Illustrative founder journey · steps vary with your circumstances</p>
      </section>

      <section className={styles.solution} aria-labelledby="welcome-solution-title">
        <div className={styles.heading}><p className={styles.eyebrow}><span />ONE PLACE. A CLEAR WAY FORWARD.</p><h2 id="welcome-solution-title">Your next chapter.<br /><em>Already in order.</em></h2><p className={styles.subtitle}>One connected path, with a team beside you.</p></div>
        <div className={styles.desktopDiagram}><CoverDiagram phase="solution" reducedMotion={reduced || phase !== "solution"} /></div>
        <div className={styles.mobileDiagram}><CoverDiagram phase="solution" reducedMotion={reduced || phase !== "solution"} compact /></div>
        <p className={styles.teamLabel}><svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true"><path d="m10 2 6 2v5c0 4-6 8-6 8S4 13 4 9V4l6-2Z" stroke="currentColor" strokeWidth="1.2" /><path d="m7 9 2 2 4-4" stroke="currentColor" strokeWidth="1.2" /></svg>An AI agent team, checked by a verifier</p>
        <ol className={styles.journey} aria-label="Your journey">{["Arrive", "Build", "Run", "Belong"].map((word, index) => <li key={word}><span>{word}</span>{index < 3 && <Arrow />}</li>)}</ol>
      </section>
    </div>

    <footer className={styles.footer}>
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .6, ease: "easeOut" }}><Link href="/" className={styles.enter}>Enter Manzil<Arrow /></Link></motion.div>
      <p className={styles.builtFor}>Built for founders. Useful for Hub71 and Abu Dhabi.</p>
      <div className={styles.footerBottom}><span className={styles.keyHint}>Press <kbd>Enter ↵</kbd> to begin</span><div className={styles.progress} aria-label={phase === "solution" ? "Introduction complete" : "Introduction playing"}><i data-active={phase === "problem"} /><i data-active={phase === "transition"} /><i data-active={phase === "solution"} /></div><button type="button" className={styles.replay} aria-label="Replay introduction" onClick={restart}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Replay</button></div>
      <p className={styles.draftNote}>Drafts and guidance. You review and submit through official channels.</p>
    </footer>
  </div>;
}
