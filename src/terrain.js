/**
 * Aegis - Terrain & Decorations
 *
 * Handles visual layers:
 * - Ground tiles (path / grass / dirt) → can use images later
 * - Decorations (trees, rocks, bushes) with placement rules
 *
 * Large trees:
 * - Center sits on one EMPTY cell
 * - Visual radius covers up to `radius` cells around
 * - Must keep at least `minPathClearance` cells of distance from any PATH/SPAWN/ORB
 *   so branches never overlap the road.
 */

import { TILE } from './map.js';

/** Ground types (visual only, separate from logical TILE) */
export const GROUND = {
  GRASS: 'grass',
  DIRT: 'dirt',
  PATH: 'path',
  STONE: 'stone',
};

/**
 * Decoration definitions.
 * image: path relative to /assets/ (you'll provide the files later)
 * radius: how many cells the visual extends from the center
 * minPathClearance: minimum Chebyshev distance from any path tile
 */
export const DECOR_TYPES = {
  tree_small: {
    id: 'tree_small',
    name: 'Árbol chico',
    image: 'assets/tiles/tree_small.png',
    radius: 1,
    minPathClearance: 1,
    // size in tiles for drawing (width/height of sprite in tile units)
    drawSize: 1.6,
  },
  tree_large: {
    id: 'tree_large',
    name: 'Árbol grande',
    image: 'assets/tiles/tree_large.png',
    radius: 2,
    minPathClearance: 2, // branches cover up to 2 cells → keep 2 away from path
    drawSize: 3.2,
  },
  bush: {
    id: 'bush',
    name: 'Arbusto',
    image: null, // Sprite todavía no disponible; se dibuja con Canvas
    radius: 0,
    minPathClearance: 0,
    drawSize: 1.0,
  },
  rock: {
    id: 'rock',
    name: 'Roca',
    image: null, // Sprite todavía no disponible; se dibuja con Canvas
    radius: 0,
    minPathClearance: 0,
    drawSize: 1.0,
  },
};

export class TerrainLayer {
  /**
   * @param {import('./map.js').GameMap} map
   */
  constructor(map) {
    this.map = map;
    this.width = map.width;
    this.height = map.height;

    // ground[y][x] = GROUND.*
    this.ground = Array.from({ length: this.height }, () =>
      Array(this.width).fill(GROUND.GRASS)
    );

    // decorations: { x, y, typeId }
    this.decorations = [];

    // image cache: typeId → HTMLImageElement | null (null = failed / not loaded)
    this.images = {};
    this._loadState = {}; // 'loading' | 'ok' | 'error'

    this._syncGroundFromMap();
  }

  /** Keep path tiles visually as PATH ground */
  _syncGroundFromMap() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.map.get(x, y);
        if (t === TILE.PATH || t === TILE.SPAWN || t === TILE.ORB || t === TILE.TRAP || t === TILE.WALL) {
          this.ground[y][x] = GROUND.PATH;
        } else if (this.ground[y][x] === GROUND.PATH) {
          // was path before, now empty → grass
          this.ground[y][x] = GROUND.GRASS;
        }
      }
    }
  }

  setGround(x, y, groundType) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.ground[y][x] = groundType;
  }

  getGround(x, y) {
    return this.ground[y]?.[x] ?? null;
  }

  // ─────────────────────────────────────────────
  // Decoration placement rules
  // ─────────────────────────────────────────────

  /**
   * Chebyshev distance (king-move in chess) between two cells.
   */
  static chebyshev(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  }

  /**
   * Returns true if a decoration of the given type can be placed at (x,y).
   * Rules:
   * - Center must be EMPTY (not path/wall/spawn/orb)
   * - Must respect minPathClearance from every PATH/SPAWN/ORB tile
   * - Optional: don't overlap other large decorations too much
   */
  canPlaceDecor(typeId, x, y, { checkOtherDecor = true } = {}) {
    const def = DECOR_TYPES[typeId];
    if (!def) return false;
    if (!this.map.inBounds(x, y)) return false;

    // Center must be buildable empty ground
    const tile = this.map.get(x, y);
    if (tile !== TILE.EMPTY) return false;

    const clearance = def.minPathClearance;

    // Check distance to all path-like tiles
    for (let py = 0; py < this.height; py++) {
      for (let px = 0; px < this.width; px++) {
        const t = this.map.get(px, py);
        if (t === TILE.PATH || t === TILE.SPAWN || t === TILE.ORB || t === TILE.TRAP) {
          const dist = TerrainLayer.chebyshev(x, y, px, py);
          if (dist < clearance) return false;
        }
      }
    }

    // Avoid stacking large trees too close to each other
    if (checkOtherDecor && def.radius >= 1) {
      for (const d of this.decorations) {
        const other = DECOR_TYPES[d.typeId];
        if (!other || other.radius < 1) continue;
        const minSep = Math.max(def.radius, other.radius) + 1;
        if (TerrainLayer.chebyshev(x, y, d.x, d.y) < minSep) return false;
      }
    }

    return true;
  }

  placeDecor(typeId, x, y) {
    if (!this.canPlaceDecor(typeId, x, y)) return false;
    this.decorations.push({ x, y, typeId });
    this._ensureImage(typeId);
    return true;
  }

  removeDecorAt(x, y) {
    const idx = this.decorations.findIndex(d => d.x === x && d.y === y);
    if (idx === -1) return false;
    this.decorations.splice(idx, 1);
    return true;
  }

  /**
   * Auto-fill decorations with the given density (0–1).
   * Tries large trees first, then small, then bushes.
   */
  autoPopulate({ largeTreeChance = 0.04, smallTreeChance = 0.08, bushChance = 0.06 } = {}) {
    this.decorations = [];

    // Large trees first (stricter rules)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (Math.random() < largeTreeChance && this.canPlaceDecor('tree_large', x, y)) {
          this.placeDecor('tree_large', x, y);
        }
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (Math.random() < smallTreeChance && this.canPlaceDecor('tree_small', x, y)) {
          this.placeDecor('tree_small', x, y);
        }
      }
    }

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (Math.random() < bushChance && this.canPlaceDecor('bush', x, y)) {
          this.placeDecor('bush', x, y);
        }
      }
    }
  }

  // ─────────────────────────────────────────────
  // Image loading (ready for when you provide assets)
  // ─────────────────────────────────────────────

  _ensureImage(typeId) {
    if (this._loadState[typeId]) return;
    const def = DECOR_TYPES[typeId];
    if (!def?.image) return;

    this._loadState[typeId] = 'loading';
    const img = new Image();
    img.onload = () => {
      this.images[typeId] = img;
      this._loadState[typeId] = 'ok';
    };
    img.onerror = () => {
      this.images[typeId] = null;
      this._loadState[typeId] = 'error';
    };
    img.src = def.image;
  }

  /** Preload all known decoration images */
  preloadAll() {
    for (const id of Object.keys(DECOR_TYPES)) {
      this._ensureImage(id);
    }
  }

  getImage(typeId) {
    return this.images[typeId] || null;
  }
}
