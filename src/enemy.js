/**
 * Aegis - Enemy
 *
 * Behaviour (priority order):
 * 1. If this enemy can still reach the Orb from its CURRENT position → walk toward it.
 * 2. Only if it is trapped (no path from its position) → switch to ATTACK mode
 *    and damage the walls that are blocking ITS way.
 * 3. Never go backwards to attack a wall if a forward path still exists.
 * 4. In attack mode enemies STILL only walk on PATH tiles (pathfind to a tile
 *    adjacent to the wall, then attack from there).
 */

export const ENEMY_STATE = {
  WALKING: 'walking',
  ATTACKING: 'attacking',
  REACHING_ORB: 'reaching_orb',
  DEAD: 'dead',
};

const DIRS = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

export class Enemy {
  /**
   * @param {object} opts
   * @param {number} opts.x tile x
   * @param {number} opts.y tile y
   * @param {import('./map.js').GameMap} opts.map
   * @param {number} [opts.hp=30]
   * @param {number} [opts.speed=1.8] tiles per second
   * @param {number} [opts.damage=8] damage to walls per attack
   * @param {number} [opts.attackInterval=0.8] seconds between wall hits
   */
  constructor({ x, y, map, hp = 30, speed = 1.8, damage = 8, attackInterval = 0.8 }) {
    this.x = x;
    this.y = y;
    this.map = map;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.damage = damage;
    this.attackInterval = attackInterval;

    this.state = ENEMY_STATE.WALKING;
    this.path = [];
    this.pathIndex = 0;
    this.targetWall = null;       // {x,y} wall being attacked
    this.attackStandTile = null;  // walkable tile adjacent to the wall
    this.attackCooldown = 0;
    // El sprite base mira hacia la derecha (0 radianes).
    this.facingAngle = 0;
    this.targetFacingAngle = 0;
    this.id = crypto.randomUUID?.() ?? `e-${Date.now()}-${Math.random()}`;
  }

  get tileX() { return Math.round(this.x); }
  get tileY() { return Math.round(this.y); }

  update(dt) {
    if (this.state === ENEMY_STATE.DEAD) return;

    const canReachOrb = this._canReachOrbFromHere();

    if (canReachOrb) {
      if (this.state === ENEMY_STATE.ATTACKING) {
        this.state = ENEMY_STATE.WALKING;
        this.targetWall = null;
        this.attackStandTile = null;
        this.path = [];
        this.pathIndex = 0;
      }
      this._updateWalking(dt);
    } else {
      if (this.state !== ENEMY_STATE.ATTACKING) {
        this.state = ENEMY_STATE.ATTACKING;
        this.path = [];
        this.pathIndex = 0;
        this.targetWall = null;
        this.attackStandTile = null;
      }
      this._updateAttack(dt);
    }
  }

  _canReachOrbFromHere() {
    if (!this.map.orb) return false;
    const start = { x: this.tileX, y: this.tileY };
    if (!this.map.isWalkable(start.x, start.y)) return false;
    return this.map.findPath(start, this.map.orb) !== null;
  }

  // ── Walking toward orb ─────────────────────────
  _updateWalking(dt) {
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      if (!this._isRemainingPathValid()) this._recalculatePathToOrb();
    }

    if (this.path.length === 0 || this.pathIndex >= this.path.length) {
      this._recalculatePathToOrb();
      if (this.path.length === 0) return;
    }

