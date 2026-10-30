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
