import type { Dir, GameState } from "../engine/types.ts";

export interface EncodedDecision {
  encoder: string;
  /** Sent as the /v1/systemone `state` (string or JSON). */
  state: unknown;
  instructions: string;
  /** Option name to description (null lets the name describe itself). */
  criteria: Record<string, string | null>;
  keys: Dir[];
}

export interface Encoder {
  name: string;
  encode(s: GameState): EncodedDecision;
}

/** Maps a chosen option to a heading. */
export function optionToInput(key: string): Dir {
  if (key === "up" || key === "down" || key === "left" || key === "right") return key;
  throw new Error(`bad option ${key}`);
}
