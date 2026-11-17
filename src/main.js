import { GEM_TYPES, createGem, getGemStats, GEM_TYPE_LIST } from './gems.js';
import { GameMap, TILE, createTestMap } from './map.js';
import { Enemy, ENEMY_STATE } from './enemy.js';
import { TerrainLayer, DECOR_TYPES } from './terrain.js';

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

// La galería de fichas es opcional: la interfaz móvil usa el selector del menú flotante.
if (grid) GEM_TYPE_LIST.forEach(id => grid.appendChild(renderGemCard(id)));

// ─────────────────────────────────────────────
// Map demo (portrait 15×20)
// ─────────────────────────────────────────────
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const placedTowers = new Map();
let buildSelection = null;
let selectedGemType = 'yellow';
let selectedGemGrade = 1;
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

// ── Oleadas ─────────────────────────────────────
const WAVE_TOTAL = 12;
const waves = Array.from({ length: WAVE_TOTAL }, (_, i) => ({
  number: i + 1,
  count: 5 + i * 2,
  hp: 35 + i * 13,
  speed: 2.15 + Math.min(i * 0.045, 0.5),
  damage: 8 + Math.floor(i * 1.3),
}));
let currentWave = 0;
let waveState = 'ready'; // ready | running | complete
let spawnRemaining = 0;
let spawnTimer = 0;
let waveResolved = 0;

// Combate visual de torres: proyectiles, estelas e impactos.
const towerCooldowns = new Map();
const projectiles = [];
const impactParticles = [];


// Gnoll sprite (subí el archivo en assets/enemies/Gnoll.png)
const gnollImage = new Image();
let gnollImageReady = false;
gnollImage.onload = () => { gnollImageReady = true; };
gnollImage.src = 'assets/enemies/Gnoll.png';

const TILE_SIZE = 32;

function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function drawStoneFloor(px, py, x, y) {
  const h = tileHash(x, y);
  const shade = 13 + Math.floor(h * 8);
  ctx.fillStyle = `rgb(${shade},${shade - 2},${shade + 6})`;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = 'rgba(0,0,0,.48)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + .5, py + .5, TILE_SIZE - 1, TILE_SIZE - 1);
  if (h > .68) {
    ctx.strokeStyle = 'rgba(0,0,0,.52)';
    ctx.beginPath();
    const sx = px + tileHash(y, x) * TILE_SIZE;
    const sy = py + tileHash(x + 9, y) * TILE_SIZE;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (h - .68) * 34, sy + (tileHash(x, y + 3) - .5) * 18);
    ctx.stroke();
  }
}

function drawWall(x, y) {
  const px = x * TILE_SIZE, py = y * TILE_SIZE;
  const hp = map.getWallHp(x, y);
  // Sombra y bloque de piedra con bisel superior.
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(px + 3, py + 4, TILE_SIZE - 5, TILE_SIZE - 5);
  ctx.fillStyle = '#262030';
  ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  ctx.fillStyle = '#393044';
  ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, 6);
  ctx.strokeStyle = '#0c0a10';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 2.5, py + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
  ctx.beginPath();
  ctx.moveTo(px + 2, py + TILE_SIZE / 2);
  ctx.lineTo(px + TILE_SIZE - 2, py + TILE_SIZE / 2);
  ctx.moveTo(px + TILE_SIZE / 2, py + 2);
  ctx.lineTo(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
  ctx.moveTo(px + TILE_SIZE / 4, py + TILE_SIZE / 2);
  ctx.lineTo(px + TILE_SIZE / 4, py + TILE_SIZE - 2);
  ctx.stroke();
  // Grietas sutiles en la piedra.
  if (hp < 75) {
    ctx.strokeStyle = 'rgba(8,6,12,.85)';
    ctx.beginPath();
    ctx.moveTo(px + 9, py + 8); ctx.lineTo(px + 13, py + 15);
    ctx.lineTo(px + 10, py + 22); ctx.stroke();
  }
  ctx.fillStyle = '#08070b';
  ctx.fillRect(px + 5, py + TILE_SIZE - 7, TILE_SIZE - 10, 3);
  ctx.fillStyle = hp > 40 ? '#8aab78' : '#c45e59';
  ctx.fillRect(px + 5, py + TILE_SIZE - 7, (TILE_SIZE - 10) * Math.max(0, hp / 100), 3);
}

