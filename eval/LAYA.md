# Laya vs Jev evaluation

Evaluation date: 2026-09-23.

Video: [Jev 开源平替实测：Laya 的决策质量究竟如何？](https://youtu.be/i9857T0ZxpA)

Previous Jev evaluation: [Jev 到底准不准？我拿两个 Kaggle 数据集测了一遍](https://youtu.be/Ptwhkqut2Q0)

This experiment reruns the exact samples, questions and scoring code from the
previous Jev evaluation against the open-source Laya decision model. It is a
reproducible comparison on two datasets, not a general ranking of either
project.

## Setup

- Laya 0.3.11 with the English `convaiinnovations/laya` base checkpoint
- Apple M3 using the MPS device
- Jev results reused from the same checked-in samples and raw responses,
  generated with `typesafe/jev-1.13`
- SMS Spam: 200 messages, including 27 spam messages
- Banking77: 462 messages across 77 equally sampled intents
- Both providers scored by the same `score.py`

## Results

| Dataset | Samples | Task | Jev accuracy | Laya accuracy | Jev Macro F1 | Laya Macro F1 |
|---|---:|---|---:|---:|---:|---:|
| SMS Spam | 200 | spam or not spam | 96.5% | 84.0% | 0.926 | 0.759 |
| Banking77 | 462 | 77-way intent classification | 81.6% | 39.6% | 0.806 | 0.346 |

## Latency and error overlap

| Dataset | Jev p50 / p95 | Laya p50 / p95 | Both wrong | Jev only correct | Laya only correct |
|---|---:|---:|---:|---:|---:|
| SMS Spam | 447 / 922 ms | 50 / 66 ms | 3 | 29 | 4 |
| Banking77 | 432 / 658 ms | 294 / 354 ms | 74 | 205 | 11 |

The latency columns are not a pure model-speed benchmark. Jev was accessed as a
hosted service over the network; Laya ran locally on MPS. They describe the
observed wait time for these two practical execution paths on this machine.

## Reproduce

Install the locked environment, then run Laya locally and regenerate reports:

```bash
uv sync
uv run run.py sms-spam --provider laya --device mps
uv run run.py banking77 --provider laya --device mps
uv run score.py
```

Use `--device cpu` on a machine without Apple MPS or CUDA. Existing JSONL files
are resumable: completed `(id, repeat)` pairs are skipped.

## Interpretation limits

1. This covers two English datasets and 662 samples.
2. The Laya checkpoint is the unfine-tuned English base checkpoint.
3. Banking77 has 77 choices, well beyond Laya's recommended range of roughly 20
   choices, so it is also a stress test of the architecture.
4. Jev ran in the cloud and Laya ran locally, so latency is environment-specific.
5. Laya 0.3.11 warns that for 11 or more choices its temperature is clamped and
   the returned confidence values are uncalibrated. This report therefore does
   not compare confidence gating for the 77-way task.
6. New tasks should be evaluated again on representative, labeled data rather
   than extrapolated from these two results.

## Artifacts

- `runs/sms-spam-laya-laya-20260923.jsonl`
- `runs/banking77-laya-laya-20260923.jsonl`
- `reports/sms-spam-laya-laya-20260923.json`
- `reports/banking77-laya-laya-20260923.json`
- Matching SVG charts in `reports/`
