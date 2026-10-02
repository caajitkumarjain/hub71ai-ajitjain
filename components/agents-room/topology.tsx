import type { CSSProperties } from "react";
import { agentLane, type AgentManifestEntry } from "./manifest";
import styles from "./agents-room.module.css";

function Flow({ path, delay = 0, tone = "sky" }: { path: string; delay?: number; tone?: string }) {
  return <g className={styles.flow} data-tone={tone}>
    <path d={path} className={styles.edge} />
    <circle r="3" className={styles.flowDot} style={{ offsetPath: `path('${path}')`, animationDelay: `${delay}s` } as CSSProperties} />
  </g>;
}

function Node({ x, y, width = 180, height = 44, label, monogram, tone = "sky" }: {
  x: number; y: number; width?: number; height?: number; label: string; monogram?: string; tone?: string;
}) {
  return <g transform={`translate(${x} ${y})`} className={styles.mapNode} data-tone={tone}>
    <rect width={width} height={height} rx="7" />
    {monogram && <><rect x="9" y={(height - 24) / 2} width="26" height="24" rx="5" className={styles.nodeAvatar} /><text x="22" y={height / 2 + 3} textAnchor="middle" className={styles.nodeMonogram}>{monogram}</text></>}
    <text x={monogram ? 45 : width / 2} y={height / 2 + 4} textAnchor={monogram ? "start" : "middle"} className={styles.nodeLabel}>{label}</text>
  </g>;
}

