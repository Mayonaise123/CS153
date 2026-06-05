from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import asyncio
import logging
from dotenv import load_dotenv

from services.pdf_parser import extract_text_and_references
from services.agent_extractor import extract_claims
from services.agent_resolver import resolve_citation
from services.agent_retraction import check_retraction, load_retraction_db
from services.agent_verifier import verify_claim
from services.agent_summarizer import summarize_results
from services.paper_fetcher import fetch_paper

load_dotenv(override=True)
# load_retraction_db()  # Downloads latest CSV from GitLab on startup
logging.basicConfig(level=logging.INFO, format="%(message)s")

app = FastAPI(title="CiteClaim API — 5-Agent Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "CiteClaim API running", "agents": ["EXTRACTOR", "RESOLVER", "RETRACTION", "VERIFIER", "SUMMARIZER"]}


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/analyze")
async def analyze_paper(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    # Step 1: Parse PDF
    logging.info(f"\n{'='*60}")
    logging.info(f"Analyzing: {file.filename}")
    logging.info(f"{'='*60}")
    try:
        paper_text, references = extract_text_and_references(pdf_bytes)
        logging.info(f"PDF parsed — {len(references)} references found: {list(references.keys())[:10]}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {str(e)}")

    # Step 2: Agent EXTRACTOR — pull all cited claims
    logging.info(f"\n[EXTRACTOR] Extracting cited claims...")
    try:
        claims = await extract_claims(paper_text)
        logging.info(f"Extracted {len(claims)} claims")
    except Exception as e:
        import traceback
        logging.info(f"EXTRACTOR FAILED: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Extractor agent failed: {str(e)}")

    # Step 3: Agent RESOLVER — clean up citation metadata for each claim
    logging.info(f"\n[RESOLVER] Resolving {len(claims)} citations...")

    async def resolve_one(claim):
        ref_key = claim.get("citation_key", "")
        raw_ref = references.get(ref_key, {}).get("raw", ref_key)
        logging.info(f"  Resolving [{ref_key}]: {str(raw_ref)[:80]}")
        resolved = await resolve_citation(raw_ref)
        parsed = references.get(ref_key, {})
        if not resolved.get("doi") and parsed.get("doi"):
            resolved["doi"] = parsed["doi"]
        if not resolved.get("title") and parsed.get("title"):
            resolved["title"] = parsed["title"]
        logging.info(f"  -> title={str(resolved.get('title','?'))[:50]}  doi={resolved.get('doi','none')}")
        return claim, resolved

    resolved_pairs = []
    for claim in claims:
        pair = await resolve_one(claim)
        resolved_pairs.append(pair)

    # Step 4: Fetch cited papers — sequential to avoid rate limits, cached for duplicates
    logging.info("Waiting 3s before fetching...")
    await asyncio.sleep(3)
    fetch_results = []
    for idx, (claim, resolved_meta) in enumerate(resolved_pairs):
        title_str = str(resolved_meta.get("title", "?"))[:60]
        logging.info(f"  [{idx+1}/{len(resolved_pairs)}] {title_str}")
        cited_text, fetch_status, fetched_doi = await fetch_paper(resolved_meta)
        # Use fetched DOI if resolver didn't find one
        if fetched_doi and not resolved_meta.get("doi"):
            resolved_meta["doi"] = fetched_doi
            logging.info(f"  -> DOI found via S2: {fetched_doi}")
        logging.info(f"  -> {fetch_status} | has_text={bool(cited_text)} | doi={resolved_meta.get('doi','none')}")
        fetch_results.append((claim, resolved_meta, cited_text, fetch_status))

    # Step 5: Agents RETRACTION + VERIFIER run in parallel per claim
    logging.info(f"\n[VERIFIER + RETRACTION] Checking {len(fetch_results)} claims...")

    async def check_and_verify(claim, resolved_meta, cited_text, fetch_status):
        doi = resolved_meta.get("doi")
        title = resolved_meta.get("title")

        retraction_task = check_retraction(doi, title)
        if cited_text:
            verify_task = verify_claim(claim["claim"], cited_text)
        else:
            async def no_paper():
                return {
                    "verdict": "cannot_determine",
                    "explanation": "Could not retrieve the cited paper.",
                    "confidence": 0,
                    "excerpt": None,
                }
            verify_task = no_paper()

        retraction_result, verdict = await asyncio.gather(retraction_task, verify_task)

        logging.info(f"  [{claim.get('citation_key','?')}] verdict={verdict['verdict']} retracted={retraction_result['is_retracted']}")

        return {
            "claim": claim["claim"],
            "citation_key": claim.get("citation_key", ""),
            "resolved_title": resolved_meta.get("title"),
            "fetch_status": fetch_status,
            "is_retracted": retraction_result["is_retracted"],
            "retraction_reason": retraction_result.get("retraction_reason"),
            "retraction_date": retraction_result.get("retraction_date"),
            **verdict,
        }

    results = list(await asyncio.gather(*[
        check_and_verify(c, r, t, s) for c, r, t, s in fetch_results
    ]))

    # Step 6: Agent SUMMARIZER
    logging.info(f"\n[SUMMARIZER] Generating integrity report...")
    integrity_report = await summarize_results(results)
    logging.info(f"Score: {integrity_report.get('integrity_score')} | Label: {integrity_report.get('verdict_label')}")

    verdicts = [r["verdict"] for r in results]
    summary = {
        "total": len(results),
        "supported": verdicts.count("supported"),
        "partially_supported": verdicts.count("partially_supported"),
        "unsupported": verdicts.count("unsupported"),
        "cannot_determine": verdicts.count("cannot_determine"),
        "retracted": sum(1 for r in results if r.get("is_retracted")),
    }

    logging.info(f"\nDone! {summary}")

    return JSONResponse({
        "summary": summary,
        "integrity_report": integrity_report,
        "results": results,
    })


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
