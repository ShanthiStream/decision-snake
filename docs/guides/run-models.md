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

Model (dropdown), mode (Model/Keyboard), speed, seed, endpoint. Arrows/WASD play in keyboard mode.

## Recording clips

```bash
npm run record -- --model tev1:0.8b --seconds 30 --seed 100 --out docs/media/demo.mp4
```
