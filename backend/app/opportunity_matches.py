"""Who at Temple fits a funding call, and which calls fit a researcher. Deterministic overlap of stored fields; no
model call. A match is a discovery aid, not a recommendation to apply or a judgment of eligibility.

A call is turned into a profile, the same `compatibility` profile a person's interests become, and scored with the
same `_score` against the same corpus:
- topics: the NIH institute in the call number (RFA-CA-... is NCI, so Cancer) and the call's title, description and
  categories through `topics.topics_from_text`, the tagging records without a funder get. A topic only the
  description names counts half;
- terms: the call's distinctive words and two-word phrases, weighted by rarity across Temple's records exactly as a
  person's interests are. A term must appear in at least one Temple record; grant boilerplate ("applicant",
  "deadline") never counts.
A researcher's points are their best eligible record's score (`compatibility.ELIGIBLE`, as in the people ranking),
plus PROGRAM_POINTS when one of their Temple awards is under one of the call's assistance listings (ALNs). Both
directions use that one score, so a call that lists a researcher shows the same band on that researcher's page.
"""

import re
import threading
import unicodedata
from array import array
from collections import Counter, OrderedDict, defaultdict
from dataclasses import dataclass, field

from app import models
from app.compatibility import (
    ELIGIBLE, GENERIC, MAX_PHRASE_SHARE, MAX_WORD_SHARE, MIN_MATCH_SCORE, MIN_RECORDS_FOR_SHARE, PHRASE_BONUS,
    _Corpus, _Profile, _score, _singular, band_for, corpus, data_version, normalize,
)
from app.db import Connection, Row
from app.queries import PARENT_ONLY, STOPWORDS, _initials
from app.topics import AREA_TO_TOPIC, BY_ID, topics_from_text

NOTICE = ("People whose public grants, trials or publications overlap this call's topic. It is not a recommendation "
          "or an eligibility check: read the call's own eligibility section before applying.")

RESEARCHER_LIMIT = 12
OPPORTUNITY_LIMIT = 8
PROJECT_ID_LIMIT = 8
# Funded under the same assistance listing counts as much as one funder-defined shared topic: Good overlap alone.
PROGRAM_POINTS = 24
CALL_TOPICS = 2  # topics read from a call's text, besides the institute in its number
# How sure a call is of a topic: its institute or its title names it, or only its description does ("machine
# learning" in a cancer call's methods paragraph doesn't make it a computing call).
TITLE_TOPIC, DESCRIPTION_TOPIC = 1.0, 0.5
CALL_PHRASES, CALL_TERMS = 6, 12  # two-word phrases kept, and terms in all (ProfileInput allows 12)
SHORT_CALL = 120  # words; a shorter description is a forecast blurb, where one mention of a term is all there is
CALL_CACHE_SIZE = 4096  # call profiles kept, one per (call, its fetch time) for the current data version
RESULT_CACHE_SIZE = 256  # researcher lists kept, one per (call, its fetch time, data version)

