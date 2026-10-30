"""Shared HTTP helpers for the importers: polite headers and simple retries."""

import time

import httpx

USER_AGENT = "ResearchConnect student prototype (Temple AI Build Challenge)"


def client() -> httpx.Client:
    return httpx.Client(timeout=90, headers={"User-Agent": USER_AGENT})


def request_json(c: httpx.Client, method: str, url: str, attempts: int = 4, **kwargs) -> dict:
    for attempt in range(attempts):
        try:
            res = c.request(method, url, **kwargs)
            if res.status_code == 429 or res.status_code >= 500:
                raise httpx.HTTPStatusError(f"{res.status_code}", request=res.request, response=res)
            res.raise_for_status()
            return res.json()
        except httpx.HTTPError:
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** (attempt + 1))
    raise AssertionError("unreachable")
