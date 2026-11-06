from datetime import date

from app.topics import topics_from_text
from ingest import clinical_trials, nih_reporter, openalex, usaspending
from ingest.funders import classify
from ingest.load import merge
from tests.test_nih_reporter import record as nih_record


def trial(**overrides) -> dict:
    p = {
        "identificationModule": {"nctId": "NCT01234567", "briefTitle": "Ketamine for Opioid Withdrawal"},
        "statusModule": {"overallStatus": "RECRUITING", "startDateStruct": {"date": "2025-03-01"},
                         "completionDateStruct": {"date": "2027-06"}, "lastUpdatePostDateStruct": {"date": "2026-05-01"}},
        "sponsorCollaboratorsModule": {"leadSponsor": {"name": "Temple University", "class": "OTHER"},
                                       "collaborators": [{"name": "Pfizer", "class": "INDUSTRY"}]},
        "descriptionModule": {"briefSummary": "This study tests ketamine for opioid withdrawal. It is randomized."},
        "conditionsModule": {"conditions": ["Opioid Use Disorder"], "keywords": ["withdrawal"]},
        "designModule": {"studyType": "INTERVENTIONAL", "phases": ["PHASE2"]},
        "armsInterventionsModule": {"interventions": [{"name": "Ketamine"}]},
        "contactsLocationsModule": {
            "overallOfficials": [{"name": "Domenico Pratico, MD, PhD", "affiliation": "Temple University",
                                  "role": "PRINCIPAL_INVESTIGATOR"}],
            "locations": [{"facility": "Temple University Hospital", "city": "Philadelphia"}],
        },
    }
    for key, value in overrides.items():
        p[key] = value
    return {"protocolSection": p}


def work(**overrides) -> dict:
    w = {
        "id": "https://openalex.org/W1", "doi": "https://doi.org/10.1/abc", "title": "Cancer cell metabolism in mice",
        "publication_year": 2025, "publication_date": "2025-04-02",
        "primary_location": {"source": {"display_name": "Cell Reports"}},
        "authorships": [
            {"author": {"id": "https://openalex.org/A1", "display_name": "Ana Lopez"},
             "institutions": [{"id": "https://openalex.org/I84392919", "lineage": ["https://openalex.org/I84392919"]}],
             "raw_affiliation_strings": ["Department of Biology, College of Science and Technology, Temple University"]},
            {"author": {"id": "https://openalex.org/A2", "display_name": "Outside Person"},
             "institutions": [{"id": "https://openalex.org/I1", "lineage": ["https://openalex.org/I1"]}],
             "raw_affiliation_strings": ["University of Elsewhere"]},
        ],
        "primary_topic": {"display_name": "Cancer metabolism", "subfield": {"display_name": "Oncology"},
                          "field": {"display_name": "Medicine"}},
        "keywords": [], "abstract_inverted_index": {"Tumors": [0], "grow.": [1]},
        "funders": [{"id": "https://openalex.org/F1", "display_name": "American Cancer Society"},
                    {"id": "https://openalex.org/F2", "display_name": "National Natural Science Foundation of China"}],
        "updated_date": "2026-01-01T00:00:00",
    }
    w.update(overrides)
    return w


OPENALEX_FUNDERS = {"F1": {"country_code": "US"}, "F2": {"country_code": "CN"}}


def usa_award(**overrides) -> dict:
    a = {
        "Award ID": "W911NF2120007", "Description": "BATTERY MATERIALS FOR SOLDIERS - THIS PROJECT STUDIES BATTERIES.",
        "Awarding Agency": "Department of Defense", "Awarding Sub Agency": "Department of the Army",
        "Start Date": "2023-01-04", "End Date": "2027-10-03", "Award Amount": 1000000.0,
        "Assistance Listings": [{"cfda_number": "12.431", "cfda_program_title": "BASIC SCIENTIFIC RESEARCH"}],
        "generated_internal_id": "ASST_NON_W911NF2120007_097",
        "_transactions": [{"action_date": "2023-01-04", "amount": 600000.0}, {"action_date": "2024-11-01", "amount": 400000.0}],
    }
    a.update(overrides)
    return a


def test_clinical_trial_normalize():
    data = clinical_trials.normalize([trial(), trial(identificationModule={"nctId": "NCT9", "briefTitle": "Elsewhere"},
                                                     sponsorCollaboratorsModule={"leadSponsor": {"name": "Baylor", "class": "OTHER"}},
                                                     contactsLocationsModule={"locations": [{"facility": "Baylor Temple", "city": "Temple"}]})], 2022)
    (p,) = data["projects"]  # the Texas "Temple" site is not Temple University
    assert p["id"] == "ct-NCT01234567" and p["kind"] == "trial" and p["status_label"] == "Recruiting"
    assert p["is_active"] == 1 and p["activity_code"] == "Phase 2"
    assert [(f["name"], f["category"]) for f in data["project_funders"]] == [("Temple University", "temple"), ("Pfizer", "industry")]
    assert data["project_team"][0]["name"] == "Domenico Pratico"
    assert data["project_colleges"] == [{"project_id": "ct-NCT01234567", "college": "medicine"}]


