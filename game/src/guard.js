// guard.js — the night watchmen: patrol routes, vision cones, suspicion and alarm.
//
// A guard walks a loop of waypoints, pausing at each to look around. When the
// player is inside its vision cone with a clear line of sight, suspicion rises
// (faster up close, faster still if the player runs or stands in the light;
// slower when the player sneaks or hides in shadow). At full suspicion the
// guard raises the alarm and chases; if it loses the player for a while it
// gives up, suspicion drains, and it walks back to its patrol.
//
// Guards never walk in a straight line into a wall: they route across the
// floor on a tile grid (breadth-first search), so a patrol always reaches its
// next waypoint and a chase can follow the player around corners.

import { TILE, hasLineOfSight, hitsSolid, inShadow, findPath } from './level.js';

export const VISION_RANGE = 190;
export const VISION_HALF_ANGLE = 0.62; // radians either side of facing (~71 deg cone)
export const CHASE_SPEED = 118;
export const SUSPICION_MAX = 100;

export class Guard {
  constructor(route) {
    this.waypoints = route.waypoints;
    this.speed = route.speed;
    this.pauseTime = route.pause;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.targetIndex = 1;
    this.facing = 0;
    this.pauseLeft = 0.6;
    this.scanDir = 1;
    this.state = 'patrol'; // patrol | suspicious | alerted | returning
    this.suspicion = 0;
    this.lastSeen = null; // last known player position
    this.lostTimer = 0;
    this.searchTimer = 0;
    this.stepPhase = 0;
    this.stepTick = 0;
    this.route = null; // tile-centre path to the current destination
    this.routeTarget = null; // {x, y} the route was built for
    this.routeNode = 0;
  }

