/**
 * Aegis - Map & Pathfinding system
 *
 * Rules (GemCraft Labyrinth style):
 * - Enemies only walk on PATH tiles.
 * - Player can place WALL on PATH tiles to force longer routes / redirect.
 * - If every possible route is blocked → no path exists → enemies switch to
 *   ATTACK mode and start damaging the walls that are sealing the path.
 * - Once a wall is destroyed, path is recalculated and they resume walking.
 */

export const TILE = {
  EMPTY: 0,      // buildable ground (towers, amplifiers, etc.)
  PATH: 1,       // walkable by enemies
  WALL: 2,       // blocks path, can be destroyed by enemies when fully sealed
  SPAWN: 3,      // enemy entrance (also walkable)
  ORB: 4,        // player base (goal)
  TOWER: 5,      // structure on EMPTY
  AMPLIFIER: 6,
  TRAP: 7,       // trap sits on PATH
};

export const TILE_NAMES = {
  [TILE.EMPTY]: 'empty',
  [TILE.PATH]: 'path',
  [TILE.WALL]: 'wall',
  [TILE.SPAWN]: 'spawn',
  [TILE.ORB]: 'orb',
  [TILE.TOWER]: 'tower',
  [TILE.AMPLIFIER]: 'amplifier',
  [TILE.TRAP]: 'trap',
};

/** Simple 4-directional neighbors */
const DIRS = [
  { dx: 0, dy: -1 }, // N
  { dx: 1, dy: 0 },  // E
  { dx: 0, dy: 1 },  // S
  { dx: -1, dy: 0 }, // W
];

export class GameMap {
  /**
   * @param {number} width
   * @param {number} height
   * @param {number[][]} [layout] optional initial layout (row-major)
   */
  constructor(width, height, layout = null) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.wallHp = new Map(); // key "x,y" → current HP

