import { legalDirs, dirFacts } from "./features.ts";
import type { GameState } from "../engine/types.ts";
import type { EncodedDecision, Encoder } from "./types.ts";

const INSTRUCTIONS = [
  "You steer a snake one cell per step. Edges wrap around: there are no wall deaths.",
  "Your body and the rival's body kill you. Eat food to grow and score.",
  "Reply with the direction to head.",
].join(" ");

/**
 * The same facts as `features`, rendered as flat text lines instead of nested
 * JSON. The 0.8B follows per-option gradients (food distance, open space) in
 * this shape but not in nested JSON (probe: 6/8 vs 2/8 on the same scenarios).
 */
export const flatEncoder: Encoder = {
  name: "flat",
  encode(s: GameState): EncodedDecision {
    const keys = legalDirs(s);
    const head = s.player.body[0];
    const lines = keys.map((k) => {
      const f = dirFacts(s, k);
      const eat = f.eatsFood ? ", EATS the food" : "";
      return `- ${k}: nearest body ${f.selfDist} ahead, rival ${f.rivalDist} ahead, food ${f.foodDist} away${eat}, open space ${f.openArea}`;
    });
    const rival = s.rival.alive
      ? `Rival head at (${s.rival.body[0].x},${s.rival.body[0].y}), length ${s.rival.body.length}.`
      : `Rival dead, respawns in ${s.rival.respawnIn}.`;
    const state = [
      `Tick ${s.tick}. Arena ${s.width}x${s.height}, edges wrap.`,
      `Your head at (${head.x},${head.y}) heading ${s.player.dir}. Length ${s.player.body.length}, score ${s.player.food}. Food at (${s.food.x},${s.food.y}).`,
      rival,
      "Options:",
      ...lines,
    ].join("\n");
    const criteria: Record<string, string | null> = {};
    for (const k of keys) criteria[k] = null;
    return { encoder: "flat", state, instructions: INSTRUCTIONS, criteria, keys };
  },
};
