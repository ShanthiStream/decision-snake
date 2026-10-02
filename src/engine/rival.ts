// Scripted rival: a greedy food-chaser. Deterministic, no model calls — it
// keeps the arena alive and threatening while the player thinks.
import type { Dir, GameState, Snake, Vec } from "./types.ts";

export const DIRS: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function opposite(d: Dir): Dir {
  return d === "up" ? "down" : d === "down" ? "up" : d === "left" ? "right" : "left";
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

function key(v: Vec): string {
  return `${v.x},${v.y}`;
}

/** Cells no snake may enter (bodies; the moving tail tip frees up, handled by callers). */
export function occupiedCells(s: GameState): Set<string> {
  const cells = new Set<string>();
  for (const snake of [s.player, s.rival]) {
    if (!snake.alive) continue;
    for (const c of snake.body) cells.add(key(c));
  }
  return cells;
}

function hitWall(s: GameState, v: Vec): boolean {
  return v.x < 0 || v.y < 0 || v.x >= s.width || v.y >= s.height;
}

/** Non-reverse directions that do not hit a wall or a body immediately. */
export function safeDirs(s: GameState, snake: Snake, bodies?: Set<string>): string[] {
  const blocked = bodies ?? occupiedCells(s);
  const out: string[] = [];
  for (const d of Object.keys(DIRS) as Dir[]) {
    if (d === opposite(snake.dir)) continue;
    const n = add(snake.body[0], DIRS[d]);
    // Own tail tip moves away unless growing; treat it as free here.
    const tail = snake.body[snake.body.length - 1];
    if (key(n) === key(tail)) {
      if (!hitWall(s, n)) out.push(d);
      continue;
    }
    if (!hitWall(s, n) && !blocked.has(key(n))) out.push(d);
  }
  return out;
}

/** Greedy heading: closest safe cell to the food by Manhattan distance. */
export function rivalHeading(s: GameState, rival: Snake): Dir {
  const safe = safeDirs(s, rival);
  if (safe.length === 0) return rival.dir;
  let best = safe[0] as Dir;
  let bestDist = Infinity;
  for (const d of safe as Dir[]) {
    const n = add(rival.body[0], DIRS[d]);
    const dist = Math.abs(n.x - s.food.x) + Math.abs(n.y - s.food.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }
  return best;
}
