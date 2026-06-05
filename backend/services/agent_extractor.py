import httpx
import json
import os
import re
from typing import List, Dict
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

EXTRACTOR_API_KEY = os.getenv("EXTRACTOR_API_KEY", "")

MODEL = "anthropic/claude-sonnet-4-6"

EXTRACTION_PROMPT = """You are Agent EXTRACTOR, an academic research assistant specialized in identifying cited claims in research papers.

Given the text of a research paper, extract every sentence or claim that explicitly cites another paper.

For each cited claim, return:
- "claim": the exact sentence or claim being made
- "citation_key": the citation identifier used (e.g. "1", "Smith, 2020", "Jones et al., 2019")

Return ONLY a JSON array, no explanation, no markdown backticks. Example:
[
  {{"claim": "Transformers outperform RNNs on translation tasks [1].", "citation_key": "1"}},
  {{"claim": "BERT achieves state-of-the-art on GLUE benchmarks (Devlin et al., 2019).", "citation_key": "Devlin et al., 2019"}}
]

If no cited claims are found, return an empty array: []

Paper text:
{text}"""


async def extract_claims(paper_text: str) -> List[Dict]:
    truncated = truncate_to_body(paper_text, max_chars=8000)
    prompt = EXTRACTION_PROMPT.format(text=truncated)

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
                "temperature": 0,
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


def truncate_to_body(text: str, max_chars: int) -> str:
    ref_match = re.search(
        r'\n(References|Bibliography|Works Cited)\s*\n',
        text, re.IGNORECASE
    )
    if ref_match:
        text = text[:ref_match.start()]
    return text[:max_chars]