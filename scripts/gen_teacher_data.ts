// Records arena states labeled by a teacher (or the oracle search) for training.
//
//   npm run gen-data -- --player greedy --labeler teacher-peek30t --games 5 --seed 1000 --out data/q1/train
//
// The player only decides which states get visited; the labeler labels every
// one of them. Refuses evaluation seeds 100-199: eval seeds never train.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadDotEnv, makePolicy, policyEnvFromProcess } from "../src/agent/factory.ts";
import type { TeacherDecision } from "../src/agent/teacher.ts";
import { ENCODERS } from "../src/encoders/index.ts";
import { playGame } from "../src/sim/runner.ts";

loadDotEnv();

const { values: args } = parseArgs({
  options: {
    player: { type: "string", default: "oracle-30t" },
    labeler: { type: "string", default: "oracle-30t" },
    encoder: { type: "string", default: "features" },
    "also-encode": { type: "string", default: "" },
    games: { type: "string", default: "1" },
    seed: { type: "string", default: "1000" },
    "max-seconds": { type: "string", default: "120" },
    out: { type: "string", default: "data/teacher" },
  },
});

const EVAL_LOW = 100;
const EVAL_HIGH = 200;

async function main() {
  const games = Number(args.games);
  const seed0 = Number(args.seed);
  for (let g = 0; g < games; g++) {
    const seed = seed0 + g;
    if (seed >= EVAL_LOW && seed < EVAL_HIGH) throw new Error(`seed ${seed} is an evaluation seed and must never train`);
  }

  const env = policyEnvFromProcess();
  env.teacherCache = new Map<string, TeacherDecision>();
  const encoder = ENCODERS[args.encoder!];
  if (!encoder) throw new Error(`unknown encoder ${args.encoder}`);
  const alsoEncode = (args["also-encode"] ?? "").split(",").map((s) => s.trim()).filter(Boolean).map((n) => {
    const e = ENCODERS[n];
    if (!e) throw new Error(`unknown encoder ${n}`);
    return e;
  });

  let rows = 0;
  for (let g = 0; g < games; g++) {
    const seed = seed0 + g;
    const outDir = join(args.out!, `seed-${seed}`);
    mkdirSync(outDir, { recursive: true });
    const logPath = join(outDir, "states.jsonl");
    const player = makePolicy(args.player!, seed, env);
    const labeler = makePolicy(args.labeler!, seed, env);
    const sum = await playGame({
      seed,
      policy: player,
      encoder: ENCODERS[player.requiresEncoder ?? args.encoder!]!,
      clock: "lockstep",
      maxSeconds: Number(args["max-seconds"]),
      labeler,
      alsoEncode,
      onDecision: (ev) => {
        if (!ev.label) return;
        appendFileSync(
          logPath,
          JSON.stringify({
            seed,
            tick: ev.askedTick,
            player: args.player,
            encoder: ev.enc.encoder,
            state: ev.enc.state,
            instructions: ev.enc.instructions,
            options: ev.enc.criteria,
            values: ev.label.values ?? null,
            label: ev.label.choice,
            reason: (ev.label as TeacherDecision).reason ?? null,
            alt: ev.alt ?? null,
          }) + "\n",
        );
        rows++;
      },
    });
    console.log(`seed ${seed}: food ${sum.score}, ticks ${sum.ticksSurvived} -> ${logPath}`);
  }
  console.log(`wrote ${rows} rows under ${args.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
