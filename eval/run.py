"""Run one dataset's samples through Jev, local Laya, or an LLM baseline.

  uv run run.py <dataset> [--provider jev|laya|llm] [--model ...] [--limit N] [--repeat K] [--concurrency 6]

Writes runs/<dataset>-<provider>-<model>-<date>.jsonl: {id, truth, answers, usage, latency_ms, model, repeat}.
Key: OPENROUTER_API_KEY from the environment (source ~/.zshrc-custom). Never logged.
"""
import argparse, json, os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path
import requests

HERE = Path(__file__).parent
OR = "https://openrouter.ai/api"
HEADERS = lambda: {"Authorization": "Bearer " + os.environ["OPENROUTER_API_KEY"], "Content-Type": "application/json",
                   "X-OpenRouter-Title": "jev-kaggle-eval", "HTTP-Referer": "https://www.tryjev.xyz"}
JEV_MODEL = "typesafe/jev-1.13"
LAYA_MODEL = "convaiinnovations/laya"


def post(url, body, tries=5):
    for i in range(tries):
        t = time.time()
        r = requests.post(url, headers=HEADERS(), json=body, timeout=90)
        ms = int((time.time() - t) * 1000)
        if r.status_code == 200:
            return r.json(), ms
        if r.status_code in (429, 500, 502, 503, 524) and i < tries - 1:
            time.sleep(2 ** i + 0.5); continue
        raise RuntimeError(f"{r.status_code}: {r.text[:300]}")


def call_jev(state, questions, model):
    res, ms = post(f"{OR}/alpha/decisions", {"model": model, "state": state, "questions": questions})
    return {"answers": res["answers"], "usage": res.get("usage"), "model": res.get("model"), "latency_ms": ms}


def load_laya(model, device):
    from laya import Agent

    return Agent(model, device=device)


def call_laya(agent, state, questions, model):
    started = time.perf_counter()
    result = agent.predict(state, questions)
    latency_ms = (time.perf_counter() - started) * 1000
    return {
        "answers": result["answers"],
        "usage": {"input_tokens": None, "output_tokens": None, "cost": 0},
        "model": model,
        "latency_ms": latency_ms,
    }


def llm_schema(questions):
    props = {}
    for k, q in questions.items():
        if q["type"] == "noul":
            props[k] = {"type": "object", "properties": {"answer": {"type": "boolean"}, "probability_true": {"type": "number", "minimum": 0, "maximum": 1}}, "required": ["answer", "probability_true"], "additionalProperties": False}
        elif q["type"] == "choice":
            props[k] = {"type": "object", "properties": {"answer": {"type": "string", "enum": list(q["criteria"])}, "confidence": {"type": "number", "minimum": 0, "maximum": 1}}, "required": ["answer", "confidence"], "additionalProperties": False}
        else:
            props[k] = {"type": "object", "properties": {"answer": {"type": "integer", "minimum": 0, "maximum": len(q["criteria"]) - 1}, "confidence": {"type": "number", "minimum": 0, "maximum": 1}}, "required": ["answer", "confidence"], "additionalProperties": False}
    return {"type": "object", "properties": props, "required": list(props), "additionalProperties": False}


