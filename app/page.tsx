import Link from "next/link";
import { ArrowRight, Route, Landmark, CalendarClock } from "lucide-react";
import { GeoPattern } from "@/components/brand/geo-pattern";
import { PriyaButton } from "@/components/path/priya-button";

export default function HomePage() {
  return <><section className="relative flex min-h-[calc(100svh-88px)] items-center overflow-hidden py-20 md:py-24">
    <GeoPattern className="left-[44%] w-[56%]" />
    <div className="relative w-full">
      <p className="mb-8 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-ink-muted"><span className="h-px w-8 bg-gold" aria-hidden="true" />Your next chapter, Abu Dhabi</p>
      <h1 className="max-w-3xl font-display text-[52px] leading-[1.08] font-medium tracking-[-0.02em] sm:text-[64px]">Arrive. Build.<br />Belong.</h1>
      <p className="mt-7 max-w-[490px] text-base leading-7 text-ink-muted">Your whole Abu Dhabi journey (visa, home, company, bank and every deadline after), compiled into one simple path.</p>
      <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4"><PriyaButton /><Link href="/start" className="inline-flex min-h-11 items-center gap-2 font-medium underline-offset-4 hover:underline">Start with my details<ArrowRight aria-hidden="true" className="size-4" /></Link></div>
      <p className="mt-12 text-xs tracking-wide text-ink-muted">A clearer way to call Abu Dhabi home.</p>
    </div>
  </section>
  <section aria-label="A simpler move" className="grid gap-6 border-t border-line py-16 md:grid-cols-3 md:py-24">
    {[
      { Icon: Route, title: "Know the order", text: "Every step, in the order that saves weeks." },
      { Icon: Landmark, title: "Pass the bank", text: "See what a bank will question before you apply." },
      { Icon: CalendarClock, title: "Never miss a deadline", text: "Tax, VAT, licence and visa dates, with what’s at stake." },
    ].map(({ Icon, title, text }) => <article key={title} className="rounded-xl border border-line bg-surface p-7"><Icon aria-hidden="true" className="mb-8 size-6 text-gold" /><h2 className="font-display text-2xl">{title}</h2><p className="mt-3 max-w-64 leading-6 text-ink-muted">{text}</p></article>)}
  </section></>;
}
