# RFC: Architecture and key decisions

## Summary

A deterministic TypeScript arena steps on a fixed 500 ms clock. An async agent loop encodes the head state as compact JSON (`features`) and queries a decision endpoint every tick; answers become the next heading. The sim never awaits the model — a late answer means the snake keeps its heading (realtime), or the game holds (lockstep, quality-only). Same engine runs headless for evals and teacher data.

## Components

- `src/engine/`: `types.ts`, `arena.ts` (`createGame`, `step`), `rival.ts` (scripted greedy chaser), `rng.ts` (mulberry32 on the state).
- `src/encoders/`: `features` (per-direction self/rival distances, wrapped food distance, flood-fill open space; never verdicts), `types.ts`.
- `src/agent/`: `client.ts`, `llm.ts` (`llm:`/`llm-think:` + capability routing), `policies.ts` (random, greedy, systemOne), `factory.ts`, `oracle.ts` (greedy-rollout search; labels only), `teacher.ts` (peek = rollout futures).
- `src/sim/runner.ts`: realtime (latency → ticks) + lockstep clocks, labeler + alsoEncode support.
- `src/render/canvas.ts`, `src/main.ts`: canvas snakes/food/grid, HUD (score, latency, probabilities), error panel, human input. Read state, never mutate rules.
- `scripts/`, `training/` (M3), `tests/`, `docs/`, `ios/` (M4).

## Key decisions

### 1. Every tick is a decision (no junctions)

Unlike pacman's junctions, snake chooses a heading every step. Options are the non-reverse directions (≤3). The 500 ms step fits every installed model inside one step (tev1:0.8b needs ~370 ms here); staleness is measured, not hidden. Faster setups can use the 2x speed selector.

### 2. Fixed step, decoupled agent (pacman pattern)

Fixed-step accumulator on rAF; agent on its own async schedule. Slow/failed answers cost a turn (keep heading), never a stall — except lockstep, which is not ladder-comparable.

### 3. One scripted rival, respawning

A greedy rival makes the arena alive and threatening without a second model call. Respawn after 20 steps keeps pressure constant. Rival-vs-food races are the interesting states for distillation.

### 4. Encoders report facts, never verdicts

Distances, food deltas, flood-fill open space. No "safe"/"danger"/"go here" — the student must learn judgment.

### 5. Edges wrap (no wall deaths)

Off-the-shelf small models marched into walls within seconds (100% stale at 150 ms steps, and poor direction choice even fresh). A demo where the snake suicides in seconds looks broken, so the arena is toroidal: deaths come only from bodies. The ladder still discriminates via food rate and survival against a growing body + rival.

### 6. Same policy surface as the sister projects

Bare decision names, `random`, `greedy`, `llm:`, `llm-think:`, `teacher*`, `oracle-*`. Adapters and picker behavior port over.
