# Jev evaluation on labeled datasets

Scripts, samples and every raw response behind the video evaluations:

- [Jev 到底准不准？我拿两个 Kaggle 数据集测了一遍](https://youtu.be/Ptwhkqut2Q0)
- [Jev 开源平替实测：Laya 的决策质量究竟如何？](https://youtu.be/i9857T0ZxpA)

The idea: take datasets with **human** labels, rewrite each row as a Jev
`state` + typed questions, run a few hundred rows, and look at accuracy,
calibration and confidence gating. The same fixed samples and questions can be
sent to Jev, a local Laya checkpoint, or a conventional LLM baseline.

## Layout

| Path | What |
|---|---|
| `datasets.json` | manifest: source, state fields, truth columns, stratification, sample size |
| `questions/<id>.json` | the Jev question set per dataset (tryjev `EvaluateRequest` shape) |
| `samples/<id>.jsonl` | the sampled rows, `{id, state, truth}` - fixed seed, checked in |
| `runs/*.jsonl` | one line per call: answers, usage, latency; `-x3` files are the 50×3 consistency reruns |
| `reports/` | metrics JSON + reliability / gating / scatter plots |
| `sample.py` / `run.py` / `score.py` | the pipeline |

Datasets run so far: **Banking77** (PolyAI, 77 intents, CC-BY-4.0) and
**SMS Spam Collection** (UCI). Both are fetched from their original sources;
the other entries in `datasets.json` need Kaggle credentials.

## Run it

```bash
cd eval
export OPENROUTER_API_KEY=...        # Jev via OpenRouter decisions API; Haiku via chat completions
uv run sample.py sms-spam banking77  # -> samples/*.jsonl
uv run run.py banking77              # Jev
uv run run.py banking77 --provider laya --device mps
uv run run.py banking77 --provider llm --model anthropic/claude-haiku-4.5
uv run run.py banking77 --limit 50 --repeat 3   # consistency
uv run score.py                      # tables + reports/
```

To evaluate your own data: add an entry to `datasets.json` (or write
`samples/<id>.jsonl` directly), put your questions in `questions/<id>.json`,
then `run.py` + `score.py`. Keep the question set fixed for the whole run.

## Results (2026-09-20, `typesafe/jev-1.13-20260917` vs `anthropic/claude-haiku-4.5`)

Video: [Jev 到底准不准？我拿两个 Kaggle 数据集测了一遍](https://youtu.be/Ptwhkqut2Q0)

| | Jev | Haiku 4.5 |
|---|---|---|
| Banking77 accuracy (462 rows, 77-way) | 0.816 | 0.801 |
| SMS Spam accuracy (200 rows) | 0.965 | 0.935 |
| Banking77 p50 latency (from overseas, via OpenRouter) | 432 ms | 1,424 ms |
| Banking77 cost per call | $0.00008 | $0.0025 |

Jev's `confidence` separates well (≥ 0.95: 95.5% accurate, < 0.5: 17.6%),
while its top probability is over-confident in every bucket (0.99 predicted →
92.0% observed). Details in `reports/`.

## Laya comparison (2026-09-23)

Video: [Jev 开源平替实测：Laya 的决策质量究竟如何？](https://youtu.be/i9857T0ZxpA)

The same 662 samples and question files were run through Laya 0.3.11 using the
English `convaiinnovations/laya` base checkpoint on Apple M3 MPS.

| Dataset | Jev accuracy | Laya accuracy | Jev Macro F1 | Laya Macro F1 |
|---|---:|---:|---:|---:|
| SMS Spam (200 rows) | 96.5% | 84.0% | 0.926 | 0.759 |
| Banking77 (462 rows, 77-way) | 81.6% | 39.6% | 0.806 | 0.346 |

See [LAYA.md](LAYA.md) for the methodology, latency measurements and important
limits on interpreting this comparison. The checked-in Laya raw responses are
under `runs/`; generated metric JSON and charts are under `reports/`.
