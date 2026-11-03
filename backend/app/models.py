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


IdentityConfidence = Literal["high", "medium", "low"]


class ResearcherCounts(BaseModel):
    grants: int
    trials: int
    publications: int


class ResearcherProject(BaseModel):
    role: str  # their role on the record, as the source lists it
    project: Project


class ResearcherCollaborator(BaseModel):
    researcherId: str
    name: str
    college: CollegeId | None
    department: str
    identityConfidence: IdentityConfidence
    sharedRecords: int
    crossCollege: bool  # both have a college and the colleges differ
    projectIds: list[str]  # the shared records: every collaborator link is backed by these


class ResearcherAlias(BaseModel):
    source: str  # source label, e.g. "NIH RePORTER"
    name: str  # the name as that source spells it
    sourcePersonId: str | None
    evidence: Literal["source-person-id", "name-within-source", "same-name-across-sources"]
    lastSeen: str | None


class ResearcherSource(BaseModel):
    label: str
    url: str
    records: int
    lastSeen: str | None


class ResearcherFocus(BaseModel):
    id: str  # topic id
    name: str
    image: str | None
    records: int


class ResearcherYear(BaseModel):
    year: int  # start year
    grants: int
    trials: int
    publications: int


class ResearcherProfile(BaseModel):
    id: str
    name: str
    initials: str
    college: CollegeId | None
    department: str
    verified: bool  # confirmed by the researcher; always false until the correction workflow exists
    identityConfidence: IdentityConfidence
    identityNote: str
    orcid: str | None = None
    roles: list[str]  # the roles sources list them in ("Contact PI", "Author"...); never a job title
    summary: str  # built from counts, not generated
    focus: list[ResearcherFocus]  # plain-language topics of their records
    terms: list[str]  # subject terms frequent in their records and rare elsewhere
    counts: ResearcherCounts
    byYear: list[ResearcherYear]  # records by start year, oldest first
    projects: list[ResearcherProject]  # every record they are listed on, newest first
    collaborators: list[ResearcherCollaborator]
    aliases: list[ResearcherAlias]
    sources: list[ResearcherSource]
    about: str


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
    messages: list[ChatMessage] = Field(min_length=1, max_length=8)

    @model_validator(mode="after")
    def ends_with_user(self):
        if self.messages[-1].role != "user":
            raise ValueError("the last message must be from the user")
        return self


class AssistantRecord(BaseModel):
    n: int  # the [n] number the summary cites
    takeaway: str  # one line from the model: why this record answers the question
    project: Project  # facts come from the database, not the model


class PersonRecord(BaseModel):
    n: int
    id: str
    title: str
    kind: Kind
    role: str  # their role on it: "Contact PI", "Author", "Study official"...


class PersonCounts(BaseModel):
    grants: int
    trials: int
    publications: int


class AssistantPerson(BaseModel):
    name: str
    department: str
    college: CollegeId | None
    focus: str  # a few words from the model
    records: list[PersonRecord]  # retrieved records they appear on
    totals: PersonCounts  # every Temple record they appear on


class AssistantReply(BaseModel):
    mode: Literal["people", "research", "none"]  # none: nothing found or not answerable
    summary: str
    records: list[AssistantRecord]
    people: list[AssistantPerson]
    followUps: list[str]


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
    researcherId: str
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


# ---------- colleges ----------

class CollegeSummary(BaseModel):
    id: CollegeId
    name: str
    awards: int
    active: int
    funding: int  # grant money obligated FY2022 onward, same rule as Overview.byCollege
    trials: int
    publications: int
    researchers: int  # researchers whose profile is assigned to this college


class CollegeTopic(BaseModel):
    id: str
    name: str
    image: str | None
    records: int  # grants + trials + publications in this college with this topic
    awards: int


class CollegeResearcher(BaseModel):
    researcherId: str
    name: str
    department: str
    identityConfidence: IdentityConfidence
    records: int


class CollegePartner(BaseModel):
    college: CollegeId
    records: int  # grants with investigators from both colleges


class CollegeDashboard(BaseModel):
    college: CollegeSummary
    fundingYears: list[int]  # [first, last] fiscal year behind `funding` and `trend`; empty when there is none
    updatedAt: str | None
    trend: list[YearStat]
    topics: list[CollegeTopic]
    researchers: list[CollegeResearcher]
    partners: list[CollegePartner]
    crossCollege: list[Project]
    recent: list[Project]
    sources: list[SourceSummary]  # records per source in this college
    unassignedRecords: int  # records Temple-wide with no college; they appear on no college page


# ---------- people directory ----------

class PersonSummary(BaseModel):
    researcherId: str
    name: str
    initials: str
    college: CollegeId | None
    department: str
    identityConfidence: IdentityConfidence
    counts: ResearcherCounts
    topics: list[TopicRef]  # their two most frequent topics


class PeopleResponse(BaseModel):
    query: str
    total: int
    page: int
    pageSize: int
    sort: Literal["records", "name"]
    results: list[PersonSummary]
    colleges: list[FacetValue]  # people per college for the current query, ignoring the college filter
