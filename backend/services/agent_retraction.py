import csv
import io
import httpx
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)
_db: dict = {}

RETRACTION_WATCH_URL = "https://gitlab.com/crossref/retraction-watch-data/-/raw/main/retraction_watch.csv"
_loaded = False


def load_retraction_db():
    try:
        logging.info("Downloading Retraction Watch database...")
        response = httpx.get(RETRACTION_WATCH_URL, timeout=60, follow_redirects=True)
        if response.status_code != 200:
            logging.info(f"Failed: {response.status_code}")
            return
        
        count = 0
        reader = csv.DictReader(io.StringIO(response.text))
        for row in reader:
            doi = (row.get("OriginalPaperDOI") or "").strip().lower()
            if not doi:
                continue
            # Only store the 3 fields you actually use — nothing else
            _db[doi] = {
                "retraction_reason": (row.get("Reason") or "")[:200],
                "retraction_date": (row.get("RetractionDate") or "")[:20],
                "retraction_doi": (row.get("RetractionDOI") or "")[:100],
            }
            count += 1
        
        # Free the response text immediately
        del response
        logging.info(f"Loaded {count} retracted papers")
    except Exception as e:
        logging.info(f"Retraction Watch failed: {e} — disabled")

async def check_retraction(doi: Optional[str], title: Optional[str]) -> Dict:
    global _loaded
    if not _loaded:
        load_retraction_db()
        _loaded = True
    
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