"use client";

import Link from "next/link";
import Image from "next/image";
import { agentPortraits } from "@/components/agents-room/portraits";
import agents from "@/data/agents.json";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUpRight, Bot, Building2, CalendarClock, Check, CheckCheck, ChevronRight, Compass, FileCheck2, Landmark, MapPin, Route, Sparkles, ShieldCheck } from "lucide-react";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { GeoPattern } from "@/components/brand/geo-pattern";
import { PriyaButton } from "@/components/path/priya-button";
import styles from "./oasis-landing.module.css";

type LandingProps = { initialScore: number; fixedScore: number; vatDays: number | null };

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: reduced ? 0 : 0.55, delay, ease: "easeOut" }}>{children}</motion.div>;
}

function PreviewLanes({ compact = false }: { compact?: boolean }) {
  return <div className={`${styles.lanes} ${compact ? styles.compactLanes : ""}`} aria-hidden="true">
    {["Arrive", "Company", "Bank", "Home"].map((name, index) => <div className={styles.lane} key={name}><span>{name}</span><div className={styles.laneTrack}><i className={`${styles.laneBar} ${index === 1 ? styles.criticalBar : ""}`} style={{ "--lane-order": index } as CSSProperties}>{index === 1 && <span>Critical path</span>}</i></div></div>)}
  </div>;
}

function ScorePreview({ initialScore, fixedScore, light = false }: Pick<LandingProps, "initialScore" | "fixedScore"> & { light?: boolean }) {
  const reduced = useReducedMotion();
  const value = useMotionValue(initialScore);
  const rounded = useTransform(value, (score) => Math.round(score));
  useEffect(() => {
    if (reduced) { value.set(fixedScore); return; }
    const animation = animate(value, fixedScore, { duration: 0.6, ease: "easeOut" });
    return () => animation.stop();
  }, [fixedScore, reduced, value]);
  return <div className={`${styles.scorePreview} ${light ? styles.lightScore : ""}`}>
    <div className={styles.scoreRing} aria-hidden="true" style={{ "--score-start": initialScore, "--score-end": fixedScore } as CSSProperties}><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" pathLength="100" /><circle cx="32" cy="32" r="27" pathLength="100" /></svg><Check className={styles.scoreCheck} /></div>
    <div><p>Bank readiness</p><div className={styles.scoreValue}><span>{initialScore}</span><ArrowRight aria-hidden="true" /><motion.strong>{rounded}</motion.strong></div><span className={styles.tinyLabel}>One activity fix · demo</span></div>
  </div>;
}

function HeroPreview({ initialScore, fixedScore, vatDays }: LandingProps) {
  return <div className={styles.previewWrap}>
    <div className={styles.previewHalo} aria-hidden="true" />
    <div className={styles.preview}>
      <div className={styles.previewHeader}><div><span className={styles.previewEyebrow}>A clearer way forward</span><h2>Your Abu Dhabi path</h2></div><span className={styles.demoLabel}>Illustrative demo</span></div>
      <div className={styles.previewRule}><span>ONE CONNECTED JOURNEY</span><span>IN THE RIGHT ORDER</span></div>
      <PreviewLanes />
      <div className={styles.previewDivider} />
      <div className={styles.previewBottom}><ScorePreview initialScore={initialScore} fixedScore={fixedScore} /><div className={styles.previewDeadline}><span className={styles.deadlineIcon}><CalendarClock aria-hidden="true" /></span><div><p>VAT registration</p><strong>{vatDays === null ? "Verify deadline" : `${vatDays} days`}</strong><span>From threshold crossing<br />estimate · verify with FTA</span></div></div></div>
      <div className={styles.previewFooter}><ShieldCheck aria-hidden="true" /><span>Sources attached. Every next step explained.</span><ArrowUpRight aria-hidden="true" /></div>
    </div>
    <div className={styles.floatingNote}><span><CheckCheck aria-hidden="true" /></span><div><strong>A plan that moves with you</strong><p>See what changes before you decide.</p></div></div>
  </div>;
}

function CompanyPreview() {
  return <div className={styles.companyPreview} aria-hidden="true"><div className={styles.companyDocument}><span className={styles.documentMark}><Building2 /></span><div><i /><i /></div><Check /></div><div className={styles.companyChecks}>{["Activity", "Jurisdiction", "Documents"].map((label, index) => <span key={label} style={{ "--item-order": index } as CSSProperties}><Check />{label}</span>)}</div></div>;
}

