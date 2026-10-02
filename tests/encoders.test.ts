import { describe, expect, it } from "vitest";
import { dirFacts, legalDirs } from "../src/encoders/features.ts";
import { DEFAULT_ENCODER, ENCODERS } from "../src/encoders/index.ts";
import { optionToInput } from "../src/encoders/types.ts";
import { createGame } from "../src/engine/arena.ts";

const BANNED = ["safe", "danger", "recommend", "best", "should go", "go up", "avoid"];

describe("features encoder", () => {
  it("is the default and offers the non-reverse directions", () => {
    expect(DEFAULT_ENCODER).toBe("features");
    const s = createGame(3); // heading right
    expect(legalDirs(s).sort()).toEqual(["down", "right", "up"]);
    const enc = ENCODERS.features.encode(s);
    expect(enc.keys.sort()).toEqual(["down", "right", "up"]);
  });

  it("stays under a token budget and states facts, never verdicts", () => {
    const text = JSON.stringify(ENCODERS.features.encode(createGame(3)));
    expect(text.length).toBeLessThan(2000);
    const lower = text.toLowerCase();
    for (const word of BANNED) expect(lower).not.toContain(word);
  });

  it("wraps edges: food across the edge is adjacent", () => {
    const s = createGame(3, { width: 10, height: 10 });
    s.rival.alive = false;
    s.rival.body = [];
    s.player.body = [
      { x: 9, y: 5 },
      { x: 8, y: 5 },
      { x: 7, y: 5 },
    ];
    s.player.dir = "right";
    s.food = { x: 0, y: 5 };
    const cross = dirFacts(s, "right");
    expect(cross.eatsFood).toBe(true);
    expect(cross.foodDist).toBe(0);
    expect(cross.openArea).toBeGreaterThan(50);
  });

  it("flags eating and counts open space", () => {
    const s = createGame(3, { width: 10, height: 10 });
    s.rival.alive = false;
    s.rival.body = [];
    s.player.body = [
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 2, y: 5 },
    ];
    s.player.dir = "right";
    s.food = { x: 5, y: 5 };
    const eat = dirFacts(s, "right");
    expect(eat.eatsFood).toBe(true);
    expect(eat.foodDist).toBe(0);
    expect(eat.openArea).toBeGreaterThan(50);
  });

  it("sees traps: a one-cell pocket scores 1", () => {
    const s = createGame(3, { width: 10, height: 10 });
    s.rival.alive = false;
    s.rival.body = [];
    // Ring around (5,5); head at (5,4) heading down into the pocket.
    s.player.body = [
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
      { x: 6, y: 4 },
    ];
    s.player.dir = "down";
    s.food = { x: 0, y: 0 };
    expect(dirFacts(s, "down").openArea).toBe(1);
  });
});

describe("optionToInput", () => {
  it("maps direction keys", () => {
    expect(optionToInput("up")).toBe("up");
    expect(() => optionToInput("back")).toThrow();
    expect(() => optionToInput("0")).toThrow();
  });
});
