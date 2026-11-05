from app.db import _TABLES, _pg, connect, init_schema
from ingest.load import search_text


def test_placeholders_and_percent_signs_are_translated_outside_strings():
    assert _pg("SELECT * FROM t WHERE a = ? AND b LIKE ?") == "SELECT * FROM t WHERE a = %s AND b LIKE %s"
    assert _pg("SELECT '?', 'it''s 100%' WHERE x = ?") == "SELECT '?', 'it''s 100%' WHERE x = %s"
    assert _pg("SELECT 5 % 2 WHERE x = ?") == "SELECT 5 %% 2 WHERE x = %s"


def test_rows_read_by_position_and_name():
    conn = connect()
    row = conn.execute("SELECT 1 AS a, 'x' AS b, ? AS c", (3,)).fetchone()
    assert row[0] == 1 and row["b"] == "x" and row["c"] == 3
    assert dict(row) == {"a": 1, "b": "x", "c": 3}


def test_sums_of_bigint_come_back_as_int():
    conn = connect()
    value = conn.execute("SELECT SUM(x) FROM (VALUES (5000000000::bigint), (1::bigint)) AS v(x)").fetchone()[0]
    assert value == 5000000001 and type(value) is int


def test_every_table_has_row_level_security():
    """Supabase's Data API would otherwise serve these tables to anyone holding the anon key."""
    conn = connect()
    init_schema(conn)
    secured = {r[0] for r in conn.execute(
        "SELECT relname FROM pg_class WHERE relrowsecurity AND relnamespace = current_schema()::regnamespace")}
    assert set(_TABLES) | {"schema_meta"} <= secured


def test_search_text_matches_sqlite_tokenizer():
    assert search_text("Praticò") == "Pratico"
    assert search_text("infection/disease, 14-19 COVID-19") == "infection disease 14 19 COVID 19"


def test_search_ranks_records_with_every_word_first_and_ignores_accents():
    from app import queries
    from ingest.load import load, merge
    from ingest.nih_reporter import normalize
    from tests.test_nih_reporter import record

    conn = connect()
    init_schema(conn)
    load(conn, merge([normalize([
        # "learning" many times but never "machine": matches the query, ranks below the record with both words
        record(appl_id=1, core_project_num="R01AG000001", project_title="Learning, learning and more learning",
               abstract_text="Learning learning learning.", phr_text="", pref_terms="",
               principal_investigators=[{"profile_id": 12, "first_name": "LEE", "middle_name": "",
                                         "last_name": "SMITH", "is_contact_pi": True}]),
        record(appl_id=2, core_project_num="R01AG000002", project_title="Machine learning for imaging",
               abstract_text="A short abstract.", phr_text="", pref_terms="",
               principal_investigators=[{"profile_id": 11, "first_name": "ANA", "middle_name": "",
                                         "last_name": "PRATICÒ", "is_contact_pi": True}]),
    ])]))
    results = queries.search(conn, "machine learning").results
    assert [r.id for r in results] == ["nih-R01AG000002", "nih-R01AG000001"]
    assert [r.id for r in queries.search(conn, "pratico").results] == ["nih-R01AG000002"]


def test_college_vote_ties_do_not_depend_on_the_process():
    """A researcher on one record listed under two colleges: the tie must resolve the same way in every process
    (it used to follow set order, which Python randomizes per process)."""
    import subprocess
    import sys

    script = """
from ingest.load import finalize
data = {"projects": [{"id": "p1", "source": "openalex", "department": None, "title": "x", "terms": ""}],
        "project_colleges": [{"project_id": "p1", "college": c} for c in ("science-tech", "engineering", "medicine")],
        "project_team": [{"project_id": "p1", "researcher_id": "r1"}],
        "researchers": [{"id": "r1", "college": None}], "project_areas": []}
print(finalize(data)["researchers"][0]["college"])
"""
    results = {subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, check=True,
                              env={"PYTHONHASHSEED": str(seed), "PYTHONPATH": "."}).stdout.strip()
               for seed in range(8)}
    assert results == {"engineering"}
