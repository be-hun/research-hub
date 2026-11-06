"""The API contract has one source of truth: models.py and main.py. The frontend types and docs are generated."""

from typing import Literal

from pydantic import BaseModel

from app import contract

REGENERATE = "stale: run `uv run python -m app.contract` in backend/ and commit the result"


def test_types_ts_is_generated_from_models():
    assert contract.TYPES_TS.read_text() == contract.render_types(), f"frontend/src/lib/types.ts is {REGENERATE}"


def test_api_md_endpoint_table_is_generated_from_routes():
    assert contract.API_MD.read_text() == contract.render_api_md(), f"docs/api.md endpoint table is {REGENERATE}"


def test_every_api_route_is_in_the_table():
    table = contract.render_endpoints()
    for path in ["/api/search", "/api/overview", "/api/researchers/{researcher_id}", "/api/assistant"]:
        assert f"`{path}`" in table


class Child(BaseModel):
    n: int


class Sample(BaseModel):
    name: str
    count: int | None
    tags: list[str]
    either: list[str | int]
    nested: Child
    mode: Literal["a", "b"]
    note: str | None = None  # None default: optional in TypeScript
    flag: bool = False  # other defaults are always serialized, so required


def test_type_mapping():
    fields = {name: contract.ts_type(f.annotation) for name, f in Sample.model_fields.items()}
    assert fields == {
        "name": "string", "count": "number | null", "tags": "string[]", "either": "(string | number)[]",
        "nested": "Child", "mode": '"a" | "b"', "note": "string | null", "flag": "boolean",
    }
