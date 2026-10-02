import { add, DIRS, opposite } from "../engine/rival.ts";
import type { Dir, GameState, Vec } from "../engine/types.ts";
import type { EncodedDecision, Encoder } from "./types.ts";

const INSTRUCTIONS = [
  "You steer a snake one cell per step. Walls, your body, and the rival's body kill you.",
  "Your tail tip moves away unless you eat this step. Reversing is illegal and ignored.",
  "Eat food to grow and score. The rival chases the same food and respawns.",
  "Reply with the direction to head.",
].join(" ");

export interface DirFacts {
  wallDist: number;
  selfDist: number;
  rivalDist: number;
  foodDist: number;
  eatsFood: boolean;
  openArea: number;
}

function key(v: Vec): string {
  return `${v.x},${v.y}`;
}

/** Steps from the head in `dir` until hitting a cell in `blocked` or a wall. */
function rayDist(s: GameState, from: Vec, dir: Dir, blocked: Set<string>): number {
  let dist = 0;
  let v = add(from, DIRS[dir]);
  while (v.x >= 0 && v.y >= 0 && v.x < s.width && v.y < s.height && !blocked.has(key(v))) {
    dist++;
    v = add(v, DIRS[dir]);
  }
  return dist;
}

/** Reachable free cells from `from` (flood fill, capped), walls and bodies block. */
function floodArea(s: GameState, from: Vec, blocked: Set<string>, cap = 200): number {
  if (from.x < 0 || from.y < 0 || from.x >= s.width || from.y >= s.height || blocked.has(key(from))) return 0;
  const seen = new Set<string>([key(from)]);
  const stack: Vec[] = [from];
  while (stack.length && seen.size < cap) {
    const v = stack.pop()!;
    for (const d of Object.values(DIRS)) {
      const n = add(v, d);
      const k = key(n);
      if (n.x < 0 || n.y < 0 || n.x >= s.width || n.y >= s.height || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      stack.push(n);
    }
  }
  return seen.size;
}

export function legalDirs(s: GameState): Dir[] {
  return (Object.keys(DIRS) as Dir[]).filter((d) => d !== opposite(s.player.dir));
}

export function dirFacts(s: GameState, dir: Dir): DirFacts {
  const head = s.player.body[0];
  const target = add(head, DIRS[dir]);
  const grows = target.x === s.food.x && target.y === s.food.y;
  // Mirror the engine: a vacating tail tip is free.
  const selfBody = new Set<string>();
  const selfCells = grows ? s.player.body : s.player.body.slice(0, -1);
  for (const c of selfCells) selfBody.add(key(c));
  const rivalCells = s.rival.alive ? s.rival.body : [];
  const rivalBody = new Set<string>(rivalCells.map(key));
  const blocked = new Set<string>([...selfBody, ...rivalBody]);
  return {
    wallDist: rayDist(s, head, dir, new Set()),
    selfDist: rayDist(s, head, dir, selfBody),
    rivalDist: s.rival.alive ? rayDist(s, head, dir, rivalBody) : 99,
    foodDist: Math.abs(target.x - s.food.x) + Math.abs(target.y - s.food.y),
    eatsFood: grows,
    openArea: floodArea(s, target, blocked),
  };
}

export const featuresEncoder: Encoder = {
  name: "features",
  encode(s: GameState): EncodedDecision {
    const keys = legalDirs(s);
    const options: Record<string, DirFacts> = {};
    const criteria: Record<string, string | null> = {};
    for (const k of keys) {
      options[k] = dirFacts(s, k);
      criteria[k] = null;
    }
    return {
      encoder: "features",
      state: {
        tick: s.tick,
        width: s.width,
        height: s.height,
        heading: s.player.dir,
        length: s.player.body.length,
        score: s.player.food,
        food: s.food,
        rival: s.rival.alive
          ? { head: s.rival.body[0], length: s.rival.body.length, score: s.rival.food }
          : { respawnIn: s.rival.respawnIn },
        options,
      },
      instructions: INSTRUCTIONS,
      criteria,
      keys,
    };
  },
};
