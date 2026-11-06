-- Every record carries its source, verification status and last-updated date.
-- A "project" is any research record: a grant ('award'), a clinical trial ('trial') or a publication.

CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,          -- e.g. nih-R01AG080817, ct-NCT01234567, pub-W123
    award_number    TEXT NOT NULL,             -- award number, NCT id or DOI
    kind            TEXT NOT NULL CHECK (kind IN ('award', 'trial', 'publication')),
    status_label    TEXT NOT NULL,             -- "Active", "Recruiting", "Published 2025", ...
    title           TEXT NOT NULL,
    summary         TEXT NOT NULL,
    abstract        TEXT NOT NULL,             -- paragraphs separated by blank lines
    terms           TEXT NOT NULL,             -- NIH preferred terms, '; ' separated
    agency          TEXT NOT NULL,             -- NIH, CDC, AHRQ
    activity_code   TEXT,                      -- R01, R21, ...
    funder          TEXT NOT NULL,             -- display label, e.g. "NIH R01"
    admin_ic        TEXT,                      -- administering institute abbreviation, e.g. NIA
    admin_ic_name   TEXT,
    department      TEXT,                      -- as reported by NIH, title-cased
    start_date      TEXT,                      -- ISO date
    end_date        TEXT,
    start_year      INTEGER NOT NULL,
    end_year        INTEGER NOT NULL,
    latest_fy       INTEGER NOT NULL,
    latest_amount   BIGINT,                    -- award amount in latest_fy
    is_active       INTEGER NOT NULL,          -- NIH's flag; not proof a study is recruiting
    source          TEXT NOT NULL,             -- 'nih-reporter'
    source_label    TEXT NOT NULL,
    source_url      TEXT NOT NULL,
    verification    TEXT NOT NULL CHECK (verification IN (
                        'faculty-confirmed', 'public-award-record', 'public-registry-record', 'public-publication-record')),
    updated_at      TEXT NOT NULL
);

-- Who paid for or sponsored each record, with an inferred funding type (see ingest/funders.py).
CREATE TABLE IF NOT EXISTS project_funders (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    name            TEXT NOT NULL,
    category        TEXT NOT NULL,             -- federal | industry | foundation | temple | academic | government | other
    PRIMARY KEY (project_id, position)
);

-- Plain-language topics. method = 'funder' (from the funding institute) or 'keywords' (title and terms).
CREATE TABLE IF NOT EXISTS project_topics (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    topic_id        TEXT NOT NULL,
    method          TEXT NOT NULL,
    PRIMARY KEY (project_id, topic_id)
);

-- One row per project per fiscal year, for trends.
CREATE TABLE IF NOT EXISTS award_years (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    fiscal_year     INTEGER NOT NULL,
    appl_id         INTEGER NOT NULL,
    award_amount    BIGINT,
    admin_ic        TEXT,
    PRIMARY KEY (project_id, fiscal_year, appl_id)
);

CREATE TABLE IF NOT EXISTS project_colleges (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    college         TEXT NOT NULL,
    PRIMARY KEY (project_id, college)
);

CREATE TABLE IF NOT EXISTS researchers (
    id              TEXT PRIMARY KEY,          -- e.g. r-nih-2086996
    nih_profile_id  INTEGER UNIQUE,
    name            TEXT NOT NULL,
    department      TEXT,
    college         TEXT,
    verified        INTEGER NOT NULL DEFAULT 0,
    source          TEXT NOT NULL,
    verification    TEXT NOT NULL CHECK (verification IN (
                        'faculty-confirmed', 'public-award-record', 'public-registry-record', 'public-publication-record')),
    updated_at      TEXT NOT NULL,
    -- How sure we are that every record on this profile is the same person (see ingest/load.py):
    -- high = one source identity with that source's own person ID; medium = one source identity matched by name
    -- within that source; low = identities from several sources combined by name alone.
    identity_confidence TEXT NOT NULL DEFAULT 'low' CHECK (identity_confidence IN ('high', 'medium', 'low')),
    orcid           TEXT
);

