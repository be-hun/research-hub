import { MOCK_PROJECTS } from "./mock";
import type { Project, SearchParams, SearchResponse } from "./types";

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