# Words that say nothing about a call's field: what every funding call says, whatever it funds, and the filler of
# research prose. Normalized like record text, so plurals fold.
BOILERPLATE = {normalize(w) for w in """
    about above across activity activities additional agency agencies agreement agreements all also among amount
    announcement any applicant applicants application applications apply approximately area areas available
    awardee awardees awards based been being between both budget budgets business but can competing competition
    complete conduct cooperative cost costs current date deadline deadlines department describe described due
    during each eligible eligibility encourage encourages encouraged estimated et etc expected federal fiscal
    focus foa foundation fund funded funding funds further general given gov grants grantee grantees have here
    html http https include includes including information initiative institute institutes institution
    institutions institutional intent interest invite invites investigator investigators its letter may million
    more most must national nih nofo notice nsf number objective objectives office one only opportunity
    opportunities organization organizations other our over part participate period phase pi please priority
    priorities proposal proposals proposed proposer proposers provide provides purpose receipt related relevant
    request requests require required requirement requirements responsive review reviewed reviewer scope section
    see seek seeks should small solicitation solicitations specific submission submissions submit submitted
    such support supported supporting supports than their them these they this those three through total two
    under upon was website were which while who will within would www year years
    able achieve address addressing advance advancing aims altered approaches assess better broad capacity
    challenge challenges collaboration collaborative critical demonstrate design designed determine develop
    developing different early effective enable enhance ensure establish evaluate evidence examine expertise
    explore field fields finding findings first functional future gap gaps help highly however identify impact
    impacts important individual individuals innovative insight insights investigate key knowledge large lead
    leading let like limited long major many multiple need needed needs ongoing overall people play plays
    population populations potential preliminary range recent recently responsible result results rigorous
    robust role second set several significant significance subject subjects successful team teams term toward
    towards type types understand understanding unique various via way ways well whether wide without
    acquisition advanced analyze analyzing continuum disseminate dissemination era fundamental integrate
    integrating interpretation particular plan plans solicit solicits transform transformative transforms
""".split()}
# NIH call numbers name the institute: RFA-CA-27-019 is NCI's. Two-letter codes to the funder areas topics use.
NIH_INSTITUTES = {
    "CA": "nci", "AG": "nia", "DA": "nida", "AA": "niaaa", "MH": "nimh", "NS": "ninds", "DC": "nidcd", "EY": "nei",
    "HL": "nhlbi", "AI": "niaid", "HD": "nichd", "DK": "niddk", "AR": "niams", "DE": "nidcr", "MD": "nimhd",
    "NR": "ninr", "GM": "nigms", "HG": "nhgri", "EB": "nibib", "LM": "nlm", "ES": "niehs", "AT": "nccih",
}
_NIH_NUMBER = re.compile(r"^(?:RFA|PAR|PAS|PA|NOT|OTA)-([A-Z]{2})-\d", re.IGNORECASE)
# Phrases never span a sentence, a clause or a list item ("imaging, cancer genomics" has no "imaging cancer").
_SENTENCE = re.compile(r"[.,;:!?()\[\]{}\n•|/]+")

# Whole days from today to the deadline; NULL without a usable date. Dates are stored as ISO text.
_DAYS_LEFT = ("CASE WHEN o.close_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' "
              "THEN substr(o.close_date, 1, 10)::date - CURRENT_DATE END")
_OPEN = f"o.status IN ('posted', 'forecasted') AND COALESCE({_DAYS_LEFT}, 0) >= 0"
# Applicant types 06 and 20: public and private institutions of higher education.
_OPPORTUNITY_COLUMNS = f"""o.id, o.number, o.title, o.status, o.agency, o.agency_name, o.posted_date, o.close_date,
    o.close_date_estimated, o.close_date_note, o.award_floor, o.award_ceiling, o.expected_awards, o.categories,
    o.source_url, o.updated_at, {_DAYS_LEFT} AS days_left,
    EXISTS (SELECT 1 FROM opportunity_applicant_types a
            WHERE a.opportunity_id = o.id AND a.code IN ('06', '20')) AS universities"""


def _marks(values) -> str:
    return ",".join("?" * len(values))


# ---------- the corpus, indexed by word ----------

