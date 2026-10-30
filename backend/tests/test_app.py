import re
from pathlib import Path

from fastapi.testclient import TestClient

from app import models
from app.main import create_app

TYPES_TS = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "types.ts"


def ts_fields(interface: str) -> set[str]:
    """Own (non-inherited) field names of a TypeScript interface in types.ts."""
    match = re.search(rf"export interface {interface}\b[^{{]*{{(.*?)\n}}", TYPES_TS.read_text(), re.DOTALL)
    assert match, f"{interface} not found in types.ts"
    return set(re.findall(r"^  (\w+)\??:", match.group(1), re.MULTILINE))


def own_fields(model: type) -> set[str]:
    parent = model.__mro__[1]
    inherited = set(getattr(parent, "model_fields", {}))
    return set(model.model_fields) - inherited


def test_models_match_frontend_types():
    for name in ["Project", "TeamMember", "YearAmount", "TopicRef", "ProjectDetail", "FacetValue", "Facets",
                 "SearchResponse", "Totals", "SourceSummary", "CollegeStat", "YearStat", "TopicSummary", "Overview",
                 "TopicPerson", "TopicDetail", "AssistantSource"]:
        assert own_fields(getattr(models, name)) == ts_fields(name), name


def test_health():
    client = TestClient(create_app(":memory:"))
    assert client.get("/health").json() == {"ok": True}
