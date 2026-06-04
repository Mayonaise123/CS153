import httpx
import json
import os
from typing import List, Dict

SUMMARIZER_API_KEY = os.getenv("SUMMARIZER_API_KEY", "")
MODEL = "anthropic/claude-sonnet-4-6"

SUMMARIZER_PROMPT = """You are Agent SUMMARIZER, an expert academic integrity analyst. You have just reviewed all citation verifications for a research paper.

Here are the verification results:
{results_json}

Write a structured integrity report. Return ONLY a JSON object:
{{
  "integrity_score": 0-100,
  "verdict_label": "PASS" | "REVIEW NEEDED" | "CONCERNS FOUND" | "SERIOUS ISSUES",
  "summary": "2-3 sentence overview of the paper's citation integrity",
  "key_concerns": ["list of the most important issues found, max 4 items"],
  "patterns": "any systematic patterns in how citations are used or misused",
  "recommendation": "one clear sentence on what should happen next"
}}

Scoring guide:
- 90-100: All or nearly all claims well-supported
- 70-89: Minor issues, mostly solid
- 50-69: Notable concerns worth investigating
- 0-49: Serious integrity problems"""


async def summarize_results(results: List[Dict]) -> Dict:
    if not results:
        return _empty()

    results_text = json.dumps([
        {
            "claim": r["claim"],
            "verdict": r["verdict"],
            "explanation": r["explanation"],
            "is_retracted": r.get("is_retracted", False),
        }
        for r in results
    ], indent=2)

    prompt = SUMMARIZER_PROMPT.format(results_json=results_text[:6000])

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {SUMMARIZER_API_KEY}",
                "Content-Type": "application/json",
                "X-Title": "CiteClaim Summarizer Agent",
            },
            json={
                "model": MODEL,
                "max_tokens": 600,
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
    return {
        "integrity_score": None,
        "verdict_label": "UNKNOWN",
        "summary": "Could not generate summary.",
        "key_concerns": [],
        "patterns": None,
        "recommendation": None,
    }
