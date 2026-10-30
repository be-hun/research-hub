"""Response models. Field names mirror frontend/src/lib/types.ts exactly (camelCase)."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

CollegeId = Literal["medicine", "public-health", "science-tech", "engineering", "business", "media", "education",
                    "liberal-arts"]
Verification = Literal["faculty-confirmed", "public-award-record", "public-registry-record", "public-publication-record"]
Kind = Literal["award", "trial", "publication"]


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
    kind: Kind  # grant ("award"), clinical trial or publication
    title: str
    summary: str
    colleges: list[CollegeId]
    verification: Verification
    pi: PI
    funder: str
    agency: str  # grants: NIH, NSF, DOD...; trials: lead sponsor; publications: journal
    active: bool  # the source's own flag; for grants not proof a study is recruiting
    statusLabel: str  # "Active", "Recruiting", "Published 2025", ...
    fundingTypes: list[str]  # e.g. ["U.S. federal government", "Foundations & nonprofits"]
    amount: int | None  # grants: obligated in the latest fiscal year
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
    college: CollegeId | None  # None when the source names no department to map


class Funding(BaseModel):
    agency: str
    mechanism: str
    period: str
    total: str
    awardNumber: str


class Students(BaseModel):
    skills: list[str]
    notice: str


class YearAmount(BaseModel):
    fiscalYear: int
    amount: int


class TopicRef(BaseModel):
    id: str
    name: str


class Fact(BaseModel):
    label: str
    value: str
    href: str | None = None


class FunderRef(BaseModel):
    name: str
    type: str  # funding type label


class ProjectDetail(Project):
    abstract: list[str]
    methodologies: list[str]
    facts: list[Fact]  # the key facts for this kind of record, in display order
    funders: list[FunderRef]
    funding: Funding
    fundingByYear: list[YearAmount]
    topics: list[TopicRef]
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
    label: str  # source name, e.g. "NIH RePORTER"
    url: str


class AssistantReply(BaseModel):
    reply: str
    sources: list[AssistantSource]


class FacetValue(BaseModel):
    value: str
    label: str
    count: int


class Facets(BaseModel):
    kinds: list[FacetValue]
    colleges: list[FacetValue]
    fundingTypes: list[FacetValue]
    funders: list[FacetValue]
    status: list[FacetValue]
    topics: list[FacetValue]


class SearchResponse(BaseModel):
    query: str
    interpretedAs: str
    total: int
    page: int
    pageSize: int
    results: list[Project]
    facets: Facets


# ---------- explore ----------

class Totals(BaseModel):
    awards: int
    active: int
    trials: int
    recruiting: int
    publications: int
    researchers: int
    colleges: int


class SourceSummary(BaseModel):
    label: str
    url: str
    records: int
    kind: str  # "grants", "clinical trials", "publications"
    coverage: str  # e.g. "Fiscal years 2022–2026"


class CollegeStat(BaseModel):
    college: CollegeId
    awards: int
    active: int
    funding: int  # grant money obligated FY2022 onward
    trials: int
    publications: int


class FundingTypeStat(BaseModel):
    type: str  # key, e.g. "foundation"
    label: str
    awards: int
    trials: int
    publications: int


class AgencyStat(BaseModel):
    agency: str  # NIH, NSF, DOD...
    funding: int
    awards: int


class YearStat(BaseModel):
    fiscalYear: int
    nih: int
    nsf: int
    other: int
    awards: int
    mayBeIncomplete: bool


class TopicSummary(BaseModel):
    id: str
    name: str
    blurb: str
    image: str | None
    awards: int
    active: int
    funding: int
    trials: int
    publications: int


class Overview(BaseModel):
    totals: Totals
    sources: list[SourceSummary]
    updatedAt: str | None
    byCollege: list[CollegeStat]
    fundingTypes: list[FundingTypeStat]
    federalByAgency: list[AgencyStat]
    trend: list[YearStat]
    topics: list[TopicSummary]
    recent: list[Project]
    recruiting: list[Project]
    publications: list[Project]
    crossCollege: list[Project]


class TopicPerson(BaseModel):
    name: str
    college: CollegeId | None
    department: str
    awards: int


class TopicDetail(BaseModel):
    topic: TopicSummary
    funders: list[str]  # the funder areas that define this topic
    byCollege: list[CollegeStat]
    trend: list[YearStat]
    people: list[TopicPerson]
    projects: list[Project]  # grants
    trials: list[Project]
    publications: list[Project]
    related: list[TopicSummary]