    this._followPath(dt, () => {
      if (this.map.orb && this.tileX === this.map.orb.x && this.tileY === this.map.orb.y) {
        this.state = ENEMY_STATE.REACHING_ORB;
      }
    });
  }

  _recalculatePathToOrb() {
    const start = { x: this.tileX, y: this.tileY };
    if (!this.map.isWalkable(start.x, start.y)) {
      this.path = [];
      this.pathIndex = 0;
      return;
    }
    const path = this.map.findPath(start, this.map.orb);
    this._setPath(path);
  }

  // ── Attack mode (still only on path tiles) ─────
  _updateAttack(dt) {
    // Acquire / refresh target wall
    if (!this.targetWall || this.map.get(this.targetWall.x, this.targetWall.y) !== 2) {
      this.targetWall = this._getBestWallToAttack();
      this.attackStandTile = null;
      this.path = [];
      this.pathIndex = 0;
      if (!this.targetWall) return;
    }

    // Find a walkable tile adjacent to the wall (stand position)
    if (!this.attackStandTile) {
      this.attackStandTile = this._findAdjacentWalkable(this.targetWall.x, this.targetWall.y);
      if (!this.attackStandTile) {
        // No adjacent walkable tile reachable? drop target and retry next frame
        this.targetWall = null;
        return;
      }
    }

    const stand = this.attackStandTile;
    const onStand =
      Math.abs(this.x - stand.x) < 0.15 && Math.abs(this.y - stand.y) < 0.15;

    if (!onStand) {
      // Pathfind to the stand tile (only walkable tiles)
      if (this.path.length === 0 || this.pathIndex >= this.path.length || !this._isRemainingPathValid()) {
        const path = this.map.findPath(
          { x: this.tileX, y: this.tileY },
          stand
        );
        this._setPath(path);
        if (this.path.length === 0) {
          // Can't reach stand tile from here — pick another wall next frame
          this.targetWall = null;
          this.attackStandTile = null;
          return;
        }
      }
      this._followPath(dt);
      return;
    }

    // Standing next to the wall → attack
    this.x = stand.x;
    this.y = stand.y;
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      const destroyed = this.map.damageWall(this.targetWall.x, this.targetWall.y, this.damage);
      this.attackCooldown = this.attackInterval;
      if (destroyed) {
        this.targetWall = null;
        this.attackStandTile = null;
        this.path = [];
        this.pathIndex = 0;
      }
    }
  }

  /** Find a walkable neighbor of (wx,wy) that this enemy can path to. Prefer closest. */
  _findAdjacentWalkable(wx, wy) {
    const candidates = [];
    for (const dir of DIRS) {
      const nx = wx + dir.dx;
      const ny = wy + dir.dy;
      if (!this.map.isWalkable(nx, ny)) continue;
      // Must be reachable from current position
      const path = this.map.findPath({ x: this.tileX, y: this.tileY }, { x: nx, y: ny });
      if (!path) continue;
      candidates.push({ x: nx, y: ny, len: path.length });
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.len - b.len);
    return { x: candidates[0].x, y: candidates[0].y };
  }

  _getBestWallToAttack() {
    const localCritical = this.map.getCriticalWallsFrom(this.tileX, this.tileY);
    if (localCritical.length > 0) return this._pickClosest(localCritical);

    const global = this.map.getAttackableWalls();
    if (global.length > 0) return this._pickClosest(global);

    return null;
  }

  _pickClosest(walls) {
    let best = null;
    let bestDist = Infinity;
    for (const w of walls) {
      const d = Math.abs(w.x - this.tileX) + Math.abs(w.y - this.tileY);
      if (d < bestDist) {
        bestDist = d;
        best = w;
      }
    }
    return best;
  }

  // ── Shared path following ──────────────────────
  _setPath(path) {
    if (path && path.length > 0) {
      this.path = path;
      this.pathIndex = 0;
      if (path[0].x === this.tileX && path[0].y === this.tileY) {
        this.pathIndex = 1;
      }
    } else {
      this.path = [];
      this.pathIndex = 0;
    }
  }

  _isRemainingPathValid() {
    for (let i = this.pathIndex; i < this.path.length; i++) {
      if (!this.map.isWalkable(this.path[i].x, this.path[i].y)) return false;
    }
    return true;
  }

  _followPath(dt, onArriveWaypoint = null) {
    if (this.pathIndex >= this.path.length) return;

    const target = this.path[this.pathIndex];
    if (!this.map.isWalkable(target.x, target.y)) {
      this.path = [];
      this.pathIndex = 0;
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.08) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;
      if (onArriveWaypoint) onArriveWaypoint();
      return;
    }

    // Actualizar orientación hacia el siguiente punto del recorrido.
    this.targetFacingAngle = Math.atan2(dy, dx);
    let angleDelta = this.targetFacingAngle - this.facingAngle;
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    this.facingAngle += angleDelta * Math.min(1, dt * 12);

    const step = this.speed * dt;
    if (step >= dist) {
      this.x = target.x;
      this.y = target.y;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = ENEMY_STATE.DEAD;
    }
  }
}
