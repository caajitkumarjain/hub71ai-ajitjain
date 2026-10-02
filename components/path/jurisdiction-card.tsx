import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { JurisdictionComparison, Profile } from "@/lib/schemas";
import { navigate } from "@/lib/engines/jurisdiction-twin";
import { BawsalaAvatar } from "@/components/navigator/bawsala-avatar";
import { Button } from "@/components/ui/button";

export function JurisdictionCard({ profile }: { comparisons: JurisdictionComparison[] | null; profile?: Profile }) {
  const recommendation = profile ? navigate(profile) : null;
  const winner = recommendation?.winner;
  return <section aria-labelledby="locations-title" className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-line bg-surface p-5 sm:p-7">
    <div className="flex min-w-0 items-center gap-4"><BawsalaAvatar winner={winner?.jurisdictionId} size={58} /><div><h2 id="locations-title" className="text-xs text-ink-muted">Where to set up</h2><p className="mt-1 font-display text-lg">{winner ? `Bawsala recommends ${winner.name} \u00b7 ${recommendation!.confidence} confidence` : "Find where your company belongs"}</p>{Boolean(recommendation?.missingFacts.length) && <p className="mt-1 text-xs text-ink-muted">Provisional &middot; answer a few questions to check your fit.</p>}</div></div>
    <Button asChild variant="outline"><Link href="/navigator">Decide with Bawsala<ArrowRight aria-hidden="true" /></Link></Button>
  </section>;
}
