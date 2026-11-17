import { GEM_TYPES, createGem, getGemStats, GEM_TYPE_LIST } from './gems.js';
import { GameMap, TILE, createTestMap } from './map.js';
import { Enemy, ENEMY_STATE } from './enemy.js';
import { TerrainLayer, DECOR_TYPES, GROUND } from './terrain.js';

// ─────────────────────────────────────────────
// Gem design cards
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
// Map demo (portrait 15×20)
// ─────────────────────────────────────────────
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const btnWall = document.getElementById('btn-toggle-wall');
const btnSpawn = document.getElementById('btn-spawn');
const btnClear = document.getElementById('btn-clear-walls');

const map = createTestMap();
const terrain = new TerrainLayer(map);
terrain.autoPopulate({ largeTreeChance: 0.035, smallTreeChance: 0.07, bushChance: 0.05 });
terrain.preloadAll();

const enemies = [];
let placeWallMode = true;
let lastTime = performance.now();

// Smaller tiles so 15×20 fits on phone screens
const TILE_SIZE = 32;

const GROUND_COLORS = {
  [GROUND.GRASS]: '#1e2a1a',
  [GROUND.DIRT]: '#2a241c',
  [GROUND.PATH]: '#3d362c',
  [GROUND.STONE]: '#2c2c2c',
};

const TILE_COLORS = {
  [TILE.EMPTY]: null, // use ground
  [TILE.PATH]: '#4a4034',
  [TILE.WALL]: '#6b4e3d',
  [TILE.SPAWN]: '#2d4a3e',
  [TILE.ORB]: '#4a2d3e',
  [TILE.TRAP]: '#4a4034',
};

function drawPlaceholderDecor(d, def) {
  const cx = d.x * TILE_SIZE + TILE_SIZE / 2;
  const cy = d.y * TILE_SIZE + TILE_SIZE / 2;
  const r = (def.drawSize * TILE_SIZE) / 2;

  if (def.id.startsWith('tree')) {
    // trunk
    ctx.fillStyle = '#5c4030';
    ctx.fillRect(cx - 3, cy - r * 0.1, 6, r * 0.7);
    // canopy
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.25, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = def.id === 'tree_large' ? '#2d5a3a' : '#3a6b45';
    ctx.fill();
    // subtle outline of radius (debug, light)
    if (def.radius >= 2) {
      ctx.strokeStyle = 'rgba(45, 90, 58, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, def.radius * TILE_SIZE, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (def.id === 'bush') {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#3d6b40';
    ctx.fill();
  } else if (def.id === 'rock') {
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5a5a55';
    ctx.fill();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Ground + logical tiles
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.get(x, y);
      const g = terrain.getGround(x, y);

      // ground color
      ctx.fillStyle = GROUND_COLORS[g] ?? '#1a1814';
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      // path / special overlay
      if (TILE_COLORS[t]) {
        ctx.fillStyle = TILE_COLORS[t];
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }

      // subtle grid
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

      if (t === TILE.SPAWN) {
        ctx.fillStyle = '#6dce8a';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('S', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2 + 4);
      }
      if (t === TILE.ORB) {
        ctx.fillStyle = '#e87a9a';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('O', x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2 + 4);
      }
      if (t === TILE.WALL) {
        const hp = map.getWallHp(x, y);
        ctx.fillStyle = '#c4a484';
        ctx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(x * TILE_SIZE + 5, y * TILE_SIZE + TILE_SIZE - 9, TILE_SIZE - 10, 4);
        ctx.fillStyle = hp > 40 ? '#6dce8a' : '#e87a6a';
        ctx.fillRect(x * TILE_SIZE + 5, y * TILE_SIZE + TILE_SIZE - 9, (TILE_SIZE - 10) * (hp / 100), 4);
      }
    }
  }

  // 2. Decorations (trees, etc.) — draw after ground so they sit on top
  // Sort by y so lower trees draw on top (simple depth)
  const sortedDecor = [...terrain.decorations].sort((a, b) => a.y - b.y);
  for (const d of sortedDecor) {
    const def = DECOR_TYPES[d.typeId];
    if (!def) continue;

    const img = terrain.getImage(d.typeId);
    if (img) {
      const size = def.drawSize * TILE_SIZE;
      const dx = d.x * TILE_SIZE + TILE_SIZE / 2 - size / 2;
      const dy = d.y * TILE_SIZE + TILE_SIZE / 2 - size * 0.75; // anchor near bottom of cell
      ctx.drawImage(img, dx, dy, size, size);
    } else {
      // Placeholder until you provide the real images
      drawPlaceholderDecor(d, def);
    }
  }

  // 3. Enemy path debug (first enemy)
  if (enemies.length > 0 && enemies[0].path?.length) {
    ctx.strokeStyle = 'rgba(109, 206, 138, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const p0 = enemies[0].path[0];
    ctx.moveTo(p0.x * TILE_SIZE + TILE_SIZE / 2, p0.y * TILE_SIZE + TILE_SIZE / 2);
    for (let i = 1; i < enemies[0].path.length; i++) {
      const p = enemies[0].path[i];
      ctx.lineTo(p.x * TILE_SIZE + TILE_SIZE / 2, p.y * TILE_SIZE + TILE_SIZE / 2);
    }
    ctx.stroke();
  }

  // 4. Enemies
  for (const e of enemies) {
    if (e.state === ENEMY_STATE.DEAD) continue;

    const px = e.x * TILE_SIZE + TILE_SIZE / 2;
    const py = e.y * TILE_SIZE + TILE_SIZE / 2;

    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fillStyle = e.state === ENEMY_STATE.ATTACKING ? '#e87a6a' : '#7ec8e3';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.fillRect(px - 10, py - 16, 20, 3);
    ctx.fillStyle = '#6dce8a';
    ctx.fillRect(px - 10, py - 16, 20 * (e.hp / e.maxHp), 3);
  }
}

function update(dt) {
  for (const e of enemies) e.update(dt);

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].state === ENEMY_STATE.DEAD || enemies[i].state === ENEMY_STATE.REACHING_ORB) {
      enemies.splice(i, 1);
    }
  }

  const blocked = map.isFullyBlocked();
  statusEl.textContent = blocked ? '¡CAMINO BLOQUEADO!' : 'Path libre';
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
    if (map.get(x, y) === TILE.PATH) map.placeWall(x, y, 100);
    else if (map.get(x, y) === TILE.WALL) map.removeWall(x, y);
  }
});

btnWall.addEventListener('click', () => {
  placeWallMode = !placeWallMode;
  btnWall.textContent = placeWallMode ? 'Modo: Colocar Muro' : 'Modo: Solo mirar';
  btnWall.classList.toggle('active', placeWallMode);
});

btnSpawn.addEventListener('click', () => {
  const spawn = map.spawns[Math.floor(Math.random() * map.spawns.length)] || { x: 7, y: 0 };
  enemies.push(new Enemy({
    x: spawn.x,
    y: spawn.y,
    map,
    hp: 40,
    speed: 2.4,
    damage: 12,
  }));
});

btnClear.addEventListener('click', () => {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (map.get(x, y) === TILE.WALL) map.removeWall(x, y);
    }
  }
});

btnWall.classList.add('active');

canvas.width = map.width * TILE_SIZE;
canvas.height = map.height * TILE_SIZE;

requestAnimationFrame(loop);

console.log(`Aegis map ${map.width}×${map.height}`);
console.log(`Decorations: ${terrain.decorations.length}`);
console.log(map.toString());