class _Index:
    """The compatibility corpus with a word index, so a call's candidate terms are counted without scanning every
    record. `frequency` gives exactly what `_Corpus.frequency` does (records holding the phrase as whole words), so
    `weight`, borrowed from `_Corpus`, gives the same weights. `_score` reads only text, topics, colleges and weight.
    """

    weight = _Corpus.weight

    def __init__(self, data: _Corpus):
        self.text, self.topics, self.colleges, self.size = data.text, data.topics, data.colleges, data.size
        self._ids = list(data.text)
        postings: dict[str, array] = defaultdict(lambda: array("I"))
        for i, pid in enumerate(self._ids):
            for word in set(data.text[pid].split()):
                postings[word].append(i)
        self._postings = dict(postings)
        self._frequency: dict[str, int] = {}
        self._lock = threading.Lock()

    def frequency(self, phrase: str) -> int:
        with self._lock:
            if phrase in self._frequency:
                return self._frequency[phrase]
        words = phrase.split()
        rarest = min((self._postings.get(w, array("I")) for w in words), key=len) if words else array("I")
        if len(words) == 1:
            n = len(rarest)
        else:
            needle = f" {phrase} "
            n = sum(needle in self.text[self._ids[i]] for i in rarest)
        with self._lock:
            self._frequency[phrase] = n
        return n


@dataclass
class _Data:
    """Everything a match reads that only changes with an import, built once per data version."""

    index: _Index
    eligible: dict[str, list[str]]  # researcher id -> their eligible record ids
    years: dict[str, int]  # eligible record id -> latest fiscal year
    records: dict[str, tuple[str, str]]  # eligible record id -> (kind, agency)
    calls: OrderedDict = field(default_factory=OrderedDict)  # (call id, updated_at) -> _Call


_data_lock = threading.Lock()
_data_cache: dict[tuple, _Data] = {}


def _data(conn: Connection) -> _Data:
    key = data_version(conn)
    with _data_lock:
        if key in _data_cache:
            return _data_cache[key]
    eligible: dict[str, list[str]] = defaultdict(list)
    for row in conn.execute(f"""
        SELECT DISTINCT t.researcher_id, t.project_id FROM project_team t JOIN projects p ON p.id = t.project_id
        WHERE t.researcher_id IS NOT NULL AND {ELIGIBLE}
        ORDER BY t.researcher_id, t.project_id
    """):
        eligible[row["researcher_id"]].append(row["project_id"])
    years, records = {}, {}
    for row in conn.execute(f"SELECT p.id, p.latest_fy, p.kind, p.agency FROM projects p WHERE {ELIGIBLE}"):
        years[row["id"]] = row["latest_fy"] or 0
        records[row["id"]] = (row["kind"], row["agency"])
    built = _Data(_Index(corpus(conn)), dict(eligible), years, records)
    with _data_lock:
        _data_cache.clear()  # one data version at a time
        _data_cache[key] = built
    return built


# ---------- a call as a profile ----------

@dataclass
class _Call:
    profile: _Profile
    alns: set[str]


def _tokens(text: str) -> list[tuple[str, str]]:
    """Each word as written (lowercased) and normalized, the way `compatibility.normalize` reads record text."""
    plain = "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))
    return [(w, _singular(w)) for w in re.findall(r"[a-z0-9]+", plain.replace("'", "").replace("’", ""))]


def _word_ok(word: str) -> bool:
    return len(word) >= 3 and word.isalpha() and word not in GENERIC and word not in BOILERPLATE


def _pair_ok(a: str, b: str) -> bool:
    """Two adjacent words worth matching as a phrase: no filler, and not two generic words ("clinical trial")."""
    return (a != b and all(len(w) >= 3 and w.isalpha() and w not in STOPWORDS and w not in BOILERPLATE for w in (a, b))
            and not (a in GENERIC and b in GENERIC))


