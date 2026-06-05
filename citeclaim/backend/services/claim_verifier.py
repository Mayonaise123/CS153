import httpx
import json
import os
from typing import Dict

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
MODEL = "anthropic/claude-sonnet-4-6"

VERIFICATION_PROMPT = """You are a rigorous academic fact-checker. Determine whether a cited paper actually supports the specific claim an author makes about it.

CLAIM BEING MADE:
{claim}

CONTENT OF THE CITED PAPER:
{paper_text}

Does the cited paper's content actually support this specific claim?

Return ONLY a JSON object, no markdown, no explanation:
{{
  "verdict": "supported" | "partially_supported" | "unsupported" | "cannot_determine",
  "explanation": "1-2 sentences explaining your verdict",
  "confidence": 0-100,
  "excerpt": "most relevant quote from cited paper, or null"
}}

Verdict definitions:
- "supported": cited paper clearly and directly supports the claim
- "partially_supported": cited paper somewhat supports the claim but with important caveats
- "unsupported": cited paper does NOT support the claim, or contradicts it
- "cannot_determine": insufficient text to make a determination"""


async def verify_claim(claim: str, cited_paper_text: str) -> Dict:
    prompt = VERIFICATION_PROMPT.format(
        claim=claim,
        paper_text=cited_paper_text[:4000]
    )

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": MODEL,
                "max_tokens": 500,
                "messages": [{"role": "user", "content": prompt}],
            },
        )

    if response.status_code != 200:
        return fallback_verdict("API error during verification")

    content = response.json()["choices"][0]["message"]["content"].strip()
    content = content.replace("```json", "").replace("```", "").strip()

    try:
        result = json.loads(content)
        verdict = result.get("verdict", "cannot_determine")
        if verdict not in ["supported", "partially_supported", "unsupported", "cannot_determine"]:
            verdict = "cannot_determine"
        return {
            "verdict": verdict,
            "explanation": result.get("explanation", "No explanation provided."),
            "confidence": result.get("confidence", 0),
            "excerpt": result.get("excerpt", None),
        }
    except json.JSONDecodeError:
        return fallback_verdict("Could not parse LLM response")


def fallback_verdict(reason: str) -> Dict:
    return {
        "verdict": "cannot_determine",
        "explanation": reason,
        "confidence": 0,
        "excerpt": None,
    }