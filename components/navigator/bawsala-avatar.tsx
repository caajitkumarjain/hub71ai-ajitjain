"use client";

import { useId, type CSSProperties } from "react";
import styles from "./navigator.module.css";

const bearings: Record<string, number> = { adgm: 0, hub71: 60, masdar: 120, kezad: 180, twofour54: 240, mainland: 300 };

export function BawsalaAvatar({ winner = "adgm", size = 88 }: { winner?: string; size?: number }) {
  const gradient = useId().replaceAll(":", "");
  return <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Bawsala compass" className={styles.compass}>
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="var(--primary)" /><stop offset="1" stopColor="var(--gold)" /></linearGradient></defs>
    <circle cx="50" cy="50" r="47" fill="var(--surface)" stroke="var(--line)" />
    <circle cx="50" cy="50" r="38" fill="none" stroke="var(--gold)" strokeOpacity=".35" strokeDasharray="1 5" />
    <path d="M50 8 58 31 80 20 69 42 92 50 69 58 80 80 58 69 50 92 42 69 20 80 31 58 8 50 31 42 20 20 42 31Z" fill={`url(#${gradient})`} opacity=".85" />
    <circle cx="50" cy="50" r="23" fill="var(--surface)" />
    <g className={styles.needle} style={{ "--bearing": `${bearings[winner] ?? 0}deg` } as CSSProperties}><path d="M50 17 60 50 50 45 40 50Z" fill="var(--gold)" /><path d="M50 83 40 50 50 55 60 50Z" fill="var(--primary)" /></g>
    <circle cx="50" cy="50" r="4" fill="var(--ink)" />
  </svg>;
}
