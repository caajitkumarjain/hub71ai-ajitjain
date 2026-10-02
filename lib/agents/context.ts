import type { Profile, TraceEvent } from "@/lib/schemas";
import type { Language } from "./contracts";

export type TraceInput = Pick<TraceEvent, "agent" | "kind"> & Partial<Pick<TraceEvent, "name" | "data" | "ms" | "costUSD">>;
export interface ManzilRunContext {
  profile: Profile;
  locale: Language;
  runId: string;
  toolResults: unknown[];
  signal?: AbortSignal;
  emit: (event: TraceInput) => void;
}
