// Engine rollouts: steer an option on a copy of the arena, then greedy
// headings for the rest of the horizon. The outcomes label training data (the
// teacher sees them); the search itself sees the future, so it is never a
// compared player.
import { featuresEncoder } from "../encoders/features.ts";
import { step } from "../engine/arena.ts";
import type { Dir, GameState } from "../engine/types.ts";
import { greedyChoice } from "./policies.ts";
import type { Policy } from "./policies.ts";

export interface PeekOutcome {
  foodEaten: number;
  ticksSurvived: number;
  died: boolean;
}

/** Copies the arena, steers `dir`, then greedy for up to `steps` more steps. */
export function rollout(game: GameState, dir: Dir, steps: number): PeekOutcome {
  const s: GameState = structuredClone(game);
  step(s, { dir });
  let played = 1;
  while (s.phase === "playing" && played < 1 + steps) {
    const enc = featuresEncoder.encode(s);
    step(s, { dir: greedyChoice(enc) as Dir });
    played++;
  }
  return {
    foodEaten: s.player.food - game.player.food,
    ticksSurvived: played,
    died: s.phase === "dead",
  };
}

/** One named outcome per option, for the teacher's labeling prompt. */
export function peek(game: GameState, dir: Dir, steps: number): PeekOutcome {
  return rollout(game, dir, steps);
}

export function scoreOutcome(o: PeekOutcome): number {
  return o.foodEaten * 100 + o.ticksSurvived - (o.died ? 500 : 0);
}

export function oraclePolicy(opts: { steps?: number } = {}): Policy {
  const steps = opts.steps ?? 30;
  return {
    name: `oracle-${steps}t`,
    requiresEncoder: "features",
    async decide(enc, _signal, game) {
      if (!game) throw new Error("oracle needs the live arena state");
      const values: Record<string, number> = {};
      for (const key of enc.keys) values[key] = scoreOutcome(rollout(game, key, steps));
      let best = enc.keys[0];
      for (const k of enc.keys.slice(1)) if (values[k] > values[best]) best = k;
      return { choice: best, values, latencyMs: 0 };
    },
  };
}
