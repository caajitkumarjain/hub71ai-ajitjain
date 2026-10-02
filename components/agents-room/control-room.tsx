"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, Check, ChevronDown, Clock3, Radio, RefreshCw, ShieldCheck, X } from "lucide-react";
import { agentLane, studioIds, type AgentManifestEntry } from "./manifest";
import { agentKey, loadFleetRuns, statsForAgent, type AgentStats, type FleetRun, type RunTrace } from "./telemetry";
import { Topology } from "./topology";
import { agentPortraits } from "./portraits";
import { BawsalaAvatar } from "@/components/navigator/bawsala-avatar";
import styles from "./agents-room.module.css";

function useFleetTelemetry() {
  const [runs, setRuns] = useState<FleetRun[] | null>(null);
  const [state, setState] = useState<"loading" | "available" | "unavailable">("loading");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false;
    let active: AbortController | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    async function update() {
      if (active || disposed) return;
      active = new AbortController();
      timeout = setTimeout(() => active?.abort(), 8000);
      setState("loading");
      try {
        const next = await loadFleetRuns(active.signal);
        if (!disposed) { setRuns(next); setState("available"); }
      } catch {
        if (!disposed) { setRuns(null); setState("unavailable"); }
      } finally {
        clearTimeout(timeout);
        active = null;
      }
    }
    void update();
    const interval = setInterval(() => { if (document.visibilityState === "visible") void update(); }, 30000);
    return () => { disposed = true; clearInterval(interval); clearTimeout(timeout); active?.abort(); };
  }, [revision]);
  return { runs, state, refresh: () => setRevision((value) => value + 1) };
}

function Avatar({ agent }: { agent: AgentManifestEntry }) {
  const portrait = agentPortraits[agent.id];
  return <span className={styles.avatar} data-tone={agentLane(agent.id)} aria-hidden="true">
    {agent.id === "bawsala" && <BawsalaAvatar size={96} />}
    {portrait && <Image src={portrait} alt="" width={112} height={112} placeholder="blur" className={styles.portraitImage} data-agent-portrait={agent.id} />}
    <span className={styles.avatarCode}>{agent.monogram}</span>
  </span>;
}

function AgentCard({ agent, stats, onOpen }: { agent: AgentManifestEntry; stats: AgentStats | null; onOpen: () => void }) {
  const group = studioIds.has(agent.id) ? "Company Studio" : agent.tier === "Deterministic" ? "Assurance" : agent.id === "concierge" ? "Orchestration" : "Specialist";
  return <button type="button" className={styles.agentCard} onClick={onOpen} aria-label={`View ${agent.name} contract`} aria-haspopup="dialog">
    <div className={styles.cardTop}><span className={styles.eyebrow}>{group}</span><ArrowUpRight size={17} aria-hidden="true" /></div>
    <div className={styles.cardIdentity}><Avatar agent={agent} /><div><h3>{agent.name}</h3><span className={styles.tier} data-tier={agent.tier}>{agent.tier}</span></div></div>
    <p className={styles.cardRole}>{agent.role}</p>
    <div className={styles.tools}>{agent.tools.length ? agent.tools.map((tool) => <span key={tool}>{tool}</span>) : <span className={styles.noTools}>{agent.tier === "Deterministic" ? "Deterministic checks" : "Specialist handoffs"}</span>}</div>
    <div className={styles.release}><Check size={13} aria-hidden="true" /><span>Released <span aria-hidden="true">✓</span> 5/5 checks</span><span className={styles.releaseKind}>contract</span></div>
    <dl className={styles.cardStats}>
      <div><dt>Runs</dt><dd>{stats?.runs.toLocaleString("en-US") ?? "—"}</dd></div>
      <div><dt>Avg ms</dt><dd>{stats?.avgMs?.toLocaleString("en-US") ?? "—"}</dd></div>
      <div title="Share of runs with a recorded verifier verdict that passed. Unrecorded verdicts are excluded."><dt>Verified %</dt><dd>{stats?.verifiedPct === null || stats?.verifiedPct === undefined ? "—" : `${stats.verifiedPct}%`}</dd></div>
    </dl>
  </button>;
}

