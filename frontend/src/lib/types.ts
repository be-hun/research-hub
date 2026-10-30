// API contract shared with the backend. See docs/api.md.

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
  funder: string; // e.g. "NIH R01"
  startYear: number;
  endYear: number;
  source: { label: string; url: string }; // e.g. NIH RePORTER
  updatedAt: string; // ISO date
  /** Present only on search results: why the AI matched this project. */
  match?: { reason: string; evidence: string[] };
}

export interface TeamMember {
  researcherId?: string;
  name: string;
  role: string;
  department: string;
  college: CollegeId;
}

export interface ProjectDetail extends Project {
  abstract: string[]; // paragraphs
  methodologies: string[];
  funding: { agency: string; mechanism: string; period: string; total: string; awardNumber: string };
  team: TeamMember[];
  students: { skills: string[]; notice: string };
  relatedProjectIds: string[];
}

export interface Publication {
  title: string;
  authors: string;
  venue: string;
  year: number;
  doi: string;
}

export interface ResearcherProfile {
  id: string;
  name: string;
  initials: string;
  title: string;
  college: CollegeId;
  department: string;
  verified: boolean;
  orcid?: string;
  summary: string; // AI-synthesized
  focus: string[];
  about: string;
  projectIds: string[];
  publications: Publication[];
  accepting?: string; // lab applicant notice, if taking students
}

export interface CollaboratorMatch {
  researcherId: string;
  name: string;
  initials: string;
  college: CollegeId;
  title: string;
  score: number; // 0-100
  reasons: string[];
  citations: string[];
  sharedTopics: string[];
}

export type OpportunityType = "research-assistant" | "fellowship" | "credit" | "volunteer";
export type StudentLevel = "undergraduate" | "masters" | "phd";

export interface Opportunity {
  id: string;
  title: string;
  type: OpportunityType;
  lab: string;
  sponsor: string; // faculty sponsor name
  projectId?: string;
  colleges: CollegeId[];
  description: string;
  skills: string[];
  levels: StudentLevel[];
  paid: boolean;
  hourlyRate?: number;
  hoursPerWeek: string;
  term: string;
  deadline: string; // ISO date
  verifiedByPI: boolean;
}

export type NewOpportunity = Omit<Opportunity, "id" | "verifiedByPI">;

export interface SearchResponse {
  query: string;
  interpretedAs: string;
  total: number;
  page: number;
  pageSize: number;
  results: Project[];
}

export interface SearchParams {
  q: string;
  page?: number;
  colleges?: CollegeId[];
  funders?: string[];
  verification?: Verification[];
}
