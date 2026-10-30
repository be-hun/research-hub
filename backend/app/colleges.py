"""Map NIH organization type and department to the frontend's CollegeId values.

NIH does not report which Temple college an award belongs to, only an organization
type (e.g. "SCHOOLS OF MEDICINE") and a department. Edit these tables to change
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
}

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


def college_for(org_type: str | None, department: str | None) -> str | None:
    """Return a CollegeId, or None when NIH gives nothing to map (e.g. university-wide awards)."""
    if department and department in DEPARTMENT_TO_COLLEGE:
        return DEPARTMENT_TO_COLLEGE[department]
    return ORG_TYPE_TO_COLLEGE.get(org_type or "")
