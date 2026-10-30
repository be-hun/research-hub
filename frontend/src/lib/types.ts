// API contract shared with the backend (backend/app/models.py). See docs/api.md.

export type CollegeId =
  | "medicine"
  | "public-health"
  | "science-tech"
  | "engineering"
  | "business"
  | "media"
  | "education";

export type Verification = "faculty-confirmed" | "public-award-record";

export interface Project {
  id: string;
  title: string;
  summary: string;
  colleges: CollegeId[];
  verification: Verification;
  pi: { name: string; department: string };
  funder: string; // e.g. "NIH R01", "NSF CBET"
  agency: string; // NIH, NSF, CDC, AHRQ
  active: boolean; // the funder's own flag; not proof a study is recruiting
  amount: number | null; // obligated in the latest fiscal year
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

export interface ProjectDetail extends Project {
  abstract: string[]; // paragraphs
  methodologies: string[];
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
  colleges: FacetValue[];
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
}

export interface Totals {
  awards: number;
  active: number;
  researchers: number;
  colleges: number;
}

export interface SourceSummary {
  label: string;
  url: string;
  awards: number;
  coverage: string;
}

export interface CollegeStat {
  college: CollegeId;
  awards: number;
  active: number;
  funding: number; // obligated FY2022 onward
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
}

export interface Overview {
  totals: Totals;
  sources: SourceSummary[];
  updatedAt: string | null;
  byCollege: CollegeStat[];
  trend: YearStat[];
  topics: TopicSummary[];
  recent: Project[];
  crossCollege: Project[];
}

export interface TopicPerson {
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
  projects: Project[];
  related: TopicSummary[];
}

export interface AssistantSource {
  n: number;
  id: string;
  title: string;
  label: string;
  url: string;
}
