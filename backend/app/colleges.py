"""Map NIH organization type and department to the frontend's CollegeId values.

NIH does not report which Temple college an award belongs to, only an organization
type (e.g. "SCHOOLS OF MEDICINE") and a department. Edit these tables to change
the mapping. Entries marked APPROX have no matching CollegeId yet and use the nearest one.
"""

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


def college_for(org_type: str | None, department: str | None) -> str | None:
    """Return a CollegeId, or None when NIH gives nothing to map (e.g. university-wide awards)."""
    if department and department in DEPARTMENT_TO_COLLEGE:
        return DEPARTMENT_TO_COLLEGE[department]
    return ORG_TYPE_TO_COLLEGE.get(org_type or "")
