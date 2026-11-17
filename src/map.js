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

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

export class GameMap {
  constructor(width, height, layout = null) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.wallHp = new Map();

    for (let y = 0; y < height; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < width; x++) {
        this.tiles[y][x] = TILE.EMPTY;
      }
    }

    if (layout) this.loadLayout(layout);

    this.spawns = [];
    this.orb = null;
    this._findSpecialTiles();
  }

  loadLayout(layout) {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const v = layout[y]?.[x] ?? TILE.EMPTY;
        this.tiles[y][x] = v;
        if (v === TILE.WALL) this.wallHp.set(`${x},${y}`, 100);
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
    if (type === TILE.WALL) this.wallHp.set(key, wallHp);
    else this.wallHp.delete(key);
    if (type === TILE.SPAWN || type === TILE.ORB) this._findSpecialTiles();
    return true;
  }

  isWalkable(x, y) {
    const t = this.get(x, y);
    if (t === null) return false;
    return t === TILE.PATH || t === TILE.SPAWN || t === TILE.ORB || t === TILE.TRAP;
  }

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

  findPath(start, goal) {
    if (!start || !goal) return null;
    if (!this.isWalkable(start.x, start.y) || !this.isWalkable(goal.x, goal.y)) return null;

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
      if (this._wouldOpenPathIfRemoved(wall.x, wall.y)) critical.push(wall);
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
      for (let x = 0; x < this.width; x++) out += symbols[this.tiles[y][x]] ?? '?';
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

/**
 * Portrait test map for mobile: 15 wide × 20 tall
 * Path snakes from top (spawn) to bottom (orb).
 */
export function createTestMap() {
  const W = 15;
  const H = 20;
  const layout = Array.from({ length: H }, () => Array(W).fill(TILE.EMPTY));

  // Helper: fill a horizontal segment
  const hPath = (y, x0, x1) => {
    for (let x = x0; x <= x1; x++) layout[y][x] = TILE.PATH;
  };
  // Helper: fill a vertical segment
  const vPath = (x, y0, y1) => {
    for (let y = y0; y <= y1; y++) layout[y][x] = TILE.PATH;
  };

  // Snake path top → bottom (good for portrait)
  // Start top-center
  hPath(1, 5, 9);
  vPath(5, 1, 4);
  hPath(4, 5, 11);
  vPath(11, 4, 8);
  hPath(8, 3, 11);
  vPath(3, 8, 12);
  hPath(12, 3, 10);
  vPath(10, 12, 16);
  hPath(16, 4, 10);
  vPath(4, 16, 18);
  hPath(18, 4, 10);

  // Make path 2 tiles wide in places for nicer look
  hPath(2, 5, 9);
  vPath(6, 1, 4);
  hPath(5, 5, 11);
  vPath(10, 4, 8);
  hPath(9, 3, 11);
  vPath(4, 8, 12);
  hPath(13, 3, 10);
  vPath(9, 12, 16);
  hPath(17, 4, 10);
  vPath(5, 16, 18);

  // Spawn at top
  layout[0][6] = TILE.SPAWN;
  layout[0][7] = TILE.SPAWN;
  layout[0][8] = TILE.SPAWN;
  layout[1][6] = TILE.PATH;
  layout[1][7] = TILE.PATH;
  layout[1][8] = TILE.PATH;

  // Orb at bottom
  layout[19][6] = TILE.ORB;
  layout[19][7] = TILE.ORB;
  layout[19][8] = TILE.ORB;
  layout[18][6] = TILE.PATH;
  layout[18][7] = TILE.PATH;
  layout[18][8] = TILE.PATH;

  return new GameMap(W, H, layout);
}