    // Default empty map
    for (let y = 0; y < height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < width; x++) {
        this.tiles[y][x] = TILE.EMPTY;
      }
    }

    if (layout) {
      this.loadLayout(layout);
    }

    this.spawns = [];
    this.orb = null;
    this._findSpecialTiles();
  }

  loadLayout(layout) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const v = layout[y]?.[x] ?? TILE.EMPTY;
        this.tiles[y][x] = v;
        if (v === TILE.WALL) {
          this.wallHp.set(`${x},${y}`, 100); // default wall HP
        }
      }
    }
    this._findSpecialTiles();
  }

  _findSpecialTiles() {
    this.spawns = [];
    this.orb = null;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        if (t === TILE.SPAWN) this.spawns.push({ x, y });
        if (t === TILE.ORB) this.orb = { x, y };
      }
    }
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.tiles[y][x];
  }

  set(x, y, type, wallHp = 100) {
    if (!this.inBounds(x, y)) return false;
    this.tiles[y][x] = type;
    const key = `${x},${y}`;
    if (type === TILE.WALL) {
      this.wallHp.set(key, wallHp);
    } else {
      this.wallHp.delete(key);
    }
    if (type === TILE.SPAWN || type === TILE.ORB) this._findSpecialTiles();
    return true;
  }

  /** Is this tile currently walkable by enemies? */
  isWalkable(x, y) {
    const t = this.get(x, y);
    if (t === null) return false;
    // PATH, SPAWN, ORB and TRAP are walkable
    // WALL blocks
    return t === TILE.PATH || t === TILE.SPAWN || t === TILE.ORB || t === TILE.TRAP;
  }

  /** Can the player place a wall here? Only on PATH tiles. */
  canPlaceWall(x, y) {
    return this.get(x, y) === TILE.PATH;
  }

  placeWall(x, y, hp = 100) {
    if (!this.canPlaceWall(x, y)) return false;
    this.set(x, y, TILE.WALL, hp);
    return true;
  }

  removeWall(x, y) {
    if (this.get(x, y) !== TILE.WALL) return false;
    this.set(x, y, TILE.PATH); // restore path
    return true;
  }

  damageWall(x, y, amount) {
    const key = `${x},${y}`;
    if (!this.wallHp.has(key)) return false;
    let hp = this.wallHp.get(key) - amount;
    if (hp <= 0) {
      this.removeWall(x, y);
      return true; // destroyed
    }
    this.wallHp.set(key, hp);
    return false;
  }

  getWallHp(x, y) {
    return this.wallHp.get(`${x},${y}`) ?? 0;
  }

  // ─────────────────────────────────────────────
  // Pathfinding (A*)
  // ─────────────────────────────────────────────

  /**
   * Find shortest path from start → goal using only walkable tiles.
   * Returns array of {x,y} or null if no path.
   */
  findPath(start, goal) {
    if (!start || !goal) return null;
    if (!this.isWalkable(start.x, start.y) || !this.isWalkable(goal.x, goal.y)) {
      return null;
    }

    const key = (p) => `${p.x},${p.y}`;
    const open = new Map();
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const startKey = key(start);
    open.set(startKey, start);
    gScore.set(startKey, 0);
    fScore.set(startKey, heuristic(start, goal));

    while (open.size > 0) {
      // node with lowest fScore
      let currentKey = null;
      let lowestF = Infinity;
      for (const [k, node] of open) {
        const f = fScore.get(k) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentKey = k;
        }
      }
      const current = open.get(currentKey);
      open.delete(currentKey);

      if (current.x === goal.x && current.y === goal.y) {
        return reconstructPath(cameFrom, current);
      }

      for (const dir of DIRS) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        if (!this.isWalkable(nx, ny)) continue;

        const neighbor = { x: nx, y: ny };
        const nKey = key(neighbor);
        const tentativeG = (gScore.get(currentKey) ?? Infinity) + 1;

        if (tentativeG < (gScore.get(nKey) ?? Infinity)) {
          cameFrom.set(nKey, current);
          gScore.set(nKey, tentativeG);
          fScore.set(nKey, tentativeG + heuristic(neighbor, goal));
          if (!open.has(nKey)) open.set(nKey, neighbor);
        }
      }
    }
    return null; // blocked
  }

  /**
   * Check if there is ANY path from any spawn to the orb.
   * Returns the first found path or null.
   */
  findAnyPathToOrb() {
    if (!this.orb || this.spawns.length === 0) return null;
    for (const spawn of this.spawns) {
      const path = this.findPath(spawn, this.orb);
      if (path) return path;
    }
    return null;
  }

  /** True when the map is completely sealed (no route left). */
  isFullyBlocked() {
    return this.findAnyPathToOrb() === null;
  }

  // ─────────────────────────────────────────────
  // Attack mode helpers (when fully blocked)
  // ─────────────────────────────────────────────

  /**
   * Find walls that are adjacent to the current reachable area of enemies.
   * These are the walls the enemies will start attacking.
   *
   * Strategy:
   * 1. Flood-fill from all spawns over currently walkable tiles → reachable set.
   * 2. Any WALL that touches the reachable set is a candidate target.
   */
  getAttackableWalls() {
    const reachable = this._floodReachableFromSpawns();
    const walls = [];

    for (const key of this.wallHp.keys()) {
      const [x, y] = key.split(',').map(Number);
      // check if any neighbor is reachable
      for (const dir of DIRS) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (reachable.has(`${nx},${ny}`)) {
          walls.push({ x, y, hp: this.wallHp.get(key) });
          break;
        }
      }
    }
    return walls;
  }

  /**
   * Pick the best wall for an enemy to attack (closest to the enemy).
   */
  getNearestAttackableWall(fromX, fromY) {
    const walls = this.getAttackableWalls();
    if (walls.length === 0) return null;

    let best = null;
    let bestDist = Infinity;
    for (const w of walls) {
      const d = Math.abs(w.x - fromX) + Math.abs(w.y - fromY);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    return best;
  }

  _floodReachableFromSpawns() {
    const visited = new Set();
    const queue = [];

    for (const s of this.spawns) {
      if (this.isWalkable(s.x, s.y)) {
        const k = `${s.x},${s.y}`;
        visited.add(k);
        queue.push(s);
      }
    }

    while (queue.length > 0) {
      const cur = queue.shift();
      for (const dir of DIRS) {
        const nx = cur.x + dir.dx;
        const ny = cur.y + dir.dy;
        const k = `${nx},${ny}`;
        if (visited.has(k)) continue;
        if (!this.isWalkable(nx, ny)) continue;
        visited.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
    return visited;
  }

  // ─────────────────────────────────────────────
  // Debug / utility
  // ─────────────────────────────────────────────

  /** Returns a simple string representation for console */
  toString() {
    const symbols = {
      [TILE.EMPTY]: '.',
      [TILE.PATH]: '·',
      [TILE.WALL]: '#',
      [TILE.SPAWN]: 'S',
      [TILE.ORB]: 'O',
      [TILE.TOWER]: 'T',
      [TILE.AMPLIFIER]: 'A',
      [TILE.TRAP]: 'x',
    };
    let out = '';
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        out += symbols[this.tiles[y][x]] ?? '?';
      }
      out += '\n';
    }
    return out;
  }
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let key = `${current.x},${current.y}`;
  while (cameFrom.has(key)) {
    current = cameFrom.get(key);
    path.unshift(current);
    key = `${current.x},${current.y}`;
  }
  return path;
}

// ─────────────────────────────────────────────
// Example starter map (for testing)
// ─────────────────────────────────────────────

/**
 * Creates a simple test map with one path that can be blocked.
 * Layout legend:
 *   . = EMPTY
 *   · = PATH
 *   S = SPAWN
 *   O = ORB
 */
export function createTestMap() {
  // 12x8 example
  const W = 14;
  const H = 10;
  const layout = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));

  // Horizontal main path
  for (let x = 1; x <= 12; x++) {
    layout[4][x] = TILE.PATH;
    layout[5][x] = TILE.PATH;
  }

  // Vertical branch
  for (let y = 2; y <= 7; y++) {
    layout[y][6] = TILE.PATH;
    layout[y][7] = TILE.PATH;
  }

  // Spawn left
  layout[4][0] = TILE.SPAWN;
  layout[5][0] = TILE.SPAWN;
  layout[4][1] = TILE.PATH;
  layout[5][1] = TILE.PATH;

  // Orb right
  layout[4][13] = TILE.ORB;
  layout[5][13] = TILE.ORB;
  layout[4][12] = TILE.PATH;
  layout[5][12] = TILE.PATH;

  return new GameMap(W, H, layout);
}
