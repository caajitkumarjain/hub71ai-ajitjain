import { ArrowUpRight } from "lucide-react";

export function safeSourceUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  try { return ["https:", "http:"].includes(new URL(url).protocol) ? url : undefined; }
  catch { return undefined; }
}

export function SourceChip({ sourceUrl, verifiedOn, confidence, authority }: {
  sourceUrl?: string | null; verifiedOn?: string; confidence: string; authority: string;
}) {
  const href = safeSourceUrl(sourceUrl);
  if (!href) return <span className="block text-xs leading-5 text-ink-muted">UNKNOWN · verify with {authority}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-start gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] leading-5 text-ink hover:underline">
    <ArrowUpRight aria-hidden="true" className="mt-1 size-3 shrink-0" />
    <span className="min-w-0 break-words">{new URL(href).hostname.replace(/^www\./, "")} · {verifiedOn ? `verified ${verifiedOn}` : "verification date unknown"} · {confidence}</span>
    <span className="sr-only"> (opens in a new tab)</span>
  </a>;
}

export function VerifyBadge() {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-2 py-1 text-[11px] font-medium text-ink"><span className="size-1.5 rounded-full bg-amber" aria-hidden="true" />Verify</span>;
}
