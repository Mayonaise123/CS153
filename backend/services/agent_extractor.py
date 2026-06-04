import httpx
import json
import os
import re
from typing import List, Dict
import logging

EXTRACTOR_API_KEY = os.getenv("EXTRACTOR_API_KEY", "")
MODEL = "anthropic/claude-sonnet-4-6"

EXTRACTION_PROMPT = """You are Agent EXTRACTOR, an academic research assistant specialized in identifying cited claims in research papers.

Given a CHUNK of a research paper, extract every sentence or claim that explicitly cites another paper.

For each cited claim, return:
- "claim": the exact sentence or claim being made
- "citation_key": the citation identifier used (e.g. "1", "Smith, 2020", "Jones et al., 2019")

Return ONLY a JSON array, no explanation, no markdown backticks. Example:
[
  {{"claim": "Transformers outperform RNNs on translation tasks [1].", "citation_key": "1"}},
  {{"claim": "BERT achieves state-of-the-art on GLUE benchmarks (Devlin et al., 2019).", "citation_key": "Devlin et al., 2019"}}
]

If no cited claims are found in this chunk, return an empty array: []

Paper chunk:
{text}"""


def chunk_paper(text: str, chunk_size: int = 6000, overlap: int = 500) -> List[str]:
    """Split paper body into overlapping chunks so no claims are missed at boundaries."""
    # Remove references section first
    ref_match = re.search(
        r'\n(References|Bibliography|Works Cited)\s*\n',
        text, re.IGNORECASE
    )
    if ref_match:
        text = text[:ref_match.start()]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        # Try to break at a sentence boundary
        if end < len(text):
            last_period = chunk.rfind('. ')
            if last_period > chunk_size * 0.7:
                chunk = chunk[:last_period + 1]

        chunks.append(chunk.strip())
        start += len(chunk) - overlap  # overlap so claims at boundaries aren't missed

    return [c for c in chunks if len(c) > 100]


async def extract_claims_from_chunk(chunk: str) -> List[Dict]:
    prompt = EXTRACTION_PROMPT.format(text=chunk)

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {EXTRACTOR_API_KEY}",
                "Content-Type": "application/json",
                "X-Title": "CiteClaim Extractor Agent",
            },
            json={
                "model": MODEL,
                "max_tokens": 2000,
                "messages": [{"role": "user", "content": prompt}],
            },
        )

    if response.status_code != 200:
        raise Exception(f"Extractor agent error: {response.text}")

    content = response.json()["choices"][0]["message"]["content"].strip()
    content = content.replace("```json", "").replace("```", "").strip()

    try:
        claims = json.loads(content)
        return claims if isinstance(claims, list) else []
    except json.JSONDecodeError:
        return []


def deduplicate_claims(claims: List[Dict]) -> List[Dict]:
    """Remove duplicate claims that appear in overlapping chunks."""
    seen = set()
    unique = []
    for claim in claims:
        # Use first 80 chars of claim as dedup key
        key = claim.get("claim", "")[:80].strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(claim)
    return unique


async def extract_claims(paper_text: str) -> List[Dict]:
    chunks = chunk_paper(paper_text, chunk_size=6000, overlap=500)
    logging.info(f"  Chunked paper into {len(chunks)} sections")
    
    all_claims = []
    for i, chunk in enumerate(chunks):
        logging.info(f"  Processing chunk {i+1}/{len(chunks)}...")
        chunk_claims = await extract_claims_from_chunk(chunk)
        logging.info(f"  Found {len(chunk_claims)} claims in chunk {i+1}")
        all_claims.extend(chunk_claims)

    deduped = deduplicate_claims(all_claims)
    logging.info(f"  Total after dedup: {len(deduped)} unique claims")
    return deduped