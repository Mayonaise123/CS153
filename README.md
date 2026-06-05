# CiteClaim — AI Citation Verifier

Does this paper actually say what the author claims it does?

CiteClaim runs an **Agent-to-Agent pipeline** to extract every cited claim from a research paper, resolve and fetch the cited papers, check for retractions, and semantically verify whether each citation actually supports the claim being made.

**Live demo video:** [https://drive.google.com/file/d/1MSf1UW14fHTcZS-bJdo_ah-KgDkx_y96/view?usp=sharing]

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- OpenRouter API key — [openrouter.ai/keys](https://openrouter.ai/keys)
- Semantic Scholar API key — [semanticscholar.org/product/api](https://api.semanticscholar.org/)

### Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env from template
cp .env
# Edit .env and add your OpenRouter key(s) + Semantic Scholar

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

## Problem & Motivation

Academic citation integrity is in crisis. In 2023, roughly **1 in 2,800** published papers contained fabricated or misrepresented references. By early 2026 that number had reached **1 in 277** — a tenfold increase driven largely by AI-assisted paper writing.

The deeper problem is not just fake citations — it is **misrepresentation**. Authors cite real papers but claim they say something they do not. This is how scientific myths form and propagate through the literature.

Existing tools like GPTZero only check whether a citation *exists*. No tool checks whether the cited paper actually *supports* the specific claim being made. CiteClaim attempts to address this gap.

---

## How It Works

### Pipeline Architecture

```
PDF Upload
    ↓
Agent 1: EXTRACTOR   — Identifies every cited claim in the paper
    ↓
Agent 2: RESOLVER    — Converts raw citation strings into structured metadata
    ↓
Agent 3: FETCHER     — Retrieves cited papers via Semantic Scholar, arXiv, Unpaywall, CrossRef
    ↓
Agent 4: VERIFIER    — Semantically checks whether each paper supports the claim
         RETRACTION  — Cross-references each DOI against 67,000+ retracted papers (parallel)
    ↓
Agent 5: SUMMARIZER  — Produces integrity score (0–100), verdict label, and narrative report
    ↓
React Dashboard
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| Frontend | React + Vite |
| LLM | Claude Sonnet via OpenRouter |
| Paper retrieval | Semantic Scholar API, arXiv, Unpaywall, CrossRef |
| Retraction data | Retraction Watch (~67,000 retracted papers) |
| PDF parsing | PyMuPDF |

### Agent Details

#### Agent 1 — EXTRACTOR (`agent_extractor.py`)
Reads the paper body (truncated to 8,000 characters) and returns a JSON array of every sentence that makes a cited claim, along with the citation key used (`[1]`, `Smith et al., 2020`, etc.).

#### Agent 2 — RESOLVER (`agent_resolver.py`)
Takes each raw citation string and converts it into structured metadata — title, authors, year, DOI, and an optimised Semantic Scholar search query. Runs in parallel across all claims via `asyncio.gather`.

#### Agent 3 — FETCHER (`paper_fetcher.py`)
Tries six retrieval strategies in order:

1. **Semantic Scholar by DOI**
2. **Semantic Scholar title search**
3. **Title + first author name**
4. **Unpaywall** — returns full PDFs for open-access papers
5. **arXiv** — full PDF download for ML papers
6. **CrossRef DOI lookup → Unpaywall**

Results are cached by DOI or title so papers cited multiple times are only fetched once.

#### Agent 4 — VERIFIER + RETRACTION (`agent_verifier.py`, `agent_retraction.py`)
The verifier reads the claim and cited paper content and returns a structured verdict:

| Verdict | Meaning |
|---------|---------|
| `supported` | Paper clearly supports the claim |
| `partially_supported` | Paper supports part of the claim but with important caveats |
| `unsupported` | Paper contradicts or is unrelated to the claim |
| `cannot_determine` | Insufficient text to make a judgment |

Runs in parallel with the retraction checker via `asyncio.gather`. The retraction checker is a dictionary lookup against the Retraction Watch CSV, loaded at startup.

#### Agent 5 — SUMMARIZER (`agent_summarizer.py`)
Synthesises all verdicts into:
- Integrity score (0–100)
- Verdict label: `PASS` / `REVIEW NEEDED` / `CONCERNS FOUND` / `SERIOUS ISSUES`
- Narrative summary
- Up to 4 key concerns
- One-sentence recommendation

### Key Design Decisions

**Sequential paper fetching**
Paper retrieval runs sequentially with delays rather than in parallel. Early versions fired all requests simultaneously, causing Semantic Scholar to rate-limit everything. Sequential fetching with a Semantic Scholar API key achieved 87.5% retrieval rate on the evaluation dataset.

**Temperature = 0**
All five agents use `temperature=0` for deterministic, reproducible outputs. Without this, the same paper produces different verdicts across runs, making evaluation meaningless.

**Caching**
The fetcher caches results by DOI or title. Papers cited multiple times in one document are only fetched once, cutting API calls roughly in half.

**Binary classification for evaluation**
The verifier outputs three classes. For evaluation and the dashboard summary we collapse these into binary: `supported` = Safe, everything else = Needs Flagging. This reflects the practical goal of surfacing citations that warrant human review, regardless of degree of mismatch.

**Majority voting in evaluation**
The evaluation script runs each verification three times and takes the majority verdict. This reduces sensitivity to LLM non-determinism and produces more stable benchmark numbers.

---

## Evaluation & Evidence

### Ground Truth Dataset

We built a manually labeled evaluation dataset of **40 claims** across four well-known papers:

| Paper | Claims | Notes |
|-------|--------|-------|
| Attention Is All You Need (Vaswani et al., 2017) | 18 | Numbered references, diverse claim types |
| Adam: A Method for Stochastic Optimization (Kingma & Ba, 2015) | 7 | Clear verifiable technical claims |
| Batch Normalization (Ioffe & Szegedy, 2015) | 7 | Mix of supported and unsupported |
| GloVe: Global Vectors for Word Representation (Pennington et al., 2014) | 8 | Includes anachronistic and fabricated claims |

**Dataset composition:**

| Label | Count |
|-------|-------|
| `supported` | 14 |
| `partially_supported` | 6 |
| `unsupported` | 20 |

Includes 6 completely fabricated citations (papers that do not exist) to test hallucination detection.

Ground truth labels were assigned manually by reading each cited paper and independently verifying each claim.

### Results

**Retrieval rate:** 35/40 = **87.5%**

#### Binary Classification Results

*(supported = Safe, partially_supported/unsupported = Needs Flagging)*

| Metric | Value |
|--------|-------|
| Binary accuracy | **88.6%** (31/35) |
| Naive baseline (always predict Safe) | 34.3% |
| High confidence (≥70%) accuracy | **90.9%** (30/33) |
| Flagging class F1 | **0.91** |
| False negatives (missed flags) | 2 |
| False positives (false alarms) | 2 |

#### Confusion Matrix

```
                    Predicted Safe    Predicted Flagged
Actual Safe              10                  2         ← false negatives
Actual Flagged            2                 21         ← false positives
```

#### Multi-Class F1 Scores

| Class | Precision | Recall | F1 |
|-------|-----------|--------|----|
| `supported` | 0.83 | 0.77 | 0.80 |
| `partially_supported` | 0.38 | 0.43 | 0.40 |
| `unsupported` | 0.87 | 0.65 | 0.74 |

The low `partially_supported` F1 reflects the inherent subjectivity of this category — the boundary between partially_supported and unsupported involves judgment calls that even human annotators would disagree on.

### Failure Mode Analysis

| ID | Ground Truth | Predicted | Root Cause |
|----|-------------|-----------|------------|
| 1, 2 | `partially_supported` | `supported` | Labeling subjectivity — verifier reasoning is defensible |
| 10 | `supported` | `unsupported` | Wrong paper retrieved (stance detection paper vs. memory networks) |
| 12, 14 | `unsupported` | `partially_supported` | Verifier too lenient on clearly wrong claims |
| 16, 17 | `unsupported` | `partially_supported` | Fabricated title matched a real paper too closely |
| 30, 34 | `supported`/`partially_supported` | `partially_supported`/`unsupported` | Abstract lacked sufficient detail for confident verdict |

**Key insight:** The majority of errors fall at the `partially_supported` boundary, which is inherently ambiguous. The system performs well on clear-cut cases — 0 false negatives for clearly unsupported claims, and strong precision (0.83) for supported claims.


## Limitations

**Retrieval dependent**
12.5% of claims return `cannot_determine` because the cited paper could not be retrieved. Semantic Scholar does not index every paper, and many older papers lack abstracts.

**Abstract-only verification**
Most verifications use only the abstract, not full text. Subtle misrepresentations in methods or results sections are invisible to the verifier. Full-text access would likely improve accuracy significantly.

**Author-year citation style**
Papers using author-year citations (e.g. `Manning et al., 2008`) have lower retrieval rates because the PDF parser extracts less structured metadata. Numbered citation styles (`[1]`, `[2]`) perform significantly better.

**Retraction checking requires DOI**
The retraction checker only works when a DOI is successfully extracted. Papers without DOIs in the Semantic Scholar response cannot be cross-referenced against the Retraction Watch database.

**Partially_supported subjectivity**
The boundary between `supported` and `partially_supported` involves judgment calls. This accounts for most multi-class errors in evaluation. For practical use, binary classification (Safe vs. Needs Flagging) is recommended.

**Rate limiting**
Despite sequential fetching and a Semantic Scholar API key, heavy papers (50+ citations) can still encounter rate limits. The fetcher handles these with exponential backoff but analysis time increases proportionally.

---

## Use Cases

**Peer reviewers**
Automated first-pass integrity check before human review. Reviewers focus limited time on claims that CiteClaim flags, rather than manually tracing every citation.

**Journal editors**
Scalable integrity screening for high-volume submission venues receiving thousands of papers per year. A 88.6% accurate automated check before human review scales capacity without scaling headcount.

---

## What I Would Add Next

**Full text retrieval**
Reliable PDF parsing for all open-access papers via arXiv and Unpaywall, giving the verifier methods and results sections to work with rather than just abstracts. Partially implemented — needs more robust error handling at scale.

**Corrections, not just flags**
When a claim is unsupported, show exactly what the cited paper says and suggest a rewritten version that accurately reflects it. The verifier already returns an excerpt — surfacing this as a correction is the natural next step.

**Batch mode for literature reviews**
Accept a folder of PDFs and produce a cross-paper integrity report, with contradiction detection across papers in the same corpus.

**Author-year citation support**
Improve the PDF parser and resolver to handle author-year citation styles reliably, expanding coverage beyond numbered-reference papers.

---

## AI Usage Disclosure

### Claude (Anthropic) — used throughout development

| Area | Usage |
|------|-------|
| Agent prompts | All five agent were improved with Claude |
| Debugging | FastAPI, asyncio, httpx, and rate limiting issues debugged with Claude |
| Frontend | `App.jsx` designed and written with Claude's assistance |

### Claude Sonnet (via OpenRouter) — runtime LLM
Powers all five agents in the live pipeline. `temperature=0` is set throughout for deterministic, reproducible results.

---

## References & Credits

### APIs & Data Sources

| Source | Usage |
|--------|-------|
| [Retraction Watch Database](https://retractionwatch.com) | Retraction data (~67,000 papers) |
| [Semantic Scholar API](https://api.semanticscholar.org) | Primary paper retrieval |
| [Unpaywall API](https://unpaywall.org/api) | Open-access PDF retrieval |
| [CrossRef API](https://api.crossref.org) | DOI lookup fallback |
| [arXiv API](https://arxiv.org/help/api) | ML paper full text |
| [OpenRouter](https://openrouter.ai) | LLM API routing |

### Libraries

| Library | Purpose |
|---------|---------|
| [FastAPI](https://fastapi.tiangolo.com) | Backend framework |
| [PyMuPDF](https://pymupdf.readthedocs.io) | PDF text extraction |
| [httpx](https://www.python-httpx.org) | Async HTTP requests |
| [python-dotenv](https://pypi.org/project/python-dotenv/) | Environment variable management |
| [Vite](https://vitejs.dev) | Frontend build tool |
| [React](https://react.dev) | Frontend framework |

### Citation Integrity Statistics

Citation fabrication rate statistics sourced from Retraction Watch and Crossref reporting on AI-assisted paper writing trends (2023–2026).

---

