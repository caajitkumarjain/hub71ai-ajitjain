import { randomUUID } from "node:crypto";
import { OpenAIProvider, Runner, withTrace, getGlobalTraceProvider, setTracingExportApiKey, ModelTimeoutError, type AgentInputItem, type ModelProvider } from "@openai/agents";
import { TraceEvent } from "@/lib/schemas";
import { createTraceEmitter } from "@/lib/trace";
import { AgentAnswer, AgentRequest, detectLanguage, type Language } from "./contracts";
import type { ManzilRunContext } from "./context";
import { createAgents } from "./registry";
import { checkInput } from "./guardrails";
import { verifyAgentResult } from "./verifier";
import { budgetedProvider, BudgetReachedError, RunBudget } from "./budget";
import { openaiApiKey, runLimits } from "./config";

const systemAnswers = {
  en: {
    unavailable: "I could not finish a verified answer. Please try again, or use the sourced Path and Deadlines pages.",
    budget: "The run budget reached its limit. Please narrow your question and try again.",
    unverified: "I could not verify this answer against the available sources. Please confirm with the relevant authority.",
  },
  ar: {
    unavailable: "تعذر إكمال إجابة موثقة. حاول مرة أخرى أو راجع صفحات المسار والمواعيد مع مصادرها.",
    budget: "وصلت ميزانية التشغيل إلى حدها. يرجى تضييق نطاق السؤال والمحاولة مرة أخرى.",
    unverified: "لم أتمكن من التحقق من الإجابة باستخدام المصادر المتاحة. يرجى التأكد من الجهة المختصة.",
  },
  hi: {
    unavailable: "मैं सत्यापित उत्तर पूरा नहीं कर सका। कृपया फिर कोशिश करें या स्रोतों सहित पाथ और समय सीमा के पृष्ठ देखें।",
    budget: "इस अनुरोध का बजट पूरा हो गया है। कृपया प्रश्न को सीमित करके फिर कोशिश करें।",
    unverified: "मैं उपलब्ध स्रोतों से इस उत्तर की पुष्टि नहीं कर सका। कृपया संबंधित प्राधिकरण से पुष्टि करें।",
  },
};

function abstain(locale: Language, reason: keyof typeof systemAnswers.en, authority: string | null = null): AgentAnswer {
  return { status: "abstain", answer_md: systemAnswers[locale][reason], evidence: [], numbers_used: [],
    next_actions: [], authority_to_verify: authority, language: locale };
}

export interface RunOptions {
  signal?: AbortSignal;
  /** Test injection runs the real SDK against a deterministic model adapter. Never exposed by HTTP. */
  modelProvider?: ModelProvider;
  timeoutMs?: number;
  onError?: (error: unknown) => void;
}

