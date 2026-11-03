import type {
  CollegeDashboard,
  CollegeSummary,
  Overview,
  Project,
  ProjectDetail,
  ResearcherProfile,
  SearchParams,
  SearchResponse,
  TopicDetail,
  TopicSummary,
} from "./types";

// The backend API (see backend/ and docs/api.md).
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

async function getOrNull<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

export function searchQueryString(params: SearchParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  params.colleges?.forEach((c) => qs.append("college", c));
  params.funders?.forEach((f) => qs.append("funder", f));
  params.status?.forEach((s) => qs.append("status", s));
  params.topics?.forEach((t) => qs.append("topic", t));
  params.kinds?.forEach((k) => qs.append("kind", k));
  params.funding?.forEach((f) => qs.append("funding", f));
  return qs.toString();
}

export const searchProjects = (params: SearchParams) => get<SearchResponse>(`/api/search?${searchQueryString(params)}`);
export const getOverview = () => get<Overview>("/api/overview");
export const getTopics = () => get<TopicSummary[]>("/api/topics");
export const getTopic = (id: string) => getOrNull<TopicDetail>(`/api/topics/${encodeURIComponent(id)}`);
export const getProject = (id: string) => getOrNull<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`);
export const getProjects = (ids: string[]) =>
  ids.length ? get<Project[]>(`/api/projects?ids=${ids.map(encodeURIComponent).join(",")}`) : Promise.resolve([]);
export const getResearcher = (id: string) => getOrNull<ResearcherProfile>(`/api/researchers/${encodeURIComponent(id)}`);
export const getColleges = () => get<CollegeSummary[]>("/api/colleges");
export const getCollege = (id: string) => getOrNull<CollegeDashboard>(`/api/colleges/${encodeURIComponent(id)}`);
