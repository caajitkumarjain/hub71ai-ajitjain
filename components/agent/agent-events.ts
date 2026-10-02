import type { AgentAnswer } from "@/lib/agents/contracts";

/** Best-effort anonymous telemetry never contains the question, answer or profile. */
export function recordAgentRun(runId: string, answer: Pick<AgentAnswer, "status" | "language">, fetcher: typeof fetch = fetch): void {
  try {
    void fetcher("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ type: "agent_run", payload: { runId, status: answer.status, language: answer.language } }),
    }).catch(() => undefined);
  } catch { /* Analytics must never prevent a result from rendering. */ }
}
