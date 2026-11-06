"""Who at Temple fits a funding call, and which calls fit a researcher. Deterministic overlap of stored fields; no
model call. A match is a discovery aid, not a recommendation to apply or a judgment of eligibility.

Stub from the contract PR; the matching agent fills it in. Every function already has its final signature.
"""

from app import models
from app.db import Connection

NOTICE = ("People whose public grants, trials or publications overlap this call's topic. It is not a recommendation "
          "or an eligibility check: read the call's own eligibility section before applying.")


def researchers_for(conn: Connection, opportunity_id: str) -> models.OpportunityResearchers | None:
    """Temple researchers whose records overlap the call; None if the call is unknown."""
    return models.OpportunityResearchers(opportunityId=opportunity_id, researchers=[], crossCollege=False, notice=NOTICE)


def for_researcher(conn: Connection, researcher_id: str) -> list[models.ResearcherOpportunity] | None:
    """Open calls that overlap a researcher's records, strongest first, at most 8; None if the researcher is unknown."""
    return []
