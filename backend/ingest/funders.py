"""Sort a funder or sponsor into a funding type, from its name plus whatever the source tells us.

The categories are deliberately coarse, and they are inferred from names: the About page says so.
Rules run in order; the first that matches wins.
"""

import re

CATEGORIES = {
    "federal": "U.S. federal government",
    "industry": "Industry",
    "foundation": "Foundations & nonprofits",
    "temple": "Temple University",
    "academic": "Other universities & hospitals",
    "government": "State & international government",
    "other": "Other",
}

US_FEDERAL = re.compile(
    r"national institutes? (of|on|for)|national science foundation|national cancer institute|national eye institute|"
    r"national library of medicine|national center for|national heart|national human genome|"
    r"department of (defense|energy|education|justice|agriculture|veterans|health and human|homeland|transportation|"
    r"the interior|commerce|state)|u\.s\.|united states|\bnasa\b|national aeronautics|army|navy|air force|darpa|"
    r"centers for disease|agency for healthcare|food and drug administration|environmental protection agency|"
    r"national endowment|office of naval|health resources and services|substance abuse and mental health|"
    r"national laborator|office of science|basic energy sciences|high energy physics|nuclear physics|"
    r"national energy research|^division of|laboratory directed research|accelerator facility|technologies office|"
    r"\bnih\b|\bnsf\b|\bdod\b|\bdoe\b|eunice kennedy shriver|fogarty|smithsonian|national oceanic|institute of education sciences|"
    r"\bnhlbi\b|intramural research|health services research and development",
    re.IGNORECASE,
)
FOREIGN_GOVERNMENT = re.compile(
    r"national|council|ministry|ministerio|ministero|minist[eè]re|bundes|government|federal|promotion of science|"
    r"forschungsgemeinschaft|research foundation|central universities|agence|state|province|european",
    re.IGNORECASE,
)
GOVERNMENT = re.compile(r"ministry|ministerio|ministero|minist[eè]re|government|european commission|"
                        r"commonwealth of|department of health|state of|school district|city of|county\b|horizon 2020|h2020|"
                        r"framework programme|nextgenerationeu|european research council|horizon europe",
                        re.IGNORECASE)
FOUNDATION = re.compile(r"foundation|society|association|fund\b|trust\b|alliance|charit|philanthrop|"
                        r"american heart|american cancer|alzheimer|march of dimes|oncology group|research network|"
                        r"cooperative group|psychiatric institute|associazione|fondazione|fundaci[oó]n|stiftung|science advancement|"
                        r"patient-centered outcomes|research to prevent blindness|battelle",
                        re.IGNORECASE)
INDUSTRY = re.compile(
    r"\b(inc|llc|ltd|limited|corp|corporation|company|co\.|gmbh|ag|s\.a\.|plc|pharma\w*|therapeutics|biosciences|"
    r"biotech\w*|biopharma\w*|laboratories|labs|technologies|medical devices|diagnostics|holdings|"
    # Well-known companies usually named without a corporate suffix.
    r"pfizer|genentech|sanofi|amgen|gilead|sunovion|merck|astrazeneca|bristol.myers|janssen|johnson & johnson|"
    r"abbvie|roche|bayer|biogen|novartis|glaxosmithkline|gsk|takeda|moderna|regeneron|lilly|boehringer|"
    r"novo nordisk|medtronic|boston scientific|abbott|ibm|google|microsoft|amazon|nvidia|intel)\b",
    re.IGNORECASE,
)
ACADEMIC = re.compile(r"universit|college|hospital|medical center|medical school|health system|health care|healthcare|"
                      r"school of|institute of technology|cancer center|research cent(er|re)|clinic\b|\bhealth$",
                      re.IGNORECASE)


def classify(name: str, sponsor_class: str | None = None, country: str | None = None) -> str:
    """Return a key of CATEGORIES.

    sponsor_class: ClinicalTrials.gov sponsor class (INDUSTRY, NIH, FED, OTHER_GOV, NETWORK, INDIV, OTHER).
    country: ISO country code where the source provides one (OpenAlex funders).
    """
    n = name or ""
    foreign = bool(country) and country != "US"
    if "temple univ" in n.lower() or "temple health" in n.lower():
        return "temple"
    if sponsor_class == "INDUSTRY":
        return "industry"
    if sponsor_class in ("NIH", "FED") or (not foreign and US_FEDERAL.search(n)):
        return "federal"
    if sponsor_class == "OTHER_GOV" or GOVERNMENT.search(n) or (foreign and FOREIGN_GOVERNMENT.search(n)):
        return "government"
    if FOUNDATION.search(n):
        return "foundation"  # before the company check: "Research Foundation for Mental Hygiene, Inc." is a nonprofit
    if INDUSTRY.search(n):
        return "industry"
    if ACADEMIC.search(n):
        return "academic"
    if foreign:
        return "government"  # unmatched foreign funders are overwhelmingly public research agencies
    return "other"
