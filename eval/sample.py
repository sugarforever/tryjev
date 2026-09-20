"""Stratified sampling: raw CSV -> samples/<id>.jsonl, one {id, state, truth} per line.

Usage: uv run sample.py [dataset ...]   (default: all in datasets.json)
Raw files land in raw/<id>/ (gitignored). Kaggle sources need ~/.kaggle/kaggle.json;
banking77 and sms-spam are fetched from their official mirrors instead.
"""
import io, json, subprocess, sys, zipfile
from pathlib import Path
import numpy as np, pandas as pd, requests

HERE = Path(__file__).parent
SEED = 20260920
MANIFEST = json.loads((HERE / "datasets.json").read_text())

MIRRORS = {  # non-Kaggle fallbacks, no credentials needed
    "banking77": ("https://raw.githubusercontent.com/PolyAI-LDN/task-specific-datasets/master/banking_data/test.csv", "test.csv"),
    "sms-spam": ("https://archive.ics.uci.edu/static/public/228/sms+spam+collection.zip", "SMSSpamCollection"),
}
CFPB_PRODUCT = {"Mortgage": "mortgage", "Debt collection": "debt_collection", "Credit reporting": "credit_reporting",
    "Credit card": "credit_card", "Bank account or service": "bank_account", "Consumer Loan": "consumer_loan",
    "Student loan": "student_loan", "Payday loan": "payday_loan", "Money transfers": "money_transfers",
    "Prepaid card": "prepaid_card", "Other financial service": "other", "Virtual currency": "other"}


def fetch(ds) -> pd.DataFrame:
    raw = HERE / "raw" / ds["id"]; raw.mkdir(parents=True, exist_ok=True)
    src = ds["source"]
    if ds["id"] in MIRRORS:
        url, name = MIRRORS[ds["id"]]; target = raw / name
        if not target.exists():
            r = requests.get(url, timeout=120); r.raise_for_status()
            if url.endswith(".zip"):
                zipfile.ZipFile(io.BytesIO(r.content)).extractall(raw)
            else:
                target.write_bytes(r.content)
        if ds["id"] == "sms-spam":
            return pd.read_csv(target, sep="\t", names=["v1", "v2"], quoting=3)
        return pd.read_csv(target)
    target = raw / src["file"]
    if not target.exists():
        cmd = ["kaggle", src["kind"] + "s", "download", "-p", str(raw), "-f", src["file"]]
        cmd += ["-c", src["ref"]] if src["kind"] == "competition" else [src["ref"]]
        subprocess.run(cmd, check=True)
        for z in raw.glob("*.zip"):
            zipfile.ZipFile(z).extractall(raw)
    df = pd.read_csv(target, low_memory=False)
    if ds["id"] == "jigsaw" and "target" not in df.columns:
        df = df.rename(columns={"toxicity": "target"})
    return df


def truth_frame(ds, df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    for key, expr in ds["truth"].items():
        out[key] = df[expr] if expr in df.columns else df.eval(expr)
    if "label_map" in ds:
        for key in out:
            out[key] = out[key].map(lambda v: ds["label_map"].get(v, v) if isinstance(v, str) else v)
    if ds["id"] == "cfpb":
        out["product"] = out["product"].map(CFPB_PRODUCT)
    if ds["id"] == "jigsaw":
        t = df["target"]
        out["severity"] = np.select(
            [t < 0.5, (df["threat"] >= 0.5) | (df["severe_toxicity"] >= 0.5), (df["insult"] >= 0.5) | (df["identity_attack"] >= 0.5) | (t >= 0.75)],
            [0, 3, 2], default=1)
    if ds["id"] == "banking77":
        group_of = json.loads((HERE / "questions" / "_banking77_group_of.json").read_text())
        out["group"] = out["intent"].map(group_of)
    if ds["id"] == "amazon-food":
        out["stars"] = out["stars"].astype(int)
    for key in out:
        if out[key].dtype == bool or str(out[key].dtype) == "boolean":
            out[key] = out[key].astype(bool)
    return out


def stratified(ds, df: pd.DataFrame) -> pd.DataFrame:
    n, st = ds["n"], ds["stratify"]; rng = np.random.default_rng(SEED)
    if "bins" in st:
        parts = []
        for (lo, hi), w in zip(st["bins"], st["weights"]):
            m = (df[st["column"]] == lo) if lo == hi else (df[st["column"]] > lo) & (df[st["column"]] <= hi) if hi < 1 else (df[st["column"]] >= lo)
            sub = df[m]; k = min(len(sub), round(n * w))
            parts.append(sub.sample(k, random_state=int(rng.integers(1 << 31))))
        return pd.concat(parts)
    idx = []
    for _, g in df.groupby(st["column"]):
        k = n // df[st["column"]].nunique() if st.get("equal") else max(1, round(len(g) * n / len(df)))
        idx += list(g.sample(min(len(g), k), random_state=SEED).index)
    out = df.loc[idx]
    return out.sample(n, random_state=SEED) if len(out) > n else out


def to_native(v):
    if isinstance(v, (np.bool_,)): return bool(v)
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return None if np.isnan(v) else float(v)
    return v


def build(ds):
    df = fetch(ds)
    if "filter" in ds:
        col = ds["filter"].split()[0]
        df = df[df[col].notna()]
    df = df.dropna(subset=[c for c in ds["state"].values() if c in df.columns])
    if ds["id"] == "telco":
        df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce"); df = df.dropna(subset=["TotalCharges"])
        df["SeniorCitizen"] = df["SeniorCitizen"].astype(bool)
    samp = stratified(ds, df)
    truth = truth_frame(ds, samp)
    maxc = ds.get("max_state_chars")
    out = HERE / "samples" / f"{ds['id']}.jsonl"
    with out.open("w") as f:
        for idx, row in samp.iterrows():
            state = {k: to_native(row[c]) for k, c in ds["state"].items()}
            if maxc:
                state = {k: (v[:maxc] if isinstance(v, str) else v) for k, v in state.items()}
            rec = {"id": f"{ds['id']}-{idx}", "state": state, "truth": {k: to_native(v) for k, v in truth.loc[idx].items()}}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"{ds['id']}: {len(samp)} rows -> {out.relative_to(HERE)}")
    for k in truth:
        vc = truth[k].value_counts()
        if len(vc) <= 12: print(f"  {k}: {vc.to_dict()}")


if __name__ == "__main__":
    want = sys.argv[1:] or [d["id"] for d in MANIFEST["datasets"]]
    for ds in MANIFEST["datasets"]:
        if ds["id"] in want:
            build(ds)
