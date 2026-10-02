import { describe, expect, it } from "vitest";
import { createAgents, registeredAgentIds } from "@/lib/agents/registry";
import manifest from "@/data/agents.json";

describe("agent registry directory coverage", () => {
  it("includes every registered agent ID in data/agents.json with the matching SDK name", () => {
    const agents = createAgents();
    expect(Object.keys(registeredAgentIds).sort()).toEqual(Object.keys(agents).sort());
    expect(new Set(Object.values(registeredAgentIds)).size).toBe(Object.keys(agents).length);
    for (const key of Object.keys(agents) as (keyof typeof agents)[]) {
      expect(manifest.find((entry) => entry.id === registeredAgentIds[key]), `Missing directory entry for ${key}`)
        .toMatchObject({ id: registeredAgentIds[key], name: agents[key].name });
    }
  });
});