  // Can this guard see the player right now? Returns 0..1 (0 = unseen).
  // Visibility grows when the player is close, moving fast, or in the light.
  seePlayer(level, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VISION_RANGE) return 0;
    if (dist > 24) {
      let angle = Math.atan2(dy, dx) - this.facing;
      while (angle > Math.PI) angle -= Math.PI * 2;
      while (angle < -Math.PI) angle += Math.PI * 2;
      if (Math.abs(angle) > VISION_HALF_ANGLE) return 0;
    }
    if (!hasLineOfSight(level, this.x, this.y, player.x, player.y)) return 0;
    const closeness = 1 - dist / VISION_RANGE; // 0 far, 1 touching
    let vis = 0.35 + closeness * 0.85;
    if (player.sneaking) vis *= 0.45;
    if (player.running) vis *= 1.5;
    if (inShadow(level, player.x, player.y)) vis *= 0.55;
    return Math.min(1.4, vis);
  }

  // Walk toward a point along the floor's tile grid, routing around walls
  // and cover. Returns the distance actually moved. The route is rebuilt
  // when the destination moves to a new tile.
  followRoute(level, tx, ty, speed, dt) {
    const targetKey = Math.floor(tx / TILE) + ',' + Math.floor(ty / TILE);
    if (!this.route || this.routeTarget !== targetKey) {
      this.route = findPath(level, this.x, this.y, tx, ty);
      this.routeTarget = targetKey;
      this.routeNode = 0;
    }
    if (!this.route || this.route.length === 0) return 0;
    // Skip nodes already reached (the first node is the guard's own tile).
    while (this.routeNode < this.route.length - 1) {
      const node = this.route[this.routeNode];
      if (Math.hypot(node.x - this.x, node.y - this.y) < 6) this.routeNode += 1;
      else break;
    }
    const node = this.route[this.routeNode];
    const dx = node.x - this.x;
    const dy = node.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return 0;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    const r = 13;
    const ox = this.x;
    const oy = this.y;
    // Slide along one axis at a time so guards hug walls instead of sticking.
    if (!hitsSolid(level, nx, this.y, r)) this.x = nx;
    if (!hitsSolid(level, this.x, ny, r)) this.y = ny;
    const moved = Math.hypot(this.x - ox, this.y - oy);
    if (moved > 0) {
      this.facing = Math.atan2(dy, dx);
      this.stepPhase += moved;
    }
    return moved;
  }

  update(level, player, dt, onFootstep) {
    const vis = this.seePlayer(level, player);
    if (vis > 0) {
      this.lastSeen = { x: player.x, y: player.y };
      this.lostTimer = 0;
      this.suspicion = Math.min(SUSPICION_MAX, this.suspicion + vis * 62 * dt);
      if (this.suspicion >= SUSPICION_MAX && this.state !== 'alerted') {
        this.state = 'alerted';
        this.searchTimer = 0;
      } else if (this.suspicion > 28 && this.state === 'patrol') {
        this.state = 'suspicious';
      }
    } else {
      this.lostTimer += dt;
      if (this.state === 'alerted') {
        // Keep hunting the last seen spot for a while, then give up.
        if (this.lostTimer > 4.5) {
          this.state = 'returning';
          this.suspicion = 55;
        }
      } else {
        this.suspicion = Math.max(0, this.suspicion - 16 * dt);
        if (this.suspicion <= 8 && this.state === 'suspicious') this.state = 'patrol';
      }
    }

    if (this.state === 'alerted' && this.lastSeen) {
      const moved = this.followRoute(level, this.lastSeen.x, this.lastSeen.y, CHASE_SPEED, dt);
      if (moved > 0) this.emitSteps(moved, onFootstep);
      const d = Math.hypot(this.lastSeen.x - this.x, this.lastSeen.y - this.y);
      if (d < 14 && vis <= 0) {
        // Reached the last seen spot and the player is gone: search the area.
        this.searchTimer += dt;
        this.facing += this.scanDir * 1.6 * dt;
        if (this.searchTimer > 1.6) {
          this.scanDir *= -1;
          this.searchTimer = 0;
        }
      }
    } else if (this.state === 'returning') {
      const home = this.waypoints[this.targetIndex];
      const moved = this.followRoute(level, home.x, home.y, this.speed * 1.15, dt);
      if (moved > 0) this.emitSteps(moved, onFootstep);
      const d = Math.hypot(home.x - this.x, home.y - this.y);
      if (d < 10) {
        this.state = 'patrol';
        this.suspicion = 0;
        this.pauseLeft = 0.5;
      }
    } else if (this.state === 'suspicious' && this.lastSeen) {
      // Walk toward the glimpse, cautiously — but stop a little way off and
      // look, instead of walking right onto the thief. That standoff is
      // what gives the player a chance to run when the alarm goes up.
      const d = Math.hypot(this.lastSeen.x - this.x, this.lastSeen.y - this.y);
      if (d > 70) {
        const moved = this.followRoute(level, this.lastSeen.x, this.lastSeen.y, this.speed * 0.8, dt);
        if (moved > 0) this.emitSteps(moved, onFootstep);
      } else {
        this.searchTimer += dt;
        const base = Math.atan2(this.lastSeen.y - this.y, this.lastSeen.x - this.x);
        this.facing = base + Math.sin(this.searchTimer * 2) * 0.5;
      }
    } else {
      // Patrol: walk to the next waypoint, pause and scan there.
      if (this.pauseLeft > 0) {
        this.pauseLeft -= dt;
        this.facing += this.scanDir * 0.9 * dt;
        if (this.pauseLeft <= 0) this.scanDir *= -1;
      } else {
        const wp = this.waypoints[this.targetIndex];
        const moved = this.followRoute(level, wp.x, wp.y, this.speed, dt);
        if (moved > 0) this.emitSteps(moved, onFootstep);
        if (Math.hypot(wp.x - this.x, wp.y - this.y) < 8) {
          this.targetIndex = (this.targetIndex + 1) % this.waypoints.length;
          this.pauseLeft = this.pauseTime;
        }
      }
    }
  }

  // Footstep sounds: one tick every ~26px walked, louder when chasing.
  emitSteps(moved, onFootstep) {
    this.stepTick += moved;
    if (this.stepTick > 26) {
      this.stepTick = 0;
      if (onFootstep) onFootstep(this.x, this.y, this.state === 'alerted' ? 0.5 : 0.28);
    }
  }

  // Caught the player? Only an alerted guard at touching distance counts.
  catches(player) {
    return this.state === 'alerted' && Math.hypot(player.x - this.x, player.y - this.y) < 24;
  }

  // A thrown pebble lands: the guard turns to investigate the noise.
  hearNoise(nx, ny) {
    const d = Math.hypot(nx - this.x, ny - this.y);
    if (d < 260) {
      this.lastSeen = { x: nx, y: ny };
      this.lostTimer = 0;
      if (this.state === 'patrol') this.state = 'suspicious';
      this.suspicion = Math.max(this.suspicion, 30);
    }
  }
}
