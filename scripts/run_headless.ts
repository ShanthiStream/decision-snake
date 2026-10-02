// Plays seeded games without rendering and writes one JSONL record per decision.
//
//   npm run headless -- --policy tev1:0.8b --games 5 --seed 100 --clock realtime
//   npm run headless -- --policy greedy --games 20
//
// realtime: the model's measured latency turns into elapsed steps before the
//           answer steers, as in the browser (late answers keep the heading).
// lockstep: every answer steers the next step (an upper bound on decision quality).
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadDotEnv, makePolicy, policyEnvFromProcess } from "../src/agent/factory.ts";
import { ENCODERS } from "../src/encoders/index.ts";
import { playGame, type Clock, type GameSummary } from "../src/sim/runner.ts";

loadDotEnv();

const { values: args } = parseArgs({
  options: {
    policy: { type: "string", default: "llm:gemma4:e2b-it-qat" },
    "base-url": { type: "string" },
    encoder: { type: "string", default: "flat" },
    clock: { type: "string", default: "realtime" },
    games: { type: "string", default: "3" },
    seed: { type: "string", default: "100" },
    speed: { type: "string", default: "1" },
    "max-seconds": { type: "string", default: "180" },
    out: { type: "string", default: "runs" },
  },
});

const clock = args.clock as Clock;
if (clock !== "realtime" && clock !== "lockstep") throw new Error("--clock must be realtime or lockstep");

async function main() {
  const env = policyEnvFromProcess();
  if (args["base-url"]) env.decisionBaseUrl = args["base-url"];
  const games = Number(args.games);
  const seed0 = Number(args.seed);
  const tag = `${new Date().toISOString().replace(/[:.]/g, "-")}_${args.policy!.replace(/[^\w.-]/g, "_")}_${args.encoder}_${clock}_p${process.pid}`;
  const dir = join(args.out!, tag);
  mkdirSync(dir, { recursive: true });
  const logPath = join(dir, "decisions.jsonl");
  writeFileSync(logPath, "");

  const summaries: GameSummary[] = [];
  for (let g = 0; g < games; g++) {
    const seed = seed0 + g;
    const policy = makePolicy(args.policy!, seed, env);
    const encoder = ENCODERS[policy.requiresEncoder ?? args.encoder!];
    if (!encoder) throw new Error(`unknown encoder ${args.encoder}`);
    const sum = await playGame({
      seed,
      policy,
      encoder,
      clock,
      maxSeconds: Number(args["max-seconds"]),
      onDecision: (ev) => appendFileSync(logPath, JSON.stringify(ev) + "\n"),
    });
    summaries.push(sum);
    console.log(
      `seed ${seed}: food ${sum.score}, ticks ${sum.ticksSurvived}, ${sum.endedBy}, ` +
        `${sum.decisions} decisions (${sum.failures} failed, ${sum.stale} stale), p50 ${sum.latencyP50} ms`,
    );
  }

  const lat = summaries.flatMap((s) => Array(s.decisions).fill(s.latencyP50));
  const overall = {
    policy: args.policy,
    encoder: args.encoder,
    clock,
    games: summaries.length,
    meanFood: summaries.reduce((a, s) => a + s.score, 0) / summaries.length,
    meanTicks: Math.round(summaries.reduce((a, s) => a + s.ticksSurvived, 0) / summaries.length),
    deaths: summaries.reduce((a, s) => a + s.deaths, 0),
    meanLatencyP50: Math.round(lat.sort((a, b) => a - b)[Math.floor(lat.length / 2)] ?? 0),
    staleRate: summaries.reduce((a, s) => a + s.stale, 0) / Math.max(1, summaries.reduce((a, s) => a + s.decisions, 0)),
    failures: summaries.reduce((a, s) => a + s.failures, 0),
  };
  console.log(JSON.stringify(overall));
  writeFileSync(join(dir, "summary.json"), JSON.stringify({ ...overall, summaries }, null, 2));
  console.log(`wrote ${dir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
