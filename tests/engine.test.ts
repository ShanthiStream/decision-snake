import { describe, expect, it } from "vitest";
import { createGame, step } from "../src/engine/arena.ts";
import { rivalHeading, safeDirs } from "../src/engine/rival.ts";
import type { GameState } from "../src/engine/types.ts";

function tiny(seed = 1): GameState {
  const s = createGame(seed, { width: 10, height: 10 });
  s.rival.alive = false;
  s.rival.respawnIn = 9999;
  s.rival.body = [];
  return s;
}

describe("createGame", () => {
  it("starts two snakes and one free food", () => {
    const s = createGame(7);
    expect(s.player.body).toHaveLength(3);
    expect(s.rival.body).toHaveLength(3);
    expect(s.phase).toBe("playing");
    const taken = new Set([...s.player.body, ...s.rival.body].map((c) => `${c.x},${c.y}`));
    expect(taken.has(`${s.food.x},${s.food.y}`)).toBe(false);
  });

  it("is deterministic for the same seed", () => {
    expect(JSON.stringify(createGame(42))).toBe(JSON.stringify(createGame(42)));
  });
});

describe("step", () => {
  it("moves and grows on food", () => {
    const s = tiny();
    s.player.body = [
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    s.player.dir = "right";
    s.food = { x: 5, y: 5 };
    step(s, {});
    expect(s.player.body[0]).toEqual({ x: 5, y: 5 });
    expect(s.player.body).toHaveLength(4);
    expect(s.stats.foodEaten).toBe(1);
  });

  it("ignores reversals", () => {
    const s = tiny();
    s.player.body = [
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    s.player.dir = "right";
    s.food = { x: 0, y: 0 };
    step(s, { dir: "left" });
    expect(s.player.body[0]).toEqual({ x: 5, y: 5 });
    expect(s.phase).toBe("playing");
  });

  it("dies on walls", () => {
    const s = tiny();
    s.player.body = [
      { x: 9, y: 5 },
      { x: 8, y: 5 },
      { x: 7, y: 5 },
    ];
    s.player.dir = "right";
    step(s, {});
    expect(s.phase).toBe("dead");
  });

  it("dies on its own body", () => {
    const s = tiny();
    s.player.body = [
      { x: 4, y: 5 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
      { x: 5, y: 6 },
    ];
    s.player.dir = "up";
    step(s, { dir: "right" });
    expect(s.phase).toBe("dead");
  });

  it("lets the vacating tail tip pass", () => {
    const s = tiny();
    // Head adjacent to its own tail tip; moving there is safe (tail moves away).
    s.player.body = [
      { x: 4, y: 5 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
    ];
    s.player.dir = "up";
    s.food = { x: 0, y: 0 };
    step(s, { dir: "right" });
    expect(s.phase).toBe("playing");
    expect(s.player.body[0]).toEqual({ x: 5, y: 5 });
  });

  it("same seed + same inputs = identical state", () => {
    const run = () => {
      const s = createGame(11);
      const dirs = ["up", "right", "right", "down", "left"] as const;
      for (let i = 0; i < 20 && s.phase === "playing"; i++) step(s, { dir: dirs[i % dirs.length] });
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});

describe("rival", () => {
  it("dies with no safe cell", () => {
    const s = createGame(1);
    // Head boxed in: walls on two sides, own body on the third.
    s.rival.body = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    s.rival.dir = "up";
    s.food = { x: 0, y: 9 };
    step(s, {});
    expect(s.rival.alive).toBe(false);
    expect(s.rival.respawnIn).toBeGreaterThan(0);
  });

  it("respawns after the timer", () => {
    const s = createGame(1);
    s.rival.alive = false;
    s.rival.body = [];
    s.rival.respawnIn = 1;
    s.player.body = [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
    ];
    s.player.dir = "right";
    step(s, {});
    expect(s.rival.alive).toBe(true);
    expect(s.rival.body).toHaveLength(3);
  });

  it("heads toward the food on a safe cell", () => {
    const s = createGame(2);
    const d = rivalHeading(s, s.rival);
    expect(safeDirs(s, s.rival)).toContain(d);
  });
});
