"use client";

import { useEffect, useRef, useState } from "react";
import { AgentResult, Profile, TraceEvent } from "@/lib/schemas";

// SSE framing is independent of network chunks, including CRLF and split UTF-8 characters.
export async function* missionEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trimStart()).join("\n");
        if (data && data !== "[DONE]") yield JSON.parse(data) as unknown;
      }
      if (done) break;
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export function useMissionPack() {
  const [result, setResult] = useState<AgentResult | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [cached, setCached] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function prepare(profile: Profile, stepId: string) {
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setResult(null); setCached(false); setBusy(true); setStatus("Preparing your draft…");
    try {
      const response = await fetch("/api/mission-pack", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: Profile.parse(profile), stepId }),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(60000)]),
      });
      if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Unavailable");
      let approved = false;
      for await (const raw of missionEvents(response.body)) {
        const event = TraceEvent.parse(raw);
        if (event.kind === "error") throw new Error("Draft failed");
        if (event.kind === "fallback") setCached(true);
        if (event.kind === "tool_call") setStatus("Checking the requirements…");
        if (event.kind === "verifier") {
          approved = typeof event.data === "object" && event.data !== null && "approved" in event.data && event.data.approved === true;
          setStatus("Verifying the draft…");
        }
        if (event.kind === "final") {
          // Render only the route's verified final result, never unverified message deltas.
          const final = AgentResult.parse(event.data);
          if (final.status === "complete" && !approved) throw new Error("Draft was not verified");
          setResult(final); setStatus(""); return;
        }
      }
      throw new Error("No final result");
    } catch {
      if (!request.signal.aborted) setStatus("Draft preparation is unavailable. Use the checklist and official link, or try again.");
    } finally { if (controller.current === request) setBusy(false); }
  }
  return { result, status, busy, cached, prepare };
}
