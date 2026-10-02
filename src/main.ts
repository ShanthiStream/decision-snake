import { DecisionApiError } from "./agent/client.ts";
import { llmPolicy, policyNamesForCapabilities } from "./agent/llm.ts";
import { greedyPolicy, randomPolicy, systemOnePolicy, type Policy, type PolicyDecision } from "./agent/policies.ts";
import { oraclePolicy } from "./agent/oracle.ts";
import { DEFAULT_ENCODER, ENCODERS } from "./encoders/index.ts";
import { optionToInput } from "./encoders/types.ts";
import { createGame, STEP_MS, step } from "./engine/arena.ts";
import { opposite } from "./engine/rival.ts";
import type { Dir, GameState } from "./engine/types.ts";
import { CELL, render } from "./render/canvas.ts";

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---- configuration -----------------------------------------------------------
const defaultEndpoint = import.meta.env.DEV ? "/decide" : (import.meta.env.VITE_DECISION_BASE_URL ?? "http://localhost:11434");
const config = {
  mode: (params.get("mode") ?? "ai") as "ai" | "human",
  model: params.get("model") ?? import.meta.env.VITE_DEFAULT_MODEL ?? "tev1:0.8b",
  speed: Number(params.get("speed") ?? "1"),
  endpoint: params.get("endpoint") ?? defaultEndpoint,
  seed: Number(params.get("seed") ?? Math.floor(Math.random() * 1e6)),
};

// ---- game state ----------------------------------------------------------------
let game: GameState = createGame(config.seed);
let pending: Dir | null = null;
let paused = false;
interface DecisionRecord {
  tick: number;
  choice: string;
  keys: string[];
  probabilities?: Record<string, number>;
  confidence?: number;
  latencyMs: number;
  stale: boolean;
  inputTokens?: number;
}
const records: DecisionRecord[] = [];
let lastRecord: DecisionRecord | null = null;
let inFlight = false;

// ---- canvas ------------------------------------------------------------------
const canvas = $<HTMLCanvasElement>("game");
const dpr = Math.min(2, window.devicePixelRatio || 1);
canvas.width = game.width * CELL * dpr;
canvas.height = game.height * CELL * dpr;
canvas.style.width = `${game.width * CELL}px`;
canvas.style.height = "auto";
const ctx = canvas.getContext("2d")!;
ctx.scale(dpr, dpr);

// ---- agent -------------------------------------------------------------------
function makePolicy(name: string): Policy {
  if (name === "random") return randomPolicy(config.seed);
  if (name === "greedy") return greedyPolicy();
  const oracle = /^oracle(?:-(\d+)t)?$/.exec(name);
  if (oracle) return oraclePolicy({ steps: oracle[1] ? Number(oracle[1]) : 30 });
  if (name.startsWith("llm-think:")) {
    return llmPolicy({ baseUrl: config.endpoint, model: name.slice("llm-think:".length), think: true, numPredict: 1024, timeoutMs: 120_000 });
  }
  if (name.startsWith("llm:")) return llmPolicy({ baseUrl: config.endpoint, model: name.slice("llm:".length) });
  return systemOnePolicy({ baseUrl: config.endpoint, model: name });
}

let policy = makePolicy(config.model);

async function ask(): Promise<void> {
  if (inFlight || paused || config.mode !== "ai" || game.phase !== "playing") return;
  inFlight = true;
  const askedTick = game.tick;
  const enc = (ENCODERS[DEFAULT_ENCODER] ?? ENCODERS.features).encode(game);
  const started = performance.now();
  try {
    const d: PolicyDecision = await policy.decide(enc, undefined, game);
    const latencyMs = performance.now() - started;
    let choice = d.choice;
    try {
      choice = optionToInput(d.choice);
    } catch {
      showError(`Model answered "${d.choice}" (options: ${enc.keys.join(", ")}). Keeping the heading.`);
      return;
    }
    const stale = game.tick > askedTick;
    pending = choice as Dir;
    lastRecord = {
      tick: askedTick,
      choice,
      keys: enc.keys,
      probabilities: d.probabilities,
      confidence: d.confidence,
      latencyMs,
      stale,
      inputTokens: d.inputTokens,
    };
    records.push(lastRecord);
    if (records.length > 5000) records.shift();
    hideError();
  } catch (err) {
    showError(err);
  } finally {
    inFlight = false;
  }
}

