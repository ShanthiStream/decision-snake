// Turn-based pacing for slow models: with the Wait switch on, the game holds
// instead of stepping until the model's answer for the current tick arrives.
// Latency then costs wall-clock time only — choices are judged, not speed.
export function shouldHold(
  mode: "ai" | "human",
  waitForModel: boolean,
  phase: string,
  answeredTick: number,
  tick: number,
): boolean {
  return mode === "ai" && waitForModel && phase === "playing" && answeredTick !== tick;
}
