import { nextRandom } from "./rng.ts";
import { add, DIRS, occupiedCells, opposite, rivalHeading } from "./rival.ts";
import type { Dir, GameOptions, GameState, Snake, Vec } from "./types.ts";

// 500 ms steps (2 cells/s): every installed model answers within one step
// (tev1:0.8b needs ~370 ms here), so the default game is playable. Faster
// setups can use the 2x speed selector. Slower models still pay an honest
// staleness cost, measured, not hidden.
export const STEP_MS = 500;
export const RIVAL_RESPAWN_STEPS = 20;

function key(v: Vec): string {
  return `${v.x},${v.y}`;
}

function makeSnake(body: Vec[], dir: Dir): Snake {
  return { body, dir, alive: true, respawnIn: 0, food: 0 };
}

function freeCell(s: GameState): Vec {
  const blocked = occupiedCells(s);
  blocked.add(key(s.food));
  for (let tries = 0; tries < s.width * s.height; tries++) {
    const v = { x: Math.floor(nextRandom(s) * s.width), y: Math.floor(nextRandom(s) * s.height) };
    if (!blocked.has(key(v))) return v;
  }
  // Arena full: overlap the tail; the game is effectively won anyway.
  return { x: 0, y: 0 };
}

export function createGame(seed: number, options: GameOptions = {}): GameState {
  const width = options.width ?? 24;
  const height = options.height ?? 24;
  const cy = Math.floor(height / 2);
  const s: GameState = {
    seed,
    rng: seed | 0,
    tick: 0,
    phase: "playing",
    width,
    height,
    player: makeSnake(
      [
        { x: 5, y: cy },
        { x: 4, y: cy },
        { x: 3, y: cy },
      ],
      "right",
    ),
    rival: makeSnake(
      [
        { x: width - 6, y: cy },
        { x: width - 5, y: cy },
        { x: width - 4, y: cy },
      ],
      "left",
    ),
    food: { x: 0, y: 0 },
    stats: { ticksSurvived: 0, foodEaten: 0 },
    events: [],
  };
  s.food = freeCell(s);
  return s;
}

export function wrap(s: GameState, v: Vec): Vec {
  return { x: ((v.x % s.width) + s.width) % s.width, y: ((v.y % s.height) + s.height) % s.height };
}

/** Moves a snake one cell against an explicit body list for the other snake. Edges wrap. */
function moveSnake(s: GameState, snake: Snake, dir: Dir, otherBody: Vec[]): "ok" | "ate" | "self" | "rival" {
  snake.dir = dir;
  const head = wrap(s, add(snake.body[0], DIRS[dir]));
  const ate = head.x === s.food.x && head.y === s.food.y;
  const body = ate ? snake.body : snake.body.slice(0, -1);
  for (const c of body) if (c.x === head.x && c.y === head.y) return "self";
  for (const c of otherBody) if (c.x === head.x && c.y === head.y) return "rival";
  snake.body.unshift(head);
  if (!ate) snake.body.pop();
  return ate ? "ate" : "ok";
}

/**
 * Advances one fixed step. The player's heading changes unless the input is
 * missing or a reversal (the neck is certain death, so it is illegal input).
 * Order: player moves (death ends the game) → food respawns → rival moves
 * (death starts its respawn timer) → rival moving onto the player's head kills
 * the player. Respawn countdown ticks while the game plays.
 */
export function step(s: GameState, input: { dir?: Dir }): void {
  if (s.phase !== "playing") return;
  const p = s.player;
  if (input.dir && input.dir !== opposite(p.dir)) p.dir = input.dir;

  // A tail tip vacates unless its owner grows this step, so it is not a
  // collision then. The rival's growth is predicted pre-move (its heading
  // target); the player's is known after it moves.
  const r = s.rival;
  const rivalTarget = r.alive ? add(r.body[0], DIRS[rivalHeading(s, r)]) : null;
  const rivalGrows = r.alive && rivalTarget !== null && rivalTarget.x === s.food.x && rivalTarget.y === s.food.y;
  const rivalBody = r.alive ? (rivalGrows ? r.body : r.body.slice(0, -1)) : [];

  const result = moveSnake(s, p, p.dir, rivalBody);
  if (result === "self" || result === "rival") {
    s.phase = "dead";
    s.events.push(`player died: ${result} at tick ${s.tick}`);
    return;
  }
  if (result === "ate") {
    p.food++;
    s.stats.foodEaten++;
    s.events.push(`player ate at tick ${s.tick} (score ${p.food})`);
    s.food = freeCell(s);
  }

  // Rule: whoever moves into the other's body dies. The mover is checked, so a
  // rival lunging at the player's head dies on it — baiting works.
  if (r.alive) {
    const heading = rivalHeading(s, r);
    const playerBody = result === "ate" ? p.body : p.body.slice(0, -1);
    const rResult = moveSnake(s, r, heading, playerBody);
    if (rResult === "self" || rResult === "rival") {
      r.alive = false;
      r.respawnIn = RIVAL_RESPAWN_STEPS;
      r.body = [];
      s.events.push(`rival died: ${rResult} at tick ${s.tick}`);
    } else if (rResult === "ate") {
      r.food++;
      s.events.push(`rival ate at tick ${s.tick}`);
      s.food = freeCell(s);
    }
  } else {
    r.respawnIn--;
    if (r.respawnIn <= 0) {
      const cx = Math.floor(s.width / 2);
      const cy = Math.floor(s.height / 2);
      const spawn = [
        { x: cx, y: cy },
        { x: cx, y: cy + 1 },
        { x: cx, y: cy + 2 },
      ];
      const blocked = occupiedCells(s);
      if (!spawn.some((c) => blocked.has(key(c)))) {
        r.body = spawn;
        r.alive = true;
        r.dir = "up";
        s.events.push(`rival respawned at tick ${s.tick}`);
      }
    }
  }

  s.tick++;
  s.stats.ticksSurvived++;
}
