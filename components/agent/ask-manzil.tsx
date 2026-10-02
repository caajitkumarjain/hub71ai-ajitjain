"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUp, Check, LoaderCircle, MessageSquare, RotateCcw, Square, UserRound, X } from "lucide-react";
import { Profile } from "@/lib/schemas";
import type { AgentAnswer } from "@/lib/agents/contracts";
import type { TraceEvent } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { Button } from "@/components/ui/button";
import { readProfile } from "@/components/path/profile-storage";
import { AgentTheatre } from "./agent-theatre";
import { ResultCard } from "./result-card";
import { useAgentStream, type AgentMessage } from "./use-agent-stream";
import styles from "./ask-manzil.module.css";

const suggestedQuestions = ["What can I do before I land?", "Do I need VAT?", "Why would a bank reject me?"];
type AskManzilContextValue = { open: () => void; close: () => void; isOpen: boolean };
const AskManzilContext = createContext<AskManzilContextValue | null>(null);

export function useAskManzil(): AskManzilContextValue {
  const context = useContext(AskManzilContext);
  if (!context) throw new Error("useAskManzil must be used inside AskManzilProvider.");
  return context;
}

export function AskManzilProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return <AskManzilContext.Provider value={{ open, close, isOpen }}>{children}<AskManzilPanel isOpen={isOpen} close={close} /></AskManzilContext.Provider>;
}

type Turn = { question: string; result: AgentAnswer; events: TraceEvent[] };

