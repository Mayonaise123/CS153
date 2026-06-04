import fitz  # PyMuPDF
import re
from typing import Tuple, Dict


def extract_text_and_references(pdf_bytes: bytes) -> Tuple[str, Dict]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text()

    references = parse_references(full_text)
    return full_text, references


def parse_references(text: str) -> Dict:
    ref_match = re.search(
        r'\n(References|Bibliography|Works Cited)\s*\n',
        text, re.IGNORECASE
    )
    if not ref_match:
        return {}

    ref_text = text[ref_match.end():]
    references = {}

    # Format 1: [1] Author, Title...
    numbered = re.findall(r'(?:^|\n)\[(\d+)\]\s*(.+?)(?=\n\[\d+\]|\Z)', ref_text, re.DOTALL)
    if numbered:
        for num, content in numbered:
            references[num] = {"raw": content.strip().replace('\n', ' ')}
        return references

    # Format 2: 1. Author, Title...
    dot_numbered = re.findall(r'(?:^|\n)(\d+)\.\s+(.+?)(?=\n\d+\.|\Z)', ref_text, re.DOTALL)
    if dot_numbered:
        for num, content in dot_numbered:
            references[num] = {"raw": content.strip().replace('\n', ' ')}
        return references

    # Format 3: Author-year style — split on blank lines
    entries = re.split(r'\n{2,}', ref_text.strip())
    for entry in entries:
        entry = entry.strip().replace('\n', ' ')
        if len(entry) < 20:
            continue
        key = _author_year_key(entry)
        if key:
            references[key] = {"raw": entry}

    return references


def _author_year_key(entry: str) -> str:
    m = re.match(r'([A-Za-z]+).*?\b(19|20\d{2})\b', entry)
    if m:
        return f"{m.group(1)}, {m.group(2)}"
    return entry[:30]