from ingest import nih_reporter, nsf_awards
from ingest.load import merge
from tests.test_nih_reporter import record as nih_record


def award(**overrides) -> dict:
    base = {
        "id": "2622544",
        "title": "Metastability in Nanostructured Metal Oxides",
        "abstractText": "Reliable energy storage is essential. This project studies oxides.\r\n\r\n"
                        "This award reflects NSF's statutory mission and has been deemed worthy of support.",
        "startDate": "10/01/2024",
        "expDate": "09/30/2027",
        "fundsObligatedAmt": "300000",
        "fundsObligated": ["FY 2024 = $166,775.00", "FY 2025 = $133,225.00"],
        "piFirstName": "Mark",
        "piLastName": "DelloStritto",
        "piId": "270133627",
        "coPDPI": ["Richard Souvenir souvenir@temple.edu"],
        "dirAbbr": "ENG",
        "divAbbr": "CBET",
        "orgLongName": "Directorate for Engineering",
        "orgLongName2": "Chemical, Bioengineering, Environmental, & Transport Systems",
        "fundProgramName": "EchemS-Electrochemical Systems",
        "program": "Artificial Intelligence (AI), PHYSICS OF THE UNIVERSE",
        "transType": "Standard Grant",
        "latestAmendmentDate": "08/04/2025",
        "activeAwd": "true",
    }
    return {**base, **overrides}


def test_normalize_award():
    data = nsf_awards.normalize([award(), award()])  # duplicates from paging are dropped
    (p,) = data["projects"]
    assert p["id"] == "nsf-2622544" and p["funder"] == "NSF CBET" and p["verification"] == "public-award-record"
    assert "statutory mission" not in p["abstract"]
    assert p["summary"].startswith("Reliable energy storage")
    assert (p["latest_fy"], p["latest_amount"], p["is_active"]) == (2025, 133225, 1)
    assert p["source_url"].endswith("AWD_ID=2622544")
    assert [y["fiscal_year"] for y in data["award_years"]] == [2024, 2025]
    assert data["project_colleges"] == [{"project_id": "nsf-2622544", "college": "engineering"}]
    assert data["project_areas"] == [{"project_id": "nsf-2622544", "area_id": "nsf-cbet"}]


def test_co_pi_emails_are_not_stored():
    data = nsf_awards.normalize([award()])
    assert [(t["name"], t["role"]) for t in data["project_team"]] == [("Mark DelloStritto", "PI"), ("Richard Souvenir", "Co-PI")]
    assert not any("@" in str(v) for r in data["researchers"] for v in r.values())


def test_co_pi_reuses_id_when_they_lead_another_award():
    data = nsf_awards.normalize([
        award(),
        award(id="2600001", piFirstName="Richard", piLastName="Souvenir", piId="111", coPDPI=[]),
    ])
    ids = {t["researcher_id"] for t in data["project_team"] if t["name"] == "Richard Souvenir"}
    assert ids == {"r-nsf-111"}


def test_same_person_in_nih_and_nsf_is_merged():
    nih = nih_reporter.normalize([nih_record()])  # PI Domenico Pratico, medicine
    nsf = nsf_awards.normalize([award(dirAbbr="SBE", piFirstName="Domenico", piLastName="Pratico", coPDPI=[])])
    data = merge([nih, nsf])
    assert [r["id"] for r in data["researchers"]] == ["r-nih-10"]
    assert {t["researcher_id"] for t in data["project_team"]} == {"r-nih-10"}
    # SBE has no college mapping, so the award takes the PI's college from NIH.
    assert {"project_id": "nsf-2622544", "college": "medicine"} in data["project_colleges"]


def test_department_college_outranks_directorate_guess():
    nih = nih_reporter.normalize([nih_record()])  # medicine, from a named department
    nsf = nsf_awards.normalize([
        award(id=str(i), dirAbbr="EDU", piFirstName="Domenico", piLastName="Pratico", coPDPI=[]) for i in range(3)
    ])
    data = merge([nih, nsf])
    assert data["researchers"][0]["college"] == "medicine"
