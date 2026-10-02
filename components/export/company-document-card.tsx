"use client";

import { FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import type { Profile } from "@/lib/schemas";
import type { DocumentPack } from "@/lib/export/schema";
import { companyDocumentPrompt, companyDocuments, type CompanyDocumentKind } from "@/lib/export/company-documents";
import { useAgentStream } from "@/components/agent/use-agent-stream";
import { AgentTheatre } from "@/components/agent/agent-theatre";
import { Button } from "@/components/ui/button";
import { DownloadMenu } from "./download-menu";
import { PackPreview } from "./pack-preview";

/** Integration slot for the later Company Studio route; no route or navigation changes. */
export function CompanyDocumentDownload({ kind, profile, pack }: { kind: CompanyDocumentKind; profile: Profile; pack: DocumentPack }) {
  return <DownloadMenu options={[{ label: kind === "emaratax" ? "EmaraTax sheet (Excel)" : `${companyDocuments[kind].title} (Word)`,
    request: kind === "emaratax" ? { kind: "emaratax", profile, pack } : { kind: "document", document: kind, profile, pack } }]} />;
}
export function CompanyDocumentCard({ kind, profile }: { kind: CompanyDocumentKind; profile: Profile }) {
  const stream = useAgentStream();
  const metadata = companyDocuments[kind];
  return <article className="min-w-0 rounded-xl border border-line bg-surface p-5">
    <div className="mb-4 flex items-center gap-3">{kind === "emaratax" ? <FileSpreadsheet className="size-5 shrink-0 text-teal" aria-hidden="true" /> : <FileText className="size-5 shrink-0 text-teal" aria-hidden="true" />}<h3 className="font-medium">{metadata.title}</h3></div>
    <p className="mb-4 text-xs leading-5 text-ink-muted">A draft from your saved details. Missing information stays marked for your review.</p>
    <div className="flex flex-wrap items-center gap-3"><Button variant="outline" size="sm" disabled={stream.isRunning} onClick={() => void stream.send({ profile, locale: profile.locale, intent: "mission", messages: [{ role: "user", content: companyDocumentPrompt(kind) }] })}>{stream.isRunning && <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />}{stream.isRunning ? "Preparing…" : stream.result?.pack ? "Regenerate draft" : "Prepare draft"}</Button>
      {stream.result?.status === "complete" && stream.result.pack && <CompanyDocumentDownload kind={kind} profile={profile} pack={stream.result.pack} />}
    </div>
    {stream.error && <p role="alert" className="mt-3 text-xs text-ink-muted">{stream.error}</p>}
    {stream.result?.status === "complete" && stream.result.pack ? <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-xs">Review draft</summary><PackPreview pack={stream.result.pack} /></details> : stream.result && <p className="mt-3 text-sm leading-6 text-ink-muted">{stream.result.answer_md}</p>}
    {(stream.isRunning || stream.events.length > 0) && <AgentTheatre events={stream.events} isRunning={stream.isRunning} />}
  </article>;
}
