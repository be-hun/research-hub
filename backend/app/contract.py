"""Generate the frontend's view of the API from the backend, so the contract has one source of truth.

`backend/app/models.py` defines every response; `backend/app/main.py` defines every route. From them this module
writes `frontend/src/lib/types.ts` (TypeScript interfaces, comments carried over) and the endpoint table in
`docs/api.md`. Edit the models or routes, then regenerate:

    uv run python -m app.contract          # rewrite types.ts and the docs/api.md endpoint table
    uv run python -m app.contract --check  # exit 1 when either is stale (CI runs this)
"""

import ast
import json
import re
import sys
import types
from pathlib import Path
from typing import Literal, Union, get_args, get_origin

from pydantic import BaseModel

from app import models

ROOT = Path(__file__).resolve().parents[2]
MODELS_PY = Path(models.__file__)
TYPES_TS = ROOT / "frontend" / "src" / "lib" / "types.ts"
API_MD = ROOT / "docs" / "api.md"
BEGIN = "<!-- BEGIN GENERATED: endpoints (uv run python -m app.contract) -->"
END = "<!-- END GENERATED: endpoints -->"

ALIASES = {name: obj for name, obj in vars(models).items() if get_origin(obj) is Literal}
SECTION = re.compile(r"^# -{3,} (.+?) -{3,}$")
FIELD_COMMENT = re.compile(r"^    (\w+)\s*:[^#]*#\s?(.*)$")


def ts_type(ann, use_aliases: bool = True) -> str:
    for name, alias in ALIASES.items() if use_aliases else ():
        if ann == alias:
            return name
    origin, args = get_origin(ann), get_args(ann)
    if ann is str:
        return "string"
    if ann in (int, float):
        return "number"
    if ann is bool:
        return "boolean"
    if ann is type(None):
        return "null"
    if ann is dict:
        return "object"
    if origin is Literal:
        return " | ".join(json.dumps(a) for a in args)
    if origin in (Union, types.UnionType):
        return " | ".join(ts_type(a) for a in args)
    if origin is list:
        inner = ts_type(args[0])
        return f"({inner})[]" if " | " in inner else f"{inner}[]"
    if origin is dict:
        return f"Record<{ts_type(args[0])}, {ts_type(args[1])}>"
    if isinstance(ann, type) and issubclass(ann, BaseModel):
        return ann.__name__
    raise TypeError(f"no TypeScript mapping for {ann!r}; add one to app/contract.py")


def _comment_above(lines: list[str], lineno: int) -> list[str]:
    """Plain `#` comment lines directly above a definition (1-based lineno), excluding section headers."""
    out, i = [], lineno - 2
    while i >= 0 and lines[i].startswith("#") and not SECTION.match(lines[i]):
        out.insert(0, lines[i].lstrip("#").strip())
        i -= 1
    return out


def _trailing(line: str) -> str | None:
    match = re.search(r"#\s?(.*)$", line)
    return match.group(1) if match else None


def _interface(model: type[BaseModel], node: ast.ClassDef, lines: list[str]) -> list[str]:
    parent = next(b for b in model.__bases__ if issubclass(b, BaseModel))
    inherited = set(parent.model_fields) if parent is not BaseModel else set()
    comments = {}
    for line in lines[node.lineno:node.end_lineno]:
        if match := FIELD_COMMENT.match(line):
            comments[match.group(1)] = match.group(2)
    out = []
    if doc := ast.get_docstring(node):
        out.append(f"/** {' '.join(doc.split())} */")
    extends = f" extends {parent.__name__}" if inherited else ""
    out.append(f"export interface {model.__name__}{extends} {{")
    for name, field in model.model_fields.items():
        if name in inherited:
            continue
        optional = not field.is_required() and field.default is None
        line = f"  {name}{'?' if optional else ''}: {ts_type(field.annotation)};"
        if name in comments:
            line += f" // {comments[name]}"
        out.append(line)
    out.append("}")
    return out


def render_types() -> str:
    source = MODELS_PY.read_text()
    lines = source.splitlines()
    tree = ast.parse(source)
    sections = {i + 1: m.group(1) for i, line in enumerate(lines) if (m := SECTION.match(line))}
    blocks: list[tuple[int, list[str]]] = [(n, [f"// ---------- {title} ----------"]) for n, title in sections.items()]

    for node in tree.body:
        doc = _comment_above(lines, node.lineno)
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name not in ALIASES:
                continue
            body = f"export type {name} = {ts_type(ALIASES[name], use_aliases=False)};"
            if note := _trailing(lines[node.end_lineno - 1]):
                body += f" // {note}"
            blocks.append((node.lineno, [f"/** {' '.join(doc)} */"] * bool(doc) + [body]))
        elif isinstance(node, ast.ClassDef):
            model = getattr(models, node.name, None)
            if isinstance(model, type) and issubclass(model, BaseModel):
                block = _interface(model, node, lines)
                blocks.append((node.lineno, [f"/** {' '.join(doc)} */"] * bool(doc) + block))

    header = [
        "// GENERATED from backend/app/models.py by `uv run python -m app.contract`. Do not edit by hand:",
        "// change the Pydantic model, then regenerate. Request-parameter types live in lib/api.ts.",
    ]
    body = "\n\n".join("\n".join(block) for _, block in sorted(blocks, key=lambda b: b[0]))
    return "\n".join(header) + "\n\n" + body + "\n"


def _headers(dependant) -> list[str]:
    """Request headers a route reads, including through its dependencies (X-Client-Id comes from one)."""
    names = [p.alias for p in dependant.header_params]
    for sub in dependant.dependencies:
        names += [n for n in _headers(sub) if n not in names]
    return names


def _params(route) -> str:
    parts = [f"`{p.alias}`{' (repeatable)' if get_origin(p.field_info.annotation) is list else ''}"
             for p in route.dependant.query_params]
    parts += [f"header `{'-'.join(w.capitalize() for w in name.split('-'))}`" for name in _headers(route.dependant)]
    if route.body_field is not None:
        parts.append(f"body: `{ts_type(route.body_field.field_info.annotation)}`")
    return ", ".join(parts) or "—"


def render_endpoints() -> str:
    from fastapi.routing import APIRoute

    from app.main import create_app

    rows = ["| Method | Path | Parameters | Returns |", "| --- | --- | --- | --- |"]
    for route in create_app(connect_db=False).routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api/"):
            continue
        for method in sorted(route.methods):
            returns = ts_type(route.response_model) if route.response_model is not None else "—"
            rows.append(f"| `{method}` | `{route.path}` | {_params(route)} | `{returns}` |")
    return "\n".join(rows)


def render_api_md() -> str:
    text = API_MD.read_text()
    start, end = text.index(BEGIN) + len(BEGIN), text.index(END)
    return text[:start] + "\n\n" + render_endpoints() + "\n\n" + text[end:]


def main(argv: list[str]) -> int:
    outputs = {TYPES_TS: render_types(), API_MD: render_api_md()}
    stale = [path for path, text in outputs.items() if not path.exists() or path.read_text() != text]
    if "--check" in argv:
        for path in stale:
            print(f"{path.relative_to(ROOT)} is out of date: run `uv run python -m app.contract` in backend/")
        return 1 if stale else 0
    for path in stale:
        path.write_text(outputs[path])
        print(f"wrote {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
