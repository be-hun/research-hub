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
    latest_amount   INTEGER,                   -- award amount in latest_fy
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
    award_amount    INTEGER,
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

CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
    project_id UNINDEXED,
    title,
    abstract,
    terms,
    people,
    tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS ingest_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
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
