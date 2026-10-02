import { OasisLanding } from "@/components/landing/oasis-landing";
import { Profile } from "@/lib/schemas";
import { scoreBankability } from "@/lib/engines";
import { activities, rules } from "@/lib/engines/seed-data";
import personas from "@/data/personas.json";

export default function HomePage() {
  const profile = Profile.parse(personas.priya);
  const initialScore = scoreBankability(profile, activities).score;
  const fixedScore = scoreBankability({ ...profile, activityCode: "software-development" }, activities).score;
  const vatDays = rules.find((rule) => rule.id === "VAT-REG")?.trigger.offsetDays ?? null;
  return <OasisLanding initialScore={initialScore} fixedScore={fixedScore} vatDays={vatDays} />;
}
