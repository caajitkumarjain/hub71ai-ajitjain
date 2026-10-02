import { JurisdictionData, type JurisdictionComparison } from "@/lib/schemas";
import rawJurisdictions from "@/data/jurisdictions.json";
import { SourceChip, VerifyBadge } from "@/components/brand/source-chip";
import styles from "./path.module.css";

const jurisdictions = JurisdictionData.array().parse(rawJurisdictions);
const names = { adgm: "ADGM", mainland: "Mainland", hub71: "Hub71", masdar: "Masdar", kezad: "KEZAD", twofour54: "twofour54" };
const costLabels: Record<string, string> = { licenceAEDPerYear: "licence", officeAEDPerYear: "office", visaAEDPerPerson: "visas", setupOneOffAED: "set-up" };

export function JurisdictionCard({ comparisons }: { comparisons: JurisdictionComparison[] | null }) {
  function cost(id: string) {
    const result = comparisons?.find((item) => item.jurisdictionId === id);
    const known = result && Object.values(result.breakdown).some((amount) => amount !== null);
    const source = jurisdictions.find((item) => item.id === id)!;
    return known ? <><span className="font-medium">AED {result.totalAED.toLocaleString("en-US")}</span>{result.unknowns.length > 0 && <p className="mt-1 text-xs text-ink-muted">Partial total · {result.unknowns.map((key) => costLabels[key] ?? key).join(", ")} UNKNOWN · verify</p>}<div className="mt-2"><SourceChip {...source} authority={source.name} /></div></> : <span className="text-ink-muted">UNKNOWN · verify</span>;
  }
  function fit(id: string) {
    const result = comparisons?.find((item) => item.jurisdictionId === id);
    return result?.fitFlags.length ? result.fitFlags.map((flag) => flag.replace(/^[✓⚠]\s*/, "")).join(" · ") : "UNKNOWN · verify fit with the authority";
  }
  function note(jurisdiction: JurisdictionData) {
    return <details><summary className="cursor-pointer text-xs underline-offset-4 hover:underline">Details & source</summary><div className="mt-3 space-y-3">{jurisdiction.notes && <p>{jurisdiction.notes.replace(/: show as a note.*$/, "").replace(/: show as a note, not in the total/, "")}</p>}<SourceChip {...jurisdiction} authority={jurisdiction.name} />{jurisdiction.verify && <VerifyBadge />}</div></details>;
  }
  return <section aria-labelledby="locations-title" className="rounded-xl border border-line bg-surface p-5 sm:p-7">
    <div className="mb-6"><h2 id="locations-title" className="font-display text-2xl">Where to set up</h2><p className="mt-2 text-sm leading-6 text-ink-muted">Compare the fit before choosing a location. All costs are estimates.</p></div>
    {!comparisons && <p role="status" className="mb-5 text-xs text-ink-muted">Personal comparison is unavailable. Explore the sources below; costs and fit remain unconfirmed.</p>}
    <table className={styles.comparison}><caption className="sr-only">Location comparison: estimated three-year costs, fit and sources</caption><thead><tr><th scope="col"><span className="sr-only">Comparison</span></th>{jurisdictions.map((item) => <th key={item.id} scope="col">{names[item.id]}</th>)}</tr></thead><tbody>
      <tr><th scope="row">3-year cost<br />(estimate)</th>{jurisdictions.map((item) => <td key={item.id}>{cost(item.id)}</td>)}</tr>
      <tr><th scope="row">Fits you?</th>{jurisdictions.map((item) => <td key={item.id}>{fit(item.id)}</td>)}</tr>
      <tr><th scope="row">Note</th>{jurisdictions.map((item) => <td key={item.id}>{note(item)}</td>)}</tr>
    </tbody></table>
    <div className={styles.mobileComparison}>{jurisdictions.map((item) => <article key={item.id} className="rounded-lg border border-line p-4"><h3 className="mb-4 font-medium">{names[item.id]}</h3><dl className="space-y-3 text-sm"><div><dt className="mb-1 text-xs text-ink-muted">3-year cost (estimate)</dt><dd>{cost(item.id)}</dd></div><div><dt className="mb-1 text-xs text-ink-muted">Fits you?</dt><dd>{fit(item.id)}</dd></div><div><dt className="sr-only">Note</dt><dd>{note(item)}</dd></div></dl></article>)}</div>
    <p className="mt-5 text-xs leading-5 text-ink-muted">Unknown costs are excluded from totals. Incentives and eligibility need confirmation with each authority.</p>
  </section>;
}
