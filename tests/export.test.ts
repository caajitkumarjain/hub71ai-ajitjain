import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Profile } from "@/lib/schemas";
import personas from "@/data/personas.json";
import { rules, steps } from "@/lib/engines/seed-data";
import { compilePath, computeObligations } from "@/lib/engines";
import { DocumentPack, DRAFT_NOTE, ExportRequest } from "@/lib/export/schema";
import { verifyDocumentPack } from "@/lib/agents/verifier";
import { renderDocx } from "@/lib/export/docx";
import { renderChecklist, renderDeadlines, renderEmaraTax } from "@/lib/export/xlsx";
import { CompanyDocumentDownload } from "@/components/export/company-document-card";
import { companyDocuments, type CompanyDocumentKind } from "@/lib/export/company-documents";
import { POST } from "@/app/api/export/route";

const profile = Profile.parse(personas.priya);
const now = new Date("2026-10-02T10:00:00.000Z");
const ctStep = steps.find((step) => step.id === "C-CT")!;
const pack: DocumentPack = {
  title: "Business Profile", purpose: "Review the company details before submitting.",
  sections: [{ heading: "Overview", paragraphs: ["Confirm the supporting records."] }],
  fields: [
    { label: "Founder", value: profile.name, provenance: "profile", sourceRuleId: null },
    { label: "Registration number", value: null, provenance: "needed", sourceRuleId: null },
  ],
  checklist: [{ item: "Review supporting documents", required: true }],
  email: { to: null, subject: "Draft for review", body: "Please review the attached draft.\nThank you." },
  officialUrl: ctStep.officialUrl ?? null,
  sources: [{ stepId: ctStep.id, ruleId: null, url: ctStep.sourceUrl ?? ctStep.officialUrl!, verifiedOn: ctStep.verifiedOn ?? null }],
};

