import { AlignmentType, Document, ExternalHyperlink, Footer, Header, HeadingLevel, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { DocumentPack, DRAFT_NOTE, provenanceLabels } from "./schema";

const emerald = "0E9F6E";
const amber = "FFF2CC";
const paragraph = (text: string) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 140 } });
const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, keepNext: true });
function cell(text: string, needed = false, header = false) {
  return new TableCell({ shading: needed ? { fill: amber, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: header })] })] });
}
function link(label: string, url: string) {
  return new Paragraph({ children: [new TextRun(label), new ExternalHyperlink({ link: url,
    children: [new TextRun({ text: url, style: "Hyperlink" })] })], spacing: { after: 120 } });
}

/** Deterministic layout from verified JSON; the caller supplies the generation timestamp. */
export async function renderDocx(input: DocumentPack, generatedAt = new Date()): Promise<Buffer> {
  const pack = DocumentPack.parse(input);
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: pack.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ children: [new TextRun({ text: DRAFT_NOTE, bold: true })], shading: { fill: amber }, spacing: { before: 160, after: 220 } }),
    paragraph(pack.purpose),
    ...pack.sections.flatMap((section) => [heading(section.heading), ...section.paragraphs.map(paragraph)]),
    heading("Fields to review"),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [2600, 3900, 2860], rows: [
      new TableRow({ tableHeader: true, children: [cell("Field", false, true), cell("Value", false, true), cell("Source", false, true)] }),
      ...pack.fields.map((field) => new TableRow({ cantSplit: true, children: [cell(field.label, field.value === null),
        cell(field.value ?? "NEEDED FROM YOU", field.value === null),
        cell(`${provenanceLabels[field.value === null ? "needed" : field.provenance]}${field.sourceRuleId ? ` · ${field.sourceRuleId}` : ""}`, field.value === null)] })),
    ] }),
    heading("Checklist"), ...pack.checklist.map((item) => paragraph(`☐ ${item.item}${item.required ? " (required)" : " (optional)"}`)),
  ];
  if (pack.email) children.push(heading("Email draft"), paragraph(`To: ${pack.email.to ?? "NEEDED FROM YOU"}`), paragraph(`Subject: ${pack.email.subject}`), paragraph("Body:"), ...pack.email.body.split("\n").map(paragraph));
  children.push(pack.officialUrl ? link("Submit at: ", pack.officialUrl) : paragraph("Submit at: UNKNOWN · verify with the relevant authority"));
  const footer = new Footer({ children: [
    ...pack.sources.map((source) => new Paragraph({ children: [new TextRun({ text: `${source.ruleId ?? source.stepId} · ${source.url} · verified ${source.verifiedOn ?? "date unknown"}`, size: 16 })], spacing: { after: 50 } })),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Generated ${generatedAt.toISOString()} · Page `, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 }), new TextRun({ text: " of ", size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 })] }),
  ] });
  const document = new Document({ creator: "Manzil", title: pack.title, description: pack.purpose,
    styles: { default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { after: 140, line: 276 } } },
      heading1: { run: { font: "Calibri", color: emerald, size: 36, bold: true }, paragraph: { spacing: { before: 200, after: 180 } } },
      heading2: { run: { font: "Calibri", color: emerald, size: 26, bold: true }, paragraph: { spacing: { before: 240, after: 120 } } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1700, left: 1080, right: 1080, header: 400, footer: 400 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "Manzil", bold: true, color: emerald, size: 28 }), new TextRun({ text: `  |  ${pack.title}`, size: 18 })] })] }) },
      footers: { default: footer }, children }],
  });
  return Packer.toBuffer(document);
}
