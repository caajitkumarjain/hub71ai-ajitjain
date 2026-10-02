"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays } from "lucide-react";
import type { Obligation } from "@/lib/schemas";
import { SourceChip, VerifyBadge } from "@/components/brand/source-chip";
import { dateLabel, groupObligations, obligationKey } from "./deadline-client";
import styles from "./deadlines.module.css";

export function ObligationList({ obligations, addedIds }: { obligations: Obligation[]; addedIds: Set<string> }) {
  const reduced = useReducedMotion();
  const groups = groupObligations(obligations);
  return <div className="space-y-9">
    <AnimatePresence initial={false}>
      {groups.map(({ month, rows }) => <motion.section layout={!reduced} key={month} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, overflow: "hidden" }} transition={{ duration: reduced ? 0 : .25 }} aria-label={month === "undated" ? "To keep in mind" : dateLabel(`${month}-01`, { month: "long", year: "numeric" })}>
        <h3 className="mb-4 flex items-center gap-3 font-display text-xl"><span className="h-px w-6 bg-gold" aria-hidden="true" />{month === "undated" ? "To keep in mind" : dateLabel(`${month}-01`, { month: "long", year: "numeric" })}</h3>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <AnimatePresence initial={false}>
            {rows.map((row) => <motion.article layout={!reduced} key={obligationKey(row)} data-rule-id={row.ruleId} data-due-date={row.dueDate ?? ""} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reduced ? 0 : .25 }} className={styles.obligation}>
              <div className={styles.dateBlock} data-overdue={row.status === "overdue"}>
                {row.dueDate ? <time dateTime={row.dueDate}><span className="block font-display text-3xl leading-none">{dateLabel(row.dueDate, { day: "numeric" })}</span><span className="mt-1 block text-[11px] uppercase tracking-wider">{dateLabel(row.dueDate, { month: "short" })}</span></time> : <CalendarDays aria-hidden="true" className="size-5" />}
              </div>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-ink-muted">{row.ruleId}</span>{row.verify && <VerifyBadge />}{addedIds.has(obligationKey(row)) && <span className="rounded-full bg-teal/10 px-2 py-1 text-[11px] text-teal">New</span>}{row.status === "overdue" && <span className="rounded-full bg-coral/10 px-2 py-1 text-[11px] text-ink">Overdue</span>}{row.status === "due_soon" && <span className="rounded-full bg-amber/10 px-2 py-1 text-[11px] text-ink">Due soon</span>}</div>
                <h4 className="mt-2 text-sm font-semibold leading-6">{row.title}</h4><p className="mt-1 text-xs leading-5 text-ink-muted">{row.authority}{!row.dueDate && " · No date set"}</p>
                <p className="mt-3 text-sm leading-6"><span className="text-ink-muted">{row.dueDate ? "If late: " : "Penalty / consequence: "}</span>{row.penaltyDisplay}</p>
                <div className="mt-3"><SourceChip {...row} /></div>
                <details className="mt-3 text-xs leading-6 text-ink-muted"><summary className="w-fit cursor-pointer underline-offset-4 hover:underline">Why this applies</summary><p className="mt-2 max-w-3xl">{row.reason.replaceAll("C-LIC earliest finish", "estimated licence completion")}</p></details>
              </div>
            </motion.article>)}
          </AnimatePresence>
        </div>
      </motion.section>)}
    </AnimatePresence>
    {!obligations.length && <p className="rounded-xl border border-line bg-surface p-6 text-sm text-ink-muted">No obligations were returned for this scenario. Verify your requirements with the relevant authorities.</p>}
  </div>;
}
