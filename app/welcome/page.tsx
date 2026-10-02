import { CoverIntro } from "@/components/cover/cover-intro";
import rawRules from "@/data/rules.json";
import steps from "@/data/steps.json";
import { Rule } from "@/lib/schemas";

export const metadata = { title: "Welcome to Manzil", description: "Arrive. Build. Run. Belong. Your Abu Dhabi founder journey, in the right order." };

export default function WelcomePage() {
  const corporateTax = Rule.parse(rawRules.find((rule) => rule.id === "CT-REG"));
  return <CoverIntro stepCount={steps.length} penaltyAED={corporateTax.penaltyAED ?? null} penaltySourceUrl={corporateTax.sourceUrl ?? "https://tax.gov.ae/en/services/corporate.tax.registration.aspx"} />;
}