// Read the ZIP central directory using Node built-ins, without installing a third package.
function zipEntries(buffer: Buffer): Map<string, string> {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Not an Office ZIP archive");
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, string>();
  const count = buffer.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    expect(buffer.readUInt32LE(offset)).toBe(0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const compressed = buffer.subarray(start, start + size);
    if (name.endsWith(".xml")) entries.set(name, (method === 8 ? inflateRawSync(compressed) : compressed).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
async function openWorkbook(buffer: Buffer) {
  expect(buffer.byteLength).toBeGreaterThan(1000);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(buffer).buffer);
  return book;
}
function conditionalFormatting(sheet: ExcelJS.Worksheet): ExcelJS.ConditionalFormattingOptions[] {
  // ExcelJS preserves these on load; its public declaration omits the getter.
  return (sheet as ExcelJS.Worksheet & { conditionalFormattings: ExcelJS.ConditionalFormattingOptions[] }).conditionalFormattings;
}
function request(body: unknown) {
  return new Request("http://localhost/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("structured export verification", () => {
  it("nulls invented values, corrects provenance, and matches normalized profile/tool values", () => {
    const result = verifyDocumentPack({ ...pack, fields: [
      { label: "Founder", value: `  ${profile.name.toUpperCase()}  `, provenance: "calculated" },
      { label: "Tax number", value: "TRN-FAKE-999777", provenance: "profile" },
      { label: "Calculated days", value: "٤٢", provenance: "profile" },
      { label: "Missing", value: null, provenance: "calculated" },
    ] }, profile, [{ days: 42 }]);
    expect(result.fields[0].provenance).toBe("profile");
    expect(result.fields[1]).toMatchObject({ value: null, provenance: "needed" });
    expect(result.fields[2]).toMatchObject({ value: "٤٢", provenance: "calculated" });
    expect(result.fields[3]).toMatchObject({ value: null, provenance: "needed" });
  });
  it("removes unsupported numbers from every prose surface and does not split dates into allowed fragments", () => {
    const result = verifyDocumentPack({ ...pack, purpose: "Pay 999777 AED", sections: [{ heading: "Due 2049-12-31", paragraphs: ["It takes 42 days.", "A fee of 999777 AED applies.", "A fee of ٤٤٤٤ AED applies."] }], email: { to: "invented@example.com", subject: "Due 999777", body: "Pay 999777" } }, profile, [{ days: 42, year: 2049, month: 12, day: 31 }]);
    expect(result.sections[0].paragraphs[0]).toBe("It takes 42 days.");
    expect(JSON.stringify(result)).not.toMatch(/999777|٤٤٤٤|2049-12-31|invented@example/);
    expect(result.email?.to).toBeNull();
  });
  it("reconstructs sources and rejects invented destinations and IDs", () => {
    const result = verifyDocumentPack({ ...pack, officialUrl: "https://invented.example/apply", sources: [
      { stepId: "C-CT", url: "https://invented.example/source", verifiedOn: "2099-01-01" },
      { ruleId: "FAKE-RULE", url: "https://invented.example", verifiedOn: null },
    ] }, profile, []);
    expect(result.officialUrl).toBeNull();
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toMatchObject({ stepId: "C-CT", url: ctStep.sourceUrl ?? ctStep.officialUrl, verifiedOn: ctStep.verifiedOn ?? null });
  });
  it("rejects unsupported formats, executable URLs and client supplied tool results", () => {
    expect(ExportRequest.safeParse({ kind: "document", document: "mission-pack", profile, pack, toolOutputs: [{ invented: 999 }] }).success).toBe(false);
    expect(ExportRequest.safeParse({ kind: "calculator", profile }).success).toBe(false);
    expect(DocumentPack.safeParse({ ...pack, officialUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("Office renderers", () => {
  it("opens the Word archive and includes the full draft, table, highlighting, email, sources and page numbers", async () => {
    const buffer = await renderDocx(pack, now);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    const entries = zipEntries(buffer);
    const document = entries.get("word/document.xml")!;
    expect(entries.has("[Content_Types].xml")).toBe(true);
    for (const text of [DRAFT_NOTE, "Field", "Value", "Source", "From your profile", "NEEDED FROM YOU", "FFF2CC", "☐", "To:", "Subject:", "Submit at:"]) expect(document).toContain(text);
    const footer = [...entries].filter(([name]) => name.includes("footer")).map(([, xml]) => xml).join("");
    expect(footer).toContain(now.toISOString()); expect(footer).toContain("PAGE"); expect(footer).toContain("NUMPAGES");
    expect(footer).toContain("C-CT");
    expect([...entries.values()].join("")).toContain("0E9F6E");
  });
  it("opens EmaraTax with the exact header, Ready/Needed validation and conditional highlighting", async () => {
    const book = await openWorkbook(await renderEmaraTax(pack, now));
    const sheet = book.getWorksheet("EmaraTax registration")!;
    expect(sheet.getCell("A1").value).toBe(DRAFT_NOTE);
    expect(sheet.getRow(3).values).toEqual([, "Field", "Value", "Source", "Status"]);
    expect(sheet.getCell("D4").value).toBe("Ready"); expect(sheet.getCell("D5").value).toBe("Needed");
    expect(sheet.getCell("D5").dataValidation.formulae).toEqual(['"Ready,Needed"']);
    expect(conditionalFormatting(sheet)[0].rules[0]).toMatchObject({ type: "expression", formulae: ['$D4="Needed"'] });
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
    expect(sheet.autoFilter).toBeTruthy(); expect(sheet.getColumn(2).width).toBeGreaterThan(20);
  });
  it("exports all path steps, source links, estimates and status dropdowns", async () => {
    const path = compilePath(profile, steps);
    const sheet = (await openWorkbook(await renderChecklist(path, now))).getWorksheet("Setup checklist")!;
    expect(sheet.rowCount).toBe(path.nodes.length + 3);
    expect(sheet.getRow(3).values).toEqual([, "Lane", "Step", "Documents needed", "Est. days", "Status", "Official link"]);
    expect(sheet.getCell("E4").dataValidation.formulae).toEqual(['"To do,In progress,Done"']);
    expect(sheet.getCell("D4").value).toBe(path.nodes[0].durationDays.likely);
  });
  it("exports engine dates and qualified penalties with live overdue/30-day formatting", async () => {
    const rows = computeObligations(profile, rules, now);
    const sheet = (await openWorkbook(await renderDeadlines(rows, now))).getWorksheet("Deadlines")!;
    expect(sheet.getRow(3).values).toEqual([, "Due date", "Obligation", "Authority", "If late (AED)", "Source URL", "Status"]);
    expect(sheet.getCell("D4").value).toBe(rows[0].penaltyDisplay);
    expect(conditionalFormatting(sheet)[0].rules.map((rule) => "formulae" in rule ? rule.formulae?.[0] : undefined)).toEqual(['AND(ISNUMBER($A4),$A4<TODAY())', 'AND(ISNUMBER($A4),$A4>=TODAY(),$A4<=TODAY()+30)']);
  });
});

describe("server export boundary and integration slots", () => {
  it("reverifies a forged pack on HTTP export and returns a dated Word attachment", async () => {
    const response = await POST(request({ kind: "document", document: "mission-pack", profile, pack: { ...pack, fields: [{ label: "TRN", value: "FORGED-TRN", provenance: "calculated" }] } }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/manzil-mission-pack-\d{4}-\d{2}-\d{2}\.docx/);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const xml = zipEntries(Buffer.from(await response.arrayBuffer())).get("word/document.xml")!;
    expect(xml).not.toContain("FORGED-TRN"); expect(xml).toContain("NEEDED FROM YOU");
  });
  it.each(["emaratax", "deadlines", "checklist"])("returns an openable %s Excel attachment", async (kind) => {
    const response = await POST(request({ kind, profile, ...(kind === "emaratax" ? { pack } : {}) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(`manzil-${kind}-`);
    await openWorkbook(Buffer.from(await response.arrayBuffer()));
  });
  it("rejects malformed JSON and unvalidated requests", async () => {
    expect((await POST(new Request("http://localhost/api/export", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await POST(request({ kind: "deadlines", profile: {} }))).status).toBe(400);
  });
  it.each(Object.keys(companyDocuments) as CompanyDocumentKind[])("offers only the applicable format for %s", (kind) => {
    const html = renderToStaticMarkup(createElement(CompanyDocumentDownload, { kind, profile, pack }));
    expect(html).toContain(kind === "emaratax" ? "(Excel)" : "(Word)");
    expect(html).not.toContain(kind === "emaratax" ? "(Word)" : "(Excel)");
  });
});
