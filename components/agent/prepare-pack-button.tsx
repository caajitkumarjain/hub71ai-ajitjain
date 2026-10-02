"use client";

import { FilePenLine, LoaderCircle, Square } from "lucide-react";
import type { Profile } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AgentTheatre } from "./agent-theatre";
import { ResultCard } from "./result-card";
import { useAgentStream } from "./use-agent-stream";

export function PreparePackButton({ profile, stepId, className }: { profile: Profile; stepId: string; className?: string }) {
  const stream = useAgentStream();
  return <div className={cn("space-y-4", className)}>
    <div className="flex flex-wrap gap-2"><Button disabled={stream.isRunning} onClick={() => void stream.prepare({ profile, stepId, locale: profile.locale })}>{stream.isRunning ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <FilePenLine aria-hidden="true" />}<span>{stream.isRunning ? "Preparing your draft…" : "Prepare it for me"}</span></Button>{stream.isRunning && <Button variant="ghost" size="icon" onClick={stream.cancel} aria-label="Stop preparing the draft"><Square aria-hidden="true" /></Button>}</div>
    <p className="text-xs leading-5 text-ink-muted">Draft only. Review it, then submit through official channels.</p>
    {stream.error && <p role="alert" className="rounded-lg border border-coral/30 bg-coral/5 p-3 text-xs leading-6 text-ink">{stream.error}</p>}
    {stream.result ? <ResultCard profile={profile} result={stream.result} events={stream.events} /> : (stream.isRunning || stream.events.length > 0) && <div className="overflow-hidden rounded-xl border border-line bg-surface"><AgentTheatre events={stream.events} isRunning={stream.isRunning} /></div>}
  </div>;
}
