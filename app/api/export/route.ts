import { ExportRequest } from "@/lib/export/schema";
import { verifyDocumentPack } from "@/lib/export/verify";
import { exportContext } from "@/lib/export/trusted-context";
import { renderDocx } from "@/lib/export/docx";
import { renderChecklist, renderDeadlines, renderEmaraTax } from "@/lib/export/xlsx";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 1_000_000) return Response.json({ error: "Document is too large." }, { status: 413 });
    raw = JSON.parse(text);
  } catch { return Response.json({ error: "Invalid JSON." }, { status: 400 }); }
  const parsed = ExportRequest.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Invalid export request." }, { status: 400 });
  const input = parsed.data;
  try {
    const now = new Date();
    const context = exportContext(input.profile, now);
    const pack = "pack" in input ? verifyDocumentPack(input.pack, input.profile, context.toolOutputs) : null;
    const buffer = input.kind === "document" ? await renderDocx(pack!, now)
      : input.kind === "emaratax" ? await renderEmaraTax(pack!, now)
      : input.kind === "deadlines" ? await renderDeadlines(context.obligations, now) : await renderChecklist(context.path, now);
    const extension = input.kind === "document" ? "docx" : "xlsx";
    const document = input.kind === "document" ? input.document : input.kind;
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": extension === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="manzil-${document}-${now.toISOString().slice(0, 10)}.${extension}"`,
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return Response.json({ error: "The document could not be exported. Please try again." }, { status: 500 }); }
}
