import { GEM_TYPES, createGem, getGemStats, GEM_TYPE_LIST } from './gems.js';
import { GameMap, TILE, createTestMap } from './map.js';
import { Enemy, ENEMY_STATE } from './enemy.js';

// ─────────────────────────────────────────────
// Gem design cards (unchanged)
// ─────────────────────────────────────────────
const grid = document.getElementById('gem-grid');

function renderGemCard(typeId) {
  const type = GEM_TYPES[typeId];
  const gem = createGem(typeId, 1);
  const stats = getGemStats(gem);

  const card = document.createElement('div');
  card.className = 'gem-card';

  const visual = document.createElement('div');
  visual.className = 'gem-visual grade-1';
  visual.style.background = type.color;
  visual.textContent = '1';

  const name = document.createElement('div');
  name.className = 'gem-name';
  name.textContent = type.nameEs;

  const colorName = document.createElement('div');
  colorName.className = 'gem-color-name';
  colorName.textContent = type.colorName;

  const desc = document.createElement('div');
  desc.className = 'gem-desc';
  desc.textContent = type.description;

  const statsEl = document.createElement('div');
  statsEl.className = 'gem-stats';
  statsEl.innerHTML = `Daño ${stats.damageMin}-${stats.damageMax} · Rango ${stats.range} · ${stats.fireRate}/s`;

  card.append(visual, name, colorName, desc, statsEl);
  return card;
}

GEM_TYPE_LIST.forEach(id => grid.appendChild(renderGemCard(id)));

// ─────────────────────────────────────────────
// Map demo
// ─────────────────────────────────────────────
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const btnWall = document.getElementById('btn-toggle-wall');
const btnSpawn = document.getElementById('btn-spawn');
const btnClear = document.getElementById('btn-clear-walls');

const map = createTestMap();
const enemies = [];
let placeWallMode = true;
let lastTime = performance.now();

const TILE_SIZE = 48;
const COLORS = {
  [TILE.EMPTY]: '#1c1a16',
  [TILE.PATH]: '#3a342c',
  [TILE.WALL]: '#6b4e3d',
  [TILE.SPAWN]: '#2d4a3e',
  [TILE.ORB]: '#4a2d3e',
  [TILE.TRAP]: '#3a342c',
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Tiles
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.get(x, y);
      ctx.fillStyle = COLORS[t] ?? '#111';
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      // Grid lines
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      // Labels
      if (t === TILE.SPAWN) {
        ctx.fillStyle = '#6dce8a';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('S', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2 + 5);
      }
      if (t === TILE.ORB) {
        ctx.fillStyle = '#e87a9a';
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('O', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2 + 5);
      }
      if (t === TILE.WALL) {
        const hp = map.getWallHp(x, y);
        ctx.fillStyle = '#c4a484';
        ctx.fillRect(x * TILE_SIZE + 6, y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12);
        // HP bar
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(x * TILE_SIZE + 8, y * TILE_SIZE + TILE_SIZE - 12, TILE_SIZE - 16, 5);
        ctx.fillStyle = hp > 40 ? '#6dce8a' : '#e87a6a';
        ctx.fillRect(x * TILE_SIZE + 8, y * TILE_SIZE + TILE_SIZE - 12, (TILE_SIZE - 16) * (hp / 100), 5);
      }
    }
  }

  // Draw current path of first enemy (debug)
  if (enemies.length > 0 && enemies[0].path?.length) {
    ctx.strokeStyle = 'rgba(109, 206, 138, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const p0 = enemies[0].path[0];
    ctx.moveTo(p0.x * TILE_SIZE + TILE_SIZE / 2, p0.y * TILE_SIZE + TILE_SIZE / 2);
    for (let i = 1; i < enemies[0].path.length; i++) {
      const p = enemies[0].path[i];
      ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.stroke();
  }

  // Enemies
  for (const e of enemies) {
    if (e.state === ENEMY_STATE.DEAD) continue;

    const px = e.x * TILE_SIZE + TILE_SIZE / 2;
    const py = e.y * TILE_SIZE + TILE_SIZE / 2;

    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    ctx.fillStyle = e.state === ENEMY_STATE.ATTACKING ? '#e87a6a' : '#7ec8e3';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();

    // small HP bar
    ctx.fillStyle = '#222';
    ctx.fillRect(px - 12, py - 22, 24, 4);
    ctx.fillStyle = '#6dce8a';
    ctx.fillRect(px - 12, py - 22, 24 * (e.hp / e.maxHp), 4);
  }
}

function update(dt) {
  for (const e of enemies) {
    e.update(dt);
  }
  // remove dead
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].state === ENEMY_STATE.DEAD || enemies[i].state === ENEMY_STATE.REACHING_ORB) {
      enemies.splice(i, 1);
    }
  }

  // Status
  const blocked = map.isFullyBlocked();
  statusEl.textContent = blocked ? '¡CAMINO BLOQUEADO! Enemigos atacan muros' : 'Path libre';
  statusEl.classList.toggle('blocked', blocked);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ── Interactions ──
canvas.addEventListener('click', (ev) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((ev.clientX - rect.left) * scaleX) / TILE_SIZE);
  const y = Math.floor(((ev.clientY - rect.top) * scaleY) / TILE_SIZE);

  if (!map.inBounds(x, y)) return;

  if (placeWallMode) {
    if (map.get(x, y) === TILE.PATH) {
      map.placeWall(x, y, 100);
    } else if (map.get(x, y) === TILE.WALL) {
      map.removeWall(x, y);
    }
  }
});

btnWall.addEventListener('click', () => {
  placeWallMode = !placeWallMode;
  btnWall.textContent = placeWallMode ? 'Modo: Colocar Muro' : 'Modo: Solo mirar';
  btnWall.classList.toggle('active', placeWallMode);
});

btnSpawn.addEventListener('click', () => {
  const spawn = map.spawns[0] || { x: 0, y: 4 };
  const e = new Enemy({
    x: spawn.x,
    y: spawn.y,
    map,
    hp: 40,
    speed: 2.2,
    damage: 12,
  });
  enemies.push(e);
});

btnClear.addEventListener('click', () => {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) === TILE.WALL) map.removeWall(x, y);
    }
  }
});

// Start with wall mode active
btnWall.classList.add('active');

// Resize canvas to fit map
canvas.width = map.width * TILE_SIZE;
canvas.height = map.height * TILE_SIZE;

requestAnimationFrame(loop);

console.log('Aegis map logic ready');
console.log(map.toString());
