"""Response models. Field names mirror frontend/src/lib/types.ts exactly (camelCase)."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

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
    college: CollegeId | None  # None when NIH gives no department to map


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
    college: CollegeId | None
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


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=4000)


class AssistantRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def ends_with_user(self):
        if self.messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return self


class AssistantSource(BaseModel):
    n: int  # the [n] number used in the reply text
    id: str
    title: str
    url: str


class AssistantReply(BaseModel):
    reply: str
    sources: list[AssistantSource]


class SearchResponse(BaseModel):
    query: str
    interpretedAs: str
    total: int
    page: int
    pageSize: int
    results: list[Project]
