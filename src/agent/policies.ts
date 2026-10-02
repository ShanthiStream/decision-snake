import type { DirFacts } from "../encoders/features.ts";
import type { EncodedDecision } from "../encoders/types.ts";
import type { GameState } from "../engine/types.ts";
import { askSystemOne, type SystemOneConfig } from "./client.ts";

export interface PolicyDecision {
  choice: string;
  probabilities?: Record<string, number>;
  /** Per-option values from search policies (higher is better; not probabilities). */
  values?: Record<string, number>;
  confidence?: number;
  inputTokens?: number;
  latencyMs: number;
}

export interface Policy {
  name: string;
  /** Encoder this policy expects, when it reads the encoding itself. */
  requiresEncoder?: string;
  /** `game` is the live state, for policies that search the engine instead of reading the encoding. */
  decide(enc: EncodedDecision, signal?: AbortSignal, game?: GameState): Promise<PolicyDecision>;
}

export function systemOnePolicy(cfg: SystemOneConfig): Policy {
  return {
    name: cfg.model,
    async decide(enc, signal) {
      const a = await askSystemOne(cfg, enc, signal);
      return a;
    },
  };
}

/** Uniform over the legal options, with its own seeded generator. */
export function randomPolicy(seed = 1): Policy {
  let t = seed | 0;
  const rand = () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  return {
    name: "random",
    async decide(enc) {
      return { choice: enc.keys[Math.floor(rand() * enc.keys.length)], latencyMs: 0 };
    },
  };
}

interface FactsState {
  options: Record<string, DirFacts>;
}

/**
 * Scripted baseline over the features encoder: never drive into a cell with
 * no open space when an alternative exists, else close in on the food. Reads
 * the same numeric facts as the models — the bar they must beat.
 */
export function greedyChoice(enc: EncodedDecision): string {
  const s = enc.state as FactsState;
  const keys = enc.keys.filter((k) => s.options[k]);
  const alive = keys.filter((k) => s.options[k].openArea > 0);
  const pool = alive.length > 0 ? alive : keys;
  const eaters = pool.filter((k) => s.options[k].eatsFood);
  if (eaters.length > 0) return eaters[0];
  let best = pool[0];
  for (const k of pool.slice(1)) {
    const a = s.options[k];
    const b = s.options[best];
    if (a.foodDist < b.foodDist || (a.foodDist === b.foodDist && a.openArea > b.openArea)) best = k;
  }
  return best;
}

export function greedyPolicy(): Policy {
  return {
    name: "greedy",
    requiresEncoder: "features",
    async decide(enc) {
      return { choice: greedyChoice(enc), latencyMs: 0 };
    },
  };
}