function drawGem(c, x, y, radius, color, glow) {
  c.save();
  c.shadowColor = color;
  c.shadowBlur = glow;
  c.beginPath();
  c.moveTo(x, y - radius);
  c.lineTo(x + radius * .8, y);
  c.lineTo(x, y + radius);
  c.lineTo(x - radius * .8, y);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255,255,255,.78)';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,.34)';
  c.beginPath();
  c.moveTo(x, y - radius);
  c.lineTo(x + radius * .8, y);
  c.lineTo(x, y);
  c.closePath();
  c.fill();
  c.restore();
}

function drawTower(x, y, now) {
  const px = x * TILE_SIZE, py = y * TILE_SIZE;
  const cx = px + TILE_SIZE / 2, cy = py + TILE_SIZE / 2;
  const key = `${x},${y}`;
  const gem = placedTowers.get(key);
  ctx.fillStyle = 'rgba(0,0,0,.48)';
  ctx.fillRect(px + 3, py + 4, TILE_SIZE - 5, TILE_SIZE - 5);
  ctx.fillStyle = '#2a2433';
  ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  ctx.strokeStyle = '#4a4058';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 2.5, py + 2.5, TILE_SIZE - 5, TILE_SIZE - 5);
  ctx.fillStyle = '#1b1722';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy + 12);
  ctx.lineTo(cx - 5, cy - 10);
  ctx.lineTo(cx, cy - 15);
  ctx.lineTo(cx + 5, cy - 10);
  ctx.lineTo(cx + 9, cy + 12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#58496a';
  ctx.stroke();
  if (gem) {
    const color = GEM_TYPES[gem.typeId]?.color || '#fff';
    const pulse = 8 + Math.sin(now * .003 + x) * 2;
    drawGem(ctx, cx, cy - 2, 5.5 + gem.grade * .35, color, pulse + gem.grade);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText(String(gem.grade), cx, cy + 13);
  } else {
    ctx.fillStyle = '#08070b';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#58496a';
    ctx.stroke();
  }
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

function draw(now = performance.now()) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.get(x, y);
      const g = terrain.getGround(x, y);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      drawStoneFloor(px, py, x, y);

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
      if (t === TILE.TOWER) drawTower(x, y, now);

      if (t === TILE.WALL) drawWall(x, y);
    }
  }

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

  enemies.forEach((e, index) => {
    if (e.state === ENEMY_STATE.DEAD) return;

    const ex = e.x * TILE_SIZE + TILE_SIZE / 2;
    const ey = e.y * TILE_SIZE + TILE_SIZE / 2;

    // Saltito continuo: se eleva un poco y aumenta suavemente de tamaño.
    const bounce = (Math.sin(now * 0.008 + index * 1.7) + 1) / 2;
    const scale = 1 + bounce * 0.12;
    const lift = bounce * 3.5;

    if (gnollImageReady) {
      const drawWidth = TILE_SIZE * 0.9 * scale;
      const drawHeight = drawWidth * (gnollImage.height / gnollImage.width);
      const feetY = ey + TILE_SIZE * 0.28 - lift;
      ctx.drawImage(
        gnollImage,
        ex - drawWidth / 2,
        feetY - drawHeight,
        drawWidth,
        drawHeight
      );
    } else {
      // Fallback mientras se carga la imagen o si todavía no está subida.
      ctx.beginPath();
      ctx.arc(ex, ey - lift, 10 * scale, 0, Math.PI * 2);
      ctx.fillStyle = e.state === ENEMY_STATE.ATTACKING ? '#e87a6a' : '#7ec8e3';
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Barra de vida
    ctx.fillStyle = '#222';
    ctx.fillRect(ex - 10, ey - 19 - lift, 20, 3);
    ctx.fillStyle = '#6dce8a';
    ctx.fillRect(ex - 10, ey - 19 - lift, 20 * (e.hp / e.maxHp), 3);
  });

  // Proyectiles mágicos con estela y brillo, seguidos de partículas de impacto.
  for (const p of projectiles) {
    ctx.save();
    for (let i = 0; i < p.trail.length; i++) {
      const point = p.trail[i];
      ctx.globalAlpha = (i + 1) / p.trail.length * .42;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.2 + i * .22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const p of impactParticles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function updateCombat(dt) {
  // Cada torre engarzada busca al enemigo más adelantado dentro de su alcance.
  for (const [key, gem] of placedTowers) {
    if (!gem) continue;
    const [tx, ty] = key.split(',').map(Number);
    const towerX = tx * TILE_SIZE + TILE_SIZE / 2;
    const towerY = ty * TILE_SIZE + TILE_SIZE / 2;
    const stats = getGemStats(gem);
    const cooldown = Math.max(0.18, 1 / stats.fireRate);
    const remaining = Math.max(0, (towerCooldowns.get(key) || 0) - dt);
    towerCooldowns.set(key, remaining);
    if (remaining > 0) continue;

    let target = null;
    let bestProgress = -Infinity;
    for (const enemy of enemies) {
      if (enemy.state === ENEMY_STATE.DEAD || enemy.state === ENEMY_STATE.REACHING_ORB) continue;
      const ex = enemy.x * TILE_SIZE + TILE_SIZE / 2;
      const ey = enemy.y * TILE_SIZE + TILE_SIZE / 2;
      if (Math.hypot(ex - towerX, ey - towerY) > stats.range) continue;
      const progress = enemy.path?.length ? enemy.pathIndex / Math.max(1, enemy.path.length) : 0;
      if (progress >= bestProgress) { bestProgress = progress; target = enemy; }
    }
    if (!target) continue;
    towerCooldowns.set(key, cooldown);
    projectiles.push({
      x: towerX, y: towerY - 5, target, gemType: gem.typeId,
      color: GEM_TYPES[gem.typeId]?.color || '#fff',
      damage: (stats.damageMin + stats.damageMax) / 2,
      speed: 250, trail: [],
    });
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const target = p.target;
    if (target.state === ENEMY_STATE.DEAD || target.state === ENEMY_STATE.REACHING_ORB) {
      projectiles.splice(i, 1);
      continue;
    }
    const tx = target.x * TILE_SIZE + TILE_SIZE / 2;
    const ty = target.y * TILE_SIZE + TILE_SIZE / 2;
    const dx = tx - p.x, dy = ty - p.y;
    const distance = Math.hypot(dx, dy);
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 6) p.trail.shift();
    const step = p.speed * dt;
    if (distance <= step + 3) {
      target.takeDamage(p.damage);
      const color = p.color;
      for (let n = 0; n < 7; n++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = 18 + Math.random() * 55;
        impactParticles.push({
          x: tx, y: ty, vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity, life: .22 + Math.random() * .2,
          maxLife: .42, radius: 1.2 + Math.random() * 1.8, color,
        });
      }
      // Efectos distintivos de impacto por familia de gema.
      if (p.gemType === 'blue' || p.gemType === 'cyan') {
        impactParticles.push({ x: tx, y: ty, vx: 0, vy: 0, life: .28, maxLife: .28, radius: 5, color: '#b7efff' });
      }
      projectiles.splice(i, 1);
    } else {
      p.x += dx / distance * step;
      p.y += dy / distance * step;
    }
  }

  for (let i = impactParticles.length - 1; i >= 0; i--) {
    const p = impactParticles[i];
    p.life -= dt;
    p.x += (p.vx || 0) * dt;
    p.y += (p.vy || 0) * dt;
    p.vx = (p.vx || 0) * .92;
    p.vy = (p.vy || 0) * .92;
    if (p.life <= 0) impactParticles.splice(i, 1);
  }
}

function update(dt) {
  if (waveState === 'running') {
    spawnTimer -= dt;
    if (spawnRemaining > 0 && spawnTimer <= 0) {
      const wave = waves[currentWave - 1];
      const spawn = map.spawns[Math.floor(Math.random() * map.spawns.length)] || { x: 7, y: 0 };
      enemies.push(new Enemy({
        x: spawn.x, y: spawn.y, map,
        hp: wave.hp, speed: wave.speed, damage: wave.damage,
      }));
      spawnRemaining--;
      spawnTimer = 0.82;
    }
  }

  for (const e of enemies) e.update(dt);
  updateCombat(dt);

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].state === ENEMY_STATE.DEAD || enemies[i].state === ENEMY_STATE.REACHING_ORB) {
      enemies.splice(i, 1);
      if (waveState === 'running') waveResolved++;
    }
  }

  if (waveState === 'running' && spawnRemaining === 0 && enemies.length === 0) {
    waveState = 'complete';
    renderWavePanel();
  }
  renderWaveProgress();

  const blocked = map.isFullyBlocked();
  statusEl.textContent = blocked ? '¡CAMINO BLOQUEADO!' : 'Path libre';
  statusEl.classList.toggle('blocked', blocked);
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw(now);
  requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = Math.floor(((ev.clientX - rect.left) * scaleX) / TILE_SIZE);
  const y = Math.floor(((ev.clientY - rect.top) * scaleY) / TILE_SIZE);
  if (!map.inBounds(x, y)) return;
  const tile = map.get(x, y);

  if (!buildSelection) {
    if (tile === TILE.WALL) map.removeWall(x, y);
    return;
  }
  if (buildSelection === 'wall') {
    if (tile === TILE.PATH) map.placeWall(x, y, 100);
  } else if (buildSelection === 'tower') {
    if (tile === TILE.EMPTY) {
      map.set(x, y, TILE.TOWER);
      placedTowers.set(`${x},${y}`, null);
    }
  } else if (buildSelection === 'gem') {
    if (tile === TILE.TOWER) {
      placedTowers.set(`${x},${y}`, createGem(selectedGemType, selectedGemGrade));
    }
  }
  draw();
});

