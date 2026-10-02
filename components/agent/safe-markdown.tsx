import { Fragment, type ReactNode } from "react";
import rules from "@/data/rules.json";
import steps from "@/data/steps.json";
import jurisdictions from "@/data/jurisdictions.json";

const nextActionRoutes = new Set(["/", "/start", "/path", "/bank", "/deadlines"]);
const sourceOrigins = new Set([...rules, ...steps, ...jurisdictions].flatMap((source) => [source.sourceUrl, ...("officialUrl" in source ? [source.officialUrl] : [])]).filter((url): url is string => typeof url === "string").map((url) => new URL(url).origin));

export function safeHref(value: string): string | null {
  if (/[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try { const url = new URL(value); return url.protocol === "https:" ? url.href : null; } catch { return null; }
}

export function safeActionHref(value: string): string | null {
  const href = safeHref(value);
  if (!href?.startsWith("/")) return null;
  const url = new URL(href, "https://manzil.invalid");
  return nextActionRoutes.has(url.pathname) ? href : null;
}

function markdownHref(value: string): string | null {
  const href = safeHref(value);
  if (!href) return null;
  if (href.startsWith("/")) return safeActionHref(href);
  return sourceOrigins.has(new URL(href).origin) ? href : null;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-surface-2 px-1 font-mono text-[0.9em]">{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = markdownHref(link[2]);
      return href ? <a key={index} href={href} target={href.startsWith("https:") ? "_blank" : undefined} rel="noopener noreferrer" className="text-primary-ink underline underline-offset-4">{link[1]}</a> : <Fragment key={index}>{link[1]}</Fragment>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

/** React escapes all content; raw HTML and executable URL schemes are never interpreted. */
export function SafeMarkdown({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return <div className="space-y-4 break-words text-[14px] leading-7 [overflow-wrap:anywhere]">{blocks.map((block, index) => {
    const lines = block.split("\n");
    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) return <ul key={index} className="list-disc space-y-2 pl-5 marker:text-primary-ink">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s+/, ""))}</li>)}</ul>;
    if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) return <ol key={index} className="list-decimal space-y-2 pl-5 marker:text-ink-muted">{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}</ol>;
    if (/^#{1,6}\s/.test(block)) return <h4 key={index} className="font-display text-lg leading-7">{inline(block.replace(/^#{1,6}\s+/, ""))}</h4>;
    return <p key={index}>{lines.map((line, i) => <Fragment key={i}>{i > 0 && <br />}{inline(line)}</Fragment>)}</p>;
  })}</div>;
}
