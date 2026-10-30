"""Grounded assistant: retrieve stored records, let the model answer only from them, keep only real citations."""

import sqlite3

from app import ai, models, queries

MAX_RECORDS = 8
NOTHING_FOUND = (
    "I couldn't find any Temple research records that match that question. "
    "Try different keywords, a research topic, or an investigator's name."
)
UNGROUNDED = (
    "I found related records but couldn't answer from them with confidence. "
    "Try asking about a specific topic, project, or investigator."
)

SYSTEM = """You answer questions about research at Temple University using only the numbered records \
provided in the latest user message. Each record is one of: a grant (NIH, NSF or another federal agency), \
a clinical trial (ClinicalTrials.gov) or a funded publication (OpenAlex).

Rules:
- Use only facts stated in the records. Never add projects, people, dates, amounts or findings that are not in them.
- Cite every factual sentence with the record number in square brackets, like [2]. List every number you cite in cited_records.
- Say which kind of record you are citing when it matters (a grant, a trial, a paper).
- A grant record is funding history. It does not show that a study is active, recruiting, or taking students. \
A trial's status comes from the registry and may be out of date; suggest contacting the study team listed there.
- Funding types (industry, foundation, federal...) are inferred from funder names; say "listed funders" rather \
than stating them as certain.
- If the records don't answer the question, set answerable to false and say briefly what the records do cover.
- Write plain text in a few short paragraphs. No markdown headings."""


def _retrieve(conn: sqlite3.Connection, messages: list[models.ChatMessage]) -> list[sqlite3.Row]:
    """Search with the latest user turn, plus the one before it so short follow-ups keep their topic."""
    user_turns = [m.text for m in messages if m.role == "user"][-2:]
    hits = queries.search(conn, " ".join(user_turns)).results[:MAX_RECORDS]
    if not hits:
        return []
    ids = [h.id for h in hits]
    rows = conn.execute(f"""
        SELECT p.*, group_concat(DISTINCT c.college) AS colleges,
               (SELECT group_concat(name || ' (' || role || ')', '; ') FROM
                  (SELECT name, role FROM project_team t WHERE t.project_id = p.id ORDER BY position LIMIT 8)) AS team,
               (SELECT group_concat(name || ' [' || category || ']', '; ')
                  FROM project_funders f WHERE f.project_id = p.id) AS funders
        FROM projects p LEFT JOIN project_colleges c ON c.project_id = p.id
        WHERE p.id IN ({','.join('?' * len(ids))}) GROUP BY p.id
    """, ids).fetchall()
    by_id = {r["id"]: r for r in rows}
    return [by_id[i] for i in ids if i in by_id]


def _format_record(n: int, r: sqlite3.Row) -> str:
    abstract = r["abstract"].replace("\n\n", " ") or r["summary"]
    kind = r["kind"]
    if kind == "trial":
        detail = (f"Clinical trial {r['award_number']}, status: {r['status_label']} (per {r['source_label']}), "
                  f"{r['start_year']}-{r['end_year']}, {r['activity_code'] or 'phase not listed'}")
        people = "Study officials"
    elif kind == "publication":
        detail = f"Publication in {r['activity_code'] or 'a journal'}, {r['start_year']}, DOI {r['award_number']}"
        people = "Temple authors"
    else:
        detail = (f"Grant {r['award_number']} from {r['admin_ic_name'] or r['agency']}, {r['start_year']}-{r['end_year']}, "
                  f"{'active' if r['is_active'] else 'not active'} per {r['source_label']}")
        people = "Investigators"
    return "\n".join([
        f'<record number="{n}" id="{r["id"]}" kind="{kind}">',
        f"Title: {r['title']}",
        detail,
        f"{people}: {r['team'] or 'not listed'}",
        f"Listed funders [type]: {r['funders'] or 'not listed'}",
        f"Department: {r['department'] or 'not listed'}; college: {r['colleges'] or 'not listed'}",
        f"Abstract: {abstract}",
        "</record>",
    ])


def answer(conn: sqlite3.Connection, messages: list[models.ChatMessage]) -> models.AssistantReply:
    records = _retrieve(conn, messages)
    if not records:
        return models.AssistantReply(reply=NOTHING_FOUND, sources=[])

    context = "\n\n".join(_format_record(n, r) for n, r in enumerate(records, start=1))
    history = [{"role": m.role, "content": m.text} for m in messages[:-1]]
    question = messages[-1].text
    api_messages = history + [{
        "role": "user",
        "content": f"<records>\n{context}\n</records>\n\nQuestion: {question}",
    }]

    result = ai.grounded_answer(SYSTEM, api_messages)

    # Keep only citations that point at a record we actually sent.
    cited = sorted({n for n in result.get("cited_records", []) if 1 <= n <= len(records)})
    if not result.get("answerable"):
        return models.AssistantReply(reply=result.get("answer") or NOTHING_FOUND, sources=[])
    if not cited:
        return models.AssistantReply(reply=UNGROUNDED, sources=[])
    return models.AssistantReply(
        reply=result["answer"],
        sources=[
            models.AssistantSource(n=n, id=records[n - 1]["id"], title=records[n - 1]["title"],
                                   label=records[n - 1]["source_label"], url=records[n - 1]["source_url"])
            for n in cited
        ],
    )
