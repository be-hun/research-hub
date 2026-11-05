"""Every test gets its own empty Postgres schema, the way SQLite's :memory: gave each one an empty database.

Point TEST_DATABASE_URL at a throwaway database (never Supabase production). Locally:
    createdb research_hub_test            # default: postgresql:///research_hub_test
"""

import os
import uuid

import psycopg
import pytest
from psycopg.conninfo import make_conninfo

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "postgresql:///research_hub_test")
# Set before app.main is imported, since importing it builds the module-level app.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app import config  # noqa: E402


@pytest.fixture(autouse=True)
def database(monkeypatch):
    schema = f"test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as admin:
        admin.execute(f'CREATE SCHEMA "{schema}"')
    url = make_conninfo(TEST_DATABASE_URL, options=f"-c search_path={schema}")
    monkeypatch.setattr(config, "DATABASE_URL", url)
    yield url
    with psycopg.connect(TEST_DATABASE_URL, autocommit=True) as admin:
        admin.execute(f'DROP SCHEMA "{schema}" CASCADE')
