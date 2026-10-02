# Test strategy

## Unit tests (Vitest, offline, default `npm test`)

- Engine: movement, edge wrap, growth on food, self/rival collisions, food respawn never on a body, rival chase + respawn timer, death ends the game.
- Determinism: same seed + heading sequence = identical state.
- Encoders: snapshots, options match legal dirs, token budget, no verdict fields, flood-fill sanity (open area shrinks in a trap).
- Agent: oracle avoids immediate death; teacher parsing drops bad states; llm extraction incl. traces.
- Runner: scripted policies finish games; labeler recorded alongside.

## Integration (opt-in, needs Ollama)

- `python3 scripts/probe_decision_models.py <model>`: tactical scenarios with known-correct directions.

## Headless (manual, needs Ollama)

`npm run headless -- --policy tev1:0.8b --games 10 --seed 100 --max-seconds 180`, JSONL under `runs/`. Compare vs previous + baselines on same seeds; log in `working.md`. Full protocol: `docs/guides/evaluate.md`.

## Manual browser check

30 ticks/s? No — 500 ms steps (2/s). Snake moves smoothly, bars update, stopping Ollama shows the error panel while the snake keeps going.
