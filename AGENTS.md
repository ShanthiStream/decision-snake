# AGENTS.md

Visual snake arena where a local decision model (`/v1/systemone`, default `tev1:0.8b` on Ollama) steers a canvas snake in real time against a scripted rival, plus the usual pipeline (teacher labels → 0.8B distill → ladder). Sister project of decision-pacman/duel: same agent stack, but every tick is a decision (no junctions) on a fixed 500 ms step. Read `docs/prd.md` and `docs/rfc.md` before changing architecture. Public GitHub repo, English only.

## Commands

- `npm install`, `npm run dev` (http://localhost:5175), `npm run typecheck`, `npm test`, `npm run build`.
- CI runs `npm ci` → `typecheck` → `test`; keep that order locally.
- Single test: `npx vitest run tests/<name>.test.ts`.
- Ladder eval (10 games, eval seeds, 3-min cap): `npm run headless -- --policy <name> --games 10 --seed 100 --max-seconds 180`. Lockstep (quality without latency): add `--clock lockstep`.
- Probes are stdlib-only, no venv: `python3 scripts/probe_decision_models.py <model>`.

## Structure

- `src/engine/`: pure deterministic arena (grid, player + rival snakes, food, seeded RNG). No DOM, timers, network, or `Math.random`. `STEP_MS = 250` fixed step. `src/sim/runner.ts` drives headless games on the same engine.
- `src/encoders/`: state-to-text, facts never verdicts. `features` is the comparison input (per-direction distances + flood-fill open space).
- `src/agent/`: loop, `/v1/systemone` client, `llm:`/`llm-think:` chat policies, `teacher*` labelers, `oracle.ts` search rollouts (labels only, never a compared player).
- `src/render/`, `src/main.ts`: canvas arena + HUD, event-driven agent loop on a fixed-step accumulator. Read engine state, never mutate rules. Code-drawn art only.
- `scripts/`: command contract (`run_headless.ts`, `gen_teacher_data.ts`, `record_demo.ts`, probes). Don't leave commands only in the README.
- `docs/`: `rfc.md` (update when a decision changes), `results.md` (update on headline-number change), `model_evaluation.md` (new section per in-game result), `test.md`, `guides/`, `working.md` (changelog + numbers with model, encoder, hardware — update every session).

## Rules

- Simulation never awaits the model: fixed step stays independent of the agent loop. Slow/failed answers keep the heading, never stall (except `lockstep`, not ladder-comparable).
- Latency claims require fresh states — exact repeats hit a cache 5–10x faster.
- Seeds are disjoint and eval seeds never train: eval 100–199, val 900–999, train 1000+. `gen-data` refuses eval seeds.
- Secrets hygiene: no emails, keys, paths, hostnames, vault refs in tracked files; `.env.example` placeholders only. Privacy scan before any push: `rg -n -i "@|op://|/Users/|ts\.net|tailscale|api[_-]?key|token" .`, review every hit.
- Default branch `master` is protected (PRs only). Commit/push/PR only when explicitly asked; keep commits small.
