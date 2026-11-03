"""Researcher profiles, college dashboards and identity labels (Sprint 1)."""

from ingest import clinical_trials, nih_reporter, nsf_awards, openalex
from ingest.load import merge
from tests.test_explore import client  # noqa: F401  (shared fixture)
from tests.test_new_sources import nih_record, trial
from tests.test_nsf_awards import award


def _db(client):
    return client.app.state.db


def test_researcher_profile_counts(client):
    p = client.get("/api/researchers/r-nih-10").json()
    direct = dict(_db(client).execute("""
        SELECT p.kind, COUNT(DISTINCT p.id) FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id = 'r-nih-10' GROUP BY p.kind""").fetchall())
    assert p["counts"] == {"grants": direct.get("award", 0), "trials": direct.get("trial", 0),
                           "publications": direct.get("publication", 0)}
    assert len(p["projects"]) == sum(direct.values())
    assert p["summary"].startswith("Listed on 2 grants and 1 clinical trial")


def test_every_profile_record_links_to_its_source(client):
    p = client.get("/api/researchers/r-nih-10").json()
    assert p["projects"] and all(r["project"]["source"]["url"].startswith("https://") for r in p["projects"])
    assert {s["label"] for s in p["sources"]} == {"NIH RePORTER", "ClinicalTrials.gov"}
    assert sum(s["records"] for s in p["sources"]) == len(p["projects"])


def test_profile_makes_no_unsupported_claims(client):
    p = client.get("/api/researchers/r-nih-10").json()
    assert p["verified"] is False
    assert "title" not in p  # no invented job title
    assert "faculty" not in (p["summary"] + p["about"] + p["identityNote"]).lower()
    assert "not been confirmed" in p["about"]


def test_researcher_missing_returns_404(client):
    assert client.get("/api/researchers/r-nope").status_code == 404
    assert client.get("/api/researchers/r-nope/projects").status_code == 404
    assert client.get("/api/researchers/r-nope/collaborators").status_code == 404
    # A researcher row with no records behind it is also a 404, not an empty profile.
    with _db(client) as conn:
        conn.execute("""INSERT INTO researchers (id, name, source, verification, updated_at, identity_confidence)
                        VALUES ('r-empty', 'No Records', 'nih-reporter', 'public-award-record', '', 'high')""")
    assert client.get("/api/researchers/r-empty").status_code == 404


def test_name_merges_are_labeled_low_confidence_with_evidence(client):
    p = client.get("/api/researchers/r-nih-10").json()  # NIH PI + same-name ClinicalTrials.gov official
    assert p["identityConfidence"] == "low"
    assert "may belong to a different person" in p["identityNote"]
    evidence = {(a["source"], a["evidence"]) for a in p["aliases"]}
    assert evidence == {("NIH RePORTER", "source-person-id"), ("ClinicalTrials.gov", "same-name-across-sources")}


def test_identity_confidence_levels(client):
    levels = dict(_db(client).execute("SELECT id, identity_confidence FROM researchers").fetchall())
    assert levels["r-nsf-270133627"] == "high"  # NSF PI with an NSF person ID
    assert levels["r-nsf-richard-souvenir"] == "medium"  # NSF co-PI, name only
    assert levels["r-oa-A1"] == "high"  # OpenAlex author ID


def test_merge_keeps_every_source_identity():
    nih = nih_reporter.normalize([nih_record()])
    ct = clinical_trials.normalize([trial()], 2022)
    data = merge([nih, ct])
    aliases = {a["source_researcher_id"]: a for a in data["researcher_aliases"]}
    assert set(aliases) == {"r-nih-10", "r-ct-domenico-pratico"}
    assert {a["researcher_id"] for a in aliases.values()} == {"r-nih-10"}
    assert aliases["r-ct-domenico-pratico"]["source_name"] == "Domenico Pratico"


def test_same_name_in_one_source_stays_separate():
    # Two NSF PIs with the same name but different NSF person IDs are different people.
    data = merge([nsf_awards.normalize([
        award(id="1", piFirstName="Alex", piLastName="Chen", piId="501", coPDPI=[]),
        award(id="2", piFirstName="Alex", piLastName="Chen", piId="502", coPDPI=[]),
    ])])
    assert {r["id"] for r in data["researchers"] if r["name"] == "Alex Chen"} == {"r-nsf-501", "r-nsf-502"}


def test_collaborators_cite_shared_records(client):
    rows = client.get("/api/researchers/r-nsf-270133627/collaborators").json()
    assert [r["researcherId"] for r in rows] == ["r-nsf-richard-souvenir"]
    assert rows[0]["projectIds"] == ["nsf-2622544"] and rows[0]["sharedRecords"] == 1
    assert rows[0]["crossCollege"] is False  # both engineering


def test_college_totals_match_overview(client):
    overview = {c["college"]: c for c in client.get("/api/overview").json()["byCollege"]}
    listed = {c["id"]: c for c in client.get("/api/colleges").json()}
    assert len(listed) == 8  # every college, including empty ones
    for cid, stat in overview.items():
        for key in ("awards", "active", "funding", "trials", "publications"):
            assert listed[cid][key] == stat[key], (cid, key)
        assert client.get(f"/api/colleges/{cid}").json()["college"] == listed[cid]


def test_college_dashboard(client):
    d = client.get("/api/colleges/medicine").json()
    assert d["college"]["awards"] == 1  # the center-grant component is not counted again
    assert sum(y["nih"] + y["nsf"] + y["other"] for y in d["trend"]) == d["college"]["funding"]
    assert d["fundingYears"] == [d["trend"][0]["fiscalYear"], d["trend"][-1]["fiscalYear"]]
    assert {t["id"] for t in d["topics"]} == {"aging", "addiction"}
    assert [r["researcherId"] for r in d["researchers"]] == ["r-nih-10"]


def test_empty_college_and_unknown_college(client):
    d = client.get("/api/colleges/media").json()
    assert d["college"]["awards"] == 0 and d["trend"] == [] and d["fundingYears"] == [] and d["recent"] == []
    assert client.get("/api/colleges/nowhere").status_code == 404
    assert client.get("/api/colleges/nowhere/projects").status_code == 404


def test_college_projects_use_search_filters(client):
    r = client.get("/api/colleges/medicine/projects").json()
    direct = client.get("/api/search?college=medicine").json()
    assert r["total"] == direct["total"] == 2  # one grant and one trial


def test_indexes_exist(client):
    names = {r[0] for r in _db(client).execute("SELECT name FROM sqlite_master WHERE type = 'index'")}
    assert {"idx_project_team_researcher", "idx_project_team_project", "idx_project_colleges_college",
            "idx_project_topics_topic", "idx_projects_kind_active", "idx_projects_updated"} <= names