// Panel lateral de oleadas, inspirado en la lectura vertical de GemCraft: Labyrinth.
const waveRoot = document.createElement('aside');
waveRoot.id = 'wave-sidebar';
waveRoot.innerHTML = `
  <div class="wave-heading"><span>OLEADAS</span><strong id="wave-current">0 / ${WAVE_TOTAL}</strong></div>
  <div class="wave-current-card">
    <div class="wave-number" id="wave-number">01</div>
    <div class="wave-info"><strong id="wave-title">Preparado</strong><small id="wave-detail">12 oleadas</small></div>
  </div>
  <div class="wave-progress-track"><div id="wave-progress-fill"></div></div>
  <div class="wave-counts"><span id="wave-progress-text">Sin iniciar</span><span id="wave-alive">0 en mapa</span></div>
  <button id="wave-start" type="button">▶ Iniciar oleada</button>
  <div class="wave-list" id="wave-list" aria-label="Lista de oleadas"></div>
`;
document.getElementById('app').appendChild(waveRoot);
const waveStartButton = document.getElementById('wave-start');

function startWave() {
  if (waveState === 'running' || currentWave >= WAVE_TOTAL) return;
  currentWave++;
  const wave = waves[currentWave - 1];
  waveState = 'running';
  spawnRemaining = wave.count;
  waveResolved = 0;
  spawnTimer = 0.15;
  renderWavePanel();
}

