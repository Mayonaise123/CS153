import httpx
import asyncio
import logging
import os
from typing import Tuple, Optional, Dict
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

logger = logging.getLogger(__name__)

SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1"
UNPAYWALL_BASE = "https://api.unpaywall.org/v2"
FIELDS = "title,abstract,year,authors,externalIds"
S2_API_KEY = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")

_cache: Dict[str, Tuple[Optional[str], Optional[str]]] = {}


async def fetch_paper(ref_meta: Dict) -> Tuple[Optional[str], str, Optional[str]]:
    """Returns (text, status, doi)."""
    cache_key = ref_meta.get("doi") or ref_meta.get("title") or ref_meta.get("search_query", "")
    if cache_key and cache_key in _cache:
        cached_text, cached_doi = _cache[cache_key]
        logger.info(f"  [CACHE] {cache_key[:60]}")
        status = "found_cache" if cached_text else "not_found_cached"
        return cached_text, status, cached_doi

    text, status, doi = await _try_fetch(ref_meta)
    if cache_key:
        _cache[cache_key] = (text, doi)
    return text, status, doi


async def _try_fetch(ref_meta: Dict) -> Tuple[Optional[str], str, Optional[str]]:
    # Strategy 1: Semantic Scholar by DOI
    if ref_meta.get("doi"):
        text, doi = await _fetch_by_doi(ref_meta["doi"])
        if text:
            logger.info(f"  ✓ S2 DOI hit")
            return text, "found_doi", doi

    # Strategy 2: Semantic Scholar by title search
    title = ref_meta.get("title") or ref_meta.get("search_query")
    if title:
        await asyncio.sleep(0.3)
        text, doi = await _fetch_by_search(title)
        if text:
            logger.info(f"  ✓ S2 title hit: {title[:50]}")
            return text, "found_title", doi

    # Strategy 3: Semantic Scholar by author + title
    authors = ref_meta.get("authors", "")
    if authors and title:
        first_author = authors.split()[0]
        await asyncio.sleep(0.3)
        text, doi = await _fetch_by_search(f"{title[:50]} {first_author}")
        if text:
            logger.info(f"  ✓ S2 author hit")
            return text, "found_author", doi

    # Strategy 4: Unpaywall by DOI
    if ref_meta.get("doi"):
        await asyncio.sleep(0.3)
        text = await _fetch_from_unpaywall(ref_meta["doi"])
        if text:
            logger.info(f"  ✓ Unpaywall hit")
            return text, "found_unpaywall", ref_meta["doi"]

    # Strategy 5: arXiv search
    if title:
        await asyncio.sleep(0.3)
        text = await _fetch_from_arxiv(title)
        if text:
            logger.info(f"  ✓ arXiv hit: {title[:50]}")
            return text, "found_arxiv", None

    # Strategy 6: CrossRef DOI lookup → Unpaywall
    if title:
        await asyncio.sleep(0.3)
        doi = await _lookup_doi_from_crossref(title, authors)
        if doi:
            logger.info(f"  CrossRef found DOI: {doi}")
            text = await _fetch_from_unpaywall(doi)
            if text:
                return text, "found_crossref_unpaywall", doi

    logger.info(f"  ✗ Not found: {title or ref_meta}")
    return None, "not_found", None


async def _fetch_by_doi(doi: str) -> Tuple[Optional[str], Optional[str]]:
    try:
        headers = {"x-api-key": S2_API_KEY} if S2_API_KEY else {}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{SEMANTIC_SCHOLAR_BASE}/paper/DOI:{doi.strip().rstrip('.')}",
                params={"fields": FIELDS},
                headers=headers,
            )
            if resp.status_code == 200:
                return _extract_text_and_doi(resp.json())
            logger.info(f"    DOI lookup -> {resp.status_code}")
    except Exception as e:
        logger.info(f"    DOI error: {e}")
    return None, None


