import { createConcierge } from "./concierge";
import { createPathfinder } from "./pathfinder";
import { createBankOfficer } from "./bank-officer";
import { createDeadlineSentinel } from "./deadline-sentinel";
import { createMissionBuilder } from "./mission-builder";
import { createActivityMatcher } from "./activity-matcher";
import { createBawsala } from "./bawsala";

/** Fresh SDK agents per run prevent hooks and run configuration leaking between sessions. */
export function createAgents(runConfig?: Partial<RunConfig>) {
  const navigator = createBawsala();
  const pathfinder = createPathfinder(navigator);
  const bank = createBankOfficer(runConfig);
  const deadlines = createDeadlineSentinel();
  const mission = createMissionBuilder();
  const activity = createActivityMatcher();
  const concierge = createConcierge([pathfinder, bank, deadlines, mission, navigator]);
  return { concierge, pathfinder, bank, deadlines, mission, activity, navigator };
}
import type { RunConfig } from "@openai/agents";
