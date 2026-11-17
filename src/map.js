/**
 * Aegis - Map & Pathfinding system
 *
 * Rules (GemCraft Labyrinth style):
 * - Enemies only walk on PATH tiles.
 * - Player can place WALL on PATH tiles to force longer routes / redirect.
 * - Each enemy decides independently:
 *     → If it can still reach the Orb from its current position → keep advancing.
 *     → Only if it is trapped → attack walls that block ITS path.
 * - Walls attacked are only *critical blockers* (removing them reopens a path).
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
    this.set(x, y, TILE.PATH);
    return true;
  }

  damageWall(x, y, amount) {
    const key = `${x},${y}`;
    if (!this.wallHp.has(key)) return false;
    let hp = this.wallHp.get(key) - amount;
    if (hp <= 0) {
      this.removeWall(x, y);
      return true;
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
      let currentKey = null;
      let lowestF = Infinity;
      for (const [k] of open) {
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
    return null;
  }

  findAnyPathToOrb() {
    if (!this.orb || this.spawns.length === 0) return null;
    for (const spawn of this.spawns) {
      const path = this.findPath(spawn, this.orb);
      if (path) return path;
    }
    return null;
  }

  isFullyBlocked() {
    return this.findAnyPathToOrb() === null;
  }

  // ─────────────────────────────────────────────
  // Critical walls (per-enemy and global)
  // ─────────────────────────────────────────────

  /**
   * Walls that are critical blockers FROM A SPECIFIC POSITION.
   * Used by an individual enemy that is trapped.
   *
   * A wall is critical for (fromX, fromY) if removing it opens a path
   * from that position to the orb.
   */
  getCriticalWallsFrom(fromX, fromY) {
    if (!this.orb) return [];

    const reachable = this._floodReachableFrom({ x: fromX, y: fromY });
    const candidates = [];

    for (const key of this.wallHp.keys()) {
      const [x, y] = key.split(',').map(Number);
      for (const dir of DIRS) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (reachable.has(`${nx},${ny}`)) {
          candidates.push({ x, y, hp: this.wallHp.get(key) });
          break;
        }
      }
    }

    const critical = [];
    for (const wall of candidates) {
      if (this._wouldOpenPathFromIfRemoved(fromX, fromY, wall.x, wall.y)) {
        critical.push(wall);
      }
    }
    return critical;
  }

  /**
   * Global critical walls (from spawns). Kept for compatibility / status display.
   */
  getAttackableWalls() {
    const reachable = this._floodReachableFromSpawns();
    const candidates = [];

    for (const key of this.wallHp.keys()) {
      const [x, y] = key.split(',').map(Number);
      for (const dir of DIRS) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (reachable.has(`${nx},${ny}`)) {
          candidates.push({ x, y, hp: this.wallHp.get(key) });
          break;
        }
      }
    }

    const critical = [];
    for (const wall of candidates) {
      if (this._wouldOpenPathIfRemoved(wall.x, wall.y)) {
        critical.push(wall);
      }
    }
    return critical;
  }

  _wouldOpenPathIfRemoved(wx, wy) {
    const original = this.tiles[wy][wx];
    this.tiles[wy][wx] = TILE.PATH;
    const opens = this.findAnyPathToOrb() !== null;
    this.tiles[wy][wx] = original;
    return opens;
  }

  _wouldOpenPathFromIfRemoved(fromX, fromY, wx, wy) {
    const original = this.tiles[wy][wx];
    this.tiles[wy][wx] = TILE.PATH;
    const path = this.findPath({ x: fromX, y: fromY }, this.orb);
    this.tiles[wy][wx] = original;
    return path !== null;
  }

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
    return this._floodReachableFromMultiple(this.spawns);
  }

  _floodReachableFrom(start) {
    return this._floodReachableFromMultiple([start]);
  }

  _floodReachableFromMultiple(starts) {
    const visited = new Set();
    const queue = [];

    for (const s of starts) {
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

export function createTestMap() {
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
