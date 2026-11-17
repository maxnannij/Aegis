/**
 * Aegis - Enemy
 *
 * Behaviour (priority order):
 * 1. If this enemy can still reach the Orb from its CURRENT position → walk toward it.
 * 2. Only if it is trapped (no path from its position) → switch to ATTACK mode
 *    and damage the walls that are blocking ITS way.
 * 3. Never go backwards to attack a wall if a forward path still exists.
 */

export const ENEMY_STATE = {
  WALKING: 'walking',
  ATTACKING: 'attacking',
  REACHING_ORB: 'reaching_orb',
  DEAD: 'dead',
};

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
    this.x = x;          // floating position (can be between tiles)
    this.y = y;
    this.map = map;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.damage = damage;
    this.attackInterval = attackInterval;

    this.state = ENEMY_STATE.WALKING;
    this.path = [];          // remaining path points
    this.pathIndex = 0;
    this.targetWall = null;  // {x,y} when attacking
    this.attackCooldown = 0;
    this.id = crypto.randomUUID?.() ?? `e-${Date.now()}-${Math.random()}`;
  }

  get tileX() { return Math.round(this.x); }
  get tileY() { return Math.round(this.y); }

  /** Called every frame */
  update(dt) {
    if (this.state === ENEMY_STATE.DEAD) return;

    // ── Core decision: can THIS enemy reach the orb from here? ──
    const canReachOrb = this._canReachOrbFromHere();

    if (canReachOrb) {
      // Always prefer advancing
      if (this.state === ENEMY_STATE.ATTACKING) {
        this.state = ENEMY_STATE.WALKING;
        this.targetWall = null;
        this.path = [];
        this.pathIndex = 0;
      }
      this._updateWalking(dt);
    } else {
      // Trapped → attack the walls that block THIS enemy
      if (this.state !== ENEMY_STATE.ATTACKING) {
        this.state = ENEMY_STATE.ATTACKING;
        this.path = [];
        this.targetWall = null;
      }
      this._updateAttack(dt);
    }
  }

  /** Returns true if there is a walkable path from current tile to the orb. */
  _canReachOrbFromHere() {
    if (!this.map.orb) return false;
    const start = { x: this.tileX, y: this.tileY };
    if (!this.map.isWalkable(start.x, start.y)) return false;
    return this.map.findPath(start, this.map.orb) !== null;
  }

  // ── Walking logic ──────────────────────────────
  _updateWalking(dt) {
    // Validate remaining path is still walkable
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      if (!this._isRemainingPathValid()) {
        this._recalculatePath();
      }
    }

    // Need a (new) path?
    if (this.path.length === 0 || this.pathIndex >= this.path.length) {
      this._recalculatePath();
      if (this.path.length === 0) {
        // Should not happen if canReachOrb was true, but safety
        return;
      }
    }

    const target = this.path[this.pathIndex];

    // Extra safety
    if (!this.map.isWalkable(target.x, target.y)) {
      this._recalculatePath();
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.08) {
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;

      if (this.map.orb && this.tileX === this.map.orb.x && this.tileY === this.map.orb.y) {
        this.state = ENEMY_STATE.REACHING_ORB;
      }
      return;
    }

    const step = this.speed * dt;
    if (step >= dist) {
      this.x = target.x;
      this.y = target.y;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  _isRemainingPathValid() {
    for (let i = this.pathIndex; i < this.path.length; i++) {
      const p = this.path[i];
      if (!this.map.isWalkable(p.x, p.y)) return false;
    }
    return true;
  }

  _recalculatePath() {
    const start = { x: this.tileX, y: this.tileY };

    if (!this.map.isWalkable(start.x, start.y)) {
      this.path = [];
      this.pathIndex = 0;
      return;
    }

    const path = this.map.findPath(start, this.map.orb);
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

  // ── Attack logic (only when THIS enemy is trapped) ──────────
  _updateAttack(dt) {
    // Find walls that block THIS enemy (critical from its perspective)
    if (!this.targetWall || this.map.get(this.targetWall.x, this.targetWall.y) !== 2) {
      this.targetWall = this._getBestWallToAttack();
      if (!this.targetWall) return;
    }

    const tx = this.targetWall.x;
    const ty = this.targetWall.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);

    // Move next to the wall
    if (dist > 1.15) {
      const step = this.speed * dt;
      this.x += (dx / dist) * Math.min(step, dist - 1.0);
      this.y += (dy / dist) * Math.min(step, dist - 1.0);
      return;
    }

    // In range → attack
    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      const destroyed = this.map.damageWall(tx, ty, this.damage);
      this.attackCooldown = this.attackInterval;

      if (destroyed) {
        this.targetWall = null;
        // Next frame will check if path opened
      }
    }
  }

  /**
   * Prefer walls that are critical blockers for THIS enemy
   * (removing them opens a path from the enemy's current position to the orb).
   * Fallback to global critical walls if needed.
   */
  _getBestWallToAttack() {
    // First try walls that would open a path FROM THIS ENEMY
    const localCritical = this.map.getCriticalWallsFrom(this.tileX, this.tileY);
    if (localCritical.length > 0) {
      return this._pickClosest(localCritical);
    }

    // Fallback: global critical walls (from spawns)
    const global = this.map.getAttackableWalls();
    if (global.length > 0) {
      return this._pickClosest(global);
    }

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

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = ENEMY_STATE.DEAD;
    }
  }
}