function ContractDrawer({ agent, onClose }: { agent: AgentManifestEntry; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} data-theme="night" className={styles.drawer} aria-labelledby="agent-contract-title" onCancel={(event) => { event.preventDefault(); onClose(); }} onKeyDown={(event) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className={styles.drawerBar}><span className={styles.eyebrow}>Agent contract</span><button autoFocus type="button" onClick={onClose} className={styles.iconButton} aria-label="Close agent contract"><X size={20} /></button></div>
    <div className={styles.drawerBody}>
      <header className={styles.drawerHeading}><Avatar agent={agent} /><div><p className={styles.agentId}>{agent.id}</p><h2 id="agent-contract-title">{agent.name}</h2><span className={styles.tier} data-tier={agent.tier}>{agent.tier}</span></div></header>
      <p className={styles.drawerRole}>{agent.role}</p>
      <section><h3>Mission</h3><p>{agent.mission}</p></section>
      <section><h3>Deliverable</h3><p>{agent.deliverable}</p></section>
      <section className={styles.contractBlock}><h3>Output contract</h3><p className={styles.code}>{agent.outputContract}</p><span>Every result passes through the Verifier before reaching you.</span></section>
      <section><h3>Tools</h3><div className={styles.tools}>{agent.tools.length ? agent.tools.map((tool) => <span key={tool}>{tool}</span>) : <p>{agent.tier === "Deterministic" ? "Pure checks; no model or external-action tools." : "Routes requests through specialist handoffs."}</p>}</div></section>
      <section><h3>Guardrails</h3><ul className={styles.guardrailList}>{agent.guardrails.map((guardrail) => <li key={guardrail}><ShieldCheck size={16} aria-hidden="true" /><span>{guardrail}</span></li>)}</ul></section>
      <section><h3>Human checkpoint</h3><p>{agent.humanCheckpoint}</p></section>
      <section className={styles.killCondition}><h3>Kill condition</h3><p>{agent.killCondition}</p></section>
      <section><h3>Contract budget</h3><dl className={styles.budget}><div><dt>Max calls</dt><dd>{agent.budget.maxCalls}</dd></div><div><dt>Max seconds</dt><dd>{agent.budget.maxSeconds}</dd></div><div><dt>Max USD</dt><dd>${agent.budget.maxUSD.toFixed(2)}</dd></div></dl><p className={styles.smallNote}>Declared ceilings per run, not measured usage.</p></section>
      <section><div className={styles.caseHeader}><h3>Acceptance cases</h3><span className={styles.count}>5 cases</span></div><p className={styles.smallNote}>Expected outcomes in the released contract. Live evaluation results are not reported here.</p><ol className={styles.acceptanceCases}>{agent.acceptanceCases.map((item, index) => <li key={item.name}><span className={styles.caseIndex}>{String(index + 1).padStart(2, "0")}</span><div><p>{item.name}</p><div className={styles.caseBadges}><span className={styles.outcome} data-status={item.expected}>{item.expected}</span>{item.holdout && <span className={styles.holdout}>Holdout</span>}</div></div></li>)}</ol></section>
      <p className={styles.drawerFootnote}>Draft-only. You review and take any action through official channels.</p>
    </div>
  </dialog>;
}

function traceKind(event: RunTrace) {
  if (event.kind === "agent_start" || event.kind === "run_start") return "Agent";
  if (event.kind === "tool_call" || event.kind === "tool_result") return "Tool";
  return event.kind === "handoff" ? "Handoff" : event.kind === "verifier" ? "Verifier" : "Guardrail";
}

function LatestRuns({ runs, state, agents, refresh }: { runs: FleetRun[] | null; state: "loading" | "available" | "unavailable"; agents: AgentManifestEntry[]; refresh: () => void }) {
  const visibleKinds = new Set(["run_start", "agent_start", "handoff", "tool_call", "tool_result", "verifier", "guardrail"]);
  const knownTools = new Set(agents.flatMap((agent) => agent.tools));
  function name(value: string) { return agents.find((agent) => agent.id === agentKey(value))?.name ?? "Agent"; }
  function eventLabel(event: RunTrace) {
    if (event.kind === "verifier") return "Evidence, numbers & promises";
    if (event.kind === "handoff" && event.name) return `${name(event.agent)} → ${name(event.name)}`;
    if (event.kind === "tool_call" || event.kind === "tool_result") return event.name && knownTools.has(event.name) ? event.name : "Tool";
    return name(event.agent);
  }
  return <section className={styles.runsSection} aria-labelledby="latest-runs-title">
    <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / Execution log</p><h2 id="latest-runs-title">Latest runs</h2></div><button type="button" className={styles.refreshButton} onClick={refresh} disabled={state === "loading"}><RefreshCw size={14} aria-hidden="true" className={state === "loading" ? styles.spin : undefined} />Refresh</button></div>
    <p className={styles.sectionNote}>Agent → handoff → tool → verifier. Durations appear when recorded.</p>
    <p role="status" className={styles.telemetryStatus}><span className={styles.statusDot} data-connected={state === "available"} />{state === "loading" ? "Checking run telemetry…" : state === "available" ? "Connected · refreshes every 30 seconds" : "Live telemetry unavailable"}</p>
    {!runs?.length ? <div className={styles.emptyRuns}><Radio size={27} strokeWidth={1.4} aria-hidden="true" /><div><h3>{state === "loading" ? "Checking for recent runs" : runs ? "No runs recorded yet" : "Waiting for run telemetry"}</h3><p>{runs ? "Verified runs will appear here as the fleet is used." : "Run history and live metrics will appear when a public feed is available. Unknown values stay as —."}</p></div><span className={styles.emptyDash}>—</span></div> : <div className={styles.runList}>{runs.slice(0, 20).map((run) => {
      const trace = run.trace.filter((event) => visibleKinds.has(event.kind));
      return <details className={styles.run} key={run.id}>
        <summary>
          <span className={styles.runIcon}><Radio size={17} aria-hidden="true" /></span>
          <span className={styles.runIdentity}><strong>{name(run.agent)}</strong><span className={styles.runId}>{run.id}</span></span>
          <span className={styles.outcome} data-status={run.status}>{run.status ?? "Unknown"}</span>
          <span className={styles.runDuration}><Clock3 size={13} aria-hidden="true" />{run.durationMs === undefined ? "—" : `${run.durationMs.toLocaleString("en-US")} ms`}</span>
          <span className={styles.verdict} data-verified={run.verified}>{run.verified === null ? "Unverified" : run.verified ? "Verified" : "Blocked"}</span>
          <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
        </summary>
        <div className={styles.traceBody}>{trace.length ? <ol className={styles.trace}>{trace.map((event, index) => <li key={`${event.spanId ?? event.kind}-${index}`}>
          <span className={styles.traceDot} /><span className={styles.traceKind}>{traceKind(event)}</span>
          <span className={styles.traceLabel}>{eventLabel(event)}</span>
          <span className={styles.traceDuration}>{event.durationMs === undefined && event.ms === undefined ? "—" : `${(event.durationMs ?? event.ms)?.toLocaleString("en-US")} ms`}</span>
        </li>)}</ol> : <p>Trace details were not included for this run.</p>}</div>
      </details>;
    })}</div>}
  </section>;
}

export function AgentControlRoom({ agents }: { agents: AgentManifestEntry[] }) {
  const [selected, setSelected] = useState<AgentManifestEntry | null>(null);
  const telemetry = useFleetTelemetry();
  const tools = new Set(agents.flatMap((agent) => agent.tools));
  const guardrails = new Set(agents.flatMap((agent) => agent.guardrails));
  return <div className={styles.room} data-theme="night">
    <header className={styles.hero}><div className={styles.heroEyebrow}><span className={styles.eyebrow}>Manzil / Agent control room</span><span className={styles.nightBadge}><span />Night edition</span></div><h1>Manzil Agent Fleet<span>.</span></h1><div className={styles.heroBottom}><p>Specialists with a clear brief.<br className={styles.mobileBreak} /> Guardrails at every handoff.</p><a href="#agent-directory">Explore the fleet <ArrowDown size={15} aria-hidden="true" /></a></div></header>
    <dl className={styles.overview}><div><dt>Agents</dt><dd>{agents.length.toString().padStart(2, "0")}</dd><p>A coordinated fleet</p></div><div><dt>Tools</dt><dd>{tools.size.toString().padStart(2, "0")}</dd><p>Distinct tools in the manifest</p></div><div><dt>Guardrails</dt><dd>{guardrails.size.toString().padStart(2, "0")}</dd><p>Distinct contract requirements</p></div><div className={styles.draftTile}><ShieldCheck size={24} strokeWidth={1.5} aria-hidden="true" /><dt>Draft-only</dt><dd>Nothing is ever<br />submitted for you.</dd><p>You make the final decision.</p></div></dl>
    <section className={styles.routingSection} aria-labelledby="routing-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / Orchestration</p><h2 id="routing-title">How the fleet works</h2></div><span className={styles.outlineBadge}><ShieldCheck size={14} aria-hidden="true" />Every path is verified</span></div><p className={styles.sectionNote}>One concierge routes your request. Specialists prepare the work. The Verifier checks the result.</p><Topology agents={agents} /></section>
    <section id="agent-directory" className={styles.directory} aria-labelledby="directory-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>02 / The directory</p><h2 id="directory-title">Meet your agents</h2></div><span className={styles.count}>{agents.length} contracts</span></div><p className={styles.sectionNote}>Open an agent to inspect its brief, boundaries and acceptance cases.</p><div className={styles.directoryNote}><ShieldCheck size={15} aria-hidden="true" /><p>Release badges confirm five contract checks: standard, missing input, injection, external action and holdout. Runtime evaluation results are separate. Metrics cover the available run history.</p></div><div className={styles.agentGrid}>{agents.map((agent) => <AgentCard key={agent.id} agent={agent} stats={telemetry.runs ? statsForAgent(telemetry.runs, agent.id) : null} onOpen={() => setSelected(agent)} />)}</div></section>
    <LatestRuns {...telemetry} agents={agents} />
    <div className={styles.closingNote}><ShieldCheck size={17} aria-hidden="true" /><p>Illustrated AI personas. Prepared by agents. Checked against evidence. Decided by you.</p><span>Manzil</span></div>
    {selected && <ContractDrawer key={selected.id} agent={selected} onClose={() => setSelected(null)} />}
  </div>;
}
