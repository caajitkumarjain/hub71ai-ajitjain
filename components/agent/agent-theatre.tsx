"use client";

import { ArrowRight, Check, ChevronDown, Circle, FileCheck2, GitBranch, LoaderCircle, Wrench } from "lucide-react";
import type { TraceEvent } from "@/lib/schemas";
import { verifierApproved } from "./agent-stream";

function detail(event: TraceEvent, key: string): string | undefined {
  if (!event.data || typeof event.data !== "object" || !(key in event.data)) return undefined;
  const value = (event.data as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export function theatreSummary(events: readonly TraceEvent[], isRunning = false): string {
  const agents: string[] = [];
  for (const event of events) {
    if (["run_start", "agent_start"].includes(event.kind) && event.agent && !agents.includes(event.agent)) agents.push(event.agent);
    if (event.kind === "handoff") {
      for (const name of [detail(event, "from"), detail(event, "to")]) if (name && !agents.includes(name)) agents.push(name);
    }
  }
  const tools = events.filter((event) => event.kind === "tool_call").length;
  const verdict = events.filter((event) => event.kind === "verifier").at(-1);
  const parts = [agents.join(" → "), tools ? `${tools} ${tools === 1 ? "tool" : "tools"}` : ""];
  if (verdict && verifierApproved(verdict)) parts.push("Verified ✓");
  else if (isRunning) parts.push("Working…");
  else if (verdict) parts.push("Verification needs attention");
  else parts.push(events.length ? "Not verified" : "Waiting to start");
  return parts.filter(Boolean).join(" · ");
}

function eventLabel(event: TraceEvent): string {
  switch (event.kind) {
    case "run_start": return "Request received";
    case "agent_start": return `${event.agent} started`;
    case "handoff": return `${detail(event, "from") ?? event.agent} → ${detail(event, "to") ?? event.name ?? "specialist"}`;
    case "tool_call": return `Tool · ${event.name?.replaceAll("_", " ") ?? "checking evidence"}`;
    case "tool_result": return `Result · ${event.name?.replaceAll("_", " ") ?? "evidence received"}`;
    case "guardrail": return "Request safety check";
    case "verifier": return verifierApproved(event) ? "Verifier approved the answer" : "Verifier requested a revision";
    case "final": return detail(event, "status") === "complete" ? "Answer ready" : "Verification limit explained";
    case "error": return "Run could not complete";
    case "fallback": return "Recorded response loaded · cached";
    default: return "Response prepared";
  }
}

export function AgentTheatre({ events, isRunning = false }: { events: readonly TraceEvent[]; isRunning?: boolean }) {
  const timeline = events.filter((event) => event.kind !== "message_delta");
  return <details className="group/theatre border-t border-line text-left">
    <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-4 text-xs [&::-webkit-details-marker]:hidden">
      <GitBranch aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-ink" />
      <span className="min-w-0 flex-1"><span className="block font-medium text-ink">How Manzil worked this out</span><span className="mt-1 block break-words text-[11px] leading-5 text-ink-muted">{theatreSummary(events, isRunning)}</span></span>
      <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ink-muted transition-transform group-open/theatre:rotate-180" />
    </summary>
    <ol aria-label="Agent activity timeline" className="space-y-0 px-4 pb-5">
      {timeline.map((event, index) => {
        const Icon = event.kind === "handoff" ? ArrowRight : event.kind === "tool_call" || event.kind === "tool_result" ? Wrench : event.kind === "verifier" ? (verifierApproved(event) ? Check : FileCheck2) : Circle;
        return <li key={`${event.spanId}-${index}`} className="relative flex gap-3 py-2.5 text-[11px] leading-5">
          {index < timeline.length - 1 && <span aria-hidden="true" className="absolute bottom-[-10px] left-[11px] top-8 w-px bg-line" />}
          <span className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border border-line bg-surface ${verifierApproved(event) ? "text-primary-ink" : "text-ink-muted"}`}><Icon aria-hidden="true" className="size-3" /></span>
          <span className="min-w-0 flex-1 break-words"><span className="block text-ink">{eventLabel(event)}</span><span className="text-ink-muted">{event.agent}{event.ms !== undefined ? ` · ${event.ms} ms` : ""}</span></span>
        </li>;
      })}
      {isRunning && <li className="flex items-center gap-3 py-2 text-xs text-ink-muted"><LoaderCircle aria-hidden="true" className="ml-1 size-4 motion-safe:animate-spin" /><span>Checking the next step…</span></li>}
      {!timeline.length && !isRunning && <li className="text-xs text-ink-muted">The steps will appear here when a request starts.</li>}
    </ol>
  </details>;
}
