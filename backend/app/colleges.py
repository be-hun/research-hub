"""Map what each source says about a record to the frontend's CollegeId values.

NIH reports an organization type (e.g. "SCHOOLS OF MEDICINE") and a department, NSF only the
funding directorate, and publications and trials an affiliation string. Edit these tables to change
the mapping. Entries marked APPROX have no matching CollegeId yet and use the nearest one.
"""

COLLEGE_NAMES = {
    "medicine": "Lewis Katz School of Medicine",
    "public-health": "College of Public Health",
    "science-tech": "College of Science & Technology",
    "engineering": "College of Engineering",
    "education": "College of Education & Human Development",
    "business": "Fox School of Business",
    "media": "Klein College of Media and Communication",
    "liberal-arts": "College of Liberal Arts",
}

# Affiliation text (publications, trial officials) names the Temple unit directly. First match wins,
# so the most specific phrases come first. Entries marked APPROX use the nearest CollegeId.
AFFILIATION_TO_COLLEGE = [
    ("college of liberal arts", "liberal-arts"),
    ("fox school", "business"),
    ("school of business", "business"),
    ("klein college", "media"),
    ("college of media", "media"),
    ("college of education", "education"),
    ("college of engineering", "engineering"),
    ("department of bioengineering", "engineering"),
    ("electrical and computer engineering", "engineering"),
    ("mechanical engineering", "engineering"),
    ("civil and environmental engineering", "engineering"),
    ("college of public health", "public-health"),
    ("school of social work", "public-health"),
    ("department of nursing", "public-health"),
    ("kinesiology", "public-health"),
    ("health and rehabilitation sciences", "public-health"),
    ("epidemiology and biostatistics", "public-health"),
    ("social and behavioral sciences", "public-health"),
    ("communication sciences and disorders", "public-health"),
    ("katz school of medicine", "medicine"),
    ("school of medicine", "medicine"),
    ("temple university hospital", "medicine"),
    ("fels cancer", "medicine"),
    ("sol sherry", "medicine"),
    ("center for substance abuse research", "medicine"),
    ("school of pharmacy", "medicine"),  # APPROX: no pharmacy CollegeId
    ("dentistry", "medicine"),  # APPROX: no dentistry CollegeId
    ("college of science and technology", "science-tech"),
    ("computer and information sciences", "science-tech"),
    ("department of physics", "science-tech"),
    ("department of chemistry", "science-tech"),
    ("department of biology", "science-tech"),
    ("department of mathematics", "science-tech"),
    ("earth and environmental science", "science-tech"),
]


def college_for_affiliation(text: str) -> str | None:
    """CollegeId named in an affiliation string, or None. Only Temple affiliations count."""
    t = (text or "").lower()
    if "temple" not in t:
        return None
    for phrase, college in AFFILIATION_TO_COLLEGE:
        if phrase in t:
            return college
    return None

# Department overrides win over organization type.
DEPARTMENT_TO_COLLEGE = {
    "ENGINEERING (ALL TYPES)": "engineering",
}

ORG_TYPE_TO_COLLEGE = {
    "SCHOOLS OF MEDICINE": "medicine",
    "SCHOOLS OF PUBLIC HEALTH": "public-health",
    "SCHOOLS OF SOCIAL WELFARE/WORK": "public-health",  # School of Social Work sits in the College of Public Health
    "BIOMED ENGR/COL ENGR/ENGR STA": "engineering",
    "SCHOOLS OF ARTS AND SCIENCES": "science-tech",  # APPROX for Psychology, which may be Liberal Arts
    "SCHOOLS OF PHARMACY": "medicine",  # APPROX: no pharmacy CollegeId
    "SCHOOLS OF DENTISTRY/ORAL HYGN": "medicine",  # APPROX: no dentistry CollegeId
}


# NSF names only the directorate that funded an award, not the Temple department.
NSF_DIRECTORATE_TO_COLLEGE = {
    "ENG": "engineering",
    "CSE": "science-tech",  # Computer & Information Sciences is in the College of Science and Technology
    "MPS": "science-tech",
    "BIO": "science-tech",
    "GEO": "science-tech",
    "EDU": "education",  # APPROX: some STEM-education awards are run from Science and Technology
    # SBE, TIP and O/D span several colleges; those awards take the college of the PI's other awards.
}

# USAspending names the awarding sub-agency and the assistance listing (program), never a Temple unit or person, so
# these awards can't take a college from their investigators. Map only programs whose Temple awards all sit in one
# college (checked against data/raw/usaspending_from2022.json). Mixed portfolios stay unassigned: Army, Navy and Air
# Force basic research, NIDILRR, Justice, State, the humanities and arts endowments, and the like. Matched in order,
# case-insensitively, against "<sub-agency> | <program titles>"; first match wins. Every entry is APPROX: the map
# names the college that runs that kind of work at Temple, not one named on the award.
USASPENDING_TO_COLLEGE = [
    ("military medical research and development", "medicine"),  # APPROX: DoD medical research; a few are rehab or behavioral
    ("dentistry", "medicine"),  # APPROX: no dentistry CollegeId (HRSA dental training)
    ("dental reimbursement", "medicine"),  # APPROX: no dentistry CollegeId (Ryan White dental program)
    ("centers for international business education", "business"),  # APPROX: the Fox School's CIBER
    ("education research, development and dissemination", "education"),  # APPROX: IES education research
    ("special education", "education"),  # APPROX
    ("teacher quality partnership", "education"),  # APPROX
    ("english language acquisition", "education"),  # APPROX
    ("improvement of postsecondary education", "education"),  # APPROX: teacher preparation (FIPSE)
    ("developmental disabilit", "education"),  # APPROX: Institute on Disabilities (a UCEDD) in Education
    ("acl assistive technology", "education"),  # APPROX: Institute on Disabilities' assistive technology program
    ("office of science financial assistance", "science-tech"),  # APPROX: DOE Office of Science physics and chemistry
    ("national aeronautics and space administration", "science-tech"),  # APPROX: NASA science
    ("animal and plant health inspection service", "science-tech"),  # APPROX: spotted lanternfly ecology and models
    ("national oceanic and atmospheric administration", "science-tech"),  # APPROX: ocean and climate science
]


def college_for_usaspending(sub_agency: str | None, programs: list[str]) -> str | None:
    """CollegeId for a USAspending award from its sub-agency and program titles, or None when they are ambiguous."""
    text = " | ".join([sub_agency or "", *programs]).lower()
    return next((college for phrase, college in USASPENDING_TO_COLLEGE if phrase in text), None)


def college_for(org_type: str | None, department: str | None) -> str | None:
    """Return a CollegeId, or None when NIH gives nothing to map (e.g. university-wide awards)."""
    if department and department in DEPARTMENT_TO_COLLEGE:
        return DEPARTMENT_TO_COLLEGE[department]
    return ORG_TYPE_TO_COLLEGE.get(org_type or "")
