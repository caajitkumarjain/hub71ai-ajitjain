import { createConcierge } from "./concierge";
import { createPathfinder } from "./pathfinder";
import { createBankOfficer } from "./bank-officer";
import { createDeadlineSentinel } from "./deadline-sentinel";
import { createMissionBuilder } from "./mission-builder";
import { createActivityMatcher } from "./activity-matcher";

/** Fresh SDK agents per run prevent hooks and run configuration leaking between sessions. */
export function createAgents(runConfig?: Partial<RunConfig>) {
  const pathfinder = createPathfinder();
  const bank = createBankOfficer(runConfig);
  const deadlines = createDeadlineSentinel();
  const mission = createMissionBuilder();
  const activity = createActivityMatcher();
  const concierge = createConcierge([pathfinder, bank, deadlines, mission]);
  return { concierge, pathfinder, bank, deadlines, mission, activity };
}
import type { RunConfig } from "@openai/agents";
