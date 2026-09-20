"""Where did it go wrong? Confusion pairs, confidence buckets, worst examples, overlap with a second run.

  uv run misses.py runs/<run>.jsonl [--question intent] [--vs runs/<other-run>.jsonl] [--top 12]
"""
import argparse, collections, json
from pathlib import Path
import numpy as np

HERE = Path(__file__).parent


def load(p): return [json.loads(l) for l in open(p) if json.loads(l)["repeat"] == 0]


def pred_of(a): return a["choice"] if a["type"] == "choice" else round(a["score"]) if a["type"] == "score" else a["noul"] >= 0.5


def conf_of(a):
    if a["type"] == "noul": return abs(a["noul"] - 0.5) * 2
    if a.get("confidence") is not None: return a["confidence"]
    return max(a["probabilities"].values()) if a.get("probabilities") else 1.0


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("run"); ap.add_argument("--question"); ap.add_argument("--vs"); ap.add_argument("--top", type=int, default=12)
    o = ap.parse_args(); rows = load(o.run); ds = Path(o.run).name.split("-jev-")[0].split("-llm-")[0]
    samp = {json.loads(l)["id"]: json.loads(l) for l in (HERE / "samples" / f"{ds}.jsonl").open()}
    q = o.question or next(iter(rows[0]["answers"]))
    miss = [r for r in rows if pred_of(r["answers"][q]) != r["truth"][q]]
    print(f"{q}: {len(miss)} misses of {len(rows)} ({1 - len(miss)/len(rows):.3f} acc)")
    pairs = collections.Counter((str(r["truth"][q]), str(pred_of(r["answers"][q]))) for r in miss)
    print("\ntop confusions (truth -> predicted):")
    for (t, p), c in pairs.most_common(o.top): print(f"  {c:2d}x  {t} -> {p}")
    conf = np.array([conf_of(r["answers"][q]) for r in rows]); correct = np.array([pred_of(r["answers"][q]) == r["truth"][q] for r in rows])
    print("\nconfidence buckets:")
    for lo, hi in [(0, .5), (.5, .8), (.8, .95), (.95, 1.01)]:
        m = (conf >= lo) & (conf < hi); print(f"  [{lo}, {min(hi,1)}): n={m.sum():3d}  acc={correct[m].mean() if m.sum() else float('nan'):.3f}")
    state = lambda r: json.dumps(samp[r["id"]]["state"], ensure_ascii=False)[:110]
    print("\nmost confident misses:")
    for r in sorted(miss, key=lambda r: -conf_of(r["answers"][q]))[:6]: print(f"  conf={conf_of(r['answers'][q]):.2f}  {r['truth'][q]} -> {pred_of(r['answers'][q])}  {state(r)}")
    print("\nleast confident misses:")
    for r in sorted(miss, key=lambda r: conf_of(r["answers"][q]))[:6]: print(f"  conf={conf_of(r['answers'][q]):.2f}  {r['truth'][q]} -> {pred_of(r['answers'][q])}  {state(r)}")
    if o.vs:
        other = {r["id"]: r for r in load(o.vs)}; om = {i for i, r in other.items() if pred_of(r["answers"][q]) != r["truth"][q]}
        both = sum(1 for r in miss if r["id"] in om)
        print(f"\nvs {Path(o.vs).name}: it misses {len(om)}; both wrong on {both} of this run's {len(miss)} misses")


if __name__ == "__main__":
    main()
