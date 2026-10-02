import { mkdir, readFile, writeFile } from "node:fs/promises";

const baseURL = process.argv[2] ?? "https://manzil-flame-delta.vercel.app";
const profile = JSON.parse(await readFile("data/personas.json", "utf8")).priya;
const cases = [
  { id: "E1", question: "What should I do first, and what can I do before I land?", evidence: "F-ATTEST" },
  { id: "E2", question: "Do I need to register for VAT?", evidence: "VAT-REG" },
  { id: "E8", question: "Why would a bank reject my account?", evidence: "BK-01" },
  { id: "bank-note", question: "Write a bank officer note about my bank readiness and the business-description questions a bank will ask.", intent: "bank", evidence: "BK-01" },
];
await mkdir("data/fixtures/priya", { recursive: true });
const selected = process.argv[3] ? cases.filter((item) => process.argv[3].split(",").includes(item.id)) : cases;
const results = await Promise.allSettled(selected.map(async (item) => {
  const request = { profile, messages: [{ role: "user", content: item.question }], ...(item.intent ? { intent: item.intent } : {}) };
  const response = await fetch(`${baseURL}/api/agent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal: AbortSignal.timeout(65_000) });
  if (!response.ok) throw new Error(`${item.id}: HTTP ${response.status}`);
  const stream = await response.text();
  const events = stream.split(/\r?\n\r?\n/).filter((frame) => frame.includes("data:")).map((frame) => JSON.parse(frame.split(/\r?\n/).find((line) => line.startsWith("data:")).slice(5)));
  const answer = events.findLast((event) => event.kind === "final")?.data;
  if (answer?.status !== "complete" || !answer.evidence.includes(item.evidence) || events.some((event) => event.kind === "fallback") || !events.some((event) => event.kind === "tool_result") || events.findLast((event) => event.kind === "verifier")?.data?.approved !== true) throw new Error(`${item.id}: live response did not meet recording acceptance (${answer?.status ?? "missing"})`);
  const fixture = { version: 1, id: item.id, recordedAt: new Date().toISOString(), source: "real-openai-run", baseURL, request, answer, events };
  await writeFile(`data/fixtures/priya/${item.id}.json`, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ id: item.id, recorded: true, runId: events[0]?.runId, evidence: answer.evidence, bankReview: answer.bankReview?.length ?? 0 }));
}));
for (const result of results) if (result.status === "rejected") { console.error(result.reason.message); process.exitCode = 1; }
