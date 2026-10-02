# RFC: Architecture and key decisions

## Summary

A deterministic TypeScript arena steps on a fixed 250 ms clock. An async agent loop encodes the head state as compact JSON (`features`) and queries a decision endpoint every tick; answers become the next heading. The sim never awaits the model — a late answer means the snake keeps its heading (realtime), or the game holds (lockstep, quality-only). Same engine runs headless for evals and teacher data.

## Components

- `src/engine/`: `types.ts`, `arena.ts` (`createGame`, `step`), `rival.ts` (scripted greedy chaser), `rng.ts` (mulberry32 on the state).
- `src/encoders/`: `features` (per-direction wall/self/rival distances, food distance after the move, flood-fill open space; never verdicts), `types.ts`.
- `src/agent/`: `client.ts`, `llm.ts` (`llm:`/`llm-think:` + capability routing), `policies.ts` (random, greedy, systemOne), `factory.ts`, `oracle.ts` (greedy-rollout search; labels only), `teacher.ts` (peek = rollout futures).
- `src/sim/runner.ts`: realtime (latency → ticks) + lockstep clocks, labeler + alsoEncode support.
- `src/render/canvas.ts`, `src/main.ts`: canvas snakes/food/grid, HUD (score, latency, probabilities), error panel, human input. Read state, never mutate rules.
- `scripts/`, `training/` (M3), `tests/`, `docs/`, `ios/` (M4).

## Key decisions

### 1. Every tick is a decision (no junctions)

Unlike pacman's junctions, snake chooses a heading every step. Options are the non-reverse directions (≤3). The 250 ms step keeps a ~350 ms 0.8B within ~1.4 steps; staleness is measured, not hidden; staleness is measured, not hidden.

### 2. Fixed step, decoupled agent (pacman pattern)

Fixed-step accumulator on rAF; agent on its own async schedule. Slow/failed answers cost a turn (keep heading), never a stall — except lockstep, which is not ladder-comparable.

### 3. One scripted rival, respawning

A greedy rival makes the arena alive and threatening without a second model call. Respawn after 20 steps keeps pressure constant. Rival-vs-food races are the interesting states for distillation.

### 4. Encoders report facts, never verdicts

Distances, food deltas, flood-fill open space. No "safe"/"danger"/"go here" — the student must learn judgment.

### 5. Same policy surface as the sister projects

Bare decision names, `random`, `greedy`, `llm:`, `llm-think:`, `teacher*`, `oracle-*`. Adapters and picker behavior port over.
