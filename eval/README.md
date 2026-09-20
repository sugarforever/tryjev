# Jev evaluation on labeled datasets

Scripts, samples and every raw response behind the write-up
"Jev 到底准不准？我拿两个 Kaggle 数据集测了一遍".

The idea: take datasets with **human** labels, rewrite each row as a Jev
`state` + typed questions, run a few hundred rows, and look at accuracy,
calibration and confidence gating - next to a cheap LLM answering the same
questions.

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
uv run run.py banking77 --provider llm --model anthropic/claude-haiku-4.5
uv run run.py banking77 --limit 50 --repeat 3   # consistency
uv run score.py                      # tables + reports/
```

To evaluate your own data: add an entry to `datasets.json` (or write
`samples/<id>.jsonl` directly), put your questions in `questions/<id>.json`,
then `run.py` + `score.py`. Keep the question set fixed for the whole run.

## Results (2026-09-20, `typesafe/jev-1.13-20260917` vs `anthropic/claude-haiku-4.5`)

| | Jev | Haiku 4.5 |
|---|---|---|
| Banking77 accuracy (462 rows, 77-way) | 0.816 | 0.801 |
| SMS Spam accuracy (200 rows) | 0.965 | 0.935 |
| Banking77 p50 latency (from overseas, via OpenRouter) | 432 ms | 1,424 ms |
| Banking77 cost per call | $0.00008 | $0.0025 |

Jev's `confidence` separates well (≥ 0.95: 95.5% accurate, < 0.5: 17.6%),
while its top probability is over-confident in every bucket (0.99 predicted →
92.0% observed). Details in `reports/`.
