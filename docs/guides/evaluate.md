# Evaluate

Ladder: 10 games on seeds 100–109, 500 ms steps, 3-minute cap per game, realtime clock, `flat` input, no lookahead.

```bash
npm run headless -- --policy <name> --games 10 --seed 100 --max-seconds 180
```

Game `i` uses seed `seed + i`. The runner writes `runs/<tag>/decisions.jsonl` and `summary.json`, and prints food, survival, latency p50, and stale rate.

## Seeds

Eval 100–199, val 900–999, train 1000+. `gen-data` refuses eval seeds.

## Clocks

- `realtime`: decision latency converts to elapsed steps before the answer applies; a late answer keeps the old heading (stale).
- `lockstep`: the game waits for every answer. Quality without latency; not ladder-comparable.

## The lookahead rule

Oracle rollouts may label training data but never enter a player's input in a comparison.

## Recording results

`working.md` (model, encoder, hardware) + `model_evaluation.md` section per result; headline changes update `results.md`.
