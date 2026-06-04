import httpx
import json
import os
from typing import Dict

RESOLVER_API_KEY = os.getenv("RESOLVER_API_KEY", "")
MODEL = "anthropic/claude-sonnet-4-6"

RESOLVER_PROMPT = """You are Agent RESOLVER, specialized in parsing academic citation strings into structured metadata for paper lookup.

Given a raw reference string, extract the best possible search metadata.

Raw reference: {raw_ref}

Return ONLY a JSON object, no markdown:
{{
  "title": "paper title if identifiable, else null",
  "authors": "last names only, space separated, e.g. LeCun Bengio Hinton",
  "year": "4-digit year or null",
  "doi": "DOI string if present, else null",
  "search_query": "best 4-8 word query to find this paper on Semantic Scholar"
}}"""


async def resolve_citation(raw_ref: str) -> Dict:
    if not raw_ref or len(raw_ref) < 10:
        return _empty()

    prompt = RESOLVER_PROMPT.format(raw_ref=raw_ref[:500])

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {RESOLVER_API_KEY}",
                "Content-Type": "application/json",
                "X-Title": "CiteClaim Resolver Agent",
            },
            json={
                "model": MODEL,
                "max_tokens": 300,
                "messages": [{"role": "user", "content": prompt}],
            },
        )

    if response.status_code != 200:
        return _empty()

    content = response.json()["choices"][0]["message"]["content"].strip()
    content = content.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return _empty()


def _empty() -> Dict:
    return {"title": None, "authors": None, "year": None, "doi": None, "search_query": None}
