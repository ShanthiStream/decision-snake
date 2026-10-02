import { describe, expect, it } from "vitest";
import { makePolicy } from "../src/agent/factory.ts";
import { extractMove, policyNamesForCapabilities } from "../src/agent/llm.ts";
import { oraclePolicy, scoreOutcome } from "../src/agent/oracle.ts";
import { greedyChoice } from "../src/agent/policies.ts";
import { parseTeacherReply, TeacherParseError, teacherPrompt } from "../src/agent/teacher.ts";
import { ENCODERS } from "../src/encoders/index.ts";
import { createGame } from "../src/engine/arena.ts";

const env = { decisionBaseUrl: "http://localhost:11434" };

describe("greedyChoice", () => {
  it("eats when it can and avoids dead cells", async () => {
    const s = createGame(3);
    // Food directly ahead; greedy should keep heading into it.
    s.food = { x: s.player.body[0].x + 1, y: s.player.body[0].y };
    const enc = ENCODERS.features.encode(s);
    expect(enc.keys).toContain("right");
    const d = await makePolicy("greedy", 1, env).decide(enc);
    expect(d.choice).toBe("right");
  });

  it("never steers into the pocket when an alternative exists", () => {
    const s = createGame(3, { width: 10, height: 10 });
    s.rival.alive = false;
    s.rival.body = [];
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
    const enc = ENCODERS.features.encode(s);
    // Down leads into the 1-cell pocket; left/right stay outside.
    expect(greedyChoice(enc)).not.toBe("down");
  });
});

describe("oraclePolicy", () => {
  it("avoids immediate death and reports values", async () => {
    const s = createGame(3);
    // Head against the right wall: heading right dies at once.
    s.player.body = [
      { x: 23, y: 5 },
      { x: 22, y: 5 },
      { x: 21, y: 5 },
    ];
    s.player.dir = "right";
    const enc = ENCODERS.features.encode(s);
    const d = await oraclePolicy({ steps: 5 }).decide(enc, undefined, s);
    expect(d.choice).not.toBe("right");
    expect(Object.keys(d.values ?? {}).sort()).toEqual([...enc.keys].sort());
  });

  it("needs the live arena state", async () => {
    const enc = ENCODERS.features.encode(createGame(3));
    await expect(oraclePolicy().decide(enc)).rejects.toThrow();
  });

  it("scores food above loitering and death below all", () => {
    expect(scoreOutcome({ foodEaten: 1, ticksSurvived: 5, died: false })).toBeGreaterThan(
      scoreOutcome({ foodEaten: 0, ticksSurvived: 30, died: false }),
    );
    expect(scoreOutcome({ foodEaten: 0, ticksSurvived: 1, died: true })).toBeLessThan(0);
  });
});

describe("teacher prompt and parsing", () => {
  it("renders state and options", () => {
    const enc = ENCODERS.features.encode(createGame(3));
    const prompt = teacherPrompt(enc);
    expect(prompt).toContain(JSON.stringify(enc.state));
    expect(prompt).toContain('"move": "<one of the options>"');
  });

  it("reads the last JSON answer", () => {
    expect(parseTeacherReply('hmm {"move": "up", "reason": "open"}', ["up", "down"])).toEqual({ move: "up", reason: "open" });
    expect(() => parseTeacherReply('{"move": "left"}', ["up"])).toThrow(TeacherParseError);
    expect(() => parseTeacherReply("no json", ["up"])).toThrow(TeacherParseError);
  });
});

describe("llm helpers", () => {
  it("extracts moves from traces", () => {
    expect(extractMove('{"move": "up"}', ["up", "down"])).toBe("up");
    expect(extractMove('thinking {"move": "down"} final {"move": "up"}', ["up", "down"])).toBe("up");
  });

  it("routes installed models by capability", () => {
    expect(policyNamesForCapabilities("tev1:0.8b", ["decision"])).toEqual(["tev1:0.8b"]);
    expect(policyNamesForCapabilities("qwen3.5:2b", ["completion"])).toEqual(["llm:qwen3.5:2b", "llm-think:qwen3.5:2b"]);
  });
});

describe("makePolicy", () => {
  it("names every policy family", () => {
    expect(makePolicy("random", 1, env).name).toBe("random");
    expect(makePolicy("greedy", 1, env).name).toBe("greedy");
    expect(makePolicy("oracle", 1, env).name).toBe("oracle-30t");
    expect(makePolicy("oracle-60t", 1, env).name).toBe("oracle-60t");
    expect(makePolicy("llm:phi4-mini", 1, env).name).toBe("llm:phi4-mini");
    expect(makePolicy("llm-think:gpt-oss:20b-cloud", 1, env).name).toBe("llm:gpt-oss:20b-cloud");
    expect(makePolicy("tev1:0.8b", 1, env).name).toBe("tev1:0.8b");
  });

  it("refuses teacher policies without an endpoint", () => {
    expect(() => makePolicy("teacher-peek30t", 1, env)).toThrow();
  });
});