def _call_terms(index: _Index, title: str, description: str) -> list[str]:
    """The call's distinctive words and phrases, as written: frequent in the call, present but uncommon at Temple.

    A title mention counts three times. Outside a short description a term must come up at least twice, so a
    passing example ("such as zebrafish") doesn't define the call. Ranked by mentions times rarity weight.
    """
    counts: Counter = Counter()
    written: dict[str, str] = {}
    for weight, text in ((3, title), (1, description)):
        for segment in _SENTENCE.split(text or ""):
            words = _tokens(segment)
            for i, (raw, word) in enumerate(words):
                grams = [(raw, word)] if _word_ok(word) else []
                if i + 1 < len(words) and _pair_ok(word, words[i + 1][1]):
                    grams.append((f"{raw} {words[i + 1][0]}", f"{word} {words[i + 1][1]}"))
                for surface, gram in grams:
                    counts[gram] += weight
                    written.setdefault(gram, surface)
    short = len(_tokens(description or "")) < SHORT_CALL
    ranked = []
    for gram, n in counts.items():
        if (n < 2 and not short) or len(written[gram]) > 40:
            continue
        df = index.frequency(gram)
        phrase = " " in gram
        if df == 0 or (index.size >= MIN_RECORDS_FOR_SHARE
                       and df / index.size > (MAX_PHRASE_SHARE if phrase else MAX_WORD_SHARE)):
            continue
        ranked.append((-n * index.weight(gram) * (PHRASE_BONUS if phrase else 1.0), gram))
    ranked.sort()
    phrases = [g for _, g in ranked if " " in g][:CALL_PHRASES]
    # A word already inside a kept phrase adds little; the phrase carries it.
    inside = {w for p in phrases for w in p.split()}
    words = [g for _, g in ranked if " " not in g and g not in inside]
    chosen = set(phrases + words[:CALL_TERMS - len(phrases)])
    return [written[g] for _, g in ranked if g in chosen]


def _call_topics(row: Row) -> dict[str, float]:
    """The call's topics and how sure it is of each: TITLE_TOPIC for its institute or title, else DESCRIPTION_TOPIC."""
    topics = {}
    match = _NIH_NUMBER.match(row["number"] or "")
    if match and (row["agency"] == "NIH" or (row["agency_code"] or "").startswith("HHS-NIH")):
        topic = AREA_TO_TOPIC.get(NIH_INSTITUTES.get(match.group(1).upper(), ""))
        if topic:
            topics[topic] = TITLE_TOPIC
    in_title = set(topics_from_text(row["title"], ""))
    for topic in topics_from_text(row["title"], f"{row['description']} {row['categories']}", limit=CALL_TOPICS):
        topics.setdefault(topic, TITLE_TOPIC if topic in in_title else DESCRIPTION_TOPIC)
    return topics


def _calls(conn: Connection, data: _Data, rows: list[Row]) -> dict[str, _Call]:
    """Profiles for these calls (rows carry id and updated_at), built once per call version and data version."""
    out, missing = {}, []
    with _data_lock:
        for row in rows:
            key = (row["id"], row["updated_at"])
            if key in data.calls:
                data.calls.move_to_end(key)
                out[row["id"]] = data.calls[key]
            else:
                missing.append(row["id"])
    if missing:
        alns: dict[str, set[str]] = defaultdict(set)
        for r in conn.execute(
                f"SELECT opportunity_id, aln FROM opportunity_programs WHERE opportunity_id IN ({_marks(missing)})", missing):
            alns[r["opportunity_id"]].add(r["aln"])
        for row in conn.execute(f"""SELECT id, number, title, description, categories, agency, agency_code, updated_at
                                    FROM opportunities WHERE id IN ({_marks(missing)})""", missing):
            topics = _call_topics(row)
            terms = _call_terms(data.index, row["title"], row["description"])
            profile = models.ProfileInput(topics=list(topics), terms=terms)
            call = _Call(_Profile(profile, data.index, topics), alns[row["id"]])  # type: ignore[arg-type]
            out[row["id"]] = call
            with _data_lock:
                data.calls[(row["id"], row["updated_at"])] = call
                while len(data.calls) > CALL_CACHE_SIZE:
                    data.calls.popitem(last=False)
    return out


# ---------- one researcher against one call ----------

@dataclass
class _Fit:
    points: int
    program: dict[str, list[str]]  # ALN -> the researcher's awards under it
    scored: list[tuple[int, str, set[str], list[str]]]  # (points, record id, shared topics, shared terms), best first

    def latest(self, years: dict[str, int]) -> int:
        return max((years.get(pid, 0) for _, pid, _, _ in self.scored), default=0)


