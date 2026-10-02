"""
backend/rag/live_searcher.py

Optional, opt-in live search layer. Off unless ENABLE_LIVE_SEARCH=true AND
the caller explicitly requests it (use_live_search=True in RAGRequest).

Primary: Tavily (tavily-python) — built for RAG, returns cleaned content,
real free tier. Falls back to `ddgs` only if no TAVILY_API_KEY is set.

Every result carries retrieved_at so it can be snapshotted into the report
at generation time and remain auditable even if the source page changes.
"""

import os
from datetime import datetime, timezone
from typing import List

TRUSTED_DOMAINS = [
    "cdc.gov", "nih.gov", "aap.org", "nice.org.uk", "who.int",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def search_tavily(query: str, api_key: str, max_results: int = 4) -> List[dict]:
    from tavily import TavilyClient
    client = TavilyClient(api_key=api_key)
    resp = client.search(
        query=query,
        max_results=max_results,
        include_domains=TRUSTED_DOMAINS,
        search_depth="advanced",
    )
    timestamp = _now_iso()
    return [
        {
            "text": r.get("content", ""),
            "title": r.get("title", "Untitled"),
            "url": r.get("url"),
            "source_type": "live",
            "publisher": "Tavily search result",
            "retrieved_at": timestamp,
        }
        for r in resp.get("results", [])
    ]


def search_ddgs(query: str, max_results: int = 4) -> List[dict]:
    try:
        from ddgs import DDGS  # primary modern ddgs package
    except ImportError:
        from duckduckgo_search import DDGS  # fallback if duckduckgo_search installed
        
    timestamp = _now_iso()
    domain_filter = " OR ".join(f"site:{d}" for d in TRUSTED_DOMAINS)
    full_query = f"{query} ({domain_filter})"
    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(full_query, max_results=max_results):
            results.append({
                "text": r.get("body", ""),
                "title": r.get("title", "Untitled"),
                "url": r.get("href"),
                "source_type": "live",
                "publisher": "Web search result (unverified snippet)",
                "retrieved_at": timestamp,
            })
    return results


def live_search(query: str, max_results: int = 4) -> List[dict]:
    """Returns [] on any failure rather than raising — a live-search outage
    should degrade to corpus-only, not break the whole recommendation."""
    if os.environ.get("ENABLE_LIVE_SEARCH", "true").lower() == "false":
        return []

    tavily_key = os.environ.get("TAVILY_API_KEY")
    try:
        if tavily_key:
            return search_tavily(query, tavily_key, max_results)
        return search_ddgs(query, max_results)
    except Exception as e:
        print(f"[live_searcher] live search failed, degrading to corpus-only: {e}")
        return []


if __name__ == "__main__":
    os.environ["ENABLE_LIVE_SEARCH"] = "true"
    test_query = "ASD M-CHAT-R high risk follow-up next steps clinical guideline"
    results = live_search(test_query)
    if not results:
        print("No live results (missing TAVILY_API_KEY / ddgs, or ENABLE_LIVE_SEARCH unset). "
              "This is expected fallback behavior, not an error.")
    for r in results:
        print(f"- {r['title']} ({r['url']}) [retrieved {r['retrieved_at']}]")
