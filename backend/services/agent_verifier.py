import httpx
import json
import os
from typing import Dict
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

VERIFIER_API_KEY = os.getenv("VERIFIER_API_KEY", "")

MODEL = "anthropic/claude-sonnet-4-6"

VERIFICATION_PROMPT = """You are an academic fact-checker evaluating whether a cited paper supports a claim.

CLAIM:
{claim}

CITED PAPER CONTENT:
{paper_text}

DECISION RULES — follow these strictly:
1. Use "supported" if the paper's core contribution or findings are CONSISTENT with the claim, even if worded differently. Do not require the abstract to use the exact same words.
2. Use "partially_supported" ONLY if the paper supports part of the claim but another part is clearly wrong or overstated.
3. Use "unsupported" ONLY if the paper contradicts the claim OR is about a completely different topic.
4. Use "cannot_determine" ONLY if the text is too short or unrelated to make any judgment.

KEY RULE: If the paper is clearly about the same topic and its findings are directionally consistent with the claim, choose "supported" not "partially_supported". Reserve "partially_supported" for genuine mixed evidence.

Return ONLY this JSON:
{{
  "verdict": "supported" | "partially_supported" | "unsupported" | "cannot_determine",
  "explanation": "1-2 sentences with specific evidence from the paper",
  "confidence": 0-100,
  "excerpt": "direct quote or null"
}}"""

async def verify_claim(claim: str, cited_paper_text: str) -> Dict:
    prompt = VERIFICATION_PROMPT.format(
        claim=claim,
        paper_text=cited_paper_text[:8000]
    )

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {VERIFIER_API_KEY}",
                "Content-Type": "application/json",
                "X-Title": "CiteClaim Verifier Agent",
            },
            json={
                "model": MODEL,
                "max_tokens": 500,
                "temperature": 0,
                "messages": [{"role": "user", "content": prompt}],
            },
        )

    if response.status_code != 200:
        return _fallback("Verifier agent API error")

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
        return _fallback("Could not parse verifier response")


def _fallback(reason: str) -> Dict:
    return {
        "verdict": "cannot_determine",
        "explanation": reason,
        "confidence": 0,
        "excerpt": None,
    }