def _fit(data: _Data, call: _Call, record_ids: list[str], program: dict[str, list[str]]) -> _Fit | None:
    """The researcher's points for a call: their best record's `_score`, plus PROGRAM_POINTS; None below the floor."""
    scored = []
    for pid in record_ids:
        if s := _score(pid, data.index, call.profile):  # type: ignore[arg-type]
            scored.append((s.points, pid, s.topics, s.phrases))
    scored.sort(key=lambda s: (-s[0], s[1]))
    on_program = {aln: pids for aln, pids in program.items() if aln in call.alns}
    points = min(100, (scored[0][0] if scored else 0) + (PROGRAM_POINTS if on_program else 0))
    if points < MIN_MATCH_SCORE:
        return None
    return _Fit(points, on_program, scored)


def _records_phrase(data: _Data, ids: list[str]) -> str:
    """'2 NIH grants, 1 clinical trial and 3 publications' for these records, from their stored kind and agency."""
    grants: Counter = Counter()
    other: Counter = Counter()
    for pid in ids:
        kind, agency = data.records.get(pid, ("", ""))
        if kind == "award":
            grants[agency] += 1
        else:
            other[kind] += 1
    parts = [f"{n} {agency + ' ' if agency else ''}grant{'s' if n != 1 else ''}"
             for agency, n in sorted(grants.items(), key=lambda kv: (-kv[1], kv[0]))]
    for kind, label in (("trial", "clinical trial"), ("publication", "publication")):
        if other[kind]:
            parts.append(f"{other[kind]} {label}{'s' if other[kind] != 1 else ''}")
    if len(parts) > 1:
        return ", ".join(parts[:-1]) + " and " + parts[-1]
    return parts[0] if parts else ""


def _reasons(data: _Data, fit: _Fit) -> tuple[list[str], list[str]]:
    """Plain reasons from stored fields, strongest first, and the record ids behind them."""
    reasons, ids = [], []
    if fit.program:
        reasons.append(f"Funded under the same program ({', '.join(sorted(fit.program))})")
        ids += sorted({pid for pids in fit.program.values() for pid in pids},
                      key=lambda pid: (-data.years.get(pid, 0), pid))
    # The two shared terms on the most records (rarest first on ties), and the records that mention either.
    on: Counter = Counter(p for _, _, _, terms in fit.scored for p in terms)
    top = sorted(on, key=lambda p: (-on[p], -data.index.weight(normalize(p)), p))[:2]
    if top:
        mentioning = [pid for _, pid, _, terms in fit.scored if set(terms) & set(top)]
        verb = "mentions" if len(mentioning) == 1 else "mention"
        reasons.append(f"{_records_phrase(data, mentioning)} {verb} " + " and ".join(f"“{p}”" for p in top))
    topics = sorted({t for _, _, shared, _ in fit.scored for t in shared})
    if topics:
        tagged = [pid for _, pid, shared, _ in fit.scored if shared]
        names = " and ".join(BY_ID[t].name for t in topics if t in BY_ID)
        reasons.append(f"{_records_phrase(data, tagged)} in {names}, a topic of this call")
    ids += [pid for _, pid, _, _ in fit.scored]
    return reasons, list(dict.fromkeys(ids))[:PROJECT_ID_LIMIT]


def _programs(conn: Connection, where: str, params: list) -> dict[str, dict[str, list[str]]]:
    """Researcher id -> ALN -> their Temple parent awards under it (any year: a past award is still program history)."""
    out: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for row in conn.execute(f"""
        SELECT DISTINCT t.researcher_id, pp.aln, p.id FROM project_programs pp
        JOIN projects p ON p.id = pp.project_id JOIN project_team t ON t.project_id = p.id
        WHERE p.kind = 'award' AND {PARENT_ONLY} AND t.researcher_id IS NOT NULL AND {where}
        ORDER BY t.researcher_id, pp.aln, p.id
    """, params):
        out[row["researcher_id"]][row["aln"]].append(row["id"])
    return out