// ---- fixed-step loop -------------------------------------------------------------
let acc = 0;
let last = performance.now();
const tickTimes: number[] = [];

function frame(now: number): void {
  const dt = Math.min(500, now - last);
  last = now;
  if (!paused) {
    acc += dt * config.speed;
    let steps = 0;
    while (acc >= STEP_MS && steps < 5 && game.phase === "playing") {
      const dir = pending ?? undefined;
      pending = null;
      step(game, dir ? { dir } : {});
      acc -= STEP_MS;
      steps++;
      tickTimes.push(now);
    }
    if (steps === 5) acc = 0;
    if (config.mode === "ai" && game.phase === "playing" && !inFlight) void ask();
  }
  while (tickTimes.length && now - tickTimes[0] > 2000) tickTimes.shift();
  render(ctx, game);
  requestAnimationFrame(frame);
}

// ---- HUD ---------------------------------------------------------------------
function pct(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function updateHud(): void {
  $("score").textContent = String(game.player.food);
  $("ticks").textContent = String(game.tick);
  $("rival").textContent = game.rival.alive ? String(game.rival.food) : `dead (${game.rival.respawnIn})`;
  $("tps").textContent = (tickTimes.length / 2).toFixed(1);
  $("who").textContent = config.mode === "ai" ? config.model : "keyboard";

  const recent = records.slice(-100);
  const lat = recent.map((r) => r.latencyMs);
  $("lat-last").textContent = lastRecord ? `${Math.round(lastRecord.latencyMs)} ms` : "-";
  $("lat-p50").textContent = lat.length ? `${Math.round(pct(lat, 0.5))} ms` : "-";
  $("stale").textContent = recent.length ? `${Math.round((100 * recent.filter((r) => r.stale).length) / recent.length)}%` : "-";

  const bars = $("bars");
  bars.innerHTML = "";
  if (lastRecord?.probabilities) {
    $("confidence").textContent = lastRecord.confidence !== undefined ? `confidence ${lastRecord.confidence.toFixed(2)}` : "";
    for (const key of lastRecord.keys) {
      const p = lastRecord.probabilities[key] ?? 0;
      const row = document.createElement("div");
      row.className = `bar${key === lastRecord.choice ? " chosen" : ""}`;
      row.innerHTML = `<span class="label">${key}</span><div class="track"><div class="fill" style="width:${(p * 100).toFixed(1)}%"></div></div><span>${(p * 100).toFixed(0)}%</span>`;
      bars.appendChild(row);
    }
    $("state-view").textContent = `tick ${lastRecord.tick}${lastRecord.stale ? " (stale)" : ""} → ${lastRecord.choice}`;
  } else {
    $("confidence").textContent = "";
    $("state-view").textContent = config.mode === "ai" ? "waiting for the first decision..." : "-";
  }
}

// ---- errors ------------------------------------------------------------------
function showError(err: unknown): void {
  const box = $("error");
  box.classList.add("show");
  if (err instanceof DecisionApiError) {
    $("error-message").textContent = err.message;
    $("error-hint").textContent = err.hint;
  } else if (typeof err === "string") {
    $("error-message").textContent = err;
    $("error-hint").textContent = "";
  } else {
    $("error-message").textContent = String(err);
    $("error-hint").textContent = "";
  }
}

function hideError(): void {
  $("error").classList.remove("show");
}

// ---- controls ----------------------------------------------------------------
const KEYS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

window.addEventListener("keydown", (e) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const d = KEYS[e.key];
  if (!d || config.mode !== "human") return;
  e.preventDefault();
  if (d !== opposite(game.player.dir)) pending = d;
});

