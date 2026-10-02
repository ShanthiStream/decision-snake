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
