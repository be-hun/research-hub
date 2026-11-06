// GENERATED from backend/app/models.py by `uv run python -m app.contract`. Do not edit by hand:
// change the Pydantic model, then regenerate. Request-parameter types live in lib/api.ts.

export type CollegeId = "medicine" | "public-health" | "science-tech" | "engineering" | "business" | "media" | "education" | "liberal-arts";

export type Verification = "faculty-confirmed" | "public-award-record" | "public-registry-record" | "public-publication-record";

export type Kind = "award" | "trial" | "publication"; // grant, clinical trial, publication

export type MatchBand = "Strong overlap" | "Good overlap" | "Some overlap"; // a match score in words (compatibility.band_for)

export interface PI {
  name: string;
  department: string;
}

export interface Source {
  label: string;
  url: string;
}

export interface Match {
  reason: string;
  evidence: string[];
  snippet?: string | null; // search only: ~30 words of the abstract around the matched words, each one in ⟦ ⟧
}

export interface Project {
  id: string;
  kind: Kind; // grant ("award"), clinical trial or publication
  title: string;
  summary: string;
  colleges: CollegeId[];
  verification: Verification;
  pi: PI;
  funder: string; // grants: "NIH R01"; trials: lead sponsor; publications: first funders
  agency: string; // grants: NIH, NSF, DOD...; trials: lead sponsor; publications: journal
  active: boolean; // the source's own flag; for grants not proof a study is recruiting
  statusLabel: string; // "Active", "Recruiting", "Published 2025", ...
  fundingTypes: string[]; // e.g. ["U.S. federal government", "Foundations & nonprofits"]
  amount: number | null; // grants: obligated in the latest fiscal year
  startYear: number;
  endYear: number;
  source: Source;
  updatedAt: string; // ISO date
  match?: Match | null; // only on search results: which stored fields matched the query
}

export interface TeamMember {
  researcherId?: string | null;
  name: string;
  role: string;
  department: string;
  college: CollegeId | null; // null when the source names no department to map
}

export interface Funding {
  agency: string;
  mechanism: string;
  period: string;
  total: string;
  awardNumber: string;
}

export interface Students {
  skills: string[];
  notice: string;
}

export interface YearAmount {
  fiscalYear: number;
  amount: number;
}

export interface TopicRef {
  id: string;
  name: string;
}

export interface Fact {
  label: string;
  value: string;
  href?: string | null;
}

export interface FunderRef {
  name: string;
  type: string; // funding type label
}

export interface ProjectDetail extends Project {
  abstract: string[]; // paragraphs
  methodologies: string[];
  facts: Fact[]; // the key facts for this kind of record, in display order
  funders: FunderRef[];
  funding: Funding;
  fundingByYear: YearAmount[];
  topics: TopicRef[];
  team: TeamMember[];
  students: Students;
  relatedProjectIds: string[];
}

/** high: one source person ID; medium: name match within one source; low: combined across sources by name. */
export type IdentityConfidence = "high" | "medium" | "low";

export interface ResearcherCounts {
  grants: number;
  trials: number;
  publications: number;
}

export interface ResearcherProject {
  role: string; // their role on the record, as the source lists it
  project: Project;
}

export interface ResearcherCollaborator {
  researcherId: string;
  name: string;
  college: CollegeId | null;
  department: string;
  identityConfidence: IdentityConfidence;
  sharedRecords: number;
  crossCollege: boolean; // both have a college and the colleges differ
  projectIds: string[]; // the shared records: every collaborator link is backed by these
}

export interface ResearcherAlias {
  source: string; // source label, e.g. "NIH RePORTER"
  name: string; // the name as that source spells it
  sourcePersonId: string | null;
  evidence: "source-person-id" | "name-within-source" | "same-name-across-sources";
  lastSeen: string | null;
}

export interface ResearcherSource {
  label: string;
  url: string;
  records: number;
  lastSeen: string | null;
}

export interface ResearcherFocus {
  id: string; // topic id
  name: string;
  image: string | null;
  records: number;
}

export interface ResearcherYear {
  year: number; // start year
  grants: number;
  trials: number;
  publications: number;
}

export interface ResearcherProfile {
  id: string;
  name: string;
  initials: string;
  college: CollegeId | null;
  department: string;
  verified: boolean; // confirmed by the researcher; always false until the correction workflow exists
  identityConfidence: IdentityConfidence;
  identityNote: string;
  orcid?: string | null;
  roles: string[]; // the roles sources list them in ("Contact PI", "Author"...); never a job title
  summary: string; // built from counts, not generated
  focus: ResearcherFocus[]; // plain-language topics of their records
  terms: string[]; // subject terms frequent in their records and rare elsewhere
  counts: ResearcherCounts;
  byYear: ResearcherYear[]; // records by start year, oldest first
  projects: ResearcherProject[]; // every record they are listed on, newest first
  collaborators: ResearcherCollaborator[];
  aliases: ResearcherAlias[];
  sources: ResearcherSource[];
  about: string;
}

