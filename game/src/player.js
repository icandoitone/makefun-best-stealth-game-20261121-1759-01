// player.js — the lantern thief: keyboard/mouse movement, sneaking, noise, pebbles.
//
// Controls: WASD or arrow keys to walk, hold Shift to sneak (slow and quiet),
// hold Space to run (fast and loud), Q or right-click to toss a pebble that
// clatters and pulls the nearest guard over to look. Left-click sets a
// walk-to point for mouse players. The thief's lantern lights a small circle
// around them; running makes a noise ring guards can hear.

import { findPath, hitsSolid, inShadow } from './level.js';

export const WALK_SPEED = 132;
export const SNEAK_SPEED = 62;
export const RUN_SPEED = 205;
export const PLAYER_RADIUS = 12;

export class Player {
  constructor(start) {
    this.x = start.x;
    this.y = start.y;
    this.facing = 0;
    this.sneaking = false;
    this.running = false;
    this.moving = false;
    this.noise = 0; // 0..1, how loud the last step was
    this.pebbles = 3;
    this.gems = 0;
    this.hasStar = false;
    this.stepPhase = 0;
    this.stepTick = 0;
    this.moveTarget = null; // {x, y} from a mouse click, or null
    this.clickRoute = null; // tile-centre path to the click point
    this.clickNode = 0;
    this.blink = 0;
  }

  reset(start) {
    this.x = start.x;
    this.y = start.y;
    this.facing = 0;
    this.pebbles = 3;
    this.gems = 0;
    this.hasStar = false;
    this.moveTarget = null;
    this.clickRoute = null;
    this.noise = 0;
  }

  // Keyboard state arrives as a Set of lowercase key names held down.
  update(level, keys, dt, onFootstep) {
    let mx = 0;
    let my = 0;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    if (keys.has('w') || keys.has('arrowup')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown')) my += 1;

    if (this.moveTarget && (mx !== 0 || my !== 0)) {
      this.moveTarget = null;
      this.clickRoute = null;
    }
    if (this.moveTarget) {
      // A click walks the routed path around cover, not a straight line
      // into the nearest crate. A click on a wall has no route: give up.
      if (!this.clickRoute) {
        this.clickRoute = findPath(level, this.x, this.y, this.moveTarget.x, this.moveTarget.y);
        this.clickNode = 0;
        if (!this.clickRoute) this.moveTarget = null;
      }
      if (this.moveTarget && this.clickRoute) {
        while (this.clickNode < this.clickRoute.length - 1) {
          const node = this.clickRoute[this.clickNode];
          if (Math.hypot(node.x - this.x, node.y - this.y) < 8) this.clickNode += 1;
          else break;
        }
        const node = this.clickRoute[this.clickNode];
        const dx = node.x - this.x;
        const dy = node.y - this.y;
        if (Math.hypot(dx, dy) < 8 && this.clickNode >= this.clickRoute.length - 1) {
          this.moveTarget = null;
          this.clickRoute = null;
        } else {
          mx = dx / Math.hypot(dx, dy);
          my = dy / Math.hypot(dx, dy);
        }
      }
    }

    this.sneaking = keys.has('shift');
    this.running = keys.has(' ') && !this.sneaking;
    const speed = this.sneaking ? SNEAK_SPEED : this.running ? RUN_SPEED : WALK_SPEED;
    const len = Math.hypot(mx, my);
    this.moving = len > 0;
    if (this.moving) {
      const nx = this.x + (mx / len) * speed * dt;
      const ny = this.y + (my / len) * speed * dt;
      if (!hitsSolid(level, nx, this.y, PLAYER_RADIUS)) this.x = nx;
      if (!hitsSolid(level, this.x, ny, PLAYER_RADIUS)) this.y = ny;
      this.facing = Math.atan2(my, mx);
      this.noise = this.sneaking ? 0.12 : this.running ? 1 : 0.45;
      this.stepPhase += speed * dt;
      this.stepTick += speed * dt;
      const stride = this.sneaking ? 30 : 22;
      if (this.stepTick > stride) {
        this.stepTick = 0;
        if (onFootstep) onFootstep(this.x, this.y, this.sneaking ? 0.1 : this.running ? 0.55 : 0.3);
      }
    } else {
      this.noise = Math.max(0, this.noise - dt * 2);
    }
    this.blink = Math.max(0, this.blink - dt);
  }

  // Toss a pebble toward a point. Returns the landing spot, or null if none left.
  throwPebble(tx, ty) {
    if (this.pebbles <= 0) return null;
    this.pebbles -= 1;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const reach = Math.min(d, 220);
    return { x: this.x + (dx / (d || 1)) * reach, y: this.y + (dy / (d || 1)) * reach };
  }

  // Pick up anything touching the thief. Returns a list of what was taken.
  collect(level) {
    const taken = [];
    for (const gem of level.gems) {
      if (!gem.taken && Math.hypot(gem.x - this.x, gem.y - this.y) < 26) {
        gem.taken = true;
        taken.push(gem);
        if (gem.big) this.hasStar = true;
        else this.gems += 1;
      }
    }
    return taken;
  }

  // Standing on the exit with the Ember Star wins the level.
  atExit(level) {
    return this.hasStar && Math.hypot(level.exit.x - this.x, level.exit.y - this.y) < 30;
  }

  hiddenInShadow(level) {
    return inShadow(level, this.x, this.y);
  }
}

// Read the keys currently held down from DOM events into a Set.
export function createKeyTracker() {
  const keys = new Set();
  const down = (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
  };
  const up = (e) => keys.delete(e.key.toLowerCase());
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());
  return keys;
}
