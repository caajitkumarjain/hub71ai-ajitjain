"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TraceEvent } from "@/lib/schemas";
import type { AgentAnswer } from "@/lib/agents/contracts";
import { runAgentStream, type PrepareAgentInput, type SendAgentInput } from "./agent-stream";
import { recordAgentRun } from "./agent-events";

export type { AgentMessage, PrepareAgentInput, SendAgentInput } from "./agent-stream";

export function useAgentStream() {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [result, setResult] = useState<AgentAnswer | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => current.current?.abort(), []);

  const cancel = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    cancel(); setEvents([]); setResult(null); setError(null);
  }, [cancel]);

  const run = useCallback(async (endpoint: "/api/agent" | "/api/mission-pack", input: SendAgentInput | PrepareAgentInput) => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    setEvents([]); setResult(null); setError(null); setIsRunning(true);
    let runId: string | undefined;
    try {
      const answer = await runAgentStream(endpoint, input, {
        signal: controller.signal,
        onEvent: (event) => {
          runId = event.runId;
          if (current.current === controller && !controller.signal.aborted) setEvents((previous) => [...previous, event]);
        },
      });
      if (current.current === controller && !controller.signal.aborted) {
        setResult(answer);
        if (runId) recordAgentRun(runId, answer);
      }
      return answer;
    } catch (cause) {
      if (current.current === controller && !controller.signal.aborted) {
        setError(cause instanceof Error && cause.name === "Error" ? cause.message : "Manzil could not read this response. Please try again.");
      }
      return null;
    } finally {
      if (current.current === controller) { current.current = null; setIsRunning(false); }
    }
  }, []);

  const send = useCallback((input: SendAgentInput) => run("/api/agent", input), [run]);
  const prepare = useCallback((input: PrepareAgentInput) => run("/api/mission-pack", input), [run]);
  return { send, prepare, events, result, isRunning, error, cancel, reset };
}
