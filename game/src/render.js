// render.js — everything the player sees: the museum floor, the guards and
// their vision cones, the thief's lantern light, and the HUD.
//
// The scene is drawn in layers: floor and walls, then cover, then the vision
// cones (clipped by walls so they stop at corners), then gems, exit and
// actors, then a night-darkness layer with holes punched for the lantern,
// the exit lamp and each guard's lamp. The HUD is drawn on the canvas too,
// so every screenshot carries the game's state at a glance.

import { COLS, ROWS, TILE, rayDistance } from './level.js';
import { VISION_RANGE, VISION_HALF_ANGLE } from './guard.js';

const FLOOR_A = '#2e2a33';
const FLOOR_B = '#2a262e';
const SHADOW_FLOOR = '#1d1a26';
const WALL = '#17131d';
const WALL_TOP = '#3a3345';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dark = document.createElement('canvas');
    this.dark.width = COLS * TILE;
    this.dark.height = ROWS * TILE;
    this.time = 0;
  }

  draw(state) {
    const { level, player, guards, phase } = state;
    const ctx = this.ctx;
    this.time += 0.016;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawFloor(ctx, level);
    this.drawCover(ctx, level);
    this.drawExit(ctx, level);
    this.drawGems(ctx, level);
    for (const g of guards) this.drawVisionCone(ctx, level, g);
    for (const g of guards) this.drawGuard(ctx, g);
    this.drawPlayer(ctx, player, level);
    this.drawDarkness(ctx, level, player, guards);
    this.drawNoiseRing(ctx, player);
    this.drawHud(ctx, state);
    if (phase === 'caught') this.drawBanner(ctx, 'CAUGHT!', '#e5484d', 'The watchman has you. Press R to try again.');
    if (phase === 'levelclear') this.drawBanner(ctx, 'CLEAN GETAWAY', '#7ee787', 'The Ember Star is yours. Press Enter for the next floor.');
    if (phase === 'won') this.drawBanner(ctx, 'THE VAULT IS EMPTY', '#ffd166', 'Every star stolen, never once caught. Press R to play again.');
  }

  drawFloor(ctx, level) {
    for (let ty = 0; ty < ROWS; ty++) {
      for (let tx = 0; tx < COLS; tx++) {
        const key = tx + ',' + ty;
        const x = tx * TILE;
        const y = ty * TILE;
        if (level.walls.has(key)) {
          ctx.fillStyle = WALL;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = WALL_TOP;
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(x, y + 5, TILE, 2);
        } else {
          const dark = level.dark.has(key);
          ctx.fillStyle = dark ? SHADOW_FLOOR : (tx + ty) % 2 === 0 ? FLOOR_A : FLOOR_B;
          ctx.fillRect(x, y, TILE, TILE);
          if (dark) {
            ctx.fillStyle = 'rgba(120,140,255,0.05)';
            ctx.fillRect(x, y, TILE, TILE);
          }
          ctx.strokeStyle = 'rgba(0,0,0,0.25)';
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
  }

  drawCover(ctx, level) {
    // Crates: wooden boxes with a plank line.
    for (const key of level.cover) {
      if (level.hedges.has(key) || level.pillars.has(key)) continue;
      const [tx, ty] = key.split(',').map(Number);
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = '#4a3623';
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      ctx.fillStyle = '#5d452c';
      ctx.fillRect(x + 3, y + 3, TILE - 6, 8);
      ctx.strokeStyle = '#2c1f12';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.moveTo(x + 3, y + TILE / 2);
      ctx.lineTo(x + TILE - 3, y + TILE / 2);
      ctx.stroke();
    }
    // Pillars: round stone columns with a brass ring.
    for (const key of level.pillars) {
      const [tx, ty] = key.split(',').map(Number);
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = '#5a5468';
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2c2836';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#d8c27a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Hedges: dark green shrubs, the soft cover you crouch behind.
    for (const key of level.hedges) {
      const [tx, ty] = key.split(',').map(Number);
      const x = tx * TILE;
      const y = ty * TILE;
      ctx.fillStyle = '#24402a';
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, TILE / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f5238';
      ctx.beginPath();
      ctx.arc(x + TILE / 2 - 6, y + TILE / 2 - 5, 9, 0, Math.PI * 2);
      ctx.arc(x + TILE / 2 + 7, y + TILE / 2 + 4, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawExit(ctx, level) {
    const pulse = 0.75 + Math.sin(this.time * 3) * 0.25;
    const { x, y } = level.exit;
    ctx.save();
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = '#2ee66b';
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#12351f';
    ctx.fillRect(x - 18, y - 18, 36, 36);
    ctx.strokeStyle = '#2ee66b';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 18, y - 18, 36, 36);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', x, y + 4);
  }

  drawGems(ctx, level) {
    for (const gem of level.gems) {
      if (gem.taken) continue;
      const bob = Math.sin(this.time * 2.5 + gem.x) * 2;
      const r = gem.big ? 11 : 7;
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = gem.big ? '#ff5d73' : '#ffd166';
      ctx.beginPath();
      ctx.arc(gem.x, gem.y + bob, r + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = gem.big ? '#ff5d73' : '#ffd166';
      ctx.beginPath();
      ctx.moveTo(gem.x, gem.y + bob - r);
      ctx.lineTo(gem.x + r * 0.8, gem.y + bob);
      ctx.lineTo(gem.x, gem.y + bob + r);
      ctx.lineTo(gem.x - r * 0.8, gem.y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(gem.x - 3, gem.y + bob - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // A vision cone clipped by walls: sample rays across the cone and join them.
  drawVisionCone(ctx, level, guard) {
    const range = VISION_RANGE;
    const half = VISION_HALF_ANGLE;
    const color = guard.state === 'alerted' ? '255,70,70' : guard.state === 'suspicious' ? '255,176,32' : '255,214,90';
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    const steps = 26;
    for (let i = 0; i <= steps; i++) {
      const a = guard.facing - half + (2 * half * i) / steps;
      const d = rayDistance(level, guard.x, guard.y, a, range);
      ctx.lineTo(guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(${color},0.20)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${color},0.55)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  drawGuard(ctx, guard) {
    const alerted = guard.state === 'alerted';
    const suspicious = guard.state === 'suspicious';
    // Body: a watchman in a navy coat with a brass-button front.
    ctx.fillStyle = alerted ? '#8c1d24' : suspicious ? '#7a5a12' : '#27324f';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0d0a14';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#d8c27a';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick so the patrol direction reads at a glance.
    ctx.strokeStyle = '#f5f0dc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 19, guard.y + Math.sin(guard.facing) * 19);
    ctx.stroke();
    // State mark above the head: ? while suspicious, ! while alerted.
    if (guard.state !== 'patrol') {
      ctx.fillStyle = alerted ? '#ff5a5a' : '#ffb020';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - 20);
    }
    // Suspicion arc around the guard, filling as it grows.
    if (guard.suspicion > 4) {
      ctx.strokeStyle = alerted ? '#ff5a5a' : '#ffd65a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 19, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
    }
  }

  drawPlayer(ctx, player) {
    const { x, y } = player;
    // Cloak shadow and hood.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b3a8c';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c1747';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood point and face.
    ctx.fillStyle = '#3d2560';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 6);
    ctx.lineTo(x + Math.cos(player.facing) * 16, y + Math.sin(player.facing) * 16);
    ctx.lineTo(x + 8, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath();
    ctx.arc(x + Math.cos(player.facing) * 5, y + Math.sin(player.facing) * 5, 4, 0, Math.PI * 2);
    ctx.fill();
    // The lantern: a warm dot swinging at the thief's side.
    const lx = x + Math.cos(player.facing + 1.2) * 14;
    const ly = y + Math.sin(player.facing + 1.2) * 14;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Night darkness with lantern holes: the lit circle is where it is safe to be seen.
  drawDarkness(ctx, level, player, guards) {
    const dctx = this.dark.getContext('2d');
    dctx.clearRect(0, 0, this.dark.width, this.dark.height);
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = 'rgba(5,6,18,0.52)';
    dctx.fillRect(0, 0, this.dark.width, this.dark.height);
    dctx.globalCompositeOperation = 'destination-out';
    this.punchLight(dctx, player.x, player.y, 110, 0.95);
    this.punchLight(dctx, level.exit.x, level.exit.y, 60, 0.7);
    for (const gem of level.gems) {
      if (!gem.taken) this.punchLight(dctx, gem.x, gem.y, 34, 0.5);
    }
    for (const g of guards) this.punchLight(dctx, g.x, g.y, 46, 0.45);
    ctx.drawImage(this.dark, 0, 0);
  }

  punchLight(dctx, x, y, radius, strength) {
    const grad = dctx.createRadialGradient(x, y, 4, x, y, radius);
    grad.addColorStop(0, `rgba(0,0,0,${strength})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = grad;
    dctx.beginPath();
    dctx.arc(x, y, radius, 0, Math.PI * 2);
    dctx.fill();
  }

  drawNoiseRing(ctx, player) {
    if (!player.moving || player.sneaking) return;
    const r = player.running ? 46 : 26;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawHud(ctx, state) {
    const { levelIndex, player, guards, phase, message, timeLeft } = state;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,16,0.78)';
    ctx.fillRect(0, 0, this.canvas.width, 44);
    ctx.fillStyle = '#f5f0dc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`LANTERN THIEF  ·  Floor ${levelIndex + 1}/3 — ${state.levelName}`, 12, 19);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`◆ ${player.gems}   ★ ${player.hasStar ? 'EMBER STAR' : 'find the star'}   ● pebbles ${player.pebbles}`, 12, 37);
    // Alarm meter: the highest suspicion among the guards.
    const worst = guards.reduce((m, g) => Math.max(m, g.suspicion), 0);
    const anyAlert = guards.some((g) => g.state === 'alerted');
    const bx = this.canvas.width - 250;
    ctx.fillStyle = '#3a3345';
    ctx.fillRect(bx, 12, 180, 12);
    ctx.fillStyle = anyAlert ? '#ff4d4d' : worst > 28 ? '#ffb020' : '#7ee787';
    ctx.fillRect(bx, 12, 180 * (worst / 100), 12);
    ctx.strokeStyle = '#f5f0dc';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, 12.5, 180, 12);
    ctx.fillStyle = '#f5f0dc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(anyAlert ? 'ALARM!' : worst > 28 ? 'SPOTTED?' : 'UNSEEN', bx, 38);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c9c2d6';
    ctx.font = '12px sans-serif';
    ctx.fillText(`⏱ ${Math.max(0, Math.ceil(timeLeft))}s`, this.canvas.width - 12, 19);
    ctx.fillText('M mute · R retry', this.canvas.width - 12, 37);
    ctx.restore();
    if (message) {
      ctx.save();
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(message).width + 28;
      ctx.fillStyle = 'rgba(8,8,16,0.8)';
      ctx.fillRect((this.canvas.width - w) / 2, this.canvas.height - 52, w, 30);
      ctx.fillStyle = '#ffd166';
      ctx.fillText(message, this.canvas.width / 2, this.canvas.height - 32);
      ctx.restore();
    }
    if (phase === 'title') {
      ctx.save();
      ctx.fillStyle = 'rgba(5,5,14,0.72)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 46px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LANTERN THIEF', this.canvas.width / 2, 190);
      ctx.fillStyle = '#ff5d73';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('— The Ember Vault —', this.canvas.width / 2, 224);
      ctx.fillStyle = '#f5f0dc';
      ctx.font = '16px sans-serif';
      const lines = [
        'You are the thief with the little lantern. Steal the Ember Star',
        'on each floor and slip out the green EXIT door — unseen.',
        '',
        'WASD / arrows — move      Shift — sneak      Space — run (loud!)',
        'Q or right-click — toss a pebble to lure a guard     Click — walk there',
        'Hide in the dark blue shadow tiles. Watch the cones. Break line of',
        'sight to cool an alarm down — a guard who loses you gives up.',
      ];
      lines.forEach((l, i) => ctx.fillText(l, this.canvas.width / 2, 280 + i * 26));
      ctx.fillStyle = '#7ee787';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText('Click or press Enter to begin', this.canvas.width / 2, 500);
      ctx.restore();
    }
  }

  drawBanner(ctx, title, color, sub) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,5,14,0.66)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = color;
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, this.canvas.width / 2, this.canvas.height / 2 - 10);
    ctx.fillStyle = '#f5f0dc';
    ctx.font = '17px sans-serif';
    ctx.fillText(sub, this.canvas.width / 2, this.canvas.height / 2 + 28);
    ctx.restore();
  }
}
