// Code-drawn arena. Pure render: reads game state, never mutates rules.
import type { GameState } from "../engine/types.ts";

export const CELL = 20;

export function render(ctx: CanvasRenderingContext2D, game: GameState): void {
  const W = game.width * CELL;
  const H = game.height * CELL;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Arena edge: a visible frame around the playfield (edges wrap).
  ctx.strokeStyle = "#3a3d5c";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, W - 3, H - 3);

  // Grid dots.
  ctx.fillStyle = "#14141f";
  for (let x = 0; x < game.width; x++) {
    for (let y = 0; y < game.height; y++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
    }
  }

  // Food (blinks every other step).
  if (Math.floor(game.tick / 2) % 2 === 0 || game.phase !== "playing") {
    ctx.fillStyle = "#ffd54a";
    const fx = game.food.x * CELL;
    const fy = game.food.y * CELL;
    ctx.beginPath();
    ctx.arc(fx + CELL / 2, fy + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawSnake(ctx, game.rival.body, game.rival.alive ? "#b64a5a" : "#4a2a30", game.rival.alive ? "#e0707f" : "#4a2a30");
  drawSnake(ctx, game.player.body, "#2f9e5f", "#78ffaa");

  if (game.phase === "dead") {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ff6b6b";
    ctx.font = `bold ${Math.min(36, CELL * 1.6)}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`GAME OVER · ${game.player.food} food`, W / 2, H / 2);
  }
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  body: { x: number; y: number }[],
  color: string,
  headColor: string,
): void {
  body.forEach((c, i) => {
    ctx.fillStyle = i === 0 ? headColor : color;
    const pad = i === 0 ? 1 : 3;
    ctx.fillRect(c.x * CELL + pad, c.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
  });
}
