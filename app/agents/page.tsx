import type { Metadata } from "next";
import rawAgents from "@/data/agents.json";
import { AgentControlRoom } from "@/components/agents-room/control-room";
import { agentManifestSchema } from "@/components/agents-room/manifest";

export const metadata: Metadata = {
  title: "Agent Fleet",
  description: "Meet the Manzil agent fleet. Explore each agent’s tools, guardrails, acceptance contract and verified run traces.",
};

export default function AgentsPage() {
  return <AgentControlRoom agents={agentManifestSchema.parse(rawAgents)} />;
}
