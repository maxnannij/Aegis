import { GEM_TYPES, createGem, getGemStats, GEM_TYPE_LIST } from './gems.js';
import { GameMap, TILE, createTestMap } from './map.js';
import { Enemy, ENEMY_STATE } from './enemy.js';
import { TerrainLayer, DECOR_TYPES, GROUND } from './terrain.js';
import { PATH_TEXTURE_DATA_URL } from './path_texture.js';

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

const TILE_SIZE = 32;

// Path cobblestone texture
let pathPattern = null;
const pathImg = new Image();
pathImg.onload = () => {
  // Pattern tiles the image across the canvas
  pathPattern = ctx.createPattern(pathImg, 'repeat');
};
pathImg.src = PATH_TEXTURE_DATA_URL;

const GROUND_COLORS = {
  [GROUND.GRASS]: '#1e2a1a',
  [GROUND.DIRT]: '#2a241c',
  [GROUND.PATH]: '#3d362c',
  [GROUND.STONE]: '#2c2c2c',
};

const TILE_COLORS = {
  [TILE.EMPTY]: null,
  [TILE.PATH]: null, // use texture
  [TILE.WALL]: '#6b4e3d',
  [TILE.SPAWN]: null,
  [TILE.ORB]: null,
  [TILE.TRAP]: null,
};

function isPathLike(t) {
  return t === TILE.PATH || t === TILE.SPAWN || t === TILE.ORB || t === TILE.TRAP || t === TILE.WALL;
}

function drawPlaceholderDecor(d, def) {
  const cx = d.x * TILE_SIZE + TILE_SIZE / 2;
  const cy = d.y * TILE_SIZE + TILE_SIZE / 2;
  const r = (def.drawSize * TILE_SIZE) / 2;

  if (def.id.startsWith('tree')) {
    ctx.fillStyle = '#5c4030';
    ctx.fillRect(cx - 3, cy - r * 0.1, 6, r * 0.7);
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.25, r * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = def.id === 'tree_large' ? '#2d5a3a' : '#3a6b45';
    ctx.fill();
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

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.get(x, y);
      const g = terrain.getGround(x, y);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (isPathLike(t) && pathPattern) {
        // Cobblestone texture for path / spawn / orb / wall base
        ctx.fillStyle = pathPattern;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      } else if (isPathLike(t)) {
        // Texture still loading
        ctx.fillStyle = '#4a4034';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      } else {
        ctx.fillStyle = GROUND_COLORS[g] ?? '#1a1814';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }

      // Subtle grid
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

      // Overlays for special tiles
      if (t === TILE.SPAWN) {
        ctx.fillStyle = 'rgba(109, 206, 138, 0.35)';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#6dce8a';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('S', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 4);
      }
      if (t === TILE.ORB) {
        ctx.fillStyle = 'rgba(232, 122, 154, 0.35)';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#e87a9a';
        ctx.font = 'bold 11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('O', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 4);
      }
      if (t === TILE.WALL) {
        const hp = map.getWallHp(x, y);
        ctx.fillStyle = 'rgba(80, 50, 30, 0.75)';
        ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        ctx.strokeStyle = '#c4a484';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(px + 5, py + TILE_SIZE - 9, TILE_SIZE - 10, 4);
        ctx.fillStyle = hp > 40 ? '#6dce8a' : '#e87a6a';
        ctx.fillRect(px + 5, py + TILE_SIZE - 9, (TILE_SIZE - 10) * (hp / 100), 4);
      }
    }
  }

  // Decorations
  const sortedDecor = [...terrain.decorations].sort((a, b) => a.y - b.y);
  for (const d of sortedDecor) {
    const def = DECOR_TYPES[d.typeId];
    if (!def) continue;
    const img = terrain.getImage(d.typeId);
    if (img) {
      const size = def.drawSize * TILE_SIZE;
      const dx = d.x * TILE_SIZE + TILE_SIZE / 2 - size / 2;
      const dy = d.y * TILE_SIZE + TILE_SIZE / 2 - size * 0.75;
      ctx.drawImage(img, dx, dy, size, size);
    } else {
      drawPlaceholderDecor(d, def);
    }
  }

  // Enemy path debug
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

  // Enemies
  for (const e of enemies) {
    if (e.state === ENEMY_STATE.DEAD) continue;

    const ex = e.x * TILE_SIZE + TILE_SIZE / 2;
    const ey = e.y * TILE_SIZE + TILE_SIZE / 2;

    ctx.beginPath();
    ctx.arc(ex, ey, 10, 0, Math.PI * 2);
    ctx.fillStyle = e.state === ENEMY_STATE.ATTACKING ? '#e87a6a' : '#7ec8e3';
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#222';
    ctx.fillRect(ex - 10, ey - 16, 20, 3);
    ctx.fillStyle = '#6dce8a';
    ctx.fillRect(ex - 10, ey - 16, 20 * (e.hp / e.maxHp), 3);
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

console.log(`Aegis map ${map.width}×${map.height} – cobblestone path texture loaded`);