def test_old_completed_trials_are_skipped():
    old = trial(statusModule={"overallStatus": "COMPLETED", "completionDateStruct": {"date": "2015-01"},
                              "lastUpdatePostDateStruct": {"date": "2016-01-01"}})
    assert clinical_trials.normalize([old], 2022)["projects"] == []


def test_openalex_normalize():
    data = openalex.normalize({"works": [work()], "funders": OPENALEX_FUNDERS})
    (p,) = data["projects"]
    assert p["kind"] == "publication" and p["status_label"] == "Published 2025" and p["abstract"] == "Tumors grow."
    assert p["award_number"] == "10.1/abc" and p["agency"] == "Cell Reports"
    assert [f["category"] for f in data["project_funders"]] == ["foundation", "government"]
    assert [t["name"] for t in data["project_team"]] == ["Ana Lopez"]  # only Temple authors
    assert data["project_colleges"] == [{"project_id": "pub-W1", "college": "science-tech"}]


def test_openalex_prefers_full_raw_author_name():
    paper = work()
    paper["authorships"][0]["author"]["display_name"] = "X. Grace"
    paper["authorships"][0]["raw_author_name"] = "Grace X. Ma"
    data = openalex.normalize({"works": [paper], "funders": OPENALEX_FUNDERS})
    assert data["project_team"][0]["name"] == "Grace X. Ma"


def test_usaspending_keeps_research_and_yearly_money():
    keep = usa_award()
    nih = usa_award(**{"Award ID": "R01X", "Awarding Sub Agency": "National Institutes of Health",
                       "generated_internal_id": "ASST_2"})
    pell = usa_award(**{"Award ID": "P063", "generated_internal_id": "ASST_3",
                        "Assistance Listings": [{"cfda_program_title": "FEDERAL PELL GRANT PROGRAM"}]})
    data = usaspending.normalize([keep, nih, pell], 2022, today=date(2026, 10, 30))
    (p,) = data["projects"]
    assert p["agency"] == "DOD" and p["title"] == "Battery Materials for Soldiers" and p["is_active"] == 1
    assert [(y["fiscal_year"], y["award_amount"]) for y in data["award_years"]] == [(2023, 600000), (2025, 400000)]


def test_usaspending_title_is_a_short_sentence_and_restores_acronyms():
    award = usa_award(**{
        "Description": "A VERY LONG NASA AI RESEARCH TITLE THAT SHOULD BE SHORTENED AT A WORD BOUNDARY "
        "BEFORE IT BECOMES TOO LONG AND KEEP GOING WITH MORE WORDS FOR THE DEMONSTRATION. "
        "This is the full abstract.",
    })
    (project,) = usaspending.normalize([award], 2022)["projects"]
    assert project["title"].endswith("…")
    assert len(project["title"]) <= 121
    assert "NASA" in project["title"] and "AI" in project["title"]
    assert project["abstract"].endswith("full abstract.")


def test_funder_classification():
    assert classify("Pfizer") == "industry"
    assert classify("Research Foundation for Mental Hygiene, Inc.") == "foundation"
    assert classify("National Institute on Drug Abuse") == "federal"
    assert classify("Japan Society for the Promotion of Science", country="JP") == "government"
    assert classify("University of Pennsylvania") == "academic"
    assert classify("Temple University Hospital") == "temple"


def test_keyword_topics():
    assert topics_from_text("Ketamine for Opioid Withdrawal", "Opioid Use Disorder") == ["addiction"]
    assert topics_from_text("Stem cell therapy", "") == []  # 'stem' alone is not STEM education
    assert topics_from_text("Untitled", "") == []
    assert topics_from_text("Computed Tomography", "computed tomography") == []


def test_merge_matches_people_across_sources_and_assigns_topics():
    nih = nih_reporter.normalize([nih_record()])  # PI Domenico Pratico, medicine
    ct = clinical_trials.normalize([trial()], 2022)
    data = merge([nih, ct])
    assert {t["researcher_id"] for t in data["project_team"]} == {"r-nih-10"}
    assert {"project_id": "ct-NCT01234567", "topic_id": "addiction", "method": "keywords"} in data["project_topics"]
    assert {"project_id": "nih-R01AG000001", "topic_id": "aging", "method": "funder"} in data["project_topics"]
