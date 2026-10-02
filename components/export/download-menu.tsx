"use client";

import { useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { ExportRequest } from "@/lib/export/schema";

export type DownloadOption = { label: string; request: ExportRequest };
export function DownloadMenu({ options, disabled = false }: { options: DownloadOption[]; disabled?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOffset, setMenuOffset] = useState(0);
  async function download(option: DownloadOption) {
    if (busy || disabled) return;
    if (menu.current) menu.current.open = false;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ExportRequest.parse(option.request)), signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error("Export unavailable");
      const filename = response.headers.get("content-disposition")?.match(/filename="([a-z0-9.-]+)"/i)?.[1];
      if (!filename || !response.headers.get("content-type")?.includes("application/vnd.openxmlformats-officedocument")) throw new Error("Invalid export");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Empty export");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("Download unavailable. Your draft is still here; please try again."); }
    finally { setBusy(false); }
  }
  if (!options.length) return null;
  return <div className="relative max-w-full text-sm">
    <details ref={menu} className="relative" onToggle={() => { if (menu.current?.open) { const left = menu.current.getBoundingClientRect().left; const width = Math.min(256, window.innerWidth - 48); setMenuOffset(Math.min(0, window.innerWidth - 24 - left - width)); } }} onKeyDown={(event) => { if (event.key === "Escape" && menu.current) { menu.current.open = false; menu.current.querySelector("summary")?.focus(); } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget) && menu.current) menu.current.open = false; }}>
      <summary aria-disabled={busy || disabled} onClick={(event) => { if (busy || disabled) event.preventDefault(); }} className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-ink hover:bg-surface-2 aria-disabled:cursor-wait aria-disabled:opacity-50">
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Download aria-hidden="true" className="size-4" />}<span>{busy ? "Preparing download…" : "Download"}</span><ChevronDown aria-hidden="true" className="size-3" />
      </summary>
      <div style={{ left: menuOffset }} className="absolute z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-line bg-surface p-1 shadow-lg">
        {options.map((option) => <button key={option.label} type="button" disabled={busy || disabled} onClick={() => void download(option)} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-gold">
          {option.request.kind === "document" ? <FileText aria-hidden="true" className="size-4 shrink-0 text-teal" /> : <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-teal" />}<span>{option.label}</span>
        </button>)}
      </div>
    </details>
    {error && <p role="alert" className="mt-2 max-w-64 text-xs leading-5 text-ink-muted">{error}</p>}
  </div>;
}
