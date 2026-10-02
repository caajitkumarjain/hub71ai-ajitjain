import { TraceEvent } from "@/lib/schemas";
import { AgentAnswer, AgentRequest, Message, MissionRequest } from "@/lib/agents/contracts";

export const AgentMessage = Message;
export type AgentMessage = SendAgentInput["messages"][number];
export const SendAgentInput = AgentRequest;
export type SendAgentInput = AgentRequest;
export const PrepareAgentInput = MissionRequest;
export type PrepareAgentInput = typeof MissionRequest._output;

export function verifierApproved(event: TraceEvent): boolean {
  return event.kind === "verifier" && typeof event.data === "object" && event.data !== null
    && "approved" in event.data && event.data.approved === true;
}

/** SSE frames, rather than network chunks, are the unit validated at the boundary. */
export function parseTraceFrame(frame: string): TraceEvent | null {
  let kind = "";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("event:")) kind = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!data.length) return null;
  const event = TraceEvent.parse(JSON.parse(data.join("\n")));
  if (kind && kind !== event.kind) throw new Error("The stream event type did not match its payload.");
  return event;
}

export async function* readTraceEvents(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<TraceEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const cancelReader = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", cancelReader, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("The request was stopped.", "AbortError");
      const { value, done } = await reader.read();
      if (signal?.aborted) throw new DOMException("The request was stopped.", "AbortError");
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const event = parseTraceFrame(frame);
        if (event) yield event;
      }
      if (done) {
        if (buffer.trim()) throw new Error("The response ended during a stream event.");
        break;
      }
    }
  } finally {
    signal?.removeEventListener("abort", cancelReader);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function runAgentStream(
  endpoint: "/api/agent" | "/api/mission-pack",
  input: SendAgentInput | PrepareAgentInput,
  options: { signal: AbortSignal; onEvent: (event: TraceEvent) => void; fetcher?: typeof fetch },
): Promise<AgentAnswer> {
  const payload = endpoint === "/api/agent" ? SendAgentInput.parse(input) : PrepareAgentInput.parse(input);
  const response = await (options.fetcher ?? fetch)(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(payload), signal: options.signal,
  });
  if (!response.ok) {
    throw new Error(response.status === 429 ? "Manzil is busy. Please wait a moment and try again." : "Manzil could not start this request. Please try again.");
  }
  if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("Manzil did not return a live response. Please try again.");
  }
  let approved = false;
  for await (const event of readTraceEvents(response.body, options.signal)) {
    if (event.kind === "verifier") approved = verifierApproved(event);
    // Only the final, schema-validated answer is rendered. Draft deltas stay private.
    if (event.kind === "message_delta") continue;
    options.onEvent(event);
    if (event.kind === "final") {
      const result = AgentAnswer.parse(event.data);
      if (result.status === "complete" && !approved) throw new Error("The answer could not be verified. Please try again.");
      return result;
    }
  }
  throw new Error("The connection closed before the answer was ready. Please try again.");
}
