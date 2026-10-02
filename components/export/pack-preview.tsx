import type { DocumentPack } from "@/lib/export/schema";
import { DRAFT_NOTE, provenanceLabels } from "@/lib/export/schema";

export function PackPreview({ pack }: { pack: DocumentPack }) {
  return <div className="space-y-5 break-words text-sm leading-6">
    <p className="rounded-lg bg-amber/10 p-3 text-xs">{DRAFT_NOTE}</p>
    <div><h3 className="font-display text-xl">{pack.title}</h3><p className="mt-2 text-ink-muted">{pack.purpose}</p></div>
    {pack.sections.map((section, index) => <section key={index}><h4 className="mb-2 font-medium">{section.heading}</h4>{section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex} className="mb-2 whitespace-pre-wrap text-ink-muted">{paragraph}</p>)}</section>)}
    <dl className="divide-y divide-line rounded-lg border border-line">{pack.fields.map((field, index) => <div key={index} className={`p-3 ${field.value === null ? "bg-amber/10" : ""}`}><dt className="font-medium">{field.label}</dt><dd className="mt-1 whitespace-pre-wrap">{field.value ?? "NEEDED FROM YOU"}<span className="mt-1 block text-xs text-ink-muted">{provenanceLabels[field.provenance]}{field.sourceRuleId ? ` · ${field.sourceRuleId}` : ""}</span></dd></div>)}</dl>
    {pack.checklist.length > 0 && <section><h4 className="mb-2 font-medium">Checklist</h4><ul className="space-y-2">{pack.checklist.map((item, index) => <li key={index}><label className="flex items-start gap-3"><input type="checkbox" className="mt-1.5 size-4 shrink-0 accent-teal" /><span>{item.item}<span className="ml-1 text-xs text-ink-muted">({item.required ? "required" : "optional"})</span></span></label></li>)}</ul></section>}
    {pack.email && <section><h4 className="font-medium">Email draft</h4><p>To: {pack.email.to ?? "NEEDED FROM YOU"}</p><p>Subject: {pack.email.subject}</p><p className="mt-2 whitespace-pre-wrap text-ink-muted">{pack.email.body}</p></section>}
    <p className="text-xs">Submit at: {pack.officialUrl ? <a href={pack.officialUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{pack.officialUrl}</a> : "UNKNOWN · verify with the relevant authority"}</p>
  </div>;
}
