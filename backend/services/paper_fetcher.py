import httpx
import asyncio
import logging
from typing import Tuple, Optional, Dict
import os

logger = logging.getLogger(__name__)

SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1"
UNPAYWALL_BASE = "https://api.unpaywall.org/v2"
FIELDS = "title,abstract,year,authors,externalIds"
S2_API_KEY = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")

# Cache so duplicate citations (same paper cited 3 times) only fetch once
_cache: Dict[str, Optional[str]] = {}


async def fetch_paper(ref_meta: Dict) -> Tuple[Optional[str], str]:
    cache_key = ref_meta.get("doi") or ref_meta.get("title") or ref_meta.get("search_query", "")
    if cache_key and cache_key in _cache:
        cached = _cache[cache_key]
        logger.info(f"  [CACHE] {cache_key[:60]}")
        return (cached, "found_cache") if cached else (None, "not_found_cached")

    text, status = await _try_fetch(ref_meta)
    if cache_key:
        _cache[cache_key] = text
    return text, status


async def _try_fetch(ref_meta: Dict) -> Tuple[Optional[str], str]:
    # Strategy 1: Semantic Scholar by DOI
    if ref_meta.get("doi"):
        text = await _fetch_by_doi(ref_meta["doi"])
        if text:
            logger.info(f"  ✓ S2 DOI hit")
            return text, "found_doi"

    # Strategy 2: Semantic Scholar by title search
    title = ref_meta.get("title") or ref_meta.get("search_query")
    if title:
        await asyncio.sleep(1.1)
        text = await _fetch_by_search(title)
        if text:
            logger.info(f"  ✓ S2 title hit: {title[:50]}")
            return text, "found_title"

    # Strategy 3: Semantic Scholar by author + title
    authors = ref_meta.get("authors", "")
    if authors and title:
        first_author = authors.split()[0]
        await asyncio.sleep(1.1)
        text = await _fetch_by_search(f"{title[:50]} {first_author}")
        if text:
            logger.info(f"  ✓ S2 author hit")
            return text, "found_author"

    # Strategy 4: Unpaywall by DOI (gets full text PDFs for open-access papers)
    if ref_meta.get("doi"):
        await asyncio.sleep(1.1)
        text = await _fetch_from_unpaywall(ref_meta["doi"])
        if text:
            logger.info(f"  ✓ Unpaywall hit: {ref_meta['doi']}")
            return text, "found_unpaywall"

    logger.info(f"  ✗ Not found: {title or ref_meta}")
    return None, "not_found"


async def _fetch_by_doi(doi: str) -> Optional[str]:
    try:
        headers = {"x-api-key": S2_API_KEY} if S2_API_KEY else {}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{SEMANTIC_SCHOLAR_BASE}/paper/DOI:{doi.strip().rstrip('.')}",
                params={"fields": FIELDS},
                headers=headers
            )
            if resp.status_code == 200:
                return _extract_text(resp.json())
    except Exception as e:
        logger.info(f"    DOI error: {e}")
    return None

async def _fetch_by_search(query: str, retries: int = 2) -> Optional[str]:
    headers = {"x-api-key": S2_API_KEY} if S2_API_KEY else {}
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{SEMANTIC_SCHOLAR_BASE}/paper/search",
                    params={"query": query.strip(), "fields": FIELDS, "limit": 3},
                    headers=headers
                )
                if resp.status_code == 200:
                    for paper in resp.json().get("data", []):
                        text = _extract_text(paper)
                        if text:
                            return text
                    return None
                elif resp.status_code == 429:
                    wait = 5 * (attempt + 1)
                    logger.info(f"    Rate limited, waiting {wait}s...")
                    await asyncio.sleep(wait)
                else:
                    return None
        except Exception as e:
            logger.info(f"    Search error: {e}")
    return None


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
                # No PDF but we can use the abstract from Unpaywall metadata
                abstract = data.get("abstract")
                title = data.get("title")
                if abstract:
                    parts = []
                    if title:
                        parts.append(f"Title: {title}")
                    parts.append(f"Abstract: {abstract}")
                    return "\n\n".join(parts)
                return None

            # Try to fetch and parse the actual PDF
            try:
                import fitz  # PyMuPDF
                pdf_resp = await client.get(pdf_url, timeout=30)
                if pdf_resp.status_code == 200:
                    doc = fitz.open(stream=pdf_resp.content, filetype="pdf")
                    text = ""
                    for page in doc[:3]:  # First 3 pages is enough for verification
                        text += page.get_text()
                    if len(text) > 200:
                        return text[:5000]
            except Exception:
                pass  # PDF parsing failed, fall through

    except Exception as e:
        logger.info(f"    Unpaywall error: {e}")
    return None


def _extract_text(paper: Dict) -> Optional[str]:
    if not paper.get("abstract"):
        return None
    parts = []
    if paper.get("title"):
        parts.append(f"Title: {paper['title']}")
    parts.append(f"Abstract: {paper['abstract']}")
    if paper.get("year"):
        parts.append(f"Year: {paper['year']}")
    if paper.get("authors"):
        parts.append("Authors: " + ", ".join(a.get("name", "") for a in paper["authors"][:5]))
    return "\n\n".join(parts)