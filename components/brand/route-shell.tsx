import { GeoPattern } from "./geo-pattern";

export function RouteShell({ eyebrow, title, description, pattern = false }: { eyebrow: string; title: string; description: string; pattern?: boolean }) {
  return <section className="relative min-h-[60vh] overflow-hidden py-16 md:py-24">
    {pattern && <GeoPattern className="left-1/3 w-2/3" />}
    <div className="relative">
      <p className="mb-6 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-muted">{eyebrow}</p>
      <h1 className="max-w-2xl font-display text-4xl leading-[44px] font-medium tracking-[-0.02em]">{title}</h1>
      <p className="mt-5 max-w-md text-base leading-7 text-ink-muted">{description}</p>
      <div className="mt-12 flex items-center gap-3 border-t border-line pt-6 text-xs text-ink-muted"><span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />Coming soon</div>
    </div>
  </section>;
}
