"""Response models: the single source of truth for the API contract (camelCase field names).

frontend/src/lib/types.ts is generated from this file by `uv run python -m app.contract`, and `#` comments here
carry over to it, so document fields here. A test fails when types.ts is stale.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.topics import BY_ID

CollegeId = Literal["medicine", "public-health", "science-tech", "engineering", "business", "media", "education",
                    "liberal-arts"]
Verification = Literal["faculty-confirmed", "public-award-record", "public-registry-record", "public-publication-record"]
Kind = Literal["award", "trial", "publication"]  # grant, clinical trial, publication
MatchBand = Literal["Strong overlap", "Good overlap", "Some overlap"]  # a match score in words (compatibility.band_for)


class PI(BaseModel):
    name: str
    department: str


class Source(BaseModel):
    label: str
    url: str


class Match(BaseModel):
    reason: str
    evidence: list[str]
    snippet: str | None = None  # search only: ~30 words of the abstract around the matched words, each one in ⟦ ⟧


class Project(BaseModel):
    id: str
    kind: Kind  # grant ("award"), clinical trial or publication
    title: str
    summary: str
    colleges: list[CollegeId]
    verification: Verification
    pi: PI
    funder: str  # grants: "NIH R01"; trials: lead sponsor; publications: first funders
    agency: str  # grants: NIH, NSF, DOD...; trials: lead sponsor; publications: journal
    active: bool  # the source's own flag; for grants not proof a study is recruiting
    statusLabel: str  # "Active", "Recruiting", "Published 2025", ...
    fundingTypes: list[str]  # e.g. ["U.S. federal government", "Foundations & nonprofits"]
    amount: int | None  # grants: obligated in the latest fiscal year
    startYear: int
    endYear: int
    source: Source
    updatedAt: str  # ISO date
    match: Match | None = None  # only on search results: which stored fields matched the query


class TeamMember(BaseModel):
    researcherId: str | None = None
    name: str
    role: str
    department: str
    college: CollegeId | None  # null when the source names no department to map


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
    abstract: list[str]  # paragraphs
    methodologies: list[str]
    facts: list[Fact]  # the key facts for this kind of record, in display order
    funders: list[FunderRef]
    funding: Funding
    fundingByYear: list[YearAmount]
    topics: list[TopicRef]
    team: list[TeamMember]
    students: Students
    relatedProjectIds: list[str]


# high: one source person ID; medium: name match within one source; low: combined across sources by name.
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


class CompatibilityMatch(BaseModel):
    project: Project
    score: int
    band: MatchBand
    reasons: list[str]
    sharedTopics: list[TopicRef]


class ResearcherCompatibility(BaseModel):
    researcherId: str
    researcherName: str
    isSynthetic: bool = False
    matches: list[CompatibilityMatch]


class DemoResearcherProfile(BaseModel):
    id: str
    name: str
    initials: str
    college: CollegeId
    department: str
    isSynthetic: bool = True
    bio: str
    interests: list[TopicRef]
    terms: list[str]
    compatibility: ResearcherCompatibility


class CollaboratorMatch(BaseModel):
    researcherId: str
    name: str
    initials: str
    college: CollegeId | None
    title: str
    score: int  # their best eligible record's score
    band: MatchBand
    rank: int  # 1-based place in the people ranking, the same on every surface
    reasons: list[str]
    citations: list[str]  # matching record ids, best first
    sharedTopics: list[str]


class ProfileInput(BaseModel):
    college: CollegeId | None = None
    topics: list[str] = Field(default_factory=list, max_length=8)
    terms: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("topics")
    @classmethod
    def known_topics(cls, value: list[str]) -> list[str]:
        unknown = [topic for topic in value if topic not in BY_ID]
        if unknown:
            raise ValueError(f"unknown topic id: {unknown[0]}")
        return value

    @field_validator("terms")
    @classmethod
    def bounded_terms(cls, value: list[str]) -> list[str]:
        if any(not 1 <= len(term) <= 40 for term in value):
            raise ValueError("each term must be between 1 and 40 characters")
        return value


class ForYou(BaseModel):
    trials: list[CompatibilityMatch]
    grants: list[CompatibilityMatch]
    collaborators: list[CollaboratorMatch]  # the first 6 of the people ranking
    collaboratorTotal: int  # how many people share the profile's interests (the ranking's length)


class PeopleMatches(BaseModel):
    total: int  # everyone in the ranking
    page: int
    pageSize: int
    results: list[CollaboratorMatch]  # this page of the ranking, in the same order as For you


class ResearcherMatch(BaseModel):
    score: int  # 0 when they are not in the ranking
    band: MatchBand | None  # None when they are not in the ranking
    rank: int | None  # their place in the people ranking, None when they are not in it
    total: int  # how many people are in the ranking
    eligible: bool  # False when none of their records is active or recent, so they can't be ranked
    reasons: list[str]
    sharedTopics: list[TopicRef]
    records: list[Project]


class ProjectMatchRequest(BaseModel):
    profile: ProfileInput
    ids: list[str] = Field(max_length=50)


class ProjectMatch(BaseModel):
    id: str
    score: int
    band: MatchBand
    reasons: list[str]


class ProjectMatches(BaseModel):
    matches: list[ProjectMatch]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=4000)


class AssistantRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)  # only the last 8 are used, from a user turn
    profile: ProfileInput | None = None

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
    researcherId: str | None = None  # their profile, /researchers/{researcherId}; null when no record links one
    name: str
    department: str
    college: CollegeId | None
    focus: str  # a few words from the model
    records: list[PersonRecord]  # retrieved records they appear on
    totals: PersonCounts  # every Temple record they appear on
    inYourMatches: bool = False  # one of the profile's For you collaborators; false when no profile was sent


class AssistantReply(BaseModel):
    mode: Literal["people", "research", "none"]  # none: nothing found or not answerable
    summary: str
    records: list[AssistantRecord]
    people: list[AssistantPerson]
    followUps: list[str]
    searchedFor: str = ""  # one plain line saying what was retrieved, e.g. "Recruiting clinical trials · heart failure"


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


# phrase: the top results contain the exact phrase; all: every result contains every word; any: no record had all
# the words, so results have any of them; browse: no query.
MatchMode = Literal["phrase", "all", "any", "browse"]


class SearchResponse(BaseModel):
    query: str
    interpretedAs: str
    matchMode: MatchMode = "browse"
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


class UnassignedStat(BaseModel):
    """Records in scope with no college, so the college rows plus this one add up to the totals."""
    awards: int
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
    unassigned: UnassignedStat


class TopicPerson(BaseModel):
    researcherId: str
    name: str
    college: CollegeId | None
    department: str
    records: int  # records of every kind on this topic


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
    unassigned: UnassignedStat


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


# ---------- AI summaries ----------

SummaryKind = Literal["project", "researcher", "topic", "college"]


class SummaryCitation(BaseModel):
    n: int  # the [n] used in the summary text
    id: str  # project id
    title: str
    kind: Kind


class SummaryPoint(BaseModel):
    text: str
    citations: list[int]  # [n] numbers, each one in `citations`


class AISummary(BaseModel):
    """A model-written summary of stored records, for display next to them. Never a source of facts on its own."""

    kind: SummaryKind
    id: str
    available: bool  # false when no summary could be written; `message` says why
    summary: str  # plain text with [n] citations; "" when unavailable
    points: list[SummaryPoint]
    citations: list[SummaryCitation]  # every record the model was given, numbered as in the text
    recordCount: int
    message: str | None
    generatedAt: str | None  # ISO time the summary was written (it is cached until the data changes)
    model: str | None


class IntroDraftRequest(BaseModel):
    researcherId: str = Field(min_length=1, max_length=200)
    profile: ProfileInput  # the sender's stated interests, as For you and Ask take them
    senderName: str | None = Field(default=None, max_length=80)  # signs the email; a placeholder when absent


class IntroDraft(BaseModel):
    """A short intro email from the profile's owner to a researcher, written only from records the two share.

    The model writes `subject` and `body`; everything else is read from the database. Never a source of facts.
    """

    researcherId: str
    researcherName: str
    available: bool  # false when there isn't enough real overlap to write one; `message` says why
    subject: str  # "" when unavailable
    body: str  # plain text, about 120 words; "" when unavailable
    citations: list[SummaryCitation]  # the shared records the email mentions, read from the database
    sharedTopics: list[TopicRef]  # topics the profile shares with the researcher's records
    band: MatchBand | None  # their overlap band in the people ranking; None when they aren't in it
    message: str | None
    model: str | None