-- Every source identity folded into a researcher, with the evidence for the match. Nothing is discarded,
-- so a merged profile can always be traced (and later split) back to the source records.
CREATE TABLE IF NOT EXISTS researcher_aliases (
    researcher_id   TEXT NOT NULL REFERENCES researchers(id) ON DELETE CASCADE,
    source_researcher_id TEXT NOT NULL,        -- the id the source's own rows used, e.g. r-nsf-111
    source          TEXT NOT NULL,
    source_person_id TEXT,                     -- the source's person ID, when it has one
    source_name     TEXT NOT NULL,             -- the name as that source spelled it
    confidence      TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    evidence        TEXT NOT NULL,             -- source-person-id | name-within-source | same-name-across-sources
    last_seen       TEXT,                      -- latest updated_at among that source's rows for the person
    PRIMARY KEY (researcher_id, source_researcher_id)
);

CREATE TABLE IF NOT EXISTS project_team (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL,
    researcher_id   TEXT REFERENCES researchers(id) ON DELETE SET NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL,             -- 'Contact PI' | 'Co-PI'
    PRIMARY KEY (project_id, position)
);

-- Research areas, grouped by NIH institute for now.
CREATE TABLE IF NOT EXISTS research_areas (
    id              TEXT PRIMARY KEY,          -- e.g. nia
    name            TEXT NOT NULL,
    abbreviation    TEXT NOT NULL,
    definition      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_areas (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    area_id         TEXT NOT NULL REFERENCES research_areas(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, area_id)
);

-- Full-text search. Weights rank a title match highest, then abstract, investigators and terms
-- (ts_rank weights {D, C, B, A} = {0.1, 0.2, 0.3, 1.0}, the same 10:3:2:1 ratio the SQLite bm25 search used).
CREATE TABLE IF NOT EXISTS projects_fts (
    project_id      TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    abstract        TEXT NOT NULL,
    terms           TEXT NOT NULL,
    people          TEXT NOT NULL,
    document        TSVECTOR GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', title), 'A') ||
                        setweight(to_tsvector('english', abstract), 'B') ||
                        setweight(to_tsvector('english', people), 'C') ||
                        setweight(to_tsvector('english', terms), 'D')) STORED
);

-- Federal funding calls (RFPs / notices of funding opportunity) from Grants.gov, posted or forecasted.
-- A call is an invitation to apply, not an award. Deadlines change, so every row links to the official page and
-- records when it was fetched. Eligibility is stored as the agency wrote it; nothing here decides who may apply.
CREATE TABLE IF NOT EXISTS opportunities (
    id              TEXT PRIMARY KEY,          -- gg-<Grants.gov opportunity id>, e.g. gg-359892
    number          TEXT NOT NULL,             -- the agency's call number, e.g. RFA-CA-27-019
    title           TEXT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('posted', 'forecasted', 'closed')),
    agency          TEXT NOT NULL,             -- the short label used across the site: NIH, NSF, DOD...
    agency_code     TEXT NOT NULL,             -- Grants.gov agency code, e.g. HHS-NIH11
    agency_name     TEXT NOT NULL,             -- e.g. National Institutes of Health
    description     TEXT NOT NULL,             -- synopsis (or forecast) text, HTML removed, paragraphs split by blank lines
    eligibility_text TEXT NOT NULL,            -- the agency's eligibility wording, verbatim ('' when none)
    funding_instruments TEXT NOT NULL,         -- '; ' separated, e.g. 'Grant; Cooperative Agreement'
    categories      TEXT NOT NULL,             -- funding activity categories, '; ' separated, e.g. 'Health'
    posted_date     TEXT,                      -- ISO date
    close_date      TEXT,                      -- ISO date of the application deadline; NULL when none is given
    close_date_estimated INTEGER NOT NULL DEFAULT 0,  -- 1 for forecasted calls: the agency's estimate
    close_date_note TEXT,                      -- the agency's wording when the deadline isn't one date
    archive_date    TEXT,
    award_floor     BIGINT,
    award_ceiling   BIGINT,
    total_funding   BIGINT,                    -- estimated total program funding
    expected_awards INTEGER,
    cost_sharing    INTEGER NOT NULL DEFAULT 0,
    contact_name    TEXT,
    contact_email   TEXT,
    contact_phone   TEXT,
    source_url      TEXT NOT NULL,             -- https://www.grants.gov/search-results-detail/<id>
    updated_at      TEXT NOT NULL              -- when it was fetched (ISO time)
);

