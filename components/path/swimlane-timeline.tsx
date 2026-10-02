"use client";

import type { CSSProperties } from "react";
import { PlaneLanding, Fingerprint, Building2, House, Users, BriefcaseBusiness, Check } from "lucide-react";
import type { Lane, PathNode, PathResult } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import styles from "./path.module.css";

const lanes = [
  { id: "arrive", label: "Arrive", Icon: PlaneLanding, color: "var(--sky)" },
  { id: "residency", label: "Your visa", Icon: Fingerprint, color: "var(--teal)" },
  { id: "company", label: "Your company", Icon: Building2, color: "var(--primary)" },
  { id: "home", label: "Your home", Icon: House, color: "var(--amber)" },
  { id: "family", label: "Your family", Icon: Users, color: "var(--coral)" },
  { id: "operate", label: "Running the business", Icon: BriefcaseBusiness, color: "color-mix(in srgb, var(--sky) 70%, var(--hero-deep))" },
] satisfies { id: Lane; label: string; Icon: typeof House; color: string }[];

const titles: Record<string, string> = {
  "A-ENTRY": "Enter the UAE", "A-STAY": "Temporary stay", "A-SIM": "Mobile number",
  "C-JURIS": "Choose location", "C-ACT": "Business activity", "C-NAME": "Trade name",
  "C-OFFICE": "Office lease", "C-CONST": "Company documents", "C-LIC": "Company licence",
  "C-EST": "Establishment card", "C-CT": "Corporate Tax", "C-BANK": "Business bank account", "C-HUB71": "Hub71 application",
  "R-INS": "Health insurance", "R-PERMIT": "Residence permit", "R-MED": "Medical test", "R-BIO": "Biometrics",
  "R-VISA": "Residence visa", "R-EID": "Emirates ID", "R-DL": "Driving licence",
  "H-PBANK": "Personal bank account", "H-LEASE": "Home lease", "H-TAWTH": "Tawtheeq", "H-UTIL": "Water & power", "H-NET": "Home internet",
  "F-ATTEST": "Certificate attestation", "F-INS": "Family insurance", "F-VISA": "Family visas", "F-EID": "Family Emirates IDs", "F-SCHOOL": "School application",
  "O-BOOKS": "Bookkeeping", "O-VATWATCH": "VAT watch", "O-HIRE": "Hiring & payroll", "O-EINV": "E-invoicing", "O-ADGMCAL": "ADGM filing calendar",
};
export function shortTitle(node: Pick<PathNode, "id" | "title">) { return titles[node.id] ?? node.title; }

export function SwimlaneTimeline({ path, selectedId, onSelect }: { path: PathResult; selectedId?: string; onSelect: (node: PathNode) => void }) {
  const end = Math.max(path.optimizedDays + 5, 5);
  const span = end + 30;
  const position = (day: number) => `${Math.max(0, Math.min(100, (day + 30) / span * 100))}%`;
  // Limit labelled ticks on long paths, but retain weekly gridlines.
  const weeks = Array.from({ length: Math.ceil(span / 7) }, (_, index) => -28 + index * 7).filter((day) => day <= end);
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 10));
  return <div className={styles.timeline} aria-label="Your steps, by days from arrival">
    <div className={styles.axis} aria-hidden="true"><div className={styles.axisTitle}>Days from arrival</div><div className={styles.axisTrack}>
      {weeks.map((day, index) => (day === 0 || (index % labelEvery === 0 && Math.abs(day) > 7)) && <span key={day} style={{ left: position(day) }} className={cn(styles.tick, day === 0 && styles.arrival)}>{day === 0 ? "You land" : day > 0 ? `+${day}` : day}</span>)}
    </div></div>
    {lanes.map(({ id, label, Icon, color }) => {
      const nodes = path.nodes.filter((node) => node.lane === id).sort((a, b) => a.earliestStart - b.earliestStart || a.earliestFinish - b.earliestFinish);
      if (!nodes.length) return null;
      return <section key={id} className={styles.lane} style={{ "--lane-color": color } as CSSProperties} aria-label={label}>
        <h3 className={styles.laneTitle}><Icon aria-hidden="true" />{label}</h3>
        <div className={styles.track}>{weeks.map((day) => <span key={day} aria-hidden="true" style={{ left: position(day) }} className={cn(styles.gridline, day === 0 && styles.landingLine)} />)}
          {nodes.map((node) => {
            const width = Math.max(0, (node.earliestFinish - node.earliestStart) / span * 100);
            const short = width < 19;
            const labelLeft = short && (node.earliestFinish + 30) / span > .7;
            return <div key={node.id} className={styles.stepRow}><button id={`step-${node.id}`} type="button" data-step-id={node.id} data-status={node.status} aria-haspopup="dialog" aria-expanded={selectedId === node.id}
              aria-labelledby={`step-label-${node.id} step-time-${node.id}`}
              aria-describedby={`step-tooltip-${node.id}`}
              onClick={() => onSelect(node)}
              className={cn(styles.step, node.status === "done" ? styles.done : node.critical && styles.critical)}
              style={{ "--step-left": position(node.earliestStart), "--step-width": `${width}%` } as CSSProperties}>
              <span id={`step-label-${node.id}`} className={cn(styles.barLabel, short && styles.shortLabel, labelLeft && styles.shortLabelLeft)}>{node.status === "done" && <Check className="size-3 shrink-0" aria-hidden="true" />}{shortTitle(node)}{node.verify && <span className={styles.verifyDot} aria-hidden="true" />}{node.critical && node.status !== "done" && <span className="text-[9px] uppercase tracking-wide opacity-80">{" "}Critical</span>}</span>
              <span id={`step-time-${node.id}`} className={styles.mobileTime}>{" "}Day {node.earliestStart} → {node.earliestFinish} · {node.status === "done" ? "Done" : `${node.durationDays.likely} days · estimate`}{node.status === "blocked" ? " · Blocked" : node.status === "in_progress" ? " · In progress" : ""}</span>
              <span id={`step-tooltip-${node.id}`} role="tooltip" className={cn(styles.stepTooltip, (node.earliestFinish + 30) / span > .7 && styles.tooltipLeft)}><strong>{node.title}</strong><span>{node.authority}</span><span>Day {node.earliestStart} → {node.earliestFinish} · estimate</span></span>
            </button></div>;
          })}
        </div>
      </section>;
    })}
  </div>;
}
