"use client";

import { useId, type CSSProperties } from "react";
import { motion } from "motion/react";
import agents from "@/data/agents.json";
import { agentManifestSchema } from "@/components/agents-room/manifest";
import styles from "./cover-diagram.module.css";

const fleet = agentManifestSchema.parse(agents);
const authorities = ["TAMM", "ICP", "ADGM", "ADDED", "FTA", "DoH", "ADREC", "ADDC / AADC", "Banks", "MOHRE", "ADEK", "Free zones"];
const products = [
  { title: "Your Path", lines: ["Every step in", "the right order"], icon: "path" },
  { title: "Bank check", lines: ["Prepare before", "you apply"], icon: "bank" },
  { title: "Company Studio", lines: ["AI agents prepare", "your paperwork"], icon: "studio" },
  { title: "Deadlines", lines: ["Stay ahead of", "filing deadlines"], icon: "time" },
] as const;
const star = "M0-42 8-19 30-30 19-8 42 0 19 8 30 30 8 19 0 42-8 19-30 30-19 8-42 0-19-8-30-30-8-19Z";
const accents = ["var(--primary)", "var(--gold)", "var(--sky)", "var(--teal)"];

function ProductIcon({ name }: { name: string }) {
  return <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {name === "path" ? <><circle cx="0" cy="0" r="2.5" /><circle cx="16" cy="16" r="2.5" /><path d="M0 3v8a5 5 0 0 0 5 5h8M8 0h8v8" /></>
      : name === "bank" ? <><path d="m-2 4 10-6 10 6M0 7v10m8-10v10m8-10v10M-2 20h20M-2 4h20" /></>
      : name === "studio" ? <><rect x="-1" y="0" width="18" height="19" rx="3" /><path d="M4 5h8M4 10h8M4 15h4M7-3h3" /></>
      : <><circle cx="8" cy="9" r="10" /><path d="M8 3v7l4 2" /></>}
  </g>;
}

function AgentFace({ index, monogram }: { index: number; monogram: string }) {
  const colour = accents[index % accents.length];
  return <g className={styles.face}>
    <circle r="17" fill="var(--surface)" stroke={colour} strokeOpacity=".7" />
    <circle cy="-2" r="8.2" fill={colour} opacity=".3" />
    <path d={index % 3 === 0 ? "M-8-4Q-9-14 0-12 10-12 8-3L5-8-3-6Z" : index % 3 === 1 ? "M-9-3Q-10-13 0-12 11-11 8 3L5-5Q0-2-6-5Z" : "M-8-4Q-5-14 3-11L9-6 7-1 4-7-3-5Z"} fill={colour} />
    <path d="M-4-1h1m6 0h1" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M-2 3q2 2 4 0" fill="none" stroke="var(--ink)" strokeWidth="1" strokeLinecap="round" />
    {index % 4 === 0 && <path d="M-6-3h5v4h-5Zm7 0h5v4H1ZM-1-1h2" fill="none" stroke="var(--ink)" strokeWidth=".7" />}
    <path d="M-10 14q1-7 10-7t10 7" fill={colour} opacity=".75" />
    <circle cx="13" cy="12" r="7.5" fill="var(--surface)" stroke="var(--line)" />
    <text x="13" y="14.2" textAnchor="middle" fill="var(--ink)" fontSize="5.7" fontWeight="700">{monogram}</text>
  </g>;
}

