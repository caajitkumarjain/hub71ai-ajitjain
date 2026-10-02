import type { z } from "zod";
import { type AgentRequest } from "./contracts";
import { runAgent } from "./run";

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<{ data: T } | { response: Response }> {
  let body: unknown;
  try { body = await request.json(); } catch {
    return { response: Response.json({ error: "Request body must be valid JSON.", code: "INVALID_JSON" }, { status: 400 }) };
  }
  const result = schema.safeParse(body);
  return result.success ? { data: result.data }
    : { response: Response.json({ error: "Please provide a valid request.", code: "INVALID_INPUT" }, { status: 400 }) };
}

export function streamAgent(input: AgentRequest, request: Request): Response {
  const encoder = new TextEncoder();
  const controller = new AbortController();
  const signal = AbortSignal.any([request.signal, controller.signal]);
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(sink) {
      try {
        await runAgent(input, (event) => {
          if (!closed && !signal.aborted) sink.enqueue(encoder.encode(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`));
        }, { signal });
      } catch {
        // Disconnects abort the model request; run failures are already emitted as typed events.
      } finally {
        if (!closed) { closed = true; sink.close(); }
      }
    },
    cancel() { closed = true; controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
