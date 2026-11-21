// level.js — the museum floors: tile maps, tile helpers and line of sight.
//
// Tiles (one character per 40px cell):
//   # wall        C crate (cover, blocks sight and movement)
//   P pillar     H hedge (cover, blocks sight and movement)
//   . floor      , dark floor (shadow: harder to be spotted here)
//   E exit door  G the Ember Star gem (level goal, optional pickups are *)
//   * small gem  S player start
// Guard patrol routes live in each level's `patrols` list, not in the map.

export const TILE = 40;
export const COLS = 24;
export const ROWS = 16;

export const LEVELS = [
  {
    name: 'Gallery of Whispers',
    brief: 'Slip past the night watch, take the Ember Star, leave by the green door.',
    map: [
      '########################',
      '#S....,,,....#.....*...#',
      '#.....,,,....#.........#',
      '#.CC..,,,..............#',
      '#.CC........C.....#...E#',
      '#.....H.........C.#....#',
      '#.........P.......#....#',
      '#.....H............C...#',
      '#......................#',
      '#.P...H..,,,.....C.....#',
      '#........,,,..C...#....#',
      '#..C..H..,,,......#....#',
      '#........,,,......#....#',
      '#...........*..........#',
      '#..G...................#',
      '########################',
    ],
    patrols: [
      { path: [[6, 3], [6, 12], [17, 12], [17, 3]], speed: 62, pause: 1.1 },
      { path: [[12, 13], [12, 5], [20, 5], [20, 13]], speed: 55, pause: 1.6 },
    ],
  },
  {
    name: 'Hall of Lanterns',
    brief: 'Two more watchmen, tighter halls. The hedge rows are your friends.',
    map: [
      '########################',
      '#S..#.,,,.....#........#',
      '#...#.,C,..C..#....*...#',
      '#...#.........#..C.....#',
      '#...#...P...H........E.#',
      '#...#.....#............#',
      '#......C..#.H...,,,....#',
      '#...............,C,....#',
      '#...............,,,....#',
      '#...#...H.#.C....P.....#',
      '#...#.....#............#',
      '#...#.........#........#',
      '#...#..C....H.#..C.....#',
      '#...#.,,,.....#...*....#',
      '#.....,G,..............#',
      '########################',
    ],
    patrols: [
      { path: [[2, 7], [2, 13], [8, 13], [8, 7]], speed: 68, pause: 0.9 },
      { path: [[16, 3], [16, 12], [21, 12], [21, 3]], speed: 62, pause: 1.2 },
      { path: [[6, 7], [12, 7], [12, 10], [6, 10]], speed: 74, pause: 0.7 },
    ],
  },
  {
    name: 'The Ember Vault',
    brief: 'The vault itself. Four watchmen, one star, no second chances.',
    map: [
      '########################',
      '#S....#,,,..#.....#....#',
      '#.C...#,,C..#..C..#.*..#',
      '#.....#.....#..........#',
      '#...H.#..P.....H.......#',
      '#.....#..............E.#',
      '#..C.....C...,,H.......#',
      '#........#...,,,.......#',
      '#...H....P.....C.......#',
      '#.....#........#.......#',
      '#..H..#........#.......#',
      '#.....#..C.....H.......#',
      '#..,,,#.....#.....#....#',
      '#..,C,#..H..#..C..#.*..#',
      '#..G........#.....#....#',
      '########################',
    ],
    patrols: [
      { path: [[2, 7], [2, 12], [5, 12], [5, 7]], speed: 72, pause: 0.8 },
      { path: [[8, 3], [8, 13], [10, 13], [10, 3]], speed: 66, pause: 1.0 },
      { path: [[14, 4], [14, 12], [16, 12], [16, 4]], speed: 78, pause: 0.6 },
      { path: [[19, 7], [19, 13], [21, 13], [21, 7]], speed: 60, pause: 1.4 },
    ],
  },
];

