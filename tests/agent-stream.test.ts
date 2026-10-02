import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { AgentResult, Profile, TraceEvent } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { parseTraceFrame, readTraceEvents, runAgentStream, verifierApproved } from "@/components/agent/agent-stream";
import { SafeMarkdown, safeActionHref, safeHref } from "@/components/agent/safe-markdown";
import { theatreSummary } from "@/components/agent/agent-theatre";
import { EvidenceSourceChips, ResultCard } from "@/components/agent/result-card";
import { recordAgentRun } from "@/components/agent/agent-events";

const result: AgentResult = { status: "complete", answer_md: "Your draft is ready.", evidence: ["C-LIC"], numbers_used: [], next_actions: [], authority_to_verify: null, language: "en" };
function event(kind: TraceEvent["kind"], data?: unknown): TraceEvent {
  return { runId: "run-1", spanId: "span-1", parentId: null, ts: "2026-10-02T08:00:00.000Z", agent: "Concierge", kind, ...(data === undefined ? {} : { data }) };
}
function frame(value: TraceEvent, newline = "\n"): string {
  return `event: ${value.kind}${newline}data: ${JSON.stringify(value)}${newline}${newline}`;
}
function stream(text: string, chunkSize = 16): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize)); controller.close(); } });
}
function fetchStream(text: string) {
  return vi.fn(async () => new Response(stream(text), { headers: { "Content-Type": "text/event-stream; charset=utf-8" } })) as unknown as typeof fetch;
}
const input = { profile: Profile.parse(personas.priya), messages: [{ role: "user" as const, content: "Do I need VAT?" }] };

describe("agent SSE boundary", () => {
  it("handles split UTF-8 characters, CRLF boundaries, heartbeat comments and many frames", async () => {
    const events = [event("run_start"), event("handoff", { from: "Concierge", to: "Deadline Sentinel" }), event("final", { ...result, answer_md: "مرحبا — ready" })];
    const response = stream(": heartbeat\r\n\r\n" + events.map((value) => frame(value, "\r\n")).join(""), 1);
    const received = [];
    for await (const value of readTraceEvents(response)) received.push(value);
    expect(received).toEqual(events);
  });

  it("parses multiline data without treating metadata as content", () => {
    const value = event("run_start");
    const lines = JSON.stringify(value, null, 2).split("\n").map((line) => `data: ${line}`).join("\n");
    expect(parseTraceFrame(`id: ignored\nretry: 1000\nevent: run_start\n${lines}`)).toEqual(value);
    expect(parseTraceFrame(": ping")).toBeNull();
  });

  it("rejects malformed JSON, invalid events and mismatched kinds", () => {
    expect(() => parseTraceFrame("data: {")).toThrow();
    expect(() => parseTraceFrame('data: {"kind":"final"}')).toThrow();
    expect(() => parseTraceFrame(`event: error\ndata: ${JSON.stringify(event("run_start"))}`)).toThrow(/did not match/);
  });

  it("reports a truncated frame on disconnect", async () => {
    const consume = async () => { for await (const value of readTraceEvents(stream('data: {"kind":'))) void value; };
    await expect(consume()).rejects.toThrow(/during a stream event/);
  });

  it("cancels a reader blocked on the network", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const controller = new AbortController();
    const iterator = readTraceEvents(body, controller.signal);
    const next = iterator.next();
    controller.abort();
    await expect(next).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it("closes the reader when the consumer stops after a final answer", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(frame(event("final", result)))); }, cancel });
    for await (const value of readTraceEvents(body)) { expect(value.kind).toBe("final"); break; }
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });
});

