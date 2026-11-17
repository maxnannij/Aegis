/**
 * Aegis - Enemy
 *
 * Behaviour:
 * 1. Tries to follow a path from its current position toward the Orb.
 * 2. If a wall is placed on the remaining path → recalculates immediately.
 * 3. If the map becomes fully blocked → switches to ATTACK mode.
 * 4. In ATTACK mode it moves toward the nearest attackable wall and damages it.
 * 5. When a wall is destroyed, pathfinding is re-enabled automatically.
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

    // Always re-evaluate if the global path situation changed
    const fullyBlocked = this.map.isFullyBlocked();

    if (fullyBlocked) {
      if (this.state !== ENEMY_STATE.ATTACKING) {
        this.state = ENEMY_STATE.ATTACKING;
        this.path = [];
        this.targetWall = null;
      }
      this._updateAttack(dt);
    } else {
      if (this.state === ENEMY_STATE.ATTACKING) {
        // Path reopened → go back to walking
        this.state = ENEMY_STATE.WALKING;
        this.targetWall = null;
        this._recalculatePath();
      }
      this._updateWalking(dt);
    }
  }

  // ── Walking logic ──────────────────────────────
  _updateWalking(dt) {
    // 1. Validate that the remaining path is still walkable.
    //    If a wall was placed on any upcoming tile → force recalculation.
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      if (!this._isRemainingPathValid()) {
        this._recalculatePath();
      }
    }

    // 2. Need a (new) path?
    if (this.path.length === 0 || this.pathIndex >= this.path.length) {
      this._recalculatePath();
      if (this.path.length === 0) {
        // No path available (shouldn't happen if not fully blocked)
        return;
      }
    }

    const target = this.path[this.pathIndex];

    // Extra safety: if the immediate target tile is no longer walkable, repath
    if (!this.map.isWalkable(target.x, target.y)) {
      this._recalculatePath();
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 0.08) {
      // Reached this waypoint
      this.x = target.x;
      this.y = target.y;
      this.pathIndex++;

      // Check if we reached the orb
      if (this.map.orb && this.tileX === this.map.orb.x && this.tileY === this.map.orb.y) {
        this.state = ENEMY_STATE.REACHING_ORB;
      }
      return;
    }

    // Move toward current waypoint
    const step = this.speed * dt;
    if (step >= dist) {
      this.x = target.x;
      this.y = target.y;
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  /**
   * Returns true only if every remaining tile in the current path is still walkable.
   */
  _isRemainingPathValid() {
    for (let i = this.pathIndex; i < this.path.length; i++) {
      const p = this.path[i];
      if (!this.map.isWalkable(p.x, p.y)) {
        return false;
      }
    }
    return true;
  }

  _recalculatePath() {
    const start = { x: this.tileX, y: this.tileY };

    // If we are currently standing on a non-walkable tile (rare), try to snap to nearest walkable
    if (!this.map.isWalkable(start.x, start.y)) {
      // simple fallback: stay and wait (or could search neighbors)
      this.path = [];
      this.pathIndex = 0;
      return;
    }

    const path = this.map.findPath(start, this.map.orb);
    if (path && path.length > 0) {
      this.path = path;
      this.pathIndex = 0;
      // Skip the starting node if we are already on it
      if (path[0].x === this.tileX && path[0].y === this.tileY) {
        this.pathIndex = 1;
      }
    } else {
      this.path = [];
      this.pathIndex = 0;
    }
  }

  // ── Attack logic (when fully blocked) ──────────
  _updateAttack(dt) {
    // Acquire target wall if needed
    if (!this.targetWall || this.map.get(this.targetWall.x, this.targetWall.y) !== 2 /* WALL */) {
      this.targetWall = this.map.getNearestAttackableWall(this.tileX, this.tileY);
      if (!this.targetWall) return; // no walls left to attack?
    }

    const tx = this.targetWall.x;
    const ty = this.targetWall.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);

    // Move next to the wall (adjacent tile)
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
        // Path may now be open – next update will handle it
      }
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
