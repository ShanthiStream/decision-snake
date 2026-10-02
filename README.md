# Decision Snake

A local decision model steers a snake in a canvas arena in real time (500 ms steps) against a scripted rival, choosing among the legal directions every tick through Ollama's `/v1/systemone` API. Sister project of decision-pacman: same agent stack and distillation pipeline, applied to a faster, more visual game.

## Quickstart

Requirements: Node 20+, Ollama 0.35+.

```bash
ollama pull tev1:0.8b
npm install
npm run dev            # open http://localhost:5175
```

Switch models in the side panel, or pass `?model=tev1:4b`. Arrow keys / WASD play human mode.

## Headless eval

```bash
npm run headless -- --policy tev1:0.8b --games 10 --seed 100 --max-seconds 180
```

Protocol and guides are in `docs/`; current numbers in `docs/results.md`.

## Tests

```bash
npm test
```

## License

MIT. Original code-drawn art only.