describe("agent request lifecycle", () => {
  it("sends validated profile data and reveals only a verified final result", async () => {
    const events = [event("run_start"), event("message_delta", "Private draft"), event("verifier", { approved: true, verdict: "approve", reasons: [], attempt: 1 }), event("final", result)];
    const fetcher = fetchStream(events.map((value) => frame(value)).join(""));
    const onEvent = vi.fn();
    const controller = new AbortController();
    await expect(runAgentStream("/api/agent", input, { signal: controller.signal, onEvent, fetcher })).resolves.toEqual(result);
    expect(onEvent.mock.calls.map(([value]) => value.kind)).toEqual(["run_start", "verifier", "final"]);
    expect(fetcher).toHaveBeenCalledWith("/api/agent", expect.objectContaining({ method: "POST", signal: controller.signal }));
    expect(JSON.parse(String(vi.mocked(fetcher).mock.calls[0]?.[1]?.body))).toEqual(input);
  });

  it("does not label a started or failed verifier as approved", () => {
    expect(verifierApproved(event("verifier"))).toBe(false);
    expect(verifierApproved(event("verifier", { approved: false }))).toBe(false);
    expect(verifierApproved(event("verifier", { approved: "true" }))).toBe(false);
    expect(verifierApproved(event("tool_result", { approved: true }))).toBe(false);
    expect(verifierApproved(event("verifier", { approved: true }))).toBe(true);
  });

  it("refuses a complete answer without an approved verifier event", async () => {
    await expect(runAgentStream("/api/agent", input, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher: fetchStream(frame(event("final", result))) })).rejects.toThrow(/could not be verified/);
  });

  it("uses the most recent verifier verdict", async () => {
    const text = [event("verifier", { approved: true }), event("verifier", { approved: false }), event("final", result)].map((value) => frame(value)).join("");
    await expect(runAgentStream("/api/agent", input, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher: fetchStream(text) })).rejects.toThrow(/could not be verified/);
  });

  it("retains a truthful abstention following an error event", async () => {
    const abstain = { ...result, status: "abstain" as const, answer_md: "I could not verify this answer." };
    const text = frame(event("error", { code: "TIMEOUT" })) + frame(event("final", abstain));
    await expect(runAgentStream("/api/agent", input, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher: fetchStream(text) })).resolves.toEqual(abstain);
  });

  it("reports a connection that ends before the final event", async () => {
    await expect(runAgentStream("/api/agent", input, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher: fetchStream(frame(event("tool_call"))) })).rejects.toThrow(/connection closed/);
  });

  it("validates final result fields", async () => {
    const text = frame(event("verifier", { approved: true })) + frame(event("final", { status: "complete" }));
    await expect(runAgentStream("/api/agent", input, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher: fetchStream(text) })).rejects.toThrow();
  });

  it("rejects invalid input before opening a connection", async () => {
    const fetcher = fetchStream("");
    await expect(runAgentStream("/api/agent", { ...input, messages: [] }, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the dedicated Mission Pack endpoint", async () => {
    const fetcher = fetchStream(frame(event("verifier", { approved: true })) + frame(event("final", result)));
    await runAgentStream("/api/mission-pack", { profile: input.profile, stepId: "C-LIC" }, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher });
    expect(fetcher).toHaveBeenCalledWith("/api/mission-pack", expect.objectContaining({ body: JSON.stringify({ profile: input.profile, stepId: "C-LIC" }) }));
  });

  it("preserves validated activity matching and AI review details", async () => {
    const answer = { ...result, activityMatches: [{ activityId: "software-development", reason: "Subscriptions support a software activity." }], bankReview: [{ title: "Client concentration", question: "Which clients are ready to sign?", evidenceQuote: "clients in UAE and KSA" }] };
    const text = frame(event("verifier", { approved: true })) + frame(event("final", answer));
    await expect(runAgentStream("/api/agent", { ...input, intent: "activity", locale: "hi" }, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher: fetchStream(text) })).resolves.toEqual(answer);
    const html = renderToStaticMarkup(createElement(ResultCard, { result: answer }));
    expect(html).toContain("AI review");
    expect(html).toContain("clients in UAE and KSA");
    expect(html).toContain("This is not a bank decision.");
  });

  it.each([200, 429, 500])("rejects a non-stream or failed response (%i)", async (status) => {
    const fetcher = vi.fn(async () => Response.json({ error: "Unavailable" }, { status })) as unknown as typeof fetch;
    await expect(runAgentStream("/api/agent", input, { signal: new AbortController().signal, onEvent: vi.fn(), fetcher })).rejects.toThrow();
  });
});

