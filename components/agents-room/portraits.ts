import type { StaticImageData } from "next/image";
import portrait0 from "./portraits/concierge.png";
import portrait1 from "./portraits/pathfinder.png";
import portrait2 from "./portraits/bank-officer.png";
import portrait3 from "./portraits/deadline-sentinel.png";
import portrait4 from "./portraits/mission-builder.png";
import portrait5 from "./portraits/activity-matcher.png";
import portrait6 from "./portraits/name-agent.png";
import portrait7 from "./portraits/bank-pack-agent.png";
import portrait8 from "./portraits/governance-agent.png";
import portrait9 from "./portraits/tax-prep-agent.png";
import portrait10 from "./portraits/input-guardrail.png";
import portrait11 from "./portraits/verifier.png";

export const agentPortraits: Record<string, StaticImageData> = {
  "concierge": portrait0,
  "pathfinder": portrait1,
  "bank-officer": portrait2,
  "deadline-sentinel": portrait3,
  "mission-builder": portrait4,
  "activity-matcher": portrait5,
  "name-agent": portrait6,
  "bank-pack-agent": portrait7,
  "governance-agent": portrait8,
  "tax-prep-agent": portrait9,
  "input-guardrail": portrait10,
  "verifier": portrait11,
};
