"""Transcribe the supplied specification, preserving its numbers and uncertainty."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = (ROOT / "MANZIL-CODEX-BUILD-SPEC.md").read_text(encoding="utf-8")
VERIFIED = "2026-10-02"


def rows(start, end):
    section = SPEC.split(start, 1)[1].split(end, 1)[0]
    return [[cell.strip() for cell in line.strip().strip("|").split("|")]
            for line in section.splitlines() if line.startswith("| ")][1:]


def write(name, data):
    folder = ROOT / "data"
    folder.mkdir(exist_ok=True)
    (folder / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def truthy(field):
    return {"field": field, "op": "truthy"}


TAMM = "https://www.tamm.abudhabi/"
ICP = "https://icp.gov.ae/"
authorities = {
    "A-ENTRY": ("ICP", ICP), "A-STAY": ("Accommodation provider", TAMM),
    "A-SIM": ("Mobile service provider", TAMM),
    "C-JURIS": ("ADDED / free-zone authority", TAMM), "C-ACT": ("ADDED / free-zone authority", TAMM),
    "C-NAME": ("ADDED / free-zone authority", TAMM), "C-OFFICE": ("ADDED / free-zone authority", TAMM),
    "C-CONST": ("ADDED / registrar", TAMM), "C-LIC": ("ADDED / free-zone authority", TAMM),
    "C-EST": ("ICP / free-zone authority", ICP), "C-CT": ("FTA (EmaraTax)", "https://eservices.tax.gov.ae/"),
    "C-BANK": ("Chosen bank", TAMM), "C-HUB71": ("Hub71", "https://www.hub71.com/program/hub71-plus-ai"),
    "R-INS": ("DoH", "https://www.doh.gov.ae/"), "R-MED": ("DoH", "https://www.doh.gov.ae/"),
    "R-DL": ("Abu Dhabi Mobility / TAMM", TAMM), "H-PBANK": ("Chosen bank", TAMM),
    "H-LEASE": ("Landlord / ADREC", TAMM), "H-TAWTH": ("ADREC / TAMM", TAMM),
    "H-UTIL": ("ADDC / AADC", TAMM), "H-NET": ("e& / du", TAMM),
    "F-ATTEST": ("Home-country authority / UAE MOFA", "https://www.mofa.gov.ae/"),
    "F-INS": ("DoH", "https://www.doh.gov.ae/"), "F-SCHOOL": ("ADEK-licensed school", "https://www.adek.gov.ae/"),
    "O-BOOKS": ("Founder / accountant", TAMM), "O-VATWATCH": ("FTA", "https://tax.gov.ae/"),
    "O-HIRE": ("MOHRE / free-zone authority", "https://www.mohre.gov.ae/"),
    "O-EINV": ("MoF / FTA", "https://mof.gov.ae/"), "O-ADGMCAL": ("ADGM Registration Authority", "https://www.adgm.com/"),
}
sources = {
    "C-LIC": ("https://ancova-associates.com/", "medium"),
    "C-HUB71": ("https://www.hub71.com/program/hub71-plus-ai", "high"),
    "R-INS": ("https://hayah.com/", "medium"), "R-DL": ("https://gulfnews.com/", "medium"),
    "H-TAWTH": ("https://www.bayut.com/", "medium"), "H-UTIL": ("https://www.modon.com/", "medium"),
}
rule_links = {"C-CONST": ["UBO-MAINT"], "C-CT": ["CT-REG"], "O-VATWATCH": ["VAT-REG"],
              "O-EINV": ["EINV-P1-ASP", "EINV-P2"], "O-ADGMCAL": ["ADGM-CS", "ADGM-ACC", "ADGM-RENEW"]}
prearrival = {"C-JURIS", "C-ACT", "C-NAME", "F-ATTEST", "F-SCHOOL"}
steps = []
for sid, title, lane, applies, dependencies, duration, cost, notes in rows("## 9.", "## 10."):
    likely, minimum, maximum = map(int, re.findall(r"\d+", duration))
    authority, official = authorities.get(sid, ("ICP", ICP))
    step = {"id": sid, "title": title, "lane": lane, "authority": authority,
            "description": re.sub(r"[*`]", "", notes) or title,
            "dependsOn": [] if dependencies == "—" else dependencies.split(", "),
            "durationDays": {"min": minimum, "likely": likely, "max": maximum},
            "costAED": None if cost == "null" else {"min": int(cost), "max": int(cost)},
            "documents": [], "officialUrl": official, "ruleIds": rule_links.get(sid, []),
            "confidence": "low", "verify": True}
    if applies != "—":
        step["appliesIf"] = truthy(applies.strip("`"))
    if sid in prearrival:
        step["canStartBeforeArrival"] = True
    if sid in sources:
        source, confidence = sources[sid]
        step.update(sourceUrl=source, verifiedOn=VERIFIED, confidence=confidence)
    if sid == "C-HUB71":
        step["verify"] = False
    if sid == "F-SCHOOL":
        step["description"] = "Start the school application before arrival. Final enrolment typically needs the child's Emirates ID."
    steps.append(step)
write("steps.json", steps)

triggers = {
    "CT-REG": {"type": "from_date", "field": "incorporationDate", "offsetMonths": 3},
    "CT-RET": {"type": "from_date", "field": "incorporationDate", "offsetMonths": 21},
    "VAT-REG": {"type": "threshold", "field": "revenue12mAED", "threshold": 375000, "offsetDays": 30},
    "EINV-P1-ASP": {"type": "fixed_date", "date": "2026-10-30"},
    "EINV-P1-LIVE": {"type": "fixed_date", "date": "2027-01-01"},
    "EINV-P2": {"type": "fixed_date", "date": "2027-07-01"},
    "ADGM-CS": {"type": "recurring", "field": "incorporationDate", "offsetMonths": 13, "every": "year"},
    "ADGM-ACC": {"type": "from_date", "field": "incorporationDate", "offsetMonths": 21},
    "ADGM-RENEW": {"type": "recurring", "field": "incorporationDate", "offsetMonths": 12, "every": "year"},
    "HI-RENEW": {"type": "recurring", "field": "arrivalDate", "offsetMonths": 12, "every": "year"},
    "VISA-RENEW": {"type": "from_date", "field": "arrivalDate", "offsetMonths": 24, "offsetDays": -30},
    "TAWTH-RENEW": {"type": "recurring", "field": "arrivalDate", "offsetMonths": 12, "every": "year"},
    "WPS": {"type": "recurring", "field": "incorporationDate", "every": "month"},
}
penalties = {"CT-REG": 10000, "VAT-REG": 10000, "UBO-MAINT": 50000, "GOAML": 50000}
usd = {"ADGM-CS": 300, "ADGM-ACC": 15000, "ADGM-RENEW": 150}
rule_rows = rows("## 10.", "### `data/jurisdictions.json`")
ey_source = next(row[6] for row in rule_rows if row[0] == "EINV-P1-LIVE")
rules = []
for rid, title, authority, applies, trigger_text, penalty, source, confidence, verify in rule_rows:
    trigger = triggers.get(rid, {"type": "none"})
    rule = {"id": rid, "title": title, "authority": authority,
            "kind": {"none": "info", "recurring": "recurring", "threshold": "threshold"}.get(trigger["type"], "deadline"),
            "trigger": trigger, "penaltyAED": penalties.get(rid),
            "sourceUrl": source if source.startswith("https://") else (ey_source if rid == "EINV-P2" else None),
            "verifiedOn": VERIFIED, "confidence": "medium" if rid == "CT-REG" else confidence.split(" ")[0],
            "verify": "true" in verify, "summary": f"{title}. {trigger_text}. Source: {source}."}
    if penalty != "—":
        rule["penaltyNote"] = penalty
    if rid in usd:
        rule.update(currency="USD", penaltyNative=usd[rid], penaltyAED=round(usd[rid] * 3.6725, 4))
    elif rid in penalties:
        rule["currency"] = "AED"
    if rid == "TAWTH-RENEW":
        rule["sourceUrl"] = "https://www.bayut.com/"
        # The AED 50 renewal fee is not a late-payment penalty.
        rule["penaltyAED"] = None
    if rid == "EINV-P2":
        rule["appliesIf"] = {"all": [truthy("revenueOverVAT"), {"not": truthy("einvPhase1")}]}
    elif rid == "GOAML":
        rule["appliesIf"] = truthy("isDnfbpActivity")
    elif applies.startswith("`"):
        rule["appliesIf"] = truthy(applies.strip("`"))
    rules.append(rule)
write("rules.json", rules)

fit_rules = {
    "adgm": [{"condition": {"field": "revenueModel", "op": "in", "value": ["saas", "services"]}, "message": "✓ common-law, investor-recognised; tech-startup licence"}],
    "hub71": [{"condition": {"field": "fundingUSD", "op": "gte", "value": 0}, "message": "⚠ selective programme: incentives not guaranteed"}],
    "kezad": [{"condition": {"field": "revenueModel", "op": "in", "value": ["manufacturing", "trading"]}, "message": "✓ industrial/logistics focus"}],
    "masdar": [{"condition": {"all": []}, "message": "✓ sustainability/tech focus"}],
    "twofour54": [{"condition": {"all": []}, "message": "✓ media/gaming focus"}],
}
jurisdictions = []
for jid, name, licence, office, setup, visa, source, notes in rows("### `data/jurisdictions.json`", "**If you have web access**"):
    jid = jid.strip("`")
    jurisdictions.append({"id": jid, "name": name, "licenceAEDPerYear": {"adgm": 5509, "mainland": 790}.get(jid),
                          "officeAEDPerYear": None, "setupOneOffAED": None, "visaAEDPerPerson": None,
                          "sourceUrl": {"adgm": "https://ancova-associates.com/", "mainland": "https://www.commenda.io/", "hub71": "https://www.hub71.com/"}.get(jid),
                          "verifiedOn": VERIFIED, "confidence": "high" if jid == "hub71" else ("medium" if jid in ["adgm", "mainland"] else "low"),
                          "verify": jid != "hub71", "notes": "" if notes == "—" else notes, "fitRules": fit_rules.get(jid, [])})
write("jurisdictions.json", jurisdictions)
write("activities.json", [{"id": aid.strip("`"), "revenueModels": models.split(", "), "dnfbp": dnfbp == "true"}
                          for aid, models, dnfbp in rows("### `data/activities.json`", "Activity names are generic")])

def persona(pid, name, nationality, business, model, **fields):
    # Only Priya's arrival is specified. Other personas share that demo date for required-schema completeness.
    return dict(id=pid, name=name, nationality=nationality, arrivalDate="2026-10-12", inUAE=False,
                spouse=False, childrenAges=[], businessDescription=business, revenueModel=model,
                fundingUSD=0, revenue12mAED=0, hires12m=0, stepStatus={}, documents=[], locale="en") | fields

write("personas.json", {
    "priya": persona("priya", "Priya", "India", "B2B SaaS for GCC clinics' appointment scheduling, clients in UAE and KSA, subscription revenue", "saas",
                     spouse=True, childrenAges=[7], activityCode="general-trading", fundingUSD=400000,
                     revenue12mAED=420000, hires12m=2, drivingLicenceCountry="India",
                     documents=[{"docType": doc} for doc in ["passport", "proof_of_address", "cv", "source_of_funds"]]),
    "omar": persona("omar", "Omar", "Egypt", "F&B restaurant", "fnb", jurisdiction="mainland", revenue12mAED=2500000, hires12m=6),
    "lena": persona("lena", "Lena", "Germany", "Climate-tech hardware", "manufacturing", jurisdiction="masdar", drivingLicenceCountry="Germany"),
})
countries = SPEC.split("### `data/licence-exchange.json`", 1)[1].split(". Source:", 1)[0].strip()
countries = countries.replace(", plus GCC states", "").split(", ")
write("licence-exchange.json", {"countries": countries + ["Bahrain", "Kuwait", "Oman", "Qatar", "Saudi Arabia", "United Arab Emirates"],
                               "sourceUrls": ["https://gulfnews.com/", "https://visasimplified.com/"],
                               "verifiedOn": VERIFIED, "confidence": "medium", "verify": True})
write("evals.json", [{"id": eid.split(" ")[0], "persona": person, "input": question.strip('"'),
                      "expectedStatuses": status.split(" or "), "must": must, "holdout": "holdout" in eid}
                     for eid, person, question, status, must in rows("## 12.", "## 13.")])
print(f"Wrote {len(steps)} steps, {len(rules)} rules, {len(jurisdictions)} jurisdictions, 12 activities, 3 personas, licence exchange and 9 evals.")