# ---------- who at Temple fits this call ----------

def _people(conn: Connection, ids: list[str]) -> dict[str, models.PersonSummary]:
    """PersonSummary as the people directory builds it: record counts by kind and their two most frequent topics."""
    if not ids:
        return {}
    topics: dict[str, list[models.TopicRef]] = {i: [] for i in ids}
    for t in conn.execute(f"""
        SELECT t.researcher_id, pt.topic_id, COUNT(DISTINCT pt.project_id) AS n
        FROM project_team t JOIN project_topics pt ON pt.project_id = t.project_id
        WHERE t.researcher_id IN ({_marks(ids)})
        GROUP BY t.researcher_id, pt.topic_id ORDER BY n DESC, pt.topic_id
    """, ids):
        if t["topic_id"] in BY_ID and len(topics[t["researcher_id"]]) < 2:
            topics[t["researcher_id"]].append(models.TopicRef(id=t["topic_id"], name=BY_ID[t["topic_id"]].name))
    return {
        r["id"]: models.PersonSummary(
            researcherId=r["id"], name=r["name"], initials=_initials(r["name"]), college=r["college"],
            department=r["department"] or "", identityConfidence=r["identity_confidence"],
            counts=models.ResearcherCounts(grants=r["grants"], trials=r["trials"], publications=r["publications"]),
            topics=topics[r["id"]],
        )
        for r in conn.execute(f"""
            SELECT r.id, r.name, r.college, r.department, r.identity_confidence,
                   COUNT(DISTINCT CASE WHEN p.kind = 'award' THEN p.id END) AS grants,
                   COUNT(DISTINCT CASE WHEN p.kind = 'trial' THEN p.id END) AS trials,
                   COUNT(DISTINCT CASE WHEN p.kind = 'publication' THEN p.id END) AS publications
            FROM researchers r JOIN project_team t ON t.researcher_id = r.id JOIN projects p ON p.id = t.project_id
            WHERE r.id IN ({_marks(ids)}) GROUP BY r.id
        """, ids)
    }


_results_lock = threading.Lock()
_results: OrderedDict[tuple, models.OpportunityResearchers] = OrderedDict()


def researchers_for(conn: Connection, opportunity_id: str) -> models.OpportunityResearchers | None:
    """Temple researchers whose records overlap the call; None if the call is unknown.

    Strongest first; ties go to someone funded under the call's program, then to more matching records, then to
    more recent work, then to the researcher id, so the order is total and a name never decides it.
    """
    row = conn.execute("SELECT id, updated_at FROM opportunities WHERE id = ?", (opportunity_id,)).fetchone()
    if not row:
        return None
    key = (row["id"], row["updated_at"], data_version(conn))
    with _results_lock:
        if key in _results:
            _results.move_to_end(key)
            return _results[key]
    data = _data(conn)
    call = _calls(conn, data, [row])[row["id"]]
    alns = sorted(call.alns)
    programs = _programs(conn, f"pp.aln IN ({_marks(alns)})", alns) if alns else {}
    fits = [(fit, rid) for rid, record_ids in data.eligible.items()
            if (fit := _fit(data, call, record_ids, programs.get(rid, {})))]
    fits.sort(key=lambda item: (-item[0].points, not item[0].program, -len(item[0].scored),
                                -item[0].latest(data.years), item[1]))
    people = _people(conn, [rid for _, rid in fits[:RESEARCHER_LIMIT]])
    researchers = []
    for fit, rid in fits[:RESEARCHER_LIMIT]:
        if rid not in people:
            continue
        reasons, ids = _reasons(data, fit)
        researchers.append(models.OpportunityResearcher(
            person=people[rid], band=band_for(fit.points), reasons=reasons, projectIds=ids,
            awardedUnderProgram=bool(fit.program),
        ))
    result = models.OpportunityResearchers(
        opportunityId=row["id"],
        researchers=researchers,
        crossCollege=len({r.person.college for r in researchers if r.person.college}) > 1,
        notice=NOTICE,
    )
    with _results_lock:
        _results[key] = result
        while len(_results) > RESULT_CACHE_SIZE:
            _results.popitem(last=False)
    return result


