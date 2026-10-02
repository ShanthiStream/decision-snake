export type Dir = "up" | "down" | "left" | "right";

export interface Vec {
  x: number;
  y: number;
}

export interface Snake {
  /** Head first. */
  body: Vec[];
  dir: Dir;
  alive: boolean;
  /** Steps until respawn when dead (rival only). */
  respawnIn: number;
  food: number;
}

export type GamePhase = "playing" | "dead";

export interface GameState {
  seed: number;
  rng: number;
  tick: number;
  phase: GamePhase;
  width: number;
  height: number;
  player: Snake;
  rival: Snake;
  food: Vec;
  stats: { ticksSurvived: number; foodEaten: number };
  events: string[];
}

export interface StepInput {
  dir?: Dir;
}

export interface GameOptions {
  width?: number;
  height?: number;
}
