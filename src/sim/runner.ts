// Drives one seeded game with a policy, headless. Shared by the evaluation
// runner and the teacher data generator so both see the same game.
import type { Policy, PolicyDecision } from "../agent/policies.ts";
import { optionToInput, type EncodedDecision, type Encoder } from "../encoders/types.ts";
import { createGame, STEP_MS, step } from "../engine/arena.ts";
import type { Dir, GameState } from "../engine/types.ts";

export type Clock = "realtime" | "lockstep";

export interface GameOptionsForRun {
  seed: number;
  policy: Policy;
  encoder: Encoder;
  clock: Clock;
  speed?: number;
  maxSeconds?: number;
  /** Optional second policy asked about every tick the player takes; its answer is not played. */
  labeler?: Policy;
  /** More encoders applied to the same state at every decision, so one run can train students that read different inputs. */
  alsoEncode?: Encoder[];
  onDecision?: (ev: DecisionEvent) => void;
}

export interface DecisionEvent {
  seed: number;
  askedTick: number;
  answeredTick: number;
  enc: EncodedDecision;
  /** The same state under each of `alsoEncode`, by encoder name. */
  alt?: Record<string, EncodedDecision>;
  decision: PolicyDecision | null;
  /** Labeler's answer; null if the labeler failed on this state. */
  label?: PolicyDecision | null;
  stale: boolean;
  error?: string;
}

export interface GameSummary {
  seed: number;
  score: number;
  ticksSurvived: number;
  deaths: number;
  decisions: number;
  failures: number;
  stale: number;
  latencyP50: number;
  latencyP90: number;
  endedBy: "dead" | "time";
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

async function tryDecide(policy: Policy, enc: EncodedDecision, game: GameState): Promise<{ d: PolicyDecision | null; error?: string }> {
  try {
    return { d: await policy.decide(enc, undefined, game) };
  } catch (err) {
    return { d: null, error: String((err as Error).message ?? err) };
  }
}

function parseChoice(choice: string, fallback: Dir): Dir {
  try {
    return optionToInput(choice);
  } catch {
    return fallback;
  }
}

export async function playGame(o: GameOptionsForRun): Promise<GameSummary> {
  const s: GameState = createGame(o.seed);
  const maxTicks = ((o.maxSeconds ?? 180) * 1000) / STEP_MS;
  const latencies: number[] = [];
  let decisions = 0;
  let failures = 0;
  let stale = 0;

  while (s.phase === "playing" && s.tick < maxTicks) {
    const enc = o.encoder.encode(s);
    const alt = o.alsoEncode?.length ? Object.fromEntries(o.alsoEncode.map((e) => [e.name, e.encode(s)])) : undefined;
    const askedTick = s.tick;
    const heading = s.player.dir;
    const [played, labeled] = await Promise.all([
      tryDecide(o.policy, enc, s),
      o.labeler && o.labeler !== o.policy ? tryDecide(o.labeler, enc, s) : Promise.resolve(null),
    ]);
    const d = played.d;
    const label = o.labeler ? (o.labeler === o.policy ? d : (labeled?.d ?? null)) : undefined;

    let isStale = false;
    if (!d) {
      failures++;
      step(s, {});
      o.onDecision?.({ seed: o.seed, askedTick, answeredTick: s.tick, enc, alt, decision: null, label, stale: false, error: played.error });
    } else {
      decisions++;
      latencies.push(d.latencyMs);
      const dir = parseChoice(d.choice, heading);
      if (o.clock === "realtime") {
        // Latency becomes elapsed steps on the old heading; then the answer steers one step.
        const lateTicks = Math.floor(d.latencyMs / STEP_MS);
        for (let i = 0; i < lateTicks && s.phase === "playing"; i++) step(s, {});
        isStale = lateTicks > 0;
        if (isStale) stale++;
        if (s.phase === "playing") step(s, { dir });
      } else {
        step(s, { dir });
      }
      o.onDecision?.({ seed: o.seed, askedTick, answeredTick: s.tick, enc, alt, decision: d, label, stale: isStale });
    }
  }

  return {
    seed: o.seed,
    score: s.player.food,
    ticksSurvived: s.stats.ticksSurvived,
    deaths: s.phase === "dead" ? 1 : 0,
    decisions,
    failures,
    stale,
    latencyP50: Math.round(percentile(latencies, 0.5)),
    latencyP90: Math.round(percentile(latencies, 0.9)),
    endedBy: s.phase === "dead" ? "dead" : "time",
  };
}