export interface CompatibilityMatch {
  project: Project;
  score: number;
  band: MatchBand;
  reasons: string[];
  sharedTopics: TopicRef[];
}

export interface ResearcherCompatibility {
  researcherId: string;
  researcherName: string;
  isSynthetic: boolean;
  matches: CompatibilityMatch[];
}

export interface DemoResearcherProfile {
  id: string;
  name: string;
  initials: string;
  college: CollegeId;
  department: string;
  isSynthetic: boolean;
  bio: string;
  interests: TopicRef[];
  terms: string[];
  compatibility: ResearcherCompatibility;
}

export interface CollaboratorMatch {
  researcherId: string;
  name: string;
  initials: string;
  college: CollegeId | null;
  title: string;
  score: number; // their best eligible record's score
  band: MatchBand;
  rank: number; // 1-based place in the people ranking, the same on every surface
  reasons: string[];
  citations: string[]; // matching record ids, best first
  sharedTopics: string[];
}

export interface ProfileInput {
  college?: CollegeId | null;
  topics: string[];
  terms: string[];
}

export interface ForYou {
  trials: CompatibilityMatch[];
  grants: CompatibilityMatch[];
  collaborators: CollaboratorMatch[]; // the first 6 of the people ranking
  collaboratorTotal: number; // how many people share the profile's interests (the ranking's length)
}

export interface PeopleMatches {
  total: number; // everyone in the ranking
  page: number;
  pageSize: number;
  results: CollaboratorMatch[]; // this page of the ranking, in the same order as For you
}

export interface ResearcherMatch {
  score: number; // 0 when they are not in the ranking
  band: MatchBand | null; // None when they are not in the ranking
  rank: number | null; // their place in the people ranking, None when they are not in it
  total: number; // how many people are in the ranking
  eligible: boolean; // False when none of their records is active or recent, so they can't be ranked
  reasons: string[];
  sharedTopics: TopicRef[];
  records: Project[];
}

export interface ProjectMatchRequest {
  profile: ProfileInput;
  ids: string[];
}

export interface ProjectMatch {
  id: string;
  score: number;
  band: MatchBand;
  reasons: string[];
}

