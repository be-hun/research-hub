"""Response models. Field names mirror frontend/src/lib/types.ts exactly (camelCase)."""

from typing import Literal

from pydantic import BaseModel

CollegeId = Literal["medicine", "public-health", "science-tech", "engineering", "business", "media", "education"]
Verification = Literal["faculty-confirmed", "public-award-record"]


class PI(BaseModel):
    name: str
    department: str


class Source(BaseModel):
    label: str
    url: str


class Match(BaseModel):
    reason: str
    evidence: list[str]


class Project(BaseModel):
    id: str
    title: str
    summary: str
    colleges: list[CollegeId]
    verification: Verification
    pi: PI
    funder: str
    startYear: int
    endYear: int
    source: Source
    updatedAt: str
    match: Match | None = None


class TeamMember(BaseModel):
    researcherId: str | None = None
    name: str
    role: str
    department: str
    college: CollegeId


class Funding(BaseModel):
    agency: str
    mechanism: str
    period: str
    total: str
    awardNumber: str


class Students(BaseModel):
    skills: list[str]
    notice: str


class ProjectDetail(Project):
    abstract: list[str]
    methodologies: list[str]
    funding: Funding
    team: list[TeamMember]
    students: Students
    relatedProjectIds: list[str]


class Publication(BaseModel):
    title: str
    authors: str
    venue: str
    year: int
    doi: str


class ResearcherProfile(BaseModel):
    id: str
    name: str
    initials: str
    title: str
    college: CollegeId
    department: str
    verified: bool
    orcid: str | None = None
    summary: str
    focus: list[str]
    about: str
    projectIds: list[str]
    publications: list[Publication]
    accepting: str | None = None


class CollaboratorMatch(BaseModel):
    researcherId: str
    name: str
    initials: str
    college: CollegeId
    title: str
    score: int
    reasons: list[str]
    citations: list[str]
    sharedTopics: list[str]


class SearchResponse(BaseModel):
    query: str
    interpretedAs: str
    total: int
    page: int
    pageSize: int
    results: list[Project]
