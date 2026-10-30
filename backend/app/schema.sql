-- Every record carries its source, verification status and last-updated date.
-- Verification values: 'faculty-confirmed' | 'public-award-record'.

CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,          -- e.g. nih-R01AG080817
    award_number    TEXT NOT NULL,             -- NIH core project number
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
    verification    TEXT NOT NULL CHECK (verification IN ('faculty-confirmed', 'public-award-record')),
    updated_at      TEXT NOT NULL
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
    verification    TEXT NOT NULL CHECK (verification IN ('faculty-confirmed', 'public-award-record')),
    updated_at      TEXT NOT NULL
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
