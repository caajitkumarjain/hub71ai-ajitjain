/** Process-local token bucket, matching the demo's in-memory deployment mode. */
export class AgentRateLimit {
  private buckets = new Map<string, { tokens: number; updated: number }>();
  constructor(private capacity = 20, private windowMs = 60_000, private maxKeys = 1000) {}
  allow(key: string, now = Date.now()): boolean {
    const previous = this.buckets.get(key);
    const tokens = previous ? Math.min(this.capacity, previous.tokens + Math.max(0, now - previous.updated) * this.capacity / this.windowMs) : this.capacity;
    this.buckets.delete(key);
    this.buckets.set(key, { tokens: tokens >= 1 ? tokens - 1 : tokens, updated: now });
    while (this.buckets.size > this.maxKeys) this.buckets.delete(this.buckets.keys().next().value!);
    return tokens >= 1;
  }
}
const buckets = new AgentRateLimit();
export function checkRateLimit(request: Request): Response | null {
  const key = (request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local").slice(0, 128);
  return buckets.allow(key) ? null : Response.json({ error: "Please wait a moment before asking again.", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "3" } });
}
