# Run models

## Local decision models (Ollama /v1/systemone)

```bash
ollama pull gemma4:e2b-it-qat
npm install
npm run dev            # http://localhost:5175/?model=llm:gemma4:e2b-it-qat
```

```bash
npm run headless -- --policy llm:gemma4:e2b-it-qat --games 10 --seed 100 --max-seconds 180
```

`tev1:0.8b` also plays (fast, ~350 ms) but circles without seeking food zero-shot — it is the distillation baseline, not the demo. `LFM2.5` ignores the JSON schema (essays instead of answers) and cannot play.

## Plain chat models (llm: / llm-think:)

`llm:<ollama-model>` (constrained JSON, thinking off) or `llm-think:<ollama-model>` (thinking allowed, move read from content or thinking). The dropdown lists installed models routed by capability. Slow models go stale and keep their heading — that's the realtime cost; use `--clock lockstep` to judge choices alone.

## Baselines and labeling players

- `random` / `greedy` (greedy: seeks food, avoids bodies; edges wrap).
- `oracle-*`: greedy-rollout search. Labels data, never a ladder player.
- `teacher*`: chat teacher over `TEACHER_BASE_URL` / `TEACHER_MODEL`.

## Browser controls

Model (dropdown), mode (Model/Keyboard), encoder (`flat` default, `features` nested JSON), Wait switch, speed, seed, endpoint. Arrows/WASD play in keyboard mode. URL params match: `?model=tev1:4b&encoder=features&wait=1`.

Representation matters per model: on the same scenarios `tev1:0.8b` scores 6/8 flat vs 2/8 nested, while `tev1:4b` scores 8/8 nested vs 4/8 flat. The ladder compares all players on `flat`; `tev1:4b` on `features` is the smart-demo recipe (`?model=tev1:4b&encoder=features&wait=1`), reported apart like any non-ladder condition.

## Recording clips

```bash
npm run record -- --model tev1:0.8b --seconds 30 --seed 100 --out docs/media/demo.mp4
```