-- Assistance listing (ALN, formerly CFDA) numbers, e.g. 93.393. The same numbers are on awards (project_programs),
-- which is how a call is linked to Temple's past awards under the same program.
CREATE TABLE IF NOT EXISTS opportunity_programs (
    opportunity_id  TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    aln             TEXT NOT NULL,
    PRIMARY KEY (opportunity_id, aln)
);

-- Grants.gov applicant-type codes the call lists, e.g. 06 = public and state controlled institutions of higher
-- education, 20 = private institutions of higher education, 25 = others (see the agency's eligibility text).
CREATE TABLE IF NOT EXISTS opportunity_applicant_types (
    opportunity_id  TEXT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    label           TEXT NOT NULL,
    PRIMARY KEY (opportunity_id, code)
);

CREATE TABLE IF NOT EXISTS opportunities_fts (
    opportunity_id  TEXT PRIMARY KEY REFERENCES opportunities(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    extra           TEXT NOT NULL,             -- call number, agency, categories
    document        TSVECTOR GENERATED ALWAYS AS (
                        setweight(to_tsvector('english', title), 'A') ||
                        setweight(to_tsvector('english', description), 'B') ||
                        setweight(to_tsvector('english', extra), 'C')) STORED
);

-- Assistance listing numbers on award records (from USAspending, NIH RePORTER and NSF where the source gives them).
CREATE TABLE IF NOT EXISTS project_programs (
    project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    aln             TEXT NOT NULL,             -- e.g. 93.393
    title           TEXT NOT NULL,             -- the program title the source gives ('' when none)
    PRIMARY KEY (project_id, aln)
);

CREATE TABLE IF NOT EXISTS ingest_runs (
    id              BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    source          TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    fiscal_years    TEXT NOT NULL,
    records_fetched INTEGER,
    projects_loaded INTEGER,
    error           TEXT
);

CREATE INDEX IF NOT EXISTS idx_project_team_researcher ON project_team(researcher_id);
CREATE INDEX IF NOT EXISTS idx_project_team_project ON project_team(project_id);
CREATE INDEX IF NOT EXISTS idx_project_colleges_college ON project_colleges(college);
CREATE INDEX IF NOT EXISTS idx_project_topics_topic ON project_topics(topic_id);
CREATE INDEX IF NOT EXISTS idx_projects_kind_active ON projects(kind, is_active);
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_researchers_college ON researchers(college);
CREATE INDEX IF NOT EXISTS idx_projects_fts_document ON projects_fts USING GIN (document);
CREATE INDEX IF NOT EXISTS idx_opportunities_status_close ON opportunities(status, close_date);
CREATE INDEX IF NOT EXISTS idx_opportunity_programs_aln ON opportunity_programs(aln);
CREATE INDEX IF NOT EXISTS idx_project_programs_aln ON project_programs(aln);
CREATE INDEX IF NOT EXISTS idx_opportunities_fts_document ON opportunities_fts USING GIN (document);

-- Supabase serves tables in the public schema through its Data API to anyone with the project's anon key.
-- Row level security with no policies closes that path; the backend connects as the table owner, which RLS
-- doesn't apply to. On plain Postgres this changes nothing.
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_funders ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE award_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE researchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE researcher_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects_fts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunity_applicant_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities_fts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_runs ENABLE ROW LEVEL SECURITY;
