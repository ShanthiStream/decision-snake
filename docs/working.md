# Working notes

## Changelog

### 2026-10-02

- Scaffolded the repo (M1 start): manifests, CI, docs, AGENTS.md.
- M1 built: arena engine (24×24, player + greedy rival with respawn, simultaneous-move tail rules), features encoder (per-direction distances + flood-fill open space, facts only), agent (ported client/llm/teacher, snake-greedy, oracle-30t, factory), realtime+lockstep runner, headless + gen-data + probe + record scripts, canvas browser (fixed-step agent loop, HUD, capability-routed model dropdown). 31 tests green, typecheck clean.
- Skill separation confirmed (lockstep, seeds 100-102): greedy ~23 food / ~630 ticks vs random 0 food / ~33 ticks. Greedy survives 30 s realtime games unbeaten.
- Cadence finding: tev1:0.8b needs ~350 ms on 335-token states (probe p50), so 150 ms steps left it 100% stale. Moved to STEP_MS 250 (4 cells/s): stale 72%, model decides most ticks. Slow models still pay honestly; ladder stays meaningful.
- Probe (4 scenarios, balanced): tev1:0.8b 2/8 — near chance, same distillation motivation as pacman.
- Live: tev1:0.8b 2 games, 0 failures; gen-data writes labeled rows (oracle values); dev page 200.
- Note: `npm`/`npx` wrappers tripped the sandbox late in the session (`FileSystem.access`); `./node_modules/.bin/` binaries work. `runs/` + `data/smoke` cleaned after verification.

### Bug: snake suicided in seconds with the default model (fixed)

- Reproduced in-browser: with `tev1:0.8b` (~370 ms on this M1 Air) at 250 ms steps, every answer was stale and the snake wall-marched to death by tick ~15. Frozen STEP + tick counter read as "not working".
- Decision logs showed a second layer: even fresh, the model marched away from food (0 food, probe 2/8) — genuine weak judgment, plus a flood-fill cap overshoot (areas of 201 vs cap 200, fixed with an inner break).
- Fix (RFC 5): the arena is now toroidal — edges wrap, deaths come only from bodies. Encoder went wrap-aware (rays, flood, toroidal food distance); `wallDist` dropped. STEP_MS 250 → 500 so installed models fit inside one step.
- After: tev1:0.8b survives full 60 s games (0 failures), greedy eats 6/60 s, browser verified visually (both snakes growing, rival scoring, zero console errors, favicon added). Model still plays dumb (0 food) — intelligence is M3's distillation job; the game no longer dies to prove it.
