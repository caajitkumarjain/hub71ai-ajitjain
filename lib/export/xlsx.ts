import ExcelJS from "exceljs";
import { Obligation, PathResult } from "@/lib/schemas";
import { DocumentPack, DRAFT_NOTE, provenanceLabels } from "./schema";

const yellow: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const red: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
function workbook(name: string, headers: string[], widths: number[], generatedAt: Date) {
  const book = new ExcelJS.Workbook();
  book.creator = "Manzil"; book.created = generatedAt; book.modified = generatedAt;
  const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  sheet.columns = widths.map((width) => ({ width }));
  sheet.mergeCells(1, 1, 1, headers.length);
  sheet.getCell("A1").value = DRAFT_NOTE; sheet.getCell("A1").fill = yellow;
  sheet.getCell("A1").alignment = { wrapText: true, vertical: "middle" }; sheet.getRow(1).height = 32;
  sheet.mergeCells(2, 1, 2, headers.length);
  sheet.getCell("A2").value = `Generated ${generatedAt.toISOString()} · UNKNOWN values require authority verification.`;
  const header = sheet.getRow(3); header.values = headers; header.height = 26;
  header.eachCell((cell) => { cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF0E9F6E" } }; cell.alignment = { wrapText: true }; });
  sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:3" };
  return { book, sheet };
}
function finish(sheet: ExcelJS.Worksheet) {
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, sheet.rowCount), column: sheet.columnCount } };
  sheet.eachRow((row, index) => { if (index > 3) { row.alignment = { vertical: "top", wrapText: true }; row.font = { name: "Calibri", size: 11 }; row.height = 45; } });
}
function dropdown(cell: ExcelJS.Cell, choices: string) {
  cell.dataValidation = { type: "list", allowBlank: false, formulae: [`"${choices}"`], showErrorMessage: true, errorStyle: "stop", errorTitle: "Choose a status", error: "Select a value from the dropdown." };
}

export async function renderEmaraTax(input: DocumentPack, generatedAt = new Date()): Promise<Buffer> {
  const pack = DocumentPack.parse(input);
  const { book, sheet } = workbook("EmaraTax registration", ["Field", "Value", "Source", "Status"], [34, 48, 48, 18], generatedAt);
  for (const field of pack.fields) {
    const needed = field.value === null;
    const row = sheet.addRow([field.label, field.value ?? "NEEDED FROM YOU", provenanceLabels[needed ? "needed" : field.provenance] + (field.sourceRuleId ? ` · ${field.sourceRuleId}` : ""), needed ? "Needed" : "Ready"]);
    dropdown(row.getCell(4), "Ready,Needed");
  }
  if (sheet.rowCount > 3) sheet.addConditionalFormatting({ ref: `A4:D${sheet.rowCount}`, rules: [{ type: "expression", priority: 1, formulae: ['$D4="Needed"'], style: { fill: yellow } }] });
  finish(sheet);
  const sourceSheet = book.addWorksheet("Sources", { views: [{ state: "frozen", ySplit: 3 }] });
  sourceSheet.columns = [{ width: 32 }, { width: 100 }, { width: 22 }];
  sourceSheet.mergeCells("A1:C1"); sourceSheet.getCell("A1").value = DRAFT_NOTE; sourceSheet.getCell("A1").fill = yellow;
  sourceSheet.getRow(3).values = ["Source", "URL", "Verified on"];
  for (const source of pack.sources) sourceSheet.addRow([source.ruleId ?? source.stepId, source.url, source.verifiedOn ?? "UNKNOWN"]);
  sourceSheet.addRow(["Submit at", pack.officialUrl ?? "UNKNOWN", ""]);
  finish(sourceSheet);
  return Buffer.from(await book.xlsx.writeBuffer());
}

export async function renderDeadlines(input: Obligation[], generatedAt = new Date()): Promise<Buffer> {
  const rows = Obligation.array().parse(input);
  const { book, sheet } = workbook("Deadlines", ["Due date", "Obligation", "Authority", "If late (AED)", "Source URL", "Status"], [17, 56, 28, 48, 64, 20], generatedAt);
  for (const row of rows) {
    const added = sheet.addRow([row.dueDate ? new Date(`${row.dueDate}T00:00:00Z`) : "UNKNOWN", row.title, row.authority,
      row.penaltyDisplay, row.sourceUrl ?? "UNKNOWN", row.status.replaceAll("_", " ")]);
    added.getCell(1).numFmt = "yyyy-mm-dd";
    added.getCell(2).note = `${row.reason}\nSource ${row.ruleId} · verified ${row.verifiedOn}${row.verify ? " · verify with authority" : ""}`;
  }
  if (sheet.rowCount > 3) sheet.addConditionalFormatting({ ref: `A4:F${sheet.rowCount}`, rules: [
    { type: "expression", priority: 1, formulae: ['AND(ISNUMBER($A4),$A4<TODAY())'], style: { fill: red } },
    { type: "expression", priority: 2, formulae: ['AND(ISNUMBER($A4),$A4>=TODAY(),$A4<=TODAY()+30)'], style: { fill: yellow } },
  ] });
  finish(sheet); return Buffer.from(await book.xlsx.writeBuffer());
}

export async function renderChecklist(input: PathResult, generatedAt = new Date()): Promise<Buffer> {
  const path = PathResult.parse(input);
  const { book, sheet } = workbook("Setup checklist", ["Lane", "Step", "Documents needed", "Est. days", "Status", "Official link"], [18, 52, 65, 16, 20, 64], generatedAt);
  for (const node of path.nodes) {
    const row = sheet.addRow([node.lane, node.title, node.documents.length ? node.documents.join("\n") : `UNKNOWN · verify with ${node.authority}`,
      node.durationDays.likely, node.status === "done" ? "Done" : node.status === "in_progress" ? "In progress" : "To do", node.officialUrl ?? `UNKNOWN · verify with ${node.authority}`]);
    dropdown(row.getCell(5), "To do,In progress,Done");
    row.getCell(4).note = `Estimate; ${node.durationDays.min}–${node.durationDays.max} days. ${node.sourceUrl ?? "Source URL unknown"} · verified ${node.verifiedOn ?? "date unknown"}`;
    if (node.status === "blocked") row.getCell(5).note = "Currently blocked. Review dependencies in your Path before starting.";
  }
  finish(sheet); return Buffer.from(await book.xlsx.writeBuffer());
}