function renderWaveProgress() {
  const total = waves[currentWave - 1]?.count ?? 0;
  const progress = total ? Math.min(100, (waveResolved / total) * 100) : 0;
  const fill = document.getElementById('wave-progress-fill');
  const progressText = document.getElementById('wave-progress-text');
  const alive = document.getElementById('wave-alive');
  if (fill) fill.style.width = progress + '%';
  if (progressText) {
    progressText.textContent = waveState === 'ready' ? 'Sin iniciar'
      : waveState === 'running' ? `${waveResolved} / ${total} procesados`
      : 'Oleada finalizada';
  }
  if (alive) alive.textContent = waveState === 'running'
    ? `${enemies.length + spawnRemaining} restantes`
    : `${enemies.length} en mapa`;
}

function renderWavePanel() {
  const current = document.getElementById('wave-current');
  const number = document.getElementById('wave-number');
  const title = document.getElementById('wave-title');
  const detail = document.getElementById('wave-detail');
  const list = document.getElementById('wave-list');
  if (!current || !list) return;
  current.textContent = `${currentWave} / ${WAVE_TOTAL}`;
  number.textContent = String(currentWave || 1).padStart(2, '0');
  title.textContent = waveState === 'running' ? 'En curso'
    : waveState === 'complete' ? 'Finalizada'
    : currentWave === 0 ? 'Preparado' : 'Siguiente';
  detail.textContent = waveState === 'running'
    ? `Oleada ${currentWave} · ${waves[currentWave - 1].count} enemigos`
    : currentWave >= WAVE_TOTAL ? 'Todas completadas' : `${waves[currentWave]?.count ?? waves[0].count} enemigos`;
  waveStartButton.disabled = waveState === 'running' || currentWave >= WAVE_TOTAL;
  waveStartButton.textContent = waveState === 'running' ? 'Oleada en curso'
    : currentWave >= WAVE_TOTAL ? '✓ Campaña completada'
    : waveState === 'complete' ? '▶ Siguiente oleada' : '▶ Iniciar oleada';
  list.innerHTML = waves.map((wave, index) => {
    const state = index < currentWave ? (index === currentWave - 1 && waveState === 'running' ? 'active' : 'done')
      : index === currentWave && waveState !== 'running' ? 'next' : '';
    return `<div class="wave-row ${state}"><span class="wave-dot">${index < currentWave && !(index === currentWave - 1 && waveState === 'running') ? '✓' : wave.number}</span><span>Oleada ${wave.number}</span><small>${wave.count}</small></div>`;
  }).join('');
  renderWaveProgress();
}

