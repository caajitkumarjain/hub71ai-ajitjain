import type { DocumentKind } from "./schema";

export type CompanyDocumentKind = Exclude<DocumentKind, "mission-pack">;
export const companyDocuments: Record<CompanyDocumentKind, { title: string; stepId: string; instruction: string }> = {
  "business-profile": { title: "Business Profile", stepId: "C-BANK", instruction: "Describe the business and revenue model from the profile. Request missing company name, registration, address, customers and trading details." },
  "source-of-funds": { title: "Source of Funds", stepId: "C-BANK", instruction: "Separate the declared funding amount from its origin. Funding origin, supporting records and account details are needed unless supplied. Do not infer a funding source from an amount." },
  "board-resolution": { title: "Board Resolution", stepId: "C-CONST", instruction: "Prepare a resolution template for review. Company legal name, directors, meeting date, authorised signatories and the actual decision must be needed; do not claim that a meeting occurred or a resolution was passed." },
  "ubo-declaration": { title: "UBO declaration", stepId: "C-CONST", instruction: "Prepare a declaration for review with missing beneficial owner identity, ownership/control details and signatures clearly needed. Do not infer ownership from founder status." },
  "emaratax": { title: "EmaraTax Corporate Tax registration sheet", stepId: "C-CT", instruction: "Prepare tabular registration fields, including legal entity name, registration and licence details, incorporation date, business activity, address, contact, authorised signatory and supporting documents. Do not invent a TRN, legal entity type or tax period." },
};
export function companyDocumentPrompt(kind: CompanyDocumentKind) {
  const document = companyDocuments[kind];
  return `Prepare only a draft ${document.title} as structured pack JSON for step ${document.stepId}. ${document.instruction} Read get_step and its get_rules. Use only the saved profile and tool results. Missing values must be null with provenance needed. Nothing is submitted, sent or signed.`;
}
