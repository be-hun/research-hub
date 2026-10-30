import { MOCK_MATCHES, MOCK_OPPORTUNITIES, MOCK_PROJECTS, MOCK_PROJECT_DETAILS, MOCK_RESEARCHERS } from "./mock";
import type { CollaboratorMatch, NewOpportunity, Opportunity, Project, ProjectDetail, ResearcherProfile, SearchParams, SearchResponse } from "./types";

// Set NEXT_PUBLIC_API_URL to point at the backend. Unset = use mock data.
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function searchProjects(params: SearchParams): Promise<SearchResponse> {
  if (API_URL) {
    const qs = new URLSearchParams({ q: params.q, page: String(params.page ?? 1) });
    params.colleges?.forEach((c) => qs.append("college", c));
    params.funders?.forEach((f) => qs.append("funder", f));
    params.verification?.forEach((v) => qs.append("verification", v));
    const res = await fetch(`${API_URL}/api/search?${qs}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return res.json();
  }

  return {
    query: params.q,
    interpretedAs: "AI methods + health + clinical settings",
    total: MOCK_PROJECTS.length,
    page: 1,
    pageSize: 10,
    results: MOCK_PROJECTS,
  };
}

export async function getFeaturedProjects(): Promise<Project[]> {
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/projects/featured`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Featured failed: ${res.status}`);
    return res.json();
  }
  return MOCK_PROJECTS.slice(0, 3);
}

export async function getProject(id: string): Promise<ProjectDetail | null> {
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/projects/${id}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Project failed: ${res.status}`);
    return res.json();
  }
  if (MOCK_PROJECT_DETAILS[id]) return MOCK_PROJECT_DETAILS[id];
  const base = MOCK_PROJECTS.find((p) => p.id === id);
  if (!base) return null;
  return {
    ...base,
    abstract: [base.summary],
    methodologies: [],
    funding: {
      agency: base.funder,
      mechanism: "",
      period: `${base.startYear} – ${base.endYear}`,
      total: "n/a",
      awardNumber: "n/a",
    },
    team: [],
    students: { skills: [], notice: "" },
    relatedProjectIds: [],
  };
}

export async function getProjects(ids: string[]): Promise<Project[]> {
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/projects?ids=${ids.join(",")}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Projects failed: ${res.status}`);
    return res.json();
  }
  const all = [...MOCK_PROJECTS, ...Object.values(MOCK_PROJECT_DETAILS)];
  return ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Project => Boolean(p));
}

export async function getResearcher(id: string): Promise<ResearcherProfile | null> {
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/researchers/${id}`, { cache: "no-store" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Researcher failed: ${res.status}`);
    return res.json();
  }
  return MOCK_RESEARCHERS[id] ?? null;
}

/** Whether a researcher profile page exists (so cards only link to real pages). */
export function hasResearcherProfile(id?: string): boolean {
  return !API_URL && id ? id in MOCK_RESEARCHERS : Boolean(id);
}

export async function getCollaboratorMatches(researcherId: string): Promise<CollaboratorMatch[]> {
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/researchers/${researcherId}/matches`, { cache: "no-store" });
    if (res.status === 404) return []; // matches endpoint not built yet
    if (!res.ok) throw new Error(`Matches failed: ${res.status}`);
    return res.json();
  }
  return MOCK_MATCHES;
}

export async function getOpportunities(): Promise<Opportunity[]> {
  if (API_URL) {
    const res = await fetch(`${API_URL}/api/opportunities`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Opportunities failed: ${res.status}`);
    return res.json();
  }
  return MOCK_OPPORTUNITIES;
}

/** Callable from client components. Without a backend the post is not persisted. */
export async function createOpportunity(body: NewOpportunity): Promise<{ persisted: boolean }> {
  if (!API_URL) return { persisted: false };
  const res = await fetch(`${API_URL}/api/opportunities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Create opportunity failed: ${res.status}`);
  return { persisted: true };
}