waveStartButton.addEventListener('click', startWave);
renderWavePanel();

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


// ─────────────────────────────────────────────
// Mobile construction palette
// ─────────────────────────────────────────────
const buildRoot = document.createElement('div');
buildRoot.id = 'build-ui';
buildRoot.innerHTML = `
  <button id="build-fab" type="button" aria-label="Abrir construcción" aria-expanded="false">＋</button>
  <section id="build-panel" aria-label="Construcción" hidden>
    <div class="build-panel-head"><strong>Construcción</strong><button id="build-close" type="button" aria-label="Cerrar">×</button></div>
    <div class="build-categories">
      <button type="button" data-category="wall">Muros</button>
      <button type="button" data-category="tower">Torres</button>
      <button type="button" data-category="gem">Gemas</button>
    </div>
    <div id="build-options"></div>
    <p id="build-hint">Elegí qué construir y tocá un casillero del mapa.</p>
  </section>`;
document.body.appendChild(buildRoot);
const fab = document.getElementById('build-fab');
const panel = document.getElementById('build-panel');
const options = document.getElementById('build-options');
const hint = document.getElementById('build-hint');
const closeBuild = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); };
fab.addEventListener('click', () => {
  panel.hidden = !panel.hidden;
  fab.setAttribute('aria-expanded', String(!panel.hidden));
});
document.getElementById('build-close').addEventListener('click', closeBuild);

function setBuildCategory(category) {
  buildSelection = category;
  panel.querySelectorAll('[data-category]').forEach(btn => btn.classList.toggle('selected', btn.dataset.category === category));
  options.replaceChildren();
  if (category === 'wall') {
    options.innerHTML = '<button class="build-option selected" data-build="wall">🧱 Muro</button>';
    hint.textContent = 'Tocá un casillero del camino para colocar un muro.';
  } else if (category === 'tower') {
    options.innerHTML = '<button class="build-option selected" data-build="tower">♜ Torre</button>';
    hint.textContent = 'Tocá un terreno libre para construir una torre.';
  } else {
    const gemButtons = GEM_TYPE_LIST.map(id => {
      const g = GEM_TYPES[id];
      return `<button class="gem-choice ${id === selectedGemType ? 'selected' : ''}" data-gem="${id}"><i style="--gem-color:${g.color}"></i><span>${g.nameEs}</span></button>`;
    }).join('');
    options.innerHTML = `<div class="gem-choices">${gemButtons}</div>
      <label class="grade-control">Rango <strong id="grade-value">${selectedGemGrade}</strong>
        <input id="grade-range" type="range" min="1" max="12" value="${selectedGemGrade}">
      </label>`;
    hint.textContent = 'Elegí gema y rango; después tocá una torre vacía para incrustarla.';
    options.querySelectorAll('[data-gem]').forEach(btn => btn.addEventListener('click', () => {
      selectedGemType = btn.dataset.gem;
      options.querySelectorAll('[data-gem]').forEach(b => b.classList.toggle('selected', b === btn));
    }));
    const range = document.getElementById('grade-range');
    range.addEventListener('input', () => {
      selectedGemGrade = Number(range.value);
      document.getElementById('grade-value').textContent = selectedGemGrade;
    });
  }
}
panel.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => setBuildCategory(btn.dataset.category)));
hint.textContent = 'Elegí Muros, Torres o Gemas para comenzar a construir.';

btnWall.classList.add('active');

canvas.width = map.width * TILE_SIZE;
canvas.height = map.height * TILE_SIZE;

requestAnimationFrame(loop);