describe("safe answer rendering", () => {
  it.each(["javascript:alert(1)", "data:text/html,hello", "//elsewhere.example", "/\\elsewhere.example", "/\n/elsewhere.example", "mailto:a@example.com"])("rejects executable or untrusted action URL %s", (href) => {
    expect(safeHref(href)).toBeNull();
  });

  it("keeps official HTTPS links and internal next actions", () => {
    expect(safeHref("https://tax.gov.ae/")).toBe("https://tax.gov.ae/");
    expect(safeHref("/path?step=C-LIC")).toBe("/path?step=C-LIC");
  });

  it("limits next-action links to recognized user routes", () => {
    expect(safeActionHref("/path?step=C-LIC")).toBe("/path?step=C-LIC");
    for (const href of ["https://tax.gov.ae/", "https://elsewhere.example/", "/admin", "/api/agent", "/path/../admin"]) expect(safeActionHref(href)).toBeNull();
  });

  it("allows sourced markdown links and removes unsourced external destinations", () => {
    const html = renderToStaticMarkup(createElement(SafeMarkdown, { text: "[Tax authority](https://tax.gov.ae/) [Unknown](https://elsewhere.example/)" }));
    expect(html).toContain('href="https://tax.gov.ae/"');
    expect(html).not.toContain('href="https://elsewhere.example/"');
  });

  it("labels deterministic checks and known activities honestly, while resolving jurisdiction sources", () => {
    const html = renderToStaticMarkup(createElement(EvidenceSourceChips, { evidence: ["BK-01", "software-development", "adgm"] }));
    expect(html).toContain("Manzil pre-flight check");
    expect(html).toContain("Activity seed");
    expect(html).not.toContain("UNKNOWN");
    expect(html).toContain('href="https://ancova-associates.com/"');
  });

  it("escapes raw HTML while rendering basic markdown", () => {
    const html = renderToStaticMarkup(createElement(SafeMarkdown, { text: '<script>alert(1)</script>\n\n**Ready** [unsafe](javascript:alert)\n\n- One\n- Two' }));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("<strong");
    expect(html).toContain("<ul");
  });
});

describe("truthful theatre summaries", () => {
  it("counts actual handoffs and tools and only adds Verified after approval", () => {
    const events = [event("run_start"), event("handoff", { from: "Concierge", to: "Deadline Sentinel" }), event("tool_call"), event("tool_result"), event("tool_call")];
    expect(theatreSummary(events, true)).toBe("Concierge → Deadline Sentinel · 2 tools · Working…");
    expect(theatreSummary(events)).not.toContain("Verified");
    expect(theatreSummary([...events, event("verifier", { approved: false })])).not.toContain("Verified");
    expect(theatreSummary([...events, event("verifier", { approved: true })])).toBe("Concierge → Deadline Sentinel · 2 tools · Verified ✓");
  });
});

describe("anonymous agent-run events", () => {
  it("posts only run ID, status and language, never answer or founder data", () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true })) as unknown as typeof fetch;
    recordAgentRun("run-1", { ...result, answer_md: "Private answer", profile: personas.priya } as typeof result, fetcher);
    const [url, request] = vi.mocked(fetcher).mock.calls[0];
    expect(url).toBe("/api/events");
    expect(request).toMatchObject({ method: "POST", keepalive: true });
    expect(JSON.parse(String(request?.body))).toEqual({ type: "agent_run", payload: { runId: "run-1", status: "complete", language: "en" } });
    expect(String(request?.body)).not.toContain("Private answer");
    expect(String(request?.body)).not.toContain("Priya");
  });

  it("does not disrupt the answer if telemetry is unavailable", async () => {
    const fetcher = vi.fn(async () => { throw new Error("Offline"); }) as unknown as typeof fetch;
    expect(() => recordAgentRun("run-1", result, fetcher)).not.toThrow();
    await Promise.resolve();
    const throws = vi.fn(() => { throw new Error("Blocked"); }) as unknown as typeof fetch;
    expect(() => recordAgentRun("run-1", result, throws)).not.toThrow();
  });
});
