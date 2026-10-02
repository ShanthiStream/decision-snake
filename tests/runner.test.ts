import { describe, expect, it } from "vitest";
import { makePolicy } from "../src/agent/factory.ts";
import { ENCODERS } from "../src/encoders/index.ts";
import { playGame, type DecisionEvent } from "../src/sim/runner.ts";

const env = { decisionBaseUrl: "http://localhost:11434" };

describe("playGame", () => {
  it("finishes games deterministically for scripted policies", async () => {
    const opts = { seed: 100, policy: makePolicy("greedy", 100, env), encoder: ENCODERS.features, clock: "lockstep" as const, maxSeconds: 20 };
    const a = await playGame(opts);
    const b = await playGame({ ...opts, policy: makePolicy("greedy", 100, env) });
    expect(a).toEqual(b);
    expect(a.decisions).toBeGreaterThan(0);
    expect(a.failures).toBe(0);
  });

  it("charges latency as extra steps on the realtime clock", async () => {
    // A 500 ms answer at 150 ms steps burns 3 ticks before steering.
    const slow = {
      name: "slow",
      async decide() {
        return { choice: "up", latencyMs: 500 };
      },
    };
    const rt = await playGame({ seed: 100, policy: slow, encoder: ENCODERS.features, clock: "realtime", maxSeconds: 5 });
    const ls = await playGame({ seed: 100, policy: slow, encoder: ENCODERS.features, clock: "lockstep", maxSeconds: 5 });
    expect(rt.stale).toBeGreaterThan(0);
    expect(ls.stale).toBe(0);
    expect(rt.decisions).toBeLessThanOrEqual(ls.decisions);
  });

  it("records labeler answers without playing them", async () => {
    const seen: DecisionEvent[] = [];
    await playGame({
      seed: 101,
      policy: makePolicy("random", 101, env),
      encoder: ENCODERS.features,
      clock: "lockstep",
      maxSeconds: 5,
      labeler: makePolicy("greedy", 101, env),
      onDecision: (ev) => seen.push(ev),
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const ev of seen) expect(ev.label).toBeDefined();
  });
});
