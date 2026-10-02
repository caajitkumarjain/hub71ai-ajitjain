import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GeoPattern } from "@/components/brand/geo-pattern";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return <section className="relative flex min-h-[72vh] items-center overflow-hidden py-20 md:py-24">
    <GeoPattern className="left-[44%] w-[56%]" />
    <div className="relative w-full">
      <p className="mb-8 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-ink-muted"><span className="h-px w-8 bg-gold" aria-hidden="true" />Your next chapter, Abu Dhabi</p>
      <h1 className="max-w-3xl font-display text-[52px] leading-[1.08] font-medium tracking-[-0.02em] sm:text-[64px]">Arrive. Build.<br />Belong.</h1>
      <p className="mt-7 max-w-[490px] text-base leading-7 text-ink-muted">Your whole Abu Dhabi journey (visa, home, company, bank and every deadline after), compiled into one simple path.</p>
      <div className="mt-9"><Button asChild size="lg"><Link href="/start">Start with my details<ArrowUpRight aria-hidden="true" /></Link></Button></div>
      <p className="mt-12 text-xs tracking-wide text-ink-muted">A clearer way to call Abu Dhabi home.</p>
    </div>
  </section>;
}