export function CoverDiagram({ phase, reducedMotion, compact = false }: { phase: "problem" | "transition" | "solution"; reducedMotion: boolean; compact?: boolean }) {
  const instance = useId().replaceAll(":", "");
  const problem = phase === "problem";
  const solution = phase === "solution";
  const width = compact ? 360 : 1000;
  const height = compact ? 570 : 450;
  const cx = width / 2;
  const cy = compact ? 180 : 225;
  const radius = compact ? 126 : 176;
  const transition = { duration: reducedMotion ? 0 : .7, ease: "easeOut" as const };
  const cardWidth = compact ? 152 : 256;
  const cardHeight = compact ? 100 : 88;
  const cards = compact ? [[18, 334], [190, 334], [18, 450], [190, 450]] : [[35, 90], [709, 90], [35, 278], [709, 278]];
  const points = authorities.map((_, index) => {
    if (compact) return { x: index % 2 === 0 ? 65 : 295, y: 47 + Math.floor(index / 2) * 78 };
    const angle = (index / authorities.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * 389, y: cy + Math.sin(angle) * 174 };
  });

  return <svg className={`${styles.diagram} ${compact ? styles.compact : ""}`} data-phase={phase} data-reduced={reducedMotion} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${instance}-title ${instance}-desc`}>
    <title id={`${instance}-title`}>{problem ? "A founder navigating separate authorities" : "Manzil connects your company journey"}</title>
    <desc id={`${instance}-desc`}>{problem ? `A founder faces overlapping steps across ${authorities.join(", ")}.` : "One coordinated route connects your Path, Bank check, Company Studio and Deadlines, supported by the Manzil agent fleet."}</desc>
    <defs>
      <radialGradient id={`${instance}-halo`}><stop stopColor="var(--primary)" stopOpacity=".14" /><stop offset="1" stopColor="var(--primary)" stopOpacity="0" /></radialGradient>
      <linearGradient id={`${instance}-star`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--primary)" /><stop offset="1" stopColor="var(--gold)" /></linearGradient>
    </defs>
    <motion.circle cx={cx} cy={cy} r={radius + 50} fill={`url(#${instance}-halo)`} animate={{ opacity: problem ? 0 : 1 }} transition={transition} />

    <motion.g animate={{ opacity: problem ? 1 : 0 }} transition={transition}>
      {points.map((point, index) => <path key={authorities[index]} d={`M${cx} ${cy} C${point.x + (index % 2 ? -130 : 130)} ${cy + (index % 3 - 1) * 190},${cx + (index % 2 ? 95 : -95)} ${point.y},${point.x} ${point.y}`} className={styles.tangle} style={{ animationDelay: `${index * -.3}s` }} />)}
    </motion.g>

    <motion.path d={`M${compact ? 24 : 62} ${cy}H${width - (compact ? 24 : 62)}`} fill="none" stroke="var(--gold)" strokeWidth="2" initial={false} animate={{ pathLength: problem ? 0 : 1, opacity: phase === "transition" ? 1 : 0 }} transition={transition} />
    {authorities.map((label, index) => <motion.g key={label} initial={false} animate={{ x: problem ? points[index].x : (compact ? 25 + index * 28 : 70 + index * 78), y: problem ? points[index].y : cy, opacity: solution ? 0 : phase === "transition" ? .55 : 1, scale: phase === "transition" ? .6 : 1 }} transition={transition}>
      <g className={problem && !reducedMotion ? styles.wobble : undefined} style={{ animationDelay: `${index * -.37}s` }}><rect x={-54} y={-17} width="108" height="34" rx="9" fill="var(--surface)" stroke="var(--line)" /><text textAnchor="middle" y="4" className={styles.authority}>{label}</text></g>
    </motion.g>)}

    <motion.g initial={false} animate={{ opacity: solution ? 1 : 0 }} transition={transition}>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--primary)" strokeOpacity=".13" strokeDasharray="2 7" />
      {cards.map(([x, y], index) => <path key={index} d={`M${cx} ${cy}C${cx} ${compact ? y - 24 : y + cardHeight / 2},${x + cardWidth / 2} ${cy},${x + cardWidth / 2} ${y + cardHeight / 2}`} className={styles.connection} />)}
      <g className={!reducedMotion ? styles.orbit : undefined} style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {fleet.map((agent, index) => {
          const angle = index / fleet.length * Math.PI * 2 - Math.PI / 2;
          return <g key={agent.id} transform={`translate(${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius})`}><g className={!reducedMotion ? styles.counterOrbit : undefined}><title>{agent.name}</title><AgentFace index={index} monogram={agent.monogram} /></g></g>;
        })}
      </g>
      {products.map((product, index) => <g key={product.title} transform={`translate(${cards[index][0]} ${cards[index][1]})`}>
        <rect width={cardWidth} height={cardHeight} rx="14" fill="var(--surface)" stroke="var(--primary)" strokeOpacity=".35" />
        <path d={`M16 0H${cardWidth - 16}`} stroke="var(--primary)" strokeOpacity=".55" />
        <g transform={compact ? "translate(14 16) scale(.7)" : "translate(18 29)"} color="var(--primary)"><ProductIcon name={product.icon} /></g>
        <text x={compact ? 38 : 53} y={compact ? 26 : 33} className={styles.productTitle}>{product.title}</text>
        <text x={compact ? 14 : 53} y={compact ? 54 : 53} className={styles.productCopy}>{product.lines.map((line, lineIndex) => <tspan x={compact ? 14 : 53} dy={lineIndex ? 16 : 0} key={line}>{line}</tspan>)}</text>
      </g>)}
    </motion.g>

    <g transform={`translate(${cx} ${cy})`}>
      <motion.g initial={false} animate={{ opacity: problem ? 1 : 0, scale: problem ? 1 : .6 }} transition={transition}>
        <circle r={compact ? 42 : 52} fill="var(--surface)" stroke="var(--line)" />
        <circle cy="-12" r="10" fill="none" stroke="var(--ink)" strokeWidth="2" /><path d="M-19 18v-4a19 15 0 0 1 38 0v4" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <text textAnchor="middle" y="38" className={styles.founder}>You</text>
      </motion.g>
      <motion.g initial={false} animate={{ opacity: problem ? 0 : 1, scale: problem ? .5 : 1, rotate: problem ? -45 : 0 }} transition={transition}>
        <circle r="67" fill="var(--bg)" stroke="var(--primary)" strokeOpacity=".25" /><circle r="58" fill="var(--surface)" />
        <path d={star} fill={`url(#${instance}-star)`} /><circle r="12" fill="var(--surface)" /><circle r="4" fill="var(--gold)" />
        <text textAnchor="middle" y="86" className={styles.manzil}>MANZIL</text>
        <text textAnchor="middle" y="102" className={styles.hubCaption}>One clear way forward</text>
      </motion.g>
    </g>
  </svg>;
}
