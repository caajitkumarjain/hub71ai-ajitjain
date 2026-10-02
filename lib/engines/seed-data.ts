import rawActivities from "@/data/activities.json";
import rawSteps from "@/data/steps.json";
import rawRules from "@/data/rules.json";
import rawJurisdictions from "@/data/jurisdictions.json";
import rawExchange from "@/data/licence-exchange.json";
import { Activity, Step, Rule, JurisdictionData, LicenceExchange } from "@/lib/schemas";

// Static imports are validated once; the engines perform no filesystem or network I/O.
export const activities = Activity.array().parse(rawActivities);
export const steps = Step.array().parse(rawSteps);
export const rules = Rule.array().parse(rawRules);
export const jurisdictions = JurisdictionData.array().parse(rawJurisdictions);
export const licenceExchange = LicenceExchange.parse(rawExchange);