async def _fetch_by_search(query: str, retries: int = 3) -> Tuple[Optional[str], Optional[str]]:
    headers = {"x-api-key": S2_API_KEY} if S2_API_KEY else {}
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{SEMANTIC_SCHOLAR_BASE}/paper/search",
                    params={"query": query.strip(), "fields": FIELDS, "limit": 3},
                    headers=headers,
                )
                if resp.status_code == 200:
                    for paper in resp.json().get("data", []):
                        text, doi = _extract_text_and_doi(paper)
                        if text:
                            return text, doi
                    return None, None
                elif resp.status_code == 429:
                    wait = 3 * (attempt + 1)
                    logger.info(f"    Rate limited, waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    logger.info(f"    Search -> {resp.status_code}")
                    return None, None
        except Exception as e:
            logger.info(f"    Search error: {e}")
    return None, None


async def _fetch_from_unpaywall(doi: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            resp = await client.get(
                f"{UNPAYWALL_BASE}/{doi.strip()}",
                params={"email": "citeclaim@example.com"}
            )
            if resp.status_code != 200:
                return None

            data = resp.json()
            best_location = data.get("best_oa_location") or {}
            pdf_url = best_location.get("url_for_pdf")

            if not pdf_url:
                abstract = data.get("abstract")
                title = data.get("title")
                if abstract:
                    parts = []
                    if title:
                        parts.append(f"Title: {title}")
                    parts.append(f"Abstract: {abstract}")
                    return "\n\n".join(parts)
                return None

            try:
                import fitz
                pdf_resp = await client.get(pdf_url, timeout=30)
                if pdf_resp.status_code == 200:
                    doc = fitz.open(stream=pdf_resp.content, filetype="pdf")
                    text = ""
                    for page in doc[:3]:
                        text += page.get_text()
                    if len(text) > 200:
                        return text[:5000]
            except Exception:
                pass

    except Exception as e:
        logger.info(f"    Unpaywall error: {e}")
    return None


async def _fetch_from_arxiv(title: str) -> Optional[str]:
    try:
        import re
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "http://export.arxiv.org/api/query",
                params={
                    "search_query": f"ti:{title[:60]}",
                    "max_results": 1,
                    "sortBy": "relevance"
                }
            )
            if resp.status_code == 200:
                summary = re.search(r'<summary>(.*?)</summary>', resp.text, re.DOTALL)
                arxiv_title = re.search(r'<entry>.*?<title>(.*?)</title>', resp.text, re.DOTALL)
                if summary and summary.group(1).strip():
                    text = f"Title: {arxiv_title.group(1).strip() if arxiv_title else title}\n\nAbstract: {summary.group(1).strip()}"
                    return text
    except Exception as e:
        logger.info(f"    arXiv error: {e}")
    return None


async def _lookup_doi_from_crossref(title: str, authors: str = "") -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.crossref.org/works",
                params={
                    "query.title": title[:80],
                    "rows": 1,
                    "select": "DOI,title"
                },
                headers={"User-Agent": "CiteClaim/1.0 (mailto:citeclaim@example.com)"}
            )
            if resp.status_code == 200:
                items = resp.json().get("message", {}).get("items", [])
                if items:
                    return items[0].get("DOI")
    except Exception as e:
        logger.info(f"    CrossRef error: {e}")
    return None


def _extract_text_and_doi(paper: Dict) -> Tuple[Optional[str], Optional[str]]:
    """Returns (text, doi). Only returns text if abstract exists."""
    if not paper.get("abstract"):
        return None, None

    parts = []
    if paper.get("title"):
        parts.append(f"Title: {paper['title']}")
    parts.append(f"Abstract: {paper['abstract']}")
    if paper.get("year"):
        parts.append(f"Year: {paper['year']}")
    if paper.get("authors"):
        parts.append("Authors: " + ", ".join(a.get("name", "") for a in paper["authors"][:5]))

    external_ids = paper.get("externalIds") or {}
    doi = external_ids.get("DOI") or external_ids.get("doi")

    return "\n\n".join(parts), doi