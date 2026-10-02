"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Check, LoaderCircle } from "lucide-react";
import type { Profile } from "@/lib/schemas";
import { Button } from "@/components/ui/button";

export async function saveDurationReport(stepId: string, days: number, profile: Profile): Promise<void> {
  if (!Number.isSafeInteger(days) || days < 1 || days > 3650) throw new Error("Enter a whole number of days from 1 to 3,650.");
  const response = await fetch("/api/events", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "duration_report", stepId, payload: {
      days, hasSpouse: profile.spouse, childrenCount: profile.childrenAges.length, jurisdiction: profile.jurisdiction ?? null,
    } }),
  });
  if (!response.ok) throw new Error("Your report couldn’t be saved. Please try again.");
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) throw new Error("Your report couldn’t be saved. Please try again.");
}

export function DurationReport({ stepId, profile }: { stepId: string; profile: Profile }) {
  const inputId = useId();
  const pending = useRef(false);
  const [days, setDays] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || state === "saved") return;
    pending.current = true; setState("saving"); setError("");
    try { await saveDurationReport(stepId, Number(days), profile); setState("saved"); }
    catch (cause) { setState("error"); setError(cause instanceof Error ? cause.message : "Your report couldn’t be saved. Please try again."); }
    finally { pending.current = false; }
  }
  return <form onSubmit={submit} className="rounded-xl border border-line bg-primary-soft/40 p-4" aria-labelledby={`${inputId}-heading`}>
    <h3 id={`${inputId}-heading`} className="font-medium">Did this take longer?</h3>
    <label htmlFor={inputId} className="mt-1 block text-sm text-ink-muted">Tell us how many days</label>
    <div className="mt-3 flex flex-wrap gap-2">
      <input id={inputId} type="number" inputMode="numeric" min={1} max={3650} step={1} required value={days}
        onChange={(event) => { setDays(event.target.value); if (state === "error") setState("idle"); }}
        disabled={state === "saving" || state === "saved"} aria-describedby={`${inputId}-note`} aria-invalid={state === "error"}
        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60" />
      <Button type="submit" variant="outline" disabled={!days || state === "saving" || state === "saved"}>
        {state === "saving" ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : state === "saved" ? <Check aria-hidden="true" /> : null}
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save duration"}
      </Button>
    </div>
    <p id={`${inputId}-note`} className="mt-2 text-xs leading-5 text-ink-muted">Report the total days this step took. Your anonymous report helps show where founders get stuck.</p>
    {state === "saved" && <p role="status" className="mt-2 text-sm text-primary-ink">Thanks. Your duration report is saved.</p>}
    {state === "error" && <p role="alert" className="mt-2 text-sm text-coral">{error}</p>}
  </form>;
}
