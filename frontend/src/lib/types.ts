// API contract shared with the backend (backend/app/models.py). See docs/api.md.

export type CollegeId =
  | "medicine"
  | "public-health"
  | "science-tech"
  | "engineering"
  | "business"
  | "media"
  | "education"
  | "liberal-arts";

export type Verification = "faculty-confirmed" | "public-award-record" | "public-registry-record" | "public-publication-record";

export type Kind = "award" | "trial" | "publication"; // grant, clinical trial, publication

export interface Project {
  id: string;
  kind: Kind;
  title: string;
  summary: string;
  colleges: CollegeId[];
  verification: Verification;
  pi: { name: string; department: string };
  funder: string; // grants: "NIH R01"; trials: lead sponsor; publications: first funders
  agency: string; // grants: NIH, NSF, DOD...; trials: lead sponsor; publications: journal
  active: boolean; // the source's own flag; for grants not proof a study is recruiting
  statusLabel: string; // "Active", "Recruiting", "Published 2025", ...
  fundingTypes: string[]; // e.g. ["U.S. federal government", "Foundations & nonprofits"]
  amount: number | null; // grants: obligated in the latest fiscal year
  startYear: number;
  endYear: number;
  source: { label: string; url: string };
  updatedAt: string; // ISO date
  /** Present only on search results: which stored fields matched the query. */
  match?: { reason: string; evidence: string[] } | null;
}

export interface TeamMember {
  researcherId?: string | null;
  name: string;
  role: string;
  department: string;
  college: CollegeId | null; // null when the source record names no college
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
  funding: { agency: string; mechanism: string; period: string; total: string; awardNumber: string };
  fundingByYear: YearAmount[];
  topics: TopicRef[];
  team: TeamMember[];
  students: { skills: string[]; notice: string };
  relatedProjectIds: string[];
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

export interface SearchResponse {
  query: string;
  interpretedAs: string;
  total: number;
  page: number;
  pageSize: number;
  results: Project[];
  facets: Facets;
}

export interface SearchParams {
  q: string;
  page?: number;
  colleges?: string[];
  funders?: string[];
  status?: string[];
  topics?: string[];
  kinds?: string[];
  funding?: string[];
}

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
  coverage: string;
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
  agency: string;
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
}

export interface TopicPerson {
  researcherId: string;
  name: string;
  college: CollegeId | null;
  department: string;
  awards: number;
}

export interface TopicDetail {
  topic: TopicSummary;
  funders: string[];
  byCollege: CollegeStat[];
  trend: YearStat[];
  people: TopicPerson[];
  projects: Project[]; // grants
  trials: Project[];
  publications: Project[];
  related: TopicSummary[];
}

export interface AssistantRecord {
  n: number; // the [n] the summary cites
  takeaway: string;
  project: Project;
}

export interface PersonRecord {
  n: number;
  id: string;
  title: string;
  kind: Kind;
  role: string;
}

export interface PersonCounts {
  grants: number;
  trials: number;
  publications: number;
}

export interface AssistantPerson {
  name: string;
  department: string;
  college: CollegeId | null;
  focus: string;
  records: PersonRecord[]; // retrieved records they appear on
  totals: PersonCounts; // every Temple record they appear on
}

export interface AssistantReply {
  mode: "people" | "research" | "none";
  summary: string;
  records: AssistantRecord[];
  people: AssistantPerson[];
  followUps: string[];
}

// ---------- researchers ----------

/** high: one source person ID; medium: name match within one source; low: combined across sources by name. */
export type IdentityConfidence = "high" | "medium" | "low";

export interface ResearcherCounts {
  grants: number;
  trials: number;
  publications: number;
}

export interface ResearcherProject {
  role: string; // as the source lists it
  project: Project;
}

export interface ResearcherCollaborator {
  researcherId: string;
  name: string;
  college: CollegeId | null;
  department: string;
  identityConfidence: IdentityConfidence;
  sharedRecords: number;
  crossCollege: boolean;
  projectIds: string[]; // the shared records behind this link
}

export interface ResearcherAlias {
  source: string;
  name: string;
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
  verified: boolean;
  identityConfidence: IdentityConfidence;
  identityNote: string;
  orcid?: string | null;
  roles: string[]; // roles on records, never a job title
  summary: string;
  focus: ResearcherFocus[];
  terms: string[];
  counts: ResearcherCounts;
  byYear: ResearcherYear[]; // oldest first
  projects: ResearcherProject[];
  collaborators: ResearcherCollaborator[];
  aliases: ResearcherAlias[];
  sources: ResearcherSource[];
  about: string;
}

export interface CompatibilityMatch {
  project: Project;
  score: number;
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
  compatibility: ResearcherCompatibility;
}

// ---------- colleges ----------

export interface CollegeSummary {
  id: CollegeId;
  name: string;
  awards: number;
  active: number;
  funding: number; // grant money obligated FY2022 onward
  trials: number;
  publications: number;
  researchers: number;
}

export interface CollegeTopic {
  id: string;
  name: string;
  image: string | null;
  records: number;
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
  records: number;
}

export interface CollegeDashboard {
  college: CollegeSummary;
  fundingYears: number[]; // [first, last]; empty when there is no funding
  updatedAt: string | null;
  trend: YearStat[];
  topics: CollegeTopic[];
  researchers: CollegeResearcher[];
  partners: CollegePartner[];
  crossCollege: Project[];
  recent: Project[];
  sources: SourceSummary[];
  unassignedRecords: number;
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
  topics: TopicRef[];
}

export interface PeopleResponse {
  query: string;
  total: number;
  page: number;
  pageSize: number;
  sort: "records" | "name";
  results: PersonSummary[];
  colleges: FacetValue[];
}

export interface PeopleParams {
  q?: string;
  page?: number;
  colleges?: string[];
  kind?: string;
  sort?: string;
}
