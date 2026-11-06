"""Funding calls from Grants.gov: search, filters and detail. Filters, sorting and counts are SQL.

Stub from the contract PR; the API agent fills it in. Every function already has its final signature.
"""

from app import models
from app.db import Connection

PAGE_SIZE = 20
OPEN = ["posted", "forecasted"]


def search(
    conn: Connection,
    q: str,
    page: int,
    agencies: list[str],
    statuses: list[str],
    categories: list[str],
    universities_only: bool,
    closes_within: int | None,
    sort: models.OpportunitySort,
) -> models.OpportunitySearchResponse:
    """Calls matching q (title, description, number, agency). With no status filter, posted and forecasted only."""
    return models.OpportunitySearchResponse(
        query=q, total=0, page=page, pageSize=PAGE_SIZE, sort=sort, results=[],
        facets=models.OpportunityFacets(agencies=[], status=[], categories=[]),
    )


def detail(conn: Connection, opportunity_id: str) -> models.OpportunityDetail | None:
    """One call with its full text and Temple's past awards under the same assistance listings; None if unknown."""
    return None


def for_project(conn: Connection, project_id: str) -> list[models.Opportunity] | None:
    """Open calls sharing an assistance listing with this award, soonest deadline first; None if the project is unknown."""
    return []
