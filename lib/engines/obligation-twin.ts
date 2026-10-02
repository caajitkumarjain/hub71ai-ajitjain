import { Obligation, Profile, Rule, WhatIfResult } from "@/lib/schemas";
import { deriveFacts, evaluate } from "./conditions";
import { compilePath } from "./path-compiler";
import { activities, rules as seedRules, steps } from "./seed-data";

type Occurrence = { key: string; obligation: Obligation };
type BaseDate = { date: Date; reason: string };

const dayMilliseconds = 24 * 60 * 60 * 1_000;
const numberDisplay = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
// The seed already contains the sourced USD/AED conversion (§10); do not add a rate feed.
const usdPenalty = seedRules.find((rule) => rule.currency === "USD" && rule.penaltyNative && rule.penaltyAED !== null);
const usdPeg = usdPenalty?.penaltyNative && usdPenalty.penaltyAED !== null
  ? usdPenalty.penaltyAED / usdPenalty.penaltyNative
  : undefined;

function utcDay(date: Date): Date {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid obligation calculation date");
  const day = new Date(date.getTime());
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

function dateFromISO(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Calendar offsets clamp the day at month end; day offsets then use UTC. */
function offsetDate(base: Date, months = 0, days = 0): Date {
  const first = new Date(base.getTime());
  first.setUTCDate(1);
  first.setUTCMonth(first.getUTCMonth() + months);
  const last = new Date(first.getTime());
  last.setUTCMonth(last.getUTCMonth() + 1);
  last.setUTCDate(0);
  first.setUTCDate(Math.min(base.getUTCDate(), last.getUTCDate()) + days);
  return first;
}

function penalty(rule: Rule): Pick<Obligation, "penaltyAED" | "penaltyDisplay"> {
  const penaltyAED = rule.penaltyAED ?? (
    rule.currency === "USD" && rule.penaltyNative !== undefined && usdPeg !== undefined
      ? rule.penaltyNative * usdPeg
      : null
  );
  if (penaltyAED === null) {
    return { penaltyAED, penaltyDisplay: `UNKNOWN · verify with ${rule.authority}` };
  }

  const isUSD = rule.currency === "USD" && rule.penaltyNative !== undefined;
  const native = isUSD ? rule.penaltyNative! : penaltyAED;
  const currency = isUSD ? "USD" : "AED";
  const amount = isUSD
    ? `USD ${numberDisplay.format(native)} (≈ AED ${numberDisplay.format(penaltyAED)})`
    : `AED ${numberDisplay.format(penaltyAED)}`;
  let penaltyDisplay = amount;
  if (rule.penaltyNote) {
    const statedAmount = rule.penaltyNote.match(/\b(AED|USD)\s+(\d[\d,]*(?:\.\d+)?)/);
    // Preserve qualifications such as "up to", "per month" and the sourced cap.
    penaltyDisplay = statedAmount && statedAmount[1] === currency && Number(statedAmount[2].replaceAll(",", "")) === native
      ? rule.penaltyNote.replace(statedAmount[0], amount)
      : `${amount} · ${rule.penaltyNote}`;
  }
  return { penaltyAED, penaltyDisplay };
}

function occurrences(profile: Profile, rules: readonly Rule[], today: Date): Occurrence[] {
  const day = utcDay(today);
  const horizon = offsetDate(day, 12);
  const facts = deriveFacts(profile, activities);
  let incorporation: BaseDate | undefined;
  let incorporationComputed = false;

  function baseFor(field: string | undefined): BaseDate | undefined {
    if (field === "arrivalDate") {
      return { date: dateFromISO(profile.arrivalDate), reason: `arrival date ${profile.arrivalDate}` };
    }
    if (field !== undefined && field !== "incorporationDate") return undefined;
    if (!incorporationComputed) {
      incorporationComputed = true;
      if (profile.incorporationDate) {
        incorporation = { date: dateFromISO(profile.incorporationDate), reason: `incorporation date ${profile.incorporationDate}` };
      } else {
        const licence = compilePath(profile, steps).nodes.find((node) => node.id === "C-LIC");
        if (licence) {
          const date = offsetDate(dateFromISO(profile.arrivalDate), 0, licence.earliestFinish);
          incorporation = {
            date,
            reason: `projected incorporation ${isoDate(date)} — arrival + C-LIC earliest finish (${licence.earliestFinish} days)`,
          };
        }
      }
    }
    return incorporation;
  }

  const result: Occurrence[] = [];
  function add(rule: Rule, due: Date | null, reason: string, index = 0): void {
    const daysAway = due === null ? null : (due.getTime() - day.getTime()) / dayMilliseconds;
    const status: Obligation["status"] = daysAway === null ? "info" : daysAway < 0 ? "overdue" : daysAway <= 30 ? "due_soon" : "upcoming";
    result.push({
      key: `${rule.id}:${index}`,
      obligation: Obligation.parse({
        ruleId: rule.id, title: rule.title, authority: rule.authority,
        dueDate: due === null ? null : isoDate(due), ...penalty(rule), status, reason,
        sourceUrl: rule.sourceUrl, verifiedOn: rule.verifiedOn,
        confidence: rule.confidence, verify: rule.verify,
      }),
    });
  }

  for (const rule of rules) {
    if (!evaluate(rule.appliesIf, facts)) continue;
    const trigger = rule.trigger;
    if (trigger.type === "none") {
      add(rule, null, rule.summary);
    } else if (trigger.type === "fixed_date") {
      add(rule, trigger.date ? dateFromISO(trigger.date) : null, trigger.date ? rule.summary : `UNKNOWN · verify deadline with ${rule.authority}`);
    } else if (trigger.type === "threshold") {
      const metric: unknown = trigger.field && Object.hasOwn(facts, trigger.field)
        ? facts[trigger.field as keyof typeof facts]
        : undefined;
      if (typeof metric !== "number" || trigger.threshold === undefined || metric <= trigger.threshold) continue;
      const days = trigger.offsetDays ?? 0;
      add(rule, offsetDate(day, trigger.offsetMonths, days), `${rule.summary} estimate — ${days} days from crossing; assumes you cross today`);
    } else {
      const base = baseFor(trigger.field);
      if (!base) {
        add(rule, null, `UNKNOWN · verify base date with ${rule.authority}`);
        continue;
      }
      const reason = `${rule.summary} Based on ${base.reason}.`;
      if (trigger.type === "from_date") {
        add(rule, offsetDate(base.date, trigger.offsetMonths, trigger.offsetDays), reason);
        continue;
      }
      const interval = trigger.every === "month" ? 1 : trigger.every === "quarter" ? 3 : trigger.every === "year" ? 12 : undefined;
      if (interval === undefined) {
        add(rule, null, `UNKNOWN · verify recurrence with ${rule.authority}`);
        continue;
      }
      const first = offsetDate(base.date, trigger.offsetMonths, trigger.offsetDays);
      const elapsedMonths = (day.getUTCFullYear() - first.getUTCFullYear()) * 12 + day.getUTCMonth() - first.getUTCMonth();
      let index = Math.max(0, Math.floor(elapsedMonths / interval) - 1);
      // Anchor each occurrence to the original base, so February never shifts March's day.
      for (;;) {
        const due = offsetDate(base.date, (trigger.offsetMonths ?? 0) + index * interval, trigger.offsetDays);
        if (due >= horizon) break;
        if (due >= day) add(rule, due, reason, index);
        index += 1;
      }
    }
  }
  return result;
}

/** Recurring deadlines cover [today, today + 12 calendar months); other rules retain their dates. */
export function computeObligations(profile: Profile, rules: readonly Rule[], today: Date = new Date()): Obligation[] {
  return occurrences(Profile.parse(profile), rules.map((rule) => Rule.parse(rule)), today).map(({ obligation }) => obligation);
}

export function whatIf(profile: Profile, patch: Partial<Profile>, today: Date = new Date()): WhatIfResult {
  const beforeOccurrences = occurrences(Profile.parse(profile), seedRules, today);
  const afterOccurrences = occurrences(Profile.parse({ ...profile, ...patch }), seedRules, today);
  const beforeByKey = new Map(beforeOccurrences.map((occurrence) => [occurrence.key, occurrence.obligation]));
  const afterByKey = new Map(afterOccurrences.map((occurrence) => [occurrence.key, occurrence.obligation]));
  const added: Obligation[] = [];
  const removed: Obligation[] = [];
  const changed: WhatIfResult["diff"]["changed"] = [];
  for (const [key, after] of afterByKey) {
    const before = beforeByKey.get(key);
    if (!before) added.push(after);
    else if (JSON.stringify(before) !== JSON.stringify(after)) changed.push({ before, after });
  }
  for (const [key, before] of beforeByKey) {
    if (!afterByKey.has(key)) removed.push(before);
  }
  return WhatIfResult.parse({
    before: beforeOccurrences.map(({ obligation }) => obligation),
    after: afterOccurrences.map(({ obligation }) => obligation),
    diff: { added, removed, changed },
  });
}