function AskManzilPanel({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const stream = useAgentStream();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Turn[]>([]);
  const lastPath = useRef(pathname);
  const currentProfile = useRef<Profile | null>(null);
  const profileSource = useRef<"stored" | "demo" | null>(null);
  const reset = stream.reset;

  const applyProfile = useCallback((next: Profile | null, source: "stored" | "demo") => {
    if (JSON.stringify(currentProfile.current) !== JSON.stringify(next)) {
      reset(); setHistory([]); setQuestion(""); setDraft("");
    }
    currentProfile.current = next;
    profileSource.current = source;
    setProfile(next); setIsDemo(next?.id === "priya");
  }, [reset]);

  const refreshProfile = useCallback(() => {
    const current = readProfile();
    if (current || profileSource.current === "stored") applyProfile(current, "stored");
  }, [applyProfile]);

  useEffect(() => {
    if (lastPath.current !== pathname) { close(); lastPath.current = pathname; }
  }, [pathname, close]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (isOpen && !element.open) {
      refreshProfile();
      element.showModal();
    } else if (!isOpen && element.open) element.close();
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [isOpen, refreshProfile]);

  useEffect(() => {
    window.addEventListener("storage", refreshProfile);
    window.addEventListener("manzil:profile-changed", refreshProfile);
    return () => { window.removeEventListener("storage", refreshProfile); window.removeEventListener("manzil:profile-changed", refreshProfile); };
  }, [refreshProfile]);

  useEffect(() => {
    if (isOpen) end.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [stream.result, stream.isRunning, question, isOpen]);

  function selectDemo() {
    applyProfile(Profile.parse(personas.priya), "demo");
    input.current?.focus();
  }

  function ask(value: string) {
    const content = value.trim();
    if (!content || !profile || stream.isRunning) return;
    const completed = stream.result && question ? [...history, { question, result: stream.result, events: stream.events }] : history;
    const previous = completed.slice(-8);
    setHistory(previous); setQuestion(content); setDraft("");
    const messages: AgentMessage[] = previous.flatMap((turn) => [{ role: "user" as const, content: turn.question }, { role: "assistant" as const, content: turn.result.answer_md.slice(0, 6000) }]);
    messages.push({ role: "user", content });
    void stream.send({ messages, profile });
  }

  function submit(event: FormEvent) { event.preventDefault(); ask(draft); }
  function resetConversation() { stream.reset(); setHistory([]); setQuestion(""); setDraft(""); input.current?.focus(); }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="ask-manzil-title" aria-describedby="ask-manzil-description" onClose={close} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !event.currentTarget.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  }} onClick={(event) => {
    if (event.target !== dialog.current) return;
    const bounds = dialog.current.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }}>
    <div className="flex h-full min-w-0 flex-col">
      <header className="border-b border-line bg-surface px-5 pb-5 pt-5 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3"><span className="inline-flex size-10 items-center justify-center rounded-xl border border-gold/35 bg-gold/10 text-gold"><MessageSquare aria-hidden="true" className="size-5" /></span><div className="flex items-center gap-1">{(question || history.length > 0) && <Button variant="ghost" size="icon" onClick={resetConversation} aria-label="Start a new conversation"><RotateCcw aria-hidden="true" /></Button>}<Button variant="ghost" size="icon" onClick={close} aria-label="Close Ask Manzil"><X aria-hidden="true" /></Button></div></div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">Your Abu Dhabi concierge</p>
        <h2 id="ask-manzil-title" className="font-display text-[30px] leading-10">Ask Manzil</h2>
        <p id="ask-manzil-description" className="mt-1 text-xs leading-6 text-ink-muted">A clear next step, with the sources behind it.</p>
      </header>

      <div className={`min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5 ${styles.conversation}`}>
        {profile ? <div className="mb-5 flex items-center gap-2 rounded-lg border border-line bg-surface/70 px-3 py-2.5 text-[11px] text-ink-muted"><UserRound aria-hidden="true" className="size-3.5 shrink-0" /><span className="min-w-0 flex-1 break-words">Using {profile.name}&apos;s profile</span>{isDemo ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-ink">Demo</span> : <Check aria-hidden="true" className="size-3 text-teal" />}</div> : <div className="mb-6 rounded-2xl border border-line bg-surface p-5"><h3 className="font-display text-xl leading-7">Let&apos;s make it personal.</h3><p className="mt-2 text-xs leading-6 text-ink-muted">Start with your profile, or explore using Priya&apos;s demo journey.</p><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" onClick={selectDemo}>Try Priya&apos;s demo<ArrowRight aria-hidden="true" /></Button><Button asChild variant="outline" size="sm"><Link href="/start" onClick={close}>Add my profile</Link></Button></div></div>}

        {history.length === 0 && !question && <section className="mb-6" aria-label="Suggested questions"><p className="mb-3 text-xs text-ink-muted">A few good places to start</p><div className="space-y-2">{suggestedQuestions.map((suggestion) => <button key={suggestion} type="button" disabled={!profile || stream.isRunning} onClick={() => ask(suggestion)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left text-xs leading-6 text-ink transition-colors hover:border-gold hover:bg-gold/5 disabled:cursor-not-allowed disabled:opacity-50"><span>{suggestion}</span><ArrowUp aria-hidden="true" className="size-3.5 shrink-0 rotate-45 text-gold" /></button>)}</div></section>}

        <div className="space-y-6">{history.map((turn, index) => <div key={index} className="space-y-3"><div className="ml-7 rounded-2xl rounded-br-sm bg-surface-2 px-4 py-3 text-sm leading-6" dir="auto">{turn.question}</div><ResultCard result={turn.result} events={turn.events} /></div>)}
          {question && <div className="space-y-3"><div className="ml-7 rounded-2xl rounded-br-sm bg-surface-2 px-4 py-3 text-sm leading-6" dir="auto">{question}</div>{stream.result ? <ResultCard result={stream.result} events={stream.events} /> : <div className="overflow-hidden rounded-2xl border border-line bg-surface">{stream.isRunning && <div role="status" className="flex items-center gap-3 p-5 text-xs text-ink-muted"><LoaderCircle aria-hidden="true" className="size-4 shrink-0 text-gold motion-safe:animate-spin" /><span>Finding your next step and checking the evidence…</span></div>}{stream.error && <div role="alert" className="space-y-3 p-5"><p className="text-xs leading-6 text-ink-muted">{stream.error}</p><Button variant="outline" size="sm" onClick={() => ask(question)}>Try again</Button></div>}{!stream.isRunning && !stream.error && <p role="status" className="p-5 text-xs leading-6 text-ink-muted">Stopped. Send another question when you&apos;re ready.</p>}<AgentTheatre events={stream.events} isRunning={stream.isRunning} /></div>}</div>}
        </div><div ref={end} />
      </div>

      <form onSubmit={submit} className={`border-t border-line bg-surface px-4 pt-4 sm:px-5 ${styles.composer}`}>
        <label htmlFor="ask-manzil-question" className="sr-only">Your question for Manzil</label>
        <div className="flex items-end gap-2 rounded-xl border border-line bg-bg p-2 focus-within:border-gold">
          <textarea ref={input} id="ask-manzil-question" dir="auto" rows={2} maxLength={6000} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!profile} placeholder={profile ? "Ask in English, العربية or हिन्दी…" : "Choose a profile to begin…"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(draft); } }} className="min-h-12 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-ink outline-none placeholder:text-ink-muted focus-visible:outline-none disabled:cursor-not-allowed" />
          {stream.isRunning ? <Button type="button" variant="outline" size="icon" onClick={stream.cancel} aria-label="Stop response"><Square aria-hidden="true" /></Button> : <Button type="submit" size="icon" disabled={!profile || !draft.trim()} aria-label="Send question"><ArrowUp aria-hidden="true" /></Button>}
        </div>
        <p className="mt-3 text-center text-[10px] leading-5 text-ink-muted">Manzil prepares. You review and submit through official channels.</p>
      </form>
    </div>
  </dialog>;
}
