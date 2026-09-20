"""Score run files: accuracy / macro-F1 / AUC / Brier / ECE, confidence-gating curve, consistency, latency, cost.

  uv run score.py [runs/*.jsonl ...]     (default: every file in runs/)

Prints one markdown table per run and writes reports/<run>.json plus reliability / gating / Jigsaw-scatter SVGs.
"""
import json, sys
from collections import defaultdict
from pathlib import Path
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import f1_score, roc_auc_score

HERE = Path(__file__).parent
REPORTS = HERE / "reports"; REPORTS.mkdir(exist_ok=True)


def ece(p, y, bins=10):
    p, y = np.asarray(p), np.asarray(y, float); edges = np.linspace(0, 1, bins + 1); e = 0.0; rows = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (p > lo) & (p <= hi) if lo > 0 else (p >= lo) & (p <= hi)
        if m.sum():
            e += m.mean() * abs(p[m].mean() - y[m].mean()); rows.append((p[m].mean(), y[m].mean(), int(m.sum())))
    return e, rows


def gating(conf, correct):
    order = np.argsort(-np.asarray(conf)); c = np.asarray(correct, float)[order]
    cov = np.arange(1, len(c) + 1) / len(c); acc = np.cumsum(c) / np.arange(1, len(c) + 1)
    return cov, acc, np.asarray(conf)[order]


def score_file(path: Path):
    rows = [json.loads(l) for l in path.open()]
    first = [r for r in rows if r["repeat"] == 0]
    if not first: return
    qs = list(first[0]["answers"]); rep = {"run": path.stem, "n": len(first), "questions": {}}
    lat = np.array([r["latency_ms"] for r in first]); cost = sum((r["usage"] or {}).get("cost") or 0 for r in first)
    rep["latency_p50"], rep["latency_p95"], rep["cost_usd"] = float(np.median(lat)), float(np.percentile(lat, 95)), cost
    md = [f"### {path.stem}  (n={len(first)}, p50 {rep['latency_p50']:.0f} ms, p95 {rep['latency_p95']:.0f} ms, ${cost:.4f})",
          "| question | type | acc | macro-F1 | AUC | Brier | ECE | MAE | acc@conf≥0.8 (cov) | consistency |", "|---|---|---|---|---|---|---|---|---|---|"]
    for q in qs:
        rs = [r for r in first if q in r["truth"] and r["truth"][q] is not None]
        if not rs: continue
        a0 = rs[0]["answers"][q]; t = a0["type"]; m = {"type": t}
        truth = [r["truth"][q] for r in rs]; ans = [r["answers"][q] for r in rs]
        if t == "noul":
            p = np.array([a["noul"] for a in ans]); y = np.array(truth, bool); pred = p >= 0.5
            m["acc"] = float((pred == y).mean()); m["f1"] = float(f1_score(y, pred, average="macro"))
            m["auc"] = float(roc_auc_score(y, p)) if 0 < y.sum() < len(y) else None
            m["brier"] = float(((p - y) ** 2).mean()); m["ece"], rel = ece(p, y)
            conf = np.abs(p - 0.5) * 2; correct = pred == y
        elif t == "choice":
            pred = np.array([a["choice"] for a in ans]); y = np.array([str(v) for v in truth]); correct = pred == y
            m["acc"] = float(correct.mean()); m["f1"] = float(f1_score(y, pred, average="macro"))
            conf = np.array([a.get("confidence") if a.get("confidence") is not None else (max(a["probabilities"].values()) if a.get("probabilities") else 1.0) for a in ans])
            ptrue = np.array([a["probabilities"].get(str(yy), 0.0) if a.get("probabilities") else float(c) for a, yy, c in zip(ans, y, correct)])
            m["brier"] = float(((ptrue - 1) ** 2).mean()) if all(a.get("probabilities") for a in ans) else None
            pmax = np.array([max(a["probabilities"].values()) if a.get("probabilities") else c for a, c in zip(ans, conf)])
            m["ece"], rel = ece(pmax, correct)
        else:  # score: truth is the criteria index (0-based)
            y = np.array(truth, float); s = np.array([a["score"] for a in ans]); pred = np.rint(s); correct = pred == y
            m["acc"] = float(correct.mean()); m["f1"] = float(f1_score(y.astype(int), pred.astype(int), average="macro")); m["mae"] = float(np.abs(s - y).mean())
            conf = np.array([a.get("confidence") if a.get("confidence") is not None else 1.0 for a in ans])
            pmax = np.array([max(a["probabilities"].values()) if a.get("probabilities") else c for a, c in zip(ans, conf)])
            m["ece"], rel = ece(pmax, correct)
        cov, gacc, gconf = gating(conf, correct); hi = gconf >= 0.8
        m["acc_at_conf80"] = float(np.asarray(correct)[np.argsort(-conf)][: hi.sum()].mean()) if hi.sum() else None; m["coverage_at_conf80"] = float(hi.mean())
        # consistency across repeats
        by_id = defaultdict(list)
        for r in rows: by_id[r["id"]].append(r["answers"][q])
        multi = [v for v in by_id.values() if len(v) > 1]
        if multi:
            key = (lambda a: a["noul"] >= 0.5) if t == "noul" else (lambda a: a["choice"]) if t == "choice" else (lambda a: round(a["score"]))
            m["consistency"] = float(np.mean([len({key(a) for a in v}) == 1 for v in multi]))
        rep["questions"][q] = m; m["reliability"] = rel
        f = lambda k, d=3: "-" if m.get(k) is None else f"{m[k]:.{d}f}"
        md.append(f"| {q} | {t} | {f('acc')} | {f('f1')} | {f('auc')} | {f('brier')} | {f('ece')} | {f('mae',2)} | {f('acc_at_conf80')} ({f('coverage_at_conf80',2)}) | {f('consistency',2)} |")
        # plots
        fig, ax = plt.subplots(1, 2, figsize=(9, 4))
        if rel:
            ax[0].plot([0, 1], [0, 1], "k--", lw=1); ax[0].plot([r[0] for r in rel], [r[1] for r in rel], "o-"); ax[0].set(title=f"reliability: {q}", xlabel="predicted", ylabel="observed")
        ax[1].plot(cov, gacc); ax[1].set(title=f"confidence gating: {q}", xlabel="coverage", ylabel="accuracy", ylim=(0, 1.02))
        fig.tight_layout(); fig.savefig(REPORTS / f"{path.stem}-{q}.svg"); plt.close(fig)
        if q == "toxic" and "toxic_fraction" in rs[0]["truth"]:
            frac = np.array([r["truth"]["toxic_fraction"] for r in rs]); m["corr_with_rater_fraction"] = float(np.corrcoef(p, frac)[0, 1])
            fig, ax = plt.subplots(figsize=(4.5, 4.5)); ax.scatter(frac, p, s=8, alpha=0.5); ax.set(xlabel="fraction of raters saying toxic", ylabel="Jev P(toxic)", title=f"r = {m['corr_with_rater_fraction']:.2f}")
            fig.tight_layout(); fig.savefig(REPORTS / f"{path.stem}-scatter.svg"); plt.close(fig)
            md.append(f"| ↳ corr(P toxic, rater fraction) | | {m['corr_with_rater_fraction']:.3f} | | | | | | | |")
    (REPORTS / f"{path.stem}.json").write_text(json.dumps(rep, indent=1))
    print("\n".join(md) + "\n")


if __name__ == "__main__":
    files = [Path(p) for p in sys.argv[1:]] or sorted((HERE / "runs").glob("*.jsonl"))
    for f in files: score_file(f)