# ---------- which open calls fit this researcher ----------

def _opportunity(row: Row, programs: list[str]) -> models.Opportunity:
    """A stored call as an `Opportunity`, field for field as models.py defines it."""
    return models.Opportunity(
        id=row["id"],
        number=row["number"],
        title=row["title"],
        status=row["status"],
        agency=row["agency"],
        agencyName=row["agency_name"],
        postedDate=row["posted_date"],
        closeDate=row["close_date"],
        closeDateEstimated=bool(row["close_date_estimated"]),
        closeDateNote=row["close_date_note"],
        daysLeft=row["days_left"],
        awardFloor=row["award_floor"],
        awardCeiling=row["award_ceiling"],
        expectedAwards=row["expected_awards"],
        universitiesEligible=bool(row["universities"]),
        categories=[c.strip() for c in (row["categories"] or "").split(";") if c.strip()],
        programs=programs,
        source=models.Source(label="Grants.gov", url=row["source_url"]),
        updatedAt=row["updated_at"],
    )


def for_researcher(conn: Connection, researcher_id: str) -> list[models.ResearcherOpportunity] | None:
    """Open calls that overlap a researcher's records, strongest first, at most 8; None if the researcher is unknown.

    Open: posted or forecasted, with a deadline (estimated, for a forecast) today or later, or none given. The score
    is the one `researchers_for` gives this researcher for each call. Ties: a call under one of their programs
    first, then more matching records, then the sooner deadline, then the call id.
    """
    if not conn.execute("SELECT 1 FROM researchers WHERE id = ?", (researcher_id,)).fetchone():
        return None
    data = _data(conn)
    record_ids = data.eligible.get(researcher_id, [])
    if not record_ids:
        return []  # no eligible record: the people ranking leaves them out, and so does every call's list
    rows = conn.execute(
        f"SELECT o.id, o.updated_at, {_DAYS_LEFT} AS days_left FROM opportunities o WHERE {_OPEN}").fetchall()
    if not rows:
        return []
    calls = _calls(conn, data, rows)
    program = _programs(conn, "t.researcher_id = ?", [researcher_id]).get(researcher_id, {})
    days = {r["id"]: r["days_left"] for r in rows}
    fits = [(fit, cid) for cid, call in calls.items() if (fit := _fit(data, call, record_ids, program))]
    fits.sort(key=lambda item: (-item[0].points, not item[0].program, -len(item[0].scored),
                                days[item[1]] if days[item[1]] is not None else 10**6, item[1]))
    best = fits[:OPPORTUNITY_LIMIT]
    if not best:
        return []
    ids = [cid for _, cid in best]
    full = {r["id"]: r for r in conn.execute(
        f"SELECT {_OPPORTUNITY_COLUMNS} FROM opportunities o WHERE o.id IN ({_marks(ids)})", ids)}
    alns: dict[str, list[str]] = defaultdict(list)
    for r in conn.execute(f"""SELECT opportunity_id, aln FROM opportunity_programs
                              WHERE opportunity_id IN ({_marks(ids)}) ORDER BY opportunity_id, aln""", ids):
        alns[r["opportunity_id"]].append(r["aln"])
    out = []
    for fit, cid in best:
        reasons, project_ids = _reasons(data, fit)
        out.append(models.ResearcherOpportunity(
            opportunity=_opportunity(full[cid], alns[cid]), band=band_for(fit.points), reasons=reasons,
            projectIds=project_ids,
        ))
    return out