export async function runAgent(input: AgentRequest, onEvent: (event: TraceEvent) => void, options: RunOptions = {}): Promise<AgentAnswer> {
  const request = AgentRequest.parse(input);
  const runId = randomUUID();
  const locale = detectLanguage(request.messages.at(-1)!.content, request.locale ?? request.profile.locale);
  const emit = createTraceEmitter(runId, onEvent);
  const started = Date.now();
  const limits = runLimits();
  const budget = new RunBudget(limits.maxCalls, limits.budgetUSD);
  const context: ManzilRunContext = { profile: request.profile, locale, runId, toolResults: [], emit };
  emit({ agent: "Manzil", kind: "run_start", name: request.intent ?? "ask", data: { language: locale } });

  const finish = (answer: AgentAnswer) => {
    const result = AgentAnswer.parse(answer);
    emit({ agent: "Manzil", kind: "final", data: result, ms: Date.now() - started, costUSD: budget.costUSD });
    return result;
  };
  const blocked = checkInput(request.messages, locale);
  emit({ agent: "Input guardrail", kind: "guardrail", data: { approved: !blocked, status: blocked ? "escalate" : "passed" } });
  if (blocked) return finish(blocked);

  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  context.signal = signal;
  const timer = setTimeout(() => controller.abort(new Error("run timeout")), options.timeoutMs ?? limits.timeoutMs);
  try {
    const apiKey = openaiApiKey();
    if (!options.modelProvider && !apiKey) throw new Error("Model unavailable");
    if (!options.modelProvider && apiKey) setTracingExportApiKey(apiKey);
    const provider = options.modelProvider ?? new OpenAIProvider({
      apiKey, useResponses: true,
    });
    const runConfig = { modelProvider: budgetedProvider(provider, budget), traceIncludeSensitiveData: false,
      tracingDisabled: Boolean(options.modelProvider), workflowName: "manzil-run",
      modelSettings: { retry: { maxRetries: 0 }, timeoutMs: limits.modelTimeoutMs } };
    const agents = createAgents(runConfig);
    const runner = new Runner(runConfig);
    const selected = request.intent === "path" || request.intent === "pathfinder" ? agents.pathfinder
      : request.intent ? agents[request.intent] : agents.concierge;
    let currentAgent = selected;
    const history: AgentInputItem[] = request.messages.map((message) => message.role === "user"
      ? { role: "user", content: message.content }
      : { role: "assistant", status: "completed", content: [{ type: "output_text", text: message.content }] });
    let candidate: unknown;

    const execute = async (): Promise<AgentAnswer> => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        signal.throwIfAborted();
        const stream = await runner.run(currentAgent, history, { context, stream: true,
          maxTurns: Math.max(1, limits.maxCalls - budget.calls), signal });
        // Observe completion immediately so cancellation cannot leave a rejected promise unhandled.
        const completion = stream.completed.catch((error: unknown) => { throw error; });
        void completion.catch(() => undefined);
        let activeName = currentAgent.name;
        for await (const event of stream) {
          if (event.type === "agent_updated_stream_event") {
            activeName = event.agent.name;
            emit({ agent: activeName, kind: "agent_start" });
          } else if (event.type === "run_item_stream_event" && event.name === "handoff_occurred") {
            const item = event.item;
            if ("sourceAgent" in item && "targetAgent" in item) {
              emit({ agent: item.sourceAgent.name, kind: "handoff", name: item.targetAgent.name,
                data: { from: item.sourceAgent.name, to: item.targetAgent.name } });
            }
          }
          // Tool wrappers emit actual call/results. Raw model deltas are never sent before verification.
          // Structured output deltas can contain rejected claims and JSON fragments.
        }
        await completion;
        candidate = stream.finalOutput;
        const verdict = verifyAgentResult(candidate, context.toolResults, context.profile, locale);
        const parsedCandidate = AgentAnswer.safeParse(candidate);
        if (parsedCandidate.success && parsedCandidate.data.status === "complete") {
          if (!context.toolResults.length) verdict.reasons.push("Read the relevant tools before giving a complete answer.");
          if (request.intent === "activity" && parsedCandidate.data.activityMatches?.length !== 3) {
            verdict.reasons.push("A complete activity match must return exactly three distinct seeded activities.");
          }
          if (verdict.reasons.length) verdict.verdict = "revise";
        }
        emit({ agent: "Verifier", kind: "verifier", name: verdict.verdict,
          data: { ...verdict, approved: verdict.verdict === "approve", attempt } });
        if (verdict.verdict === "approve") {
          const answer = AgentAnswer.parse(candidate);
          emit({ agent: activeName, kind: "message_delta", data: { delta: answer.answer_md, verified: true } });
          return finish(answer);
        }
        if (attempt === 1) {
          currentAgent = stream.lastAgent ?? currentAgent;
          history.splice(0, history.length, ...stream.history);
          history.push({ role: "user", content: `Repair your previous structured answer once. Do not change the user's profile. Verifier reasons: ${verdict.reasons.join(" ")}. Call tools if evidence is missing, otherwise abstain. Answer in ${locale}.` });
        }
      }
      const parsed = AgentAnswer.safeParse(candidate);
      return finish(abstain(locale, "unverified", parsed.success ? parsed.data.authority_to_verify ?? "the relevant authority" : "the relevant authority"));
    };
    return options.modelProvider ? await execute() : await withTrace("manzil-run", execute, { groupId: runId });
  } catch (error) {
    options.onError?.(error);
    if (options.signal?.aborted) throw error;
    const reached = error instanceof BudgetReachedError || budget.calls >= limits.maxCalls || budget.costUSD >= limits.budgetUSD;
    emit({ agent: "Manzil", kind: "error", name: reached ? "BUDGET_REACHED" : signal.aborted || error instanceof ModelTimeoutError ? "RUN_TIMEOUT" : "RUN_FAILED",
      data: { message: reached ? "budget reached" : "The live run could not produce a verified answer." } });
    // No fabricated or mismatched fixture is substituted. Recorded fixture support belongs to Phase 4.
    return finish(abstain(locale, reached ? "budget" : "unavailable"));
  } finally {
    clearTimeout(timer);
    if (!options.modelProvider) {
      // Flush ended spans before a serverless request is frozen; never delay the final answer for tracing.
      let flushTimer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        getGlobalTraceProvider().forceFlush().catch(() => undefined),
        new Promise<void>((resolve) => { flushTimer = setTimeout(resolve, 2000); }),
      ]);
      clearTimeout(flushTimer);
    }
  }
}
