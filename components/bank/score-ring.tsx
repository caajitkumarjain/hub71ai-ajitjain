"use client";

import { useEffect, useRef, useState } from "react";
import type { BankabilityResult } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import styles from "./bank.module.css";

export function ScoreRing({ score, band }: Pick<BankabilityResult, "score" | "band">) {
  const [display, setDisplay] = useState(score);
  const [improved, setImproved] = useState(false);
  const previous = useRef(score);
  useEffect(() => {
    const from = previous.current; previous.current = score;
    setImproved(score > from);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setDisplay(score); return; }
    const start = performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / 650);
      setDisplay(Math.round(from + (score - from) * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  const color = band === "Ready" ? "var(--teal)" : band === "Fixable" ? "var(--amber)" : "var(--coral)";
  return <div className={cn(styles.ring, improved && styles.improved)} data-score={score} role="img" aria-label={`Bank readiness: ${score} out of 100. ${band}.`} style={{ color }}>
    <svg viewBox="0 0 240 240" aria-hidden="true" className="size-full -rotate-90"><circle cx="120" cy="120" r="106" fill="none" stroke="var(--line)" strokeWidth="8" /><circle cx="120" cy="120" r="106" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - score} className={styles.arc} /></svg>
    <div className={styles.ringContent} aria-hidden="true"><span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">Bank readiness</span><span className="mt-3 font-display text-[72px] leading-none tracking-tight text-ink">{display}</span><span className="mt-3 text-base font-medium">{band}</span></div>
  </div>;
}