export function Topology({ agents }: { agents: AgentManifestEntry[] }) {
  const specialistIds = ["pathfinder", "bank-officer", "deadline-sentinel", "mission-builder", "activity-matcher"];
  const studioIds = ["name-agent", "bank-pack-agent", "governance-agent", "tax-prep-agent"];
  const specialistAgents = specialistIds.map((id) => agents.find((agent) => agent.id === id)!);
  const studioAgents = studioIds.map((id) => agents.find((agent) => agent.id === id)!);
  const verifier = agents.find((agent) => agent.id === "verifier")!;
  return <div className={styles.topology}>
    <svg className={styles.desktopMap} viewBox="0 0 1090 572" role="img" aria-labelledby="fleet-map-title fleet-map-description">
      <title id="fleet-map-title">Manzil agent routing</title>
      <desc id="fleet-map-description">You pass through Input Guardrail to Concierge, which hands off to five specialists or four Company Studio agents in parallel. Every result passes through Verifier before returning to you. Moving dots illustrate routing, not live activity.</desc>
      <text x="18" y="30" className={styles.mapCaption}>REQUEST</text>
      <text x="510" y="30" className={styles.mapCaption}>SPECIALIST HANDOFFS</text>
      <text x="820" y="30" className={styles.mapCaption}>VERIFIED RESPONSE</text>
      <Flow path="M 78 251 L 112 251" tone="teal" />
      <Flow path="M 248 251 L 286 251" delay={-0.8} tone="teal" />
      {specialistAgents.map((agent, index) => {
        const y = 50 + index * 56;
        return <g key={agent.id}>
          <Flow path={`M 424 251 H 465 V ${y + 22} H 510`} delay={-index * 0.65} tone={agentLane(agent.id)} />
          <Flow path={`M 700 ${y + 22} H 775 V 251 H 820`} delay={-index * 0.8 - 1} tone="teal" />
          <Node x={510} y={y} width={190} label={agent.name} monogram={agent.monogram} tone={agentLane(agent.id)} />
        </g>;
      })}
      <rect x="490" y="346" width="230" height="210" rx="10" className={styles.studioBoundary} />
      <text x="505" y="369" className={styles.studioLabel}>Company Studio</text>
      <text x="505" y="386" className={styles.mapNote}>Runs in parallel</text>
      {studioAgents.map((agent, index) => {
        const y = 396 + index * 38;
        return <g key={agent.id}>
          <Flow path={`M 424 251 H 465 V ${y + 16} H 510`} delay={-index * 0.7} tone="gold" />
          <Flow path={`M 700 ${y + 16} H 775 V 251 H 820`} delay={-index * 0.7 - 1} tone="teal" />
          <Node x={510} y={y} width={190} height={32} label={agent.name} monogram={agent.monogram} tone="gold" />
        </g>;
      })}
      <Flow path="M 958 251 L 992 251" tone="teal" delay={-1.5} />
      <Node x={12} y={229} width={66} label="You" tone="muted" />
      <Node x={112} y={229} width={136} label="Input Guardrail" tone="teal" />
      <Node x={286} y={229} width={138} label="Concierge" monogram="CO" tone="gold" />
      <Node x={820} y={229} width={138} label={verifier.name} monogram={verifier.monogram} tone="teal" />
      <Node x={992} y={229} width={78} label="You" tone="muted" />
      <text x="180" y="298" textAnchor="middle" className={styles.mapNote}>Screen the request</text>
      <text x="355" y="298" textAnchor="middle" className={styles.mapNote}>Route by intent</text>
      <text x="889" y="298" textAnchor="middle" className={styles.mapNote}>Evidence · numbers · promises</text>
      <text x="18" y="531" className={styles.mapNote}>One request. Bounded handoffs.</text>
      <text x="18" y="550" className={styles.mapNote}>You keep the final decision.</text>
    </svg>
    <svg className={styles.mobileMap} viewBox="0 0 340 968" role="img" aria-labelledby="mobile-map-title mobile-map-description">
      <title id="mobile-map-title">Manzil agent routing</title>
      <desc id="mobile-map-description">You to Input Guardrail to Concierge, then five specialists or four Company Studio agents in parallel, then Verifier and back to you.</desc>
      <Flow path="M 170 54 V 80" tone="teal" />
      <Flow path="M 170 124 V 150" tone="teal" delay={-1} />
      <Node x={117} y={10} width={106} label="You" tone="muted" />
      <Node x={70} y={80} width={200} label="Input Guardrail" monogram="IG" tone="teal" />
      <Node x={70} y={150} width={200} label="Concierge" monogram="CO" tone="gold" />
      <text x="70" y="232" className={styles.mapCaption}>SPECIALIST HANDOFFS</text>
      {specialistAgents.map((agent, index) => {
        const y = 250 + index * 52;
        return <g key={agent.id}>
          <Flow path={`M 170 194 V 210 H 35 V ${y + 22} H 70`} delay={-index * .7} tone={agentLane(agent.id)} />
          <Flow path={`M 270 ${y + 22} H 306 V 847 H 270`} delay={-index * .7 - 1} tone="teal" />
          <Node x={70} y={y} width={200} label={agent.name} monogram={agent.monogram} tone={agentLane(agent.id)} />
        </g>;
      })}
      <rect x="56" y="528" width="228" height="268" rx="9" className={styles.studioBoundary} />
      <text x="70" y="553" className={styles.studioLabel}>Company Studio</text>
      <text x="70" y="573" className={styles.mapNote}>Runs in parallel</text>
      {studioAgents.map((agent, index) => {
        const y = 588 + index * 50;
        return <g key={agent.id}>
          <Flow path={`M 170 194 V 210 H 35 V ${y + 22} H 70`} delay={-index * .7} tone="gold" />
          <Flow path={`M 270 ${y + 22} H 306 V 847 H 270`} delay={-index * .7 - 1} tone="teal" />
          <Node x={70} y={y} width={200} label={agent.name} monogram={agent.monogram} tone="gold" />
        </g>;
      })}
      <Node x={70} y={825} width={200} label={verifier.name} monogram={verifier.monogram} tone="teal" />
      <Flow path="M 170 869 V 902" tone="teal" delay={-1.5} />
      <Node x={117} y={902} width={106} label="You" tone="muted" />
    </svg>
    <div className={styles.mapLegend}><span><i data-tone="gold" /> Routing & studio</span><span><i data-tone="sky" /> Specialists</span><span><i data-tone="teal" /> Deterministic checks</span><p>Flow illustration · not live activity</p></div>
  </div>;
}
