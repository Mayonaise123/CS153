import csv
import io
import httpx
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)
_db: dict = {}

RETRACTION_WATCH_URL = "https://gitlab.com/crossref/retraction-watch-data/-/raw/main/retraction_watch.csv"


def load_retraction_db():
    try:
        logger.info("Downloading Retraction Watch database...")
        response = httpx.get(RETRACTION_WATCH_URL, timeout=60, follow_redirects=True)
        if response.status_code != 200:
            logger.info(f"Failed to download Retraction Watch CSV: {response.status_code}")
            return
        reader = csv.DictReader(io.StringIO(response.text))
        count = 0
        for row in reader:
            doi = (row.get("OriginalPaperDOI") or "").strip().lower()
            if doi:
                _db[doi] = {
                    "retraction_reason": row.get("Reason"),
                    "retraction_date": row.get("RetractionDate"),
                    "retraction_doi": row.get("RetractionDOI"),
                }
                count += 1
        logger.info(f"Loaded {count} retracted papers from Retraction Watch")
    except Exception as e:
        logger.info(f"Retraction Watch download failed: {e} — retraction checking disabled")


async def check_retraction(doi: Optional[str], title: Optional[str]) -> Dict:
    result = {
        "is_retracted": False,
        "retraction_reason": None,
        "retraction_date": None,
        "retraction_doi": None,
    }
    if doi and doi.strip().lower() in _db:
        result["is_retracted"] = True
        result.update(_db[doi.strip().lower()])
    return result