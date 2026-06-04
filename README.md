# CiteClaim — AI Citation Integrity Verifier

Does this paper actually say what the author claims it does?

CiteClaim runs a **5-agent AI pipeline** to extract every cited claim from a research paper, resolve and fetch the cited papers, check for retractions, and semantically verify whether each citation actually supports the claim being made.

---

## Architecture

```
PDF Upload
    ↓
Agent 1: EXTRACTOR   — Pulls every cited claim from the paper body
    ↓
Agent 2: RESOLVER    — Cleans raw citation strings into structured metadata
    ↓
(Semantic Scholar fetches cited papers)
    ↓
Agent 3: RETRACTION  — Cross-checks each paper against Retraction Watch
Agent 4: VERIFIER    — Checks if the cited paper supports the specific claim
    (run in parallel)
    ↓
Agent 5: SUMMARIZER  — Synthesizes all verdicts into an integrity report
    ↓
Dashboard (React)
```

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenRouter API key (openrouter.ai)

### Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env and add your OpenRouter key(s)

python main.py
# Runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

### .env

```
EXTRACTOR_API_KEY=sk-or-v1-...
RESOLVER_API_KEY=sk-or-v1-...
VERIFIER_API_KEY=sk-or-v1-...
SUMMARIZER_API_KEY=sk-or-v1-...
```

You can use the same key for all four variables — or create four separate keys in OpenRouter for independent rate limiting.

---

## What Each Verdict Means

| Verdict | Meaning |
|---------|---------|
| ✓ Supported | Cited paper clearly supports the claim |
| ◑ Partially Supported | Paper somewhat supports the claim, with caveats |
| ✗ Unsupported | Paper does not support the claim, or contradicts it |
| ? Cannot Determine | Insufficient text retrieved to make a determination |
| ⚠ Retracted | The cited paper has been retracted |

---

## Integrity Score

0–100 composite score:
- **90–100**: PASS — strong citation integrity
- **70–89**: REVIEW NEEDED — minor issues
- **50–69**: CONCERNS FOUND — notable problems
- **0–49**: SERIOUS ISSUES — significant integrity problems

---

## Limitations

- Relies on Semantic Scholar for paper retrieval; papers not indexed there return "cannot_determine"
- Retraction Watch API coverage varies
- LLM verification quality depends on abstract/text quality retrieved
- Works best on English-language papers with numbered or author-year citations

---

## AI Usage

This project uses:
- `anthropic/claude-sonnet-4-6` via OpenRouter for all agent calls
- Semantic Scholar Graph API (free, no key required) for paper retrieval
- Retraction Watch API (free) for retraction checking
