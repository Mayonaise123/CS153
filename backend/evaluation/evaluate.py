import asyncio
import csv
import json
import sys
from pathlib import Path
from collections import Counter
from typing import Dict

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=True)

from services.agent_resolver import resolve_citation
from services.agent_verifier import verify_claim
from services.paper_fetcher import fetch_paper

# ── Cache helpers ─────────────────────────────────────────────────
CACHE_FILE = Path(__file__).parent / "eval_cache.json"

def load_cache():
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text())
        except Exception:
            return {}
    return {}

def save_cache(cache):
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


# ── Majority vote verifier ────────────────────────────────────────
async def verify_with_majority_vote(claim: str, cited_text: str, runs: int = 3) -> Dict:
    verdicts = []
    for _ in range(runs):
        result = await verify_claim(claim, cited_text)
        verdicts.append(result)
        await asyncio.sleep(0.5)

    verdict_counts = Counter(v["verdict"] for v in verdicts)
    majority_verdict = verdict_counts.most_common(1)[0][0]

    matching = [v for v in verdicts if v["verdict"] == majority_verdict]
    best = max(matching, key=lambda x: x["confidence"])
    best["vote_distribution"] = dict(verdict_counts)
    return best


# ── Main evaluation ───────────────────────────────────────────────
async def evaluate():
    dataset_path = Path(__file__).parent / "ground_truth.csv"
    results = []
    cache = load_cache()

    with open(dataset_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Running evaluation on {len(rows)} claims...\n")

    for i, row in enumerate(rows):
        print(f"[{i+1}/{len(rows)}] {row['claim'][:70]}...")

        cache_key = f"{row['id']}_{row['claim'][:50]}"
        if cache_key in cache:
            print(f"  [CACHED] {cache[cache_key]['predicted']} (skipping API calls)\n")
            results.append(cache[cache_key])
            continue

        # Step 1: Resolve
        resolved = await resolve_citation(row['cited_paper_title'])

        # Step 2: Fetch
        cited_text, fetch_status, fetched_doi = await fetch_paper(resolved)
        print(f"  Fetch: {fetch_status}")

        # Step 3: Verify with majority vote
        if cited_text:
            verdict = await verify_with_majority_vote(row['claim'], cited_text, runs=3)
            print(f"  Votes: {verdict.get('vote_distribution', {})}")
        else:
            verdict = {
                "verdict": "cannot_determine",
                "explanation": "Could not retrieve cited paper",
                "confidence": 0,
                "excerpt": None,
                "vote_distribution": {},
            }

        print(f"  Ground truth: {row['ground_truth']}")
        print(f"  CiteClaim:    {verdict['verdict']}")
        print(f"  Match: {'✓' if verdict['verdict'] == row['ground_truth'] else '✗'}\n")

        result_dict = {
            "id": row['id'],
            "claim": row['claim'],
            "ground_truth": row['ground_truth'],
            "predicted": verdict['verdict'],
            "confidence": verdict['confidence'],
            "explanation": verdict['explanation'],
            "fetch_status": fetch_status,
            "vote_distribution": verdict.get("vote_distribution", {}),
            "match": verdict['verdict'] == row['ground_truth'],
        }

        cache[cache_key] = result_dict
        save_cache(cache)
        results.append(result_dict)

        await asyncio.sleep(1.5)

    # ── Compute base metrics ──────────────────────────────────────
    labels = ["supported", "partially_supported", "unsupported"]
    determinable = [r for r in results if r['predicted'] != 'cannot_determine']
    correct = [r for r in determinable if r['match']]

    print("\n" + "="*60)
    print("MULTICLASS RESULTS")
    print("="*60)
    print(f"Total claims:             {len(results)}")
    print(f"Retrievable (paper found): {len(determinable)}")
    print(f"Cannot determine:          {len(results) - len(determinable)}")
    print(f"Accuracy (on retrievable): {len(correct)}/{len(determinable)} = {len(correct)/max(len(determinable),1)*100:.1f}%")

    high_conf = [r for r in determinable if r['confidence'] >= 70]
    high_conf_correct = [r for r in high_conf if r['match']]
    print(f"High confidence (≥70%):   {len(high_conf_correct)}/{len(high_conf)} = {len(high_conf_correct)/max(len(high_conf),1)*100:.1f}%")

    print("\nPer-class F1 scores:")
    for label in labels:
        tp = sum(1 for r in results if r['ground_truth'] == label and r['predicted'] == label)
        fp = sum(1 for r in results if r['ground_truth'] != label and r['predicted'] == label)
        fn = sum(1 for r in results if r['ground_truth'] == label and r['predicted'] != label)
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 0.001)
        print(f"  {label:25s} P={precision:.2f}  R={recall:.2f}  F1={f1:.2f}")

    # ── Binary classification ─────────────────────────────────────
    print("\n" + "="*60)
    print("BINARY CLASSIFICATION (Safe vs Needs Flagging)")
    print("="*60)
    print("  supported           → 1 (Safe)")
    print("  partially_supported → 0 (Needs Flagging)")
    print("  unsupported         → 0 (Needs Flagging)")
    print()

    def to_binary(verdict):
        return 1 if verdict == "supported" else 0

    binary_results = [
        {
            "ground_truth_binary": to_binary(r["ground_truth"]),
            "predicted_binary": to_binary(r["predicted"]),
            "id": r["id"],
            "confidence": r["confidence"],
            "match": to_binary(r["ground_truth"]) == to_binary(r["predicted"]),
        }
        for r in determinable
    ]

    binary_correct = sum(1 for r in binary_results if r["match"])
    binary_accuracy = binary_correct / max(len(binary_results), 1)

    tp = sum(1 for r in binary_results if r["ground_truth_binary"] == 1 and r["predicted_binary"] == 1)
    fp = sum(1 for r in binary_results if r["ground_truth_binary"] == 0 and r["predicted_binary"] == 1)
    fn = sum(1 for r in binary_results if r["ground_truth_binary"] == 1 and r["predicted_binary"] == 0)
    tn = sum(1 for r in binary_results if r["ground_truth_binary"] == 0 and r["predicted_binary"] == 0)

    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * precision * recall / max(precision + recall, 0.001)

    flag_precision = tn / max(tn + fn, 1)
    flag_recall = tn / max(tn + fp, 1)
    flag_f1 = 2 * flag_precision * flag_recall / max(flag_precision + flag_recall, 0.001)

    print(f"Binary accuracy:           {binary_correct}/{len(binary_results)} = {binary_accuracy*100:.1f}%")
    print(f"\nConfusion matrix:")
    print(f"  TP (correct Safe):       {tp}")
    print(f"  TN (correct Flagged):    {tn}")
    print(f"  FP (wrongly Safe):       {fp}  ← missed flags, most dangerous")
    print(f"  FN (wrongly Flagged):    {fn}  ← false alarms")
    print(f"\nSafe class (supported):")
    print(f"  Precision: {precision:.2f}  Recall: {recall:.2f}  F1: {f1:.2f}")
    print(f"\nFlagging class (needs attention):")
    print(f"  Precision: {flag_precision:.2f}  Recall: {flag_recall:.2f}  F1: {flag_f1:.2f}")

    naive_binary = sum(1 for r in binary_results if r["ground_truth_binary"] == 1)
    print(f"\nNaive baseline (always Safe): {naive_binary}/{len(binary_results)} = {naive_binary/len(binary_results)*100:.1f}%")
    print(f"CiteClaim binary accuracy:    {binary_accuracy*100:.1f}%")

    high_conf_binary = [r for r in binary_results if r["confidence"] >= 70]
    high_conf_binary_correct = sum(1 for r in high_conf_binary if r["match"])
    print(f"High confidence (≥70%):       {high_conf_binary_correct}/{len(high_conf_binary)} = {high_conf_binary_correct/max(len(high_conf_binary),1)*100:.1f}%")

    # ── Mismatches ────────────────────────────────────────────────
    mismatches = [r for r in determinable if not r['match']]
    if mismatches:
        print(f"\nMismatched claims ({len(mismatches)}):")
        for r in mismatches:
            print(f"  ID {r['id']}: truth={r['ground_truth']} predicted={r['predicted']} votes={r.get('vote_distribution', {})} conf={r['confidence']}")

    out_path = Path(__file__).parent / "eval_results.json"
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nFull results saved to {out_path}")


if __name__ == "__main__":
    asyncio.run(evaluate())