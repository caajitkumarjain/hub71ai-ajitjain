import { describe, expect, it } from "vitest";
import { AgentRateLimit } from "@/lib/agents/rate-limit";

describe("agent token bucket", () => {
  it("admits twenty requests, then refills without resetting the whole bucket", () => {
    const limit = new AgentRateLimit();
    for (let index = 0; index < 20; index++) expect(limit.allow("founder", 0)).toBe(true);
    expect(limit.allow("founder", 0)).toBe(false);
    expect(limit.allow("founder", 2999)).toBe(false);
    expect(limit.allow("founder", 3000)).toBe(true);
    expect(limit.allow("founder", 3000)).toBe(false);
    expect(limit.allow("another-founder", 3000)).toBe(true);
  });
  it("bounds retained keys and clamps refill to capacity", () => {
    const limit = new AgentRateLimit(1, 100, 2);
    expect(limit.allow("old", 0)).toBe(true);
    expect(limit.allow("middle", 0)).toBe(true);
    expect(limit.allow("new", 0)).toBe(true);
    expect(limit.allow("old", 0)).toBe(true);
    expect(limit.allow("old", 10_000)).toBe(true);
    expect(limit.allow("old", 10_000)).toBe(false);
  });
});