def call_llm(state, questions, model):
    qtext = []
    for k, q in questions.items():
        if q["type"] == "noul": qtext.append(f"- {k} (yes/no): {q['instructions']} Give probability_true in [0,1].")
        elif q["type"] == "choice": qtext.append(f"- {k} (choose one): {q['instructions']}. Options: " + "; ".join(f"{o} = {d}" for o, d in q["criteria"].items()) + ". Give confidence in [0,1].")
        else: qtext.append(f"- {k} (integer score): {q['instructions']}. Scale: " + "; ".join(f"{i} = {d}" for i, d in enumerate(q["criteria"])) + ". Give confidence in [0,1].")
    body = {"model": model, "temperature": 0,
            "messages": [{"role": "system", "content": "You answer narrow typed questions about a state. Reply only with the JSON object."},
                         {"role": "user", "content": "STATE:\n" + json.dumps(state, ensure_ascii=False) + "\n\nQUESTIONS:\n" + "\n".join(qtext)}],
            "response_format": {"type": "json_schema", "json_schema": {"name": "answers", "strict": True, "schema": llm_schema(questions)}}}
    res, ms = post(f"{OR}/v1/chat/completions", body)
    raw = json.loads(res["choices"][0]["message"]["content"])
    answers = {}
    for k, q in questions.items():
        a = raw[k]
        if q["type"] == "noul": answers[k] = {"type": "noul", "noul": a["probability_true"]}
        elif q["type"] == "choice": answers[k] = {"type": "choice", "choice": a["answer"], "confidence": a["confidence"]}
        else: answers[k] = {"type": "score", "score": a["answer"], "confidence": a["confidence"]}
    u = res.get("usage", {})
    return {"answers": answers, "usage": {"input_tokens": u.get("prompt_tokens"), "output_tokens": u.get("completion_tokens"), "cost": u.get("cost")}, "model": res.get("model"), "latency_ms": ms}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("dataset"); ap.add_argument("--provider", default="jev", choices=["jev", "laya", "llm"])
    ap.add_argument("--model"); ap.add_argument("--limit", type=int); ap.add_argument("--repeat", type=int, default=1); ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda", "mps"], help="Laya execution device")
    a = ap.parse_args()
    model = a.model or (JEV_MODEL if a.provider == "jev" else LAYA_MODEL if a.provider == "laya" else "anthropic/claude-haiku-4.5")
    questions = json.loads((HERE / "questions" / f"{a.dataset}.json").read_text())
    rows = [json.loads(l) for l in (HERE / "samples" / f"{a.dataset}.jsonl").open()][: a.limit]
    tag = model.split("/")[-1].replace(":", "-")
    out = HERE / "runs" / f"{a.dataset}-{a.provider}-{tag}-{date.today():%Y%m%d}{'-x' + str(a.repeat) if a.repeat > 1 else ''}.jsonl"
    done = {(json.loads(l)["id"], json.loads(l)["repeat"]) for l in out.open()} if out.exists() else set()
    jobs = [(r, k) for k in range(a.repeat) for r in rows if (r["id"], k) not in done]
    print(f"{a.dataset} via {a.provider}/{model}: {len(jobs)} calls ({len(done)} already done) -> {out.name}", file=sys.stderr)
    cost = 0.0; errs = 0; t0 = time.time()
    if a.provider == "laya":
        agent = load_laya(model, a.device)
        with out.open("a") as f:
            for i, (r, k) in enumerate(jobs, 1):
                try:
                    res = call_laya(agent, r["state"], questions, model)
                except Exception as e:
                    errs += 1; print(f"  ! {r['id']}: {e}", file=sys.stderr); continue
                f.write(json.dumps({"id": r["id"], "repeat": k, "truth": r["truth"], **res}, ensure_ascii=False) + "\n"); f.flush()
                if i % 25 == 0 or i == len(jobs):
                    print(f"  {i}/{len(jobs)}  {int(time.time()-t0)}s  errors={errs}", file=sys.stderr)
        return

    fn = call_jev if a.provider == "jev" else call_llm
    with out.open("a") as f, ThreadPoolExecutor(a.concurrency) as ex:
        futs = {ex.submit(fn, r["state"], questions, model): (r, k) for r, k in jobs}
        for i, fut in enumerate(as_completed(futs), 1):
            r, k = futs[fut]
            try:
                res = fut.result()
            except Exception as e:
                errs += 1; print(f"  ! {r['id']}: {e}", file=sys.stderr); continue
            cost += (res["usage"] or {}).get("cost") or 0
            f.write(json.dumps({"id": r["id"], "repeat": k, "truth": r["truth"], **res}, ensure_ascii=False) + "\n"); f.flush()
            if i % 25 == 0 or i == len(jobs):
                print(f"  {i}/{len(jobs)}  {int(time.time()-t0)}s  errors={errs}  cost=${cost:.4f}", file=sys.stderr)


if __name__ == "__main__":
    main()
