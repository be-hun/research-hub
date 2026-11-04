import type {
  CollegeDashboard,
  CollegeSummary,
  DemoResearcherProfile,
  Overview,
  PeopleParams,
  PeopleResponse,
  Project,
  ProjectDetail,
  ResearcherProfile,
  ResearcherCompatibility,
  SearchParams,
  SearchResponse,
  TopicDetail,
  TopicSummary,
} from "./types";

// The backend API (see backend/ and docs/api.md).
// Server components call the API directly (API_URL, read at runtime). The browser calls /api/... on the site's own
// origin by default: the rewrite in next.config.mjs (or nginx in production) forwards it to the backend, so it works
// from any address (localhost, 127.0.0.1, a LAN IP or a shared URL) without CORS. Set NEXT_PUBLIC_API_URL at build
// time only to make the browser call a different API host directly.
const SERVER_API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"; // "" falls through
const BROWSER_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const API_URL = typeof window === "undefined" ? SERVER_API_URL : BROWSER_API_URL;

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
export const getResearcherCompatibility = (id: string) =>
  get<ResearcherCompatibility>(`/api/researchers/${encodeURIComponent(id)}/compatibility`);
export const getDemoProfile = () => get<DemoResearcherProfile>("/api/demo-profile");
export const getColleges = () => get<CollegeSummary[]>("/api/colleges");
export const getCollege = (id: string) => getOrNull<CollegeDashboard>(`/api/colleges/${encodeURIComponent(id)}`);

export function peopleQueryString(p: PeopleParams): string {
  const qs = new URLSearchParams();
  if (p.q) qs.set("q", p.q);
  if (p.page && p.page > 1) qs.set("page", String(p.page));
  p.colleges?.forEach((c) => qs.append("college", c));
  if (p.kind) qs.set("kind", p.kind);
  if (p.sort && p.sort !== "records") qs.set("sort", p.sort);
  return qs.toString();
}
export const getPeople = (p: PeopleParams) => get<PeopleResponse>(`/api/researchers?${peopleQueryString(p)}`);