function TeamPreview() {
  return <div className={styles.teamPreview} aria-hidden="true"><div className={styles.teamHub}><Bot /><span>Concierge</span></div><div className={styles.teamBranches}>{[{ Icon: Route, label: "Pathfinder" }, { Icon: Landmark, label: "Bank Officer" }, { Icon: CalendarClock, label: "Deadlines" }].map(({ Icon, label }, index) => <div key={label} style={{ "--item-order": index } as CSSProperties}><Icon /><span>{label}</span></div>)}</div><p><ShieldCheck />Tools compute. Agents explain.</p></div>;
}

export function OasisLanding(props: LandingProps) {
  return <div className={styles.landing}>
    <section className={styles.hero} aria-labelledby="landing-title">
      <div className={styles.aurora} aria-hidden="true"><span /><span /><span /></div>
      <GeoPattern className={styles.geo} />
      <div className={styles.heroContent}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><MapPin aria-hidden="true" />YOUR NEXT CHAPTER, ABU DHABI</p>
          <h1 id="landing-title">Arrive. Build.<br /><span>Belong.</span></h1>
          <p className={styles.heroDescription}>A new home. A new business. A lot to figure out.<br className={styles.desktopBreak} /> Bring your whole Abu Dhabi journey into one clear path.</p>
          <div className={styles.heroActions}><div className={styles.heroPriya}><PriyaButton /></div><Link href="/start" className={styles.heroSecondary}>Start with my details<ArrowRight aria-hidden="true" /></Link></div>
          <p className={styles.heroFootnote}><span aria-hidden="true" />Built around your life, your business, your next step.</p>
        </div>
        <HeroPreview {...props} />
      </div>
      <a href="#how-it-works" className={styles.exploreLink}>A little clarity goes a long way<ArrowDown aria-hidden="true" /></a>
    </section>

    <section className={styles.trust} aria-label="Official source references"><p>Rules sourced from</p><div>{["adgm.com", "tax.gov.ae", "tamm.abudhabi", "masdarcityfreezone.com", "doh.gov.ae"].map((domain) => <a href={`https://${domain}/`} key={domain} target="_blank" rel="noopener noreferrer"><strong>{domain}</strong><ArrowUpRight aria-hidden="true" /></a>)}</div></section>

    <section id="how-it-works" className={styles.howSection} aria-labelledby="how-heading">
      <Reveal className={styles.sectionHeading}><p className={styles.sectionEyebrow}>LESS GUESSWORK. MORE MOMENTUM.</p><h2 id="how-heading">From a big move<br />to your next small step.</h2><p>Start with who you are. See what connects. Move forward with a plan that makes sense.</p></Reveal>
      <div className={styles.howGrid}>{[
        { Icon: Compass, title: "Tell us", text: "Your move, your family and what you’re building. The details that make your path yours." },
        { Icon: Route, title: "See your path", text: "A connected timeline shows what comes first, what can run together and what needs attention." },
        { Icon: FileCheck2, title: "Stay on track", text: "Check the sources, prepare your documents and keep moving through the official channels." },
      ].map(({ Icon, title, text }, index) => <Reveal key={title} delay={index * 0.08} className={styles.howCard}><div className={styles.howCardTop}><span className={styles.howIcon}><Icon aria-hidden="true" /></span><span className={styles.stepNumber}>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></Reveal>)}</div>
    </section>

    <section className="mx-auto max-w-[1152px] px-4 py-12 md:py-16" aria-labelledby="agent-team-heading">
      <Reveal className="rounded-2xl border border-line bg-surface p-6 shadow-sm md:p-10">
        <p className={styles.sectionEyebrow}>SPECIALISTS FOR YOUR NEXT STEP</p>
        <h2 id="agent-team-heading" className="mt-3 font-heading text-3xl text-ink md:text-4xl">Meet the agent team</h2>
        <p className="mt-3 max-w-xl text-sm leading-7 text-ink-muted">Get to know the specialists behind your path, bank readiness and deadlines. See their tools, sources and work in progress.</p>
        <div className="my-7 grid grid-cols-3 gap-5 sm:grid-cols-6">
          {agents.slice(0, 6).map((agent) => <div key={agent.id} className="min-w-0 text-center"><Image src={agentPortraits[agent.id]} alt="" width={88} height={88} sizes="88px" className="mx-auto size-20 rounded-full border-2 border-primary-soft object-cover" /><p className="mt-3 text-xs font-semibold leading-5 text-ink">{agent.name}</p></div>)}
        </div>
        <Link href="/agents" className="oasis-button inline-flex min-h-12 items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition duration-200 ease-out hover:bg-primary-hover hover:text-primary-hover-foreground motion-safe:hover:-translate-y-px">See the agents at work<ArrowRight aria-hidden="true" className="size-4" /></Link>
      </Reveal>
    </section>

    <section className={styles.bentoSection} aria-labelledby="bento-heading">
      <Reveal className={styles.bentoHeading}><div><p className={styles.sectionEyebrow}>ONE PLACE TO GET YOUR BEARINGS</p><h2 id="bento-heading">Everything starts<br />to come together.</h2></div><p>Practical tools for the decisions ahead.<br />Human clarity, with a little help from AI.</p></Reveal>
      <div className={styles.bentoGrid}>
        <Reveal className={`${styles.bentoCard} ${styles.pathCard}`}><Link href="/path" className={styles.cardLink} aria-label="Explore your path"><div className={styles.cardTop}><span className={styles.cardIcon}><Route aria-hidden="true" /></span><ArrowUpRight aria-hidden="true" /></div><div className={styles.cardCopy}><p>Your Path</p><h3>The right order.<br />A calmer arrival.</h3><span>Visa, home, family and business. See the connections and the steps you can start now.</span></div><div className={styles.pathMini}><PreviewLanes compact /><span className={styles.demoCaption}>Illustrative timeline</span></div></Link></Reveal>
        <Reveal delay={0.07} className={`${styles.bentoCard} ${styles.bankCard}`}><Link href="/bank" className={styles.cardLink} aria-label="Explore bank readiness"><div className={styles.cardTop}><span className={styles.cardIcon}><Landmark aria-hidden="true" /></span><ArrowUpRight aria-hidden="true" /></div><div className={styles.cardCopy}><p>Bank check</p><h3>A stronger first<br />conversation.</h3><span>Understand the questions a bank may ask, and fix gaps before you apply.</span></div><div className={styles.bankMini}><ScorePreview initialScore={props.initialScore} fixedScore={props.fixedScore} light /><span className={styles.demoCaption}>Illustrative demo · not a bank decision</span></div></Link></Reveal>
        <Reveal className={`${styles.bentoCard} ${styles.companyCard}`}><Link prefetch={false} href="/company" className={styles.cardLink} aria-label="Explore company setup"><div className={styles.cardTop}><span className={styles.cardIcon}><Building2 aria-hidden="true" /></span><ArrowUpRight aria-hidden="true" /></div><div className={styles.cardCopy}><p>Company Studio</p><h3>Give your idea<br />a place to grow.</h3><span>Explore your activity, compare locations and prepare the documents for your next chapter.</span></div><CompanyPreview /><span className={styles.demoCaption}>Illustrative setup preview</span></Link></Reveal>
        <Reveal delay={0.07} className={`${styles.bentoCard} ${styles.teamCard}`}><Link prefetch={false} href="/agents" className={styles.cardLink} aria-label="Meet the Manzil AI team"><div className={styles.cardTop}><span className={styles.cardIcon}><Sparkles aria-hidden="true" /></span><ArrowUpRight aria-hidden="true" /></div><div className={styles.cardCopy}><p>AI agent team</p><h3>Good questions.<br />Clearer answers.</h3><span>Specialists explain your options, with tools for the calculations and sources you can inspect.</span></div><TeamPreview /><span className={styles.demoCaption}>Illustrative agent workflow</span></Link></Reveal>
      </div>
    </section>

    <Reveal className={styles.finalCta}><div><p className={styles.sectionEyebrow}>YOUR NEXT CHAPTER IS WAITING</p><h2>Your Abu Dhabi journey, compiled.</h2><p>You bring the ambition. Start with a clearer path.</p></div><div className={styles.finalActions}><div className={styles.heroPriya}><PriyaButton /></div><Link href="/start">Start with my details<ChevronRight aria-hidden="true" /></Link></div><GeoPattern className={styles.finalGeo} /></Reveal>
  </div>;
}
