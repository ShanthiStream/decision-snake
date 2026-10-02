# PRD: Decision Snake

## Goal

A visual, real-time snake arena driven by a local decision model — the fast, watchable counterpart to decision-pacman, built to repeat its pipeline (baselines → teacher labels → distilled 0.8B → ladder) on per-tick steering decisions.

## Requirements (M1: playable arena)

1. **Arena.** 24×24 grid, fixed 500 ms step (2x selector for faster setups). Player snake (model/human) + 1 scripted rival (greedy food-chaser, respawns 20 steps after death). One food at a time, contested.
2. **Deaths.** Own body, rival body. Edges wrap (no wall deaths — weak models must survive to be watchable). Single life per game; games end on death or a 3-minute cap.
3. **Decisions every tick.** Options = non-reverse directions (up to 3). The sim never waits: slow/failed answers keep the heading (lockstep clock available for quality-only measurement).
4. **Players.** Any `/v1/systemone` decision model, `llm:`/`llm-think:` chat models, scripted `random`/`greedy`, human (arrows/WASD).
5. **Headless eval.** Seeded games with JSONL logs (food, ticks survived, latency). Same engine as the browser.
6. **Stack.** Vite + TypeScript + Canvas 2D, Vitest, `tsx` scripts. No UI framework. Code-drawn art only.

## Non-goals (M1–M4)

Multiple rivals, power-ups, multiplayer, audio tour, iPhone app (M4).

## Success criteria

- M1: full games complete headless; browser snake vs rival is watchable at 1x.
- M2: 10-game ladder per policy with food/survival numbers, variance noted.
- M3: distilled 0.8B beats `tev1:4b`.
- M4: static site deployed; iOS app plays on device.