// A level instance: parsed map, player start, gems, exit and patrol routes.
export function parseLevel(def) {
  const walls = new Set();
  const cover = new Set();
  const hedges = new Set();
  const pillars = new Set();
  const dark = new Set();
  const gems = [];
  let start = { x: 1.5 * TILE, y: 1.5 * TILE };
  let exit = { x: 22.5 * TILE, y: 4.5 * TILE };
  def.map.forEach((row, ry) => {
    [...row].forEach((ch, rx) => {
      const key = rx + ',' + ry;
      if (ch === '#') walls.add(key);
      if (ch === 'C' || ch === 'P' || ch === 'H') cover.add(key);
      if (ch === 'H') hedges.add(key);
      if (ch === 'P') pillars.add(key);
      if (ch === ',') dark.add(key);
      if (ch === 'S') start = { x: (rx + 0.5) * TILE, y: (ry + 0.5) * TILE };
      if (ch === 'E') exit = { x: (rx + 0.5) * TILE, y: (ry + 0.5) * TILE };
      if (ch === 'G') gems.push({ x: (rx + 0.5) * TILE, y: (ry + 0.5) * TILE, big: true, taken: false });
      if (ch === '*') gems.push({ x: (rx + 0.5) * TILE, y: (ry + 0.5) * TILE, big: false, taken: false });
    });
  });
  return {
    name: def.name,
    brief: def.brief,
    walls,
    cover,
    hedges,
    pillars,
    dark,
    gems,
    start,
    exit,
    patrols: def.patrols.map((p) => ({
      waypoints: p.path.map(([gx, gy]) => ({ x: (gx + 0.5) * TILE, y: (gy + 0.5) * TILE })),
      speed: p.speed,
      pause: p.pause,
    })),
  };
}

export function tileAt(level, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return level.walls.has(tx + ',' + ty) ? '#' : level.cover.has(tx + ',' + ty) ? 'X' : '.';
}

// True when a circle of radius r at (px,py) overlaps a solid tile.
export function hitsSolid(level, px, py, r) {
  for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) {
    if (tileAt(level, px + dx, py + dy) !== '.') return true;
  }
  return false;
}

// True when the player stands on a shadow tile.
export function inShadow(level, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return level.dark.has(tx + ',' + ty);
}

// Line of sight between two points, blocked by walls and cover.
// Steps along the segment in small increments and checks each sample.
export function hasLineOfSight(level, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (tileAt(level, ax + dx * t, ay + dy * t) !== '.') return false;
  }
  return true;
}

// Distance from a point to the nearest wall/cover edge along a ray, for cones.
export function rayDistance(level, ox, oy, angle, maxDist) {
  const step = 8;
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    if (tileAt(level, ox + cx * d, oy + cy * d) !== '.') return d;
  }
  return maxDist;
}

// Shortest walkable route across the tile grid, as a list of tile centres.
// Returns null when no route exists. Guards chase along it, and a mouse
// click walks the thief along it, so neither ever gets stuck on cover.
export function findPath(level, fromX, fromY, toX, toY) {
  const start = { tx: Math.floor(fromX / TILE), ty: Math.floor(fromY / TILE) };
  const goal = { tx: Math.floor(toX / TILE), ty: Math.floor(toY / TILE) };
  const key = (tx, ty) => tx + ',' + ty;
  if (tileAt(level, toX, toY) !== '.') return null;
  const prev = new Map();
  const queue = [start];
  prev.set(key(start.tx, start.ty), null);
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.tx === goal.tx && cur.ty === goal.ty) {
      const path = [];
      let node = cur;
      while (node) {
        path.unshift({ x: (node.tx + 0.5) * TILE, y: (node.ty + 0.5) * TILE });
        node = prev.get(key(node.tx, node.ty));
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (prev.has(key(nx, ny))) continue;
      if (tileAt(level, (nx + 0.5) * TILE, (ny + 0.5) * TILE) !== '.') continue;
      prev.set(key(nx, ny), cur);
      queue.push({ tx: nx, ty: ny });
    }
  }
  return null;
}