export interface ProjectMatches {
  matches: ProjectMatch[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export interface AssistantRequest {
  messages: ChatMessage[]; // only the last 8 are used, from a user turn
  profile?: ProfileInput | null;
}

export interface AssistantRecord {
  n: number; // the [n] number the summary cites
  takeaway: string; // one line from the model: why this record answers the question
  project: Project; // facts come from the database, not the model
}

export interface PersonRecord {
  n: number;
  id: string;
  title: string;
  kind: Kind;
  role: string; // their role on it: "Contact PI", "Author", "Study official"...
}

export interface PersonCounts {
  grants: number;
  trials: number;
  publications: number;
}

export interface AssistantPerson {
  researcherId?: string | null; // their profile, /researchers/{researcherId}; null when no record links one
  name: string;
  department: string;
  college: CollegeId | null;
  focus: string; // a few words from the model
  records: PersonRecord[]; // retrieved records they appear on
  totals: PersonCounts; // every Temple record they appear on
  inYourMatches: boolean; // one of the profile's For you collaborators; false when no profile was sent
}

export interface AssistantReply {
  mode: "people" | "research" | "none"; // none: nothing found or not answerable
  summary: string;
  records: AssistantRecord[];
  people: AssistantPerson[];
  followUps: string[];
  searchedFor: string; // one plain line saying what was retrieved, e.g. "Recruiting clinical trials · heart failure"
}

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface Facets {
  kinds: FacetValue[];
  colleges: FacetValue[];
  fundingTypes: FacetValue[];
  funders: FacetValue[];
  status: FacetValue[];
  topics: FacetValue[];
}

/** phrase: the top results contain the exact phrase; all: every result contains every word; any: no record had all the words, so results have any of them; browse: no query. */
export type MatchMode = "phrase" | "all" | "any" | "browse";

export interface SearchResponse {
  query: string;
  interpretedAs: string;
  matchMode: MatchMode;
  total: number;
  page: number;
  pageSize: number;
  results: Project[];
  facets: Facets;
}

// ---------- explore ----------

export interface Totals {
  awards: number;
  active: number;
  trials: number;
  recruiting: number;
  publications: number;
  researchers: number;
  colleges: number;
}

export interface SourceSummary {
  label: string;
  url: string;
  records: number;
  kind: string; // "grants", "clinical trials", "publications"
  coverage: string; // e.g. "Fiscal years 2022–2026"
}

export interface CollegeStat {
  college: CollegeId;
  awards: number;
  active: number;
  funding: number; // grant money obligated FY2022 onward
  trials: number;
  publications: number;
}

export interface FundingTypeStat {
  type: string; // key, e.g. "foundation"
  label: string;
  awards: number;
  trials: number;
  publications: number;
}

export interface AgencyStat {
  agency: string; // NIH, NSF, DOD...
  funding: number;
  awards: number;
}

export interface YearStat {
  fiscalYear: number;
  nih: number;
  nsf: number;
  other: number;
  awards: number;
  mayBeIncomplete: boolean;
}

export interface TopicSummary {
  id: string;
  name: string;
  blurb: string;
  image: string | null;
  awards: number;
  active: number;
  funding: number;
  trials: number;
  publications: number;
}

/** Records in scope with no college, so the college rows plus this one add up to the totals. */
export interface UnassignedStat {
  awards: number;
  funding: number;
  trials: number;
  publications: number;
}

export interface Overview {
  totals: Totals;
  sources: SourceSummary[];
  updatedAt: string | null;
  byCollege: CollegeStat[];
  fundingTypes: FundingTypeStat[];
  federalByAgency: AgencyStat[];
  trend: YearStat[];
  topics: TopicSummary[];
  recent: Project[];
  recruiting: Project[];
  publications: Project[];
  crossCollege: Project[];
  unassigned: UnassignedStat;
}

export interface TopicPerson {
  researcherId: string;
  name: string;
  college: CollegeId | null;
  department: string;
  records: number; // records of every kind on this topic
}

export interface TopicDetail {
  topic: TopicSummary;
  funders: string[]; // the funder areas that define this topic
  byCollege: CollegeStat[];
  trend: YearStat[];
  people: TopicPerson[];
  projects: Project[]; // grants
  trials: Project[];
  publications: Project[];
  related: TopicSummary[];
  unassigned: UnassignedStat;
}

// ---------- colleges ----------

export interface CollegeSummary {
  id: CollegeId;
  name: string;
  awards: number;
  active: number;
  funding: number; // grant money obligated FY2022 onward, same rule as Overview.byCollege
  trials: number;
  publications: number;
  researchers: number; // researchers whose profile is assigned to this college
}

export interface CollegeTopic {
  id: string;
  name: string;
  image: string | null;
  records: number; // grants + trials + publications in this college with this topic
  awards: number;
}

export interface CollegeResearcher {
  researcherId: string;
  name: string;
  department: string;
  identityConfidence: IdentityConfidence;
  records: number;
}

export interface CollegePartner {
  college: CollegeId;
  records: number; // grants with investigators from both colleges
}

export interface CollegeDashboard {
  college: CollegeSummary;
  fundingYears: number[]; // [first, last] fiscal year behind `funding` and `trend`; empty when there is none
  updatedAt: string | null;
  trend: YearStat[];
  topics: CollegeTopic[];
  researchers: CollegeResearcher[];
  partners: CollegePartner[];
  crossCollege: Project[];
  recent: Project[];
  sources: SourceSummary[]; // records per source in this college
  unassignedRecords: number; // records Temple-wide with no college; they appear on no college page
}

// ---------- people directory ----------

export interface PersonSummary {
  researcherId: string;
  name: string;
  initials: string;
  college: CollegeId | null;
  department: string;
  identityConfidence: IdentityConfidence;
  counts: ResearcherCounts;
  topics: TopicRef[]; // their two most frequent topics
}

export interface PeopleResponse {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  sort: "records" | "name";
  results: PersonSummary[];
  colleges: FacetValue[]; // people per college for the current query, ignoring the college filter
}

// ---------- AI summaries ----------

export type SummaryKind = "project" | "researcher" | "topic" | "college";

export interface SummaryCitation {
  n: number; // the [n] used in the summary text
  id: string; // project id
  title: string;
  kind: Kind;
}

export interface SummaryPoint {
  text: string;
  citations: number[]; // [n] numbers, each one in `citations`
}

/** A model-written summary of stored records, for display next to them. Never a source of facts on its own. */
export interface AISummary {
  kind: SummaryKind;
  id: string;
  available: boolean; // false when no summary could be written; `message` says why
  summary: string; // plain text with [n] citations; "" when unavailable
  points: SummaryPoint[];
  citations: SummaryCitation[]; // every record the model was given, numbered as in the text
  recordCount: number;
  message: string | null;
  generatedAt: string | null; // ISO time the summary was written (it is cached until the data changes)
  model: string | null;
}
