import { z } from "zod";
import { TraceEvent } from "@/lib/schemas";
import { AgentAnswer, AgentRequest, type Language } from "@/lib/agents/contracts";
import { verifyAgentResult } from "@/lib/agents/verifier";
import e1 from "@/data/fixtures/priya/E1.json";
import e2 from "@/data/fixtures/priya/E2.json";
import e8 from "@/data/fixtures/priya/E8.json";
import bankNote from "@/data/fixtures/priya/bank-note.json";

export const RecordedFixture = z.object({
  version: z.literal(1), id: z.string(), recordedAt: z.iso.datetime(),
  source: z.literal("real-openai-run"), baseURL: z.url(),
  request: AgentRequest, answer: AgentAnswer, events: z.array(TraceEvent).min(1),
}).strict();
export const priyaFixtures = [e1, e2, e8, bankNote].map((value) => RecordedFixture.parse(value));
const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);

/** Only a matching, unmodified demo profile and recorded question may use a cached answer. */
export function findPriyaFixture(input: AgentRequest, locale: Language) {
  if (process.env.DEMO_FALLBACK !== "1" || input.profile.id !== "priya" || input.messages.length !== 1) return null;
  const request = AgentRequest.parse(input);
  return priyaFixtures.find((fixture) => {
    const allowedIntent = fixture.id === "E1" ? [undefined, "path", "pathfinder"]
      : fixture.id === "E2" ? [undefined, "deadlines"] : [undefined, "bank"];
    if (!allowedIntent.includes(request.intent) || locale !== fixture.answer.language
      || canonical(request.profile) !== canonical(fixture.request.profile)
      || normalise(request.messages[0].content) !== normalise(fixture.request.messages[0].content)) return false;
    const tools = fixture.events.filter((event) => event.kind === "tool_result").map((event) => event.data);
    return fixture.answer.status === "complete" && tools.length > 0
      && !fixture.events.some((event) => event.kind === "fallback")
      && verifyAgentResult(fixture.answer, tools, request.profile, locale).verdict === "approve";
  }) ?? null;
}