/** Models offered when Ollama cannot be reached; the live list replaces them. */
const KNOWN_MODELS = ["tev1:0.8b", "tev1:4b", "greedy", "random", "oracle-30t", "llm:phi4-mini"];
const CUSTOM_MODEL = "__custom__";

function setModelOptions(names: string[]): void {
  const sel = $<HTMLSelectElement>("model");
  const ordered = [...names];
  if (!ordered.includes(config.model)) ordered.push(config.model);
  sel.innerHTML = "";
  const seen = new Set<string>();
  for (const name of ordered) {
    if (seen.has(name)) continue;
    seen.add(name);
    sel.add(new Option(name, name));
  }
  sel.add(new Option("Custom…", CUSTOM_MODEL));
  sel.value = config.model;
}

async function loadModels(): Promise<void> {
  try {
    const res = await fetch(`${config.endpoint.replace(/\/$/, "")}/api/tags`);
    if (!res.ok) return;
    const body = (await res.json()) as { models?: { name?: string; capabilities?: string[] }[] };
    const found = (body.models ?? []).filter((m) => typeof m.name === "string" && m.name.length > 0);
    if (found.length) setModelOptions([...new Set(found.flatMap((m) => policyNamesForCapabilities(m.name!, m.capabilities ?? [])))]);
  } catch {
    // The dropdown already lists known models; decisions report their own errors.
  }
}

function setModel(value: string): void {
  config.model = value;
  const sel = $<HTMLSelectElement>("model");
  if (![...sel.options].some((o) => o.value === value)) sel.add(new Option(value, value));
  sel.value = value;
  policy = makePolicy(value);
  records.length = 0;
  lastRecord = null;
  hideError();
}

function restart(): void {
  game = createGame(Math.floor(Math.random() * 1e6));
  pending = null;
  records.length = 0;
  lastRecord = null;
  hideError();
}

function togglePause(): void {
  paused = !paused;
  $("pause").textContent = paused ? "Resume" : "Pause";
}

function setupControls(): void {
  const mode = $<HTMLSelectElement>("mode");
  const model = $<HTMLSelectElement>("model");
  const speed = $<HTMLSelectElement>("speed");
  const seed = $<HTMLInputElement>("seed");
  const endpoint = $<HTMLInputElement>("endpoint");

  setModelOptions(KNOWN_MODELS);
  mode.value = config.mode;
  model.value = config.model;
  speed.value = String(config.speed);
  seed.value = String(config.seed);
  endpoint.value = config.endpoint;

  mode.onchange = () => {
    config.mode = mode.value as "ai" | "human";
    pending = null;
  };
  model.onchange = () => {
    if (model.value === CUSTOM_MODEL) {
      const name = window.prompt("Model or policy name (llm: for chat, llm-think: for reasoning models):", config.model)?.trim();
      setModel(name || config.model);
    } else setModel(model.value);
  };
  speed.onchange = () => {
    config.speed = Number(speed.value);
  };
  seed.onchange = () => {
    const n = Number(seed.value);
    if (Number.isInteger(n)) {
      config.seed = n;
      game = createGame(n);
      pending = null;
      records.length = 0;
      lastRecord = null;
    }
  };
  endpoint.onchange = () => {
    config.endpoint = endpoint.value.trim();
    policy = makePolicy(config.model);
    void loadModels();
  };
  $("pause").onclick = togglePause;
  $("restart").onclick = restart;
  $("export").onclick = () => {
    const blob = new Blob(records.map((r) => JSON.stringify(r) + "\n"), { type: "application/x-ndjson" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `decisions-${Date.now()}.jsonl`;
    a.click();
  };
}

setupControls();
void loadModels();
setInterval(updateHud, 100);
requestAnimationFrame(frame);

// Exposed for scripted recording and debugging.
(window as unknown as { __snake: object }).__snake = {
  get game() {
    return game;
  },
  records,
  setModel(value: string) {
    if (value !== config.model) setModel(value);
  },
  setMode(mode: "ai" | "human") {
    config.mode = mode;
    $<HTMLSelectElement>("mode").value = mode;
  },
  restart,
};
