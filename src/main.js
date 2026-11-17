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
const towerCooldowns = new Map();
const playerGems = [];
const GEM_COST = 25, WALL_COST = 4, TOWER_COST = 30, INVENTORY_LIMIT = 24;
let gold = 120, nextGemId = 1, selectedInventoryGem = null, selectedInventoryGem2 = null;
let selectedTowerKey = null;
let buildSelection = null;
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
const projectiles = [];
const impactParticles = [];
const lightningBolts = [];


// Gnoll sprite (subí el archivo en assets/enemies/Gnoll.png)
const gnollImage = new Image();
let gnollImageReady = false;
gnollImage.onload = () => { gnollImageReady = true; };
gnollImage.src = 'assets/enemies/Gnoll.png';

const TILE_SIZE = 32;

// Cámara independiente del mundo: desplazamiento en píxeles del canvas y zoom uniforme.
const camera = { x: 0, y: 0, zoom: 1 };
let gameStarted = false;

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

// Camino de los enemigos: losas más claras y gastadas que el suelo edificable.
function drawPathTile(px, py, x, y) {
  const h = tileHash(x + 41, y + 17);
  const base = 29 + Math.floor(h * 10);
  ctx.fillStyle = `rgb(${base},${base - 2},${base + 3})`;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  // Borde interior de losas y juntas oscuras.
  ctx.strokeStyle = 'rgba(0,0,0,.72)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  ctx.strokeStyle = 'rgba(150,133,111,.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);

  // Desgaste irregular, pequeñas fisuras y marcas de tránsito.
  ctx.strokeStyle = 'rgba(5,4,7,.48)';
  ctx.beginPath();
  if (h > .25) {
    ctx.moveTo(px + 5 + h * 8, py + 8);
    ctx.lineTo(px + 12 + h * 5, py + 14);
    ctx.lineTo(px + 9 + h * 9, py + 21);
  } else {
    ctx.moveTo(px + 19, py + 7);
    ctx.lineTo(px + 15, py + 13);
    ctx.lineTo(px + 22, py + 25);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(190,166,132,.08)';
  ctx.fillRect(px + 6, py + 6, TILE_SIZE - 12, 2);
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
  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.get(x, y);
      const g = terrain.getGround(x, y);
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (t === TILE.PATH || t === TILE.SPAWN || t === TILE.ORB || t === TILE.TRAP) drawPathTile(px, py, x, y);
      else drawStoneFloor(px, py, x, y);

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
    ctx.strokeStyle = 'rgba(190, 157, 105, 0.22)';
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
      // El archivo original mira hacia la derecha; se rota según el rumbo del enemigo.
      const drawWidth = TILE_SIZE * 0.9 * 1.2 * scale;
      const drawHeight = drawWidth * (gnollImage.height / gnollImage.width);
      const feetY = ey + TILE_SIZE * 0.28 - lift;
      ctx.save();
      ctx.translate(ex, feetY - drawHeight / 2);
      ctx.rotate(e.facingAngle || 0);
      ctx.drawImage(gnollImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
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
  // Descargas visuales de la gema Tormenta.
  for(const bolt of lightningBolts){ctx.save();ctx.globalAlpha=Math.max(0,bolt.life/bolt.maxLife);ctx.strokeStyle=bolt.color;ctx.shadowColor='#ffe94a';ctx.shadowBlur=12;ctx.lineWidth=2.5;ctx.beginPath();bolt.points.forEach((point,index)=>{if(index===0)ctx.moveTo(point.x,point.y);else{const prev=bolt.points[index-1],mx=(prev.x+point.x)/2+(Math.random()-.5)*14,my=(prev.y+point.y)/2+(Math.random()-.5)*14;ctx.lineTo(mx,my);ctx.lineTo(point.x,point.y);}});ctx.stroke();ctx.restore();}
  for (const p of impactParticles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}


function setBuildHint(message) {
  const el = document.getElementById('build-hint');
  if (el) el.textContent = message;
}
function updateGoldHud() {
  const el = document.getElementById('gold-value');
  if (el) el.textContent = String(Math.floor(gold));
  document.querySelectorAll('[data-cost]').forEach(b => b.classList.toggle('unaffordable', gold < Number(b.dataset.cost)));
}
function canFuseSelectedGems() {
  const a = playerGems.find(g => g.id === selectedInventoryGem);
  const b = playerGems.find(g => g.id === selectedInventoryGem2);
  return !!(a && b && a.id !== b.id && a.typeId === b.typeId && a.grade === b.grade && a.grade < 8);
}
function renderGemInventory() {
  const inventory = document.getElementById('gem-inventory');
  const count = document.getElementById('gem-count');
  const fuseButton = document.getElementById('gem-fuse');
  if (!inventory) return;
  inventory.replaceChildren();
  if (count) count.textContent = playerGems.length + '/' + INVENTORY_LIMIT;
  for (const gem of playerGems) {
    const type = GEM_TYPES[gem.typeId] || GEM_TYPES[(gem.types || [])[0]];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-gem' + ((selectedInventoryGem === gem.id || selectedInventoryGem2 === gem.id) ? ' selected' : '');
    button.title = (type ? type.nameEs : 'Gema') + ' · nivel ' + gem.grade;
    button.style.setProperty('--gem-color', type ? type.color : '#fff');
    button.innerHTML = '<i></i><span>' + gem.grade + '</span>';
    button.addEventListener('click', () => {
      if (!selectedInventoryGem) selectedInventoryGem = gem.id;
      else if (selectedInventoryGem === gem.id) {
        selectedInventoryGem = null;
        selectedInventoryGem2 = null;
      } else if (!selectedInventoryGem2) selectedInventoryGem2 = gem.id;
      else {
        selectedInventoryGem = gem.id;
        selectedInventoryGem2 = null;
      }
      if (selectedTowerKey && selectedInventoryGem && !selectedInventoryGem2) {
        if (socketGemOnTower(selectedTowerKey)) { draw(); return; }
      }
      renderGemInventory();
      setBuildHint(selectedInventoryGem2 ? 'Dos gemas seleccionadas. Fusioná si son del mismo tipo y nivel.' :
        selectedInventoryGem ? 'Gema seleccionada: elegí una torre vacía para engarzarla.' :
        'Seleccioná una gema del inventario.');
    });
    inventory.appendChild(button);
  }
  if (!playerGems.length) {
    const empty = document.createElement('small');
    empty.className = 'inventory-empty';
    empty.textContent = 'Todavía no tenés gemas.';
    inventory.appendChild(empty);
  }
  if (fuseButton) fuseButton.disabled = !canFuseSelectedGems();
}
function forgeGem(typeId) {
  if (playerGems.length >= INVENTORY_LIMIT) { setBuildHint('Inventario lleno (máximo 24 gemas).'); return; }
  if (gold < GEM_COST) { setBuildHint('Oro insuficiente para forjar una gema.'); return; }
  gold -= GEM_COST;
  const gem = createGem(typeId, 1);
  gem.id = 'aegis-gem-' + nextGemId++;
  playerGems.push(gem);
  selectedInventoryGem = gem.id;
  selectedInventoryGem2 = null;
  renderGemInventory();
  updateGoldHud();
}
function fuseSelectedGems() {
  if (!canFuseSelectedGems()) { setBuildHint('Seleccioná dos gemas del mismo tipo y nivel.'); return; }
  const a = playerGems.find(g => g.id === selectedInventoryGem);
  const b = playerGems.find(g => g.id === selectedInventoryGem2);
  const high = createGem(a.typeId, a.grade + 1);
  high.id = 'aegis-gem-' + nextGemId++;
  const ai = playerGems.indexOf(a), bi = playerGems.indexOf(b);
  playerGems.splice(Math.max(ai, bi), 1);
  playerGems.splice(Math.min(ai, bi), 1);
  playerGems.push(high);
  selectedInventoryGem = high.id;
  selectedInventoryGem2 = null;
  renderGemInventory();
  setBuildHint('¡Gema de nivel ' + high.grade + ' creada!');
}
function socketGemOnTower(key) {
  if (!selectedInventoryGem) return false;
  const gem = playerGems.find(g => g.id === selectedInventoryGem);
  if (!gem) return false;
  if (placedTowers.get(key)) { setBuildHint('Esta torre ya tiene una gema.'); return true; }
  placedTowers.set(key, gem);
  playerGems.splice(playerGems.indexOf(gem), 1);
  selectedInventoryGem = null;
  selectedInventoryGem2 = null;
  renderGemInventory();
  setBuildHint('Gema engarzada. La torre ya puede atacar.');
  return true;
}
function sellTowerAt(x, y) {
  const key = x + ',' + y;
  if (map.get(x, y) !== TILE.TOWER) return false;
  const gem = placedTowers.get(key);
  if (gem && playerGems.length >= INVENTORY_LIMIT) { setBuildHint('Inventario lleno: no se puede recuperar la gema.'); return true; }
  if (gem) playerGems.push(gem);
  placedTowers.delete(key);
  towerCooldowns.delete(key);
  map.set(x, y, TILE.EMPTY);
  gold += Math.floor(TOWER_COST * 0.6);
  if (selectedTowerKey === key) selectedTowerKey = null;
  renderGemInventory();
  updateGoldHud();
  return true;
}
function rewardEnemy(enemy) {
  if (enemy._goldRewarded) return;
  enemy._goldRewarded = true;
  gold += Math.round(4 + currentWave * 0.8);
  updateGoldHud();
}

function applyGemHit(p) {
  const target=p.target, stats=p.stats, damage=p.damage, type=p.gemType;
  const x=target.x*TILE_SIZE+TILE_SIZE/2, y=target.y*TILE_SIZE+TILE_SIZE/2;
  const hit=(e,n)=>{if(e&&e.state!==ENEMY_STATE.DEAD&&e.state!==ENEMY_STATE.REACHING_ORB)e.takeDamage(n);};
  const burst=(px,py,color,count)=>{for(let n=0;n<count;n++){const a=Math.random()*Math.PI*2,s=18+Math.random()*80;impactParticles.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.22+Math.random()*.2,maxLife:.42,radius:1.2+Math.random()*1.8,color});}};
  switch(type){
    case 'fuego':
      for(const e of enemies){if(e===target||e.state===ENEMY_STATE.DEAD||e.state===ENEMY_STATE.REACHING_ORB)continue;const ex=e.x*TILE_SIZE+TILE_SIZE/2,ey=e.y*TILE_SIZE+TILE_SIZE/2;if(Math.hypot(ex-x,ey-y)<=stats.splash*TILE_SIZE)hit(e,damage*.6);}
      hit(target,damage);target._burn={time:3,dps:damage*.3};burst(x,y,'#ff8a3a',14);break;
    case 'hielo':
      hit(target,damage);target._slow={time:2,factor:1-stats.slow};burst(x,y,'#9fe6ff',5);impactParticles.push({x,y,vx:0,vy:0,life:.3,maxLife:.3,radius:7,color:'#b8efff'});break;
    case 'veneno':
      hit(target,damage);target._poison={time:4,dps:damage*1.2};burst(x,y,'#7dff4a',5);break;
    case 'rayo': {
      hit(target,damage);const points=[{x,y}],struck=new Set([target]);let current=target;
      for(let n=0;n<stats.chain;n++){let next=null,nearest=2.5*TILE_SIZE;const cx=current.x*TILE_SIZE+TILE_SIZE/2,cy=current.y*TILE_SIZE+TILE_SIZE/2;for(const e of enemies){if(struck.has(e)||e.state===ENEMY_STATE.DEAD||e.state===ENEMY_STATE.REACHING_ORB)continue;const ex=e.x*TILE_SIZE+TILE_SIZE/2,ey=e.y*TILE_SIZE+TILE_SIZE/2,d=Math.hypot(ex-cx,ey-cy);if(d<nearest){nearest=d;next=e;}}if(!next)break;struck.add(next);hit(next,damage*.8);points.push({x:next.x*TILE_SIZE+TILE_SIZE/2,y:next.y*TILE_SIZE+TILE_SIZE/2});current=next;}
      lightningBolts.push({points,life:.18,maxLife:.18,color:'#fff6a0'});break;}
    case 'sombra':
      hit(target,damage+Math.min(target.maxHp*.04,damage*10));burst(x,y,'#b36bff',8);impactParticles.push({x,y,vx:0,vy:0,life:.32,maxLife:.32,radius:9,color:'#b36bff'});break;
  }
}

function updateCombat(dt) {
  // Efectos persistentes: quemadura, veneno y ralentización.
  for(const e of enemies){
    if(e._baseSpeed==null)e._baseSpeed=e.speed;let factor=1;
    if(e._slow&&e._slow.time>0){e._slow.time-=dt;factor=e._slow.factor;if(e._slow.time<=0)e._slow=null;}
    e.speed=e._baseSpeed*factor;
    for(const key of ['_burn','_poison']){const fx=e[key];if(!fx||fx.time<=0||e.state===ENEMY_STATE.DEAD)continue;const elapsed=Math.min(dt,fx.time);e.takeDamage(fx.dps*elapsed);fx.time-=dt;if(fx.time<=0)e[key]=null;}
  }
  for(const [key,gem] of placedTowers){
    if(!gem)continue;const [tx,ty]=key.split(',').map(Number),towerX=tx*TILE_SIZE+TILE_SIZE/2,towerY=ty*TILE_SIZE+TILE_SIZE/2;
    const stats=getGemStats(gem),cooldown=Math.max(.18,1/stats.fireRate),remaining=Math.max(0,(towerCooldowns.get(key)||0)-dt);towerCooldowns.set(key,remaining);if(remaining>0)continue;
    let target=null,bestProgress=-Infinity;
    for(const e of enemies){if(e.state===ENEMY_STATE.DEAD||e.state===ENEMY_STATE.REACHING_ORB)continue;const ex=e.x*TILE_SIZE+TILE_SIZE/2,ey=e.y*TILE_SIZE+TILE_SIZE/2;if(Math.hypot(ex-towerX,ey-towerY)>stats.range)continue;const progress=e.path?.length?e.pathIndex/Math.max(1,e.path.length):0;if(progress>=bestProgress){bestProgress=progress;target=e;}}
    if(!target)continue;towerCooldowns.set(key,cooldown);projectiles.push({x:towerX,y:towerY-5,target,gemType:gem.typeId,color:GEM_TYPES[gem.typeId].color,damage:(stats.damageMin+stats.damageMax)/2,stats,speed:430,trail:[]});
  }
  for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i],e=p.target;if(e.state===ENEMY_STATE.DEAD||e.state===ENEMY_STATE.REACHING_ORB){projectiles.splice(i,1);continue;}const tx=e.x*TILE_SIZE+TILE_SIZE/2,ty=e.y*TILE_SIZE+TILE_SIZE/2,dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy);p.trail.push({x:p.x,y:p.y});if(p.trail.length>6)p.trail.shift();const step=p.speed*dt;if(d<=step+4){applyGemHit(p);const color=p.color;for(let n=0;n<7;n++){const a=Math.random()*Math.PI*2,s=18+Math.random()*55;impactParticles.push({x:tx,y:ty,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.22+Math.random()*.2,maxLife:.42,radius:1.2+Math.random()*1.8,color});}projectiles.splice(i,1);}else{p.x+=dx/d*step;p.y+=dy/d*step;}}
  for(let i=impactParticles.length-1;i>=0;i--){const p=impactParticles[i];p.life-=dt;p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;p.vx=(p.vx||0)*.92;p.vy=(p.vy||0)*.92;if(p.life<=0)impactParticles.splice(i,1);}
  for(let i=lightningBolts.length-1;i>=0;i--){lightningBolts[i].life-=dt;if(lightningBolts[i].life<=0)lightningBolts.splice(i,1);}
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
    if (enemies[i].state === ENEMY_STATE.DEAD) rewardEnemy(enemies[i]);
    if (enemies[i].state === ENEMY_STATE.DEAD || enemies[i].state === ENEMY_STATE.REACHING_ORB) {
      enemies.splice(i, 1);
      if (waveState === 'running') waveResolved++;
    }
  }

  if (waveState === 'running' && spawnRemaining === 0 && enemies.length === 0) {
    waveState = 'complete';
    gold += 10 + currentWave * 2;
    updateGoldHud();
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
  if (gameStarted) update(dt);
  draw(now);
  function zoomAtCenter(factor) {
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const worldX = (cx - camera.x) / camera.zoom, worldY = (cy - camera.y) / camera.zoom;
  camera.zoom = Math.max(.55, Math.min(2.8, camera.zoom * factor));
  camera.x = cx - worldX * camera.zoom; camera.y = cy - worldY * camera.zoom;
  clampCamera();
}
document.getElementById('zoom-in').addEventListener('click', () => zoomAtCenter(1.2));
document.getElementById('zoom-out').addEventListener('click', () => zoomAtCenter(1 / 1.2));
document.getElementById('zoom-reset').addEventListener('click', () => { camera.x = 0; camera.y = 0; camera.zoom = 1; });

document.getElementById('start-game').addEventListener('click', () => {
  gameStarted = true;
  document.getElementById('start-menu').hidden = true;
  canvas.focus?.();
});

requestAnimationFrame(loop);
}

function canvasWorldPoint(ev) {
  const rect = canvas.getBoundingClientRect();
  const sx = (ev.clientX - rect.left) * canvas.width / rect.width;
  const sy = (ev.clientY - rect.top) * canvas.height / rect.height;
  return { x: (sx - camera.x) / camera.zoom, y: (sy - camera.y) / camera.zoom };
}
function handleMapClick(ev) {
  const point = canvasWorldPoint(ev);
  const x = Math.floor(point.x / TILE_SIZE), y = Math.floor(point.y / TILE_SIZE);
  if (!map.inBounds(x, y)) return;
  const tile = map.get(x, y), key = x + ',' + y;
  if (ev.button === 2) {
    if (tile === TILE.WALL && map.removeWall(x, y)) { gold += 2; updateGoldHud(); }
    else if (tile === TILE.TOWER) sellTowerAt(x, y);
    draw(); return;
  }
  showTileActions(tile, x, y, key);
}

canvas.addEventListener('contextmenu', ev => ev.preventDefault());

// Gestos móviles: un dedo selecciona casilleros; dos dedos desplazan y pellizcan.
// El arrastre con un solo dedo nunca mueve la cámara ni construye accidentalmente.
const activePointers = new Map();
let gestureState = null;
let suppressNextTap = false;

function clampCamera() {
  const minX = canvas.width * (1 - camera.zoom);
  const minY = canvas.height * (1 - camera.zoom);
  camera.x = Math.min(0, Math.max(minX, camera.x));
  camera.y = Math.min(0, Math.max(minY, camera.y));
}
function getTouchPair() {
  return [...activePointers.values()].slice(0, 2);
}
function beginPinch() {
  const pair = getTouchPair();
  if (pair.length < 2) return;
  const [a,b] = pair;
  const mid = { x:(a.x+b.x)/2, y:(a.y+b.y)/2 };
  const rect = canvas.getBoundingClientRect();
  const px = (mid.x-rect.left)*canvas.width/rect.width;
  const py = (mid.y-rect.top)*canvas.height/rect.height;
  gestureState = {
    type:'pinch',
    distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),
    zoom:camera.zoom,
    worldX:(px-camera.x)/camera.zoom,
    worldY:(py-camera.y)/camera.zoom
  };
  suppressNextTap = true;
}
canvas.addEventListener('pointerdown', ev => {
  if (!gameStarted) return;
  ev.preventDefault();
  if (ev.pointerType === 'mouse' && ev.button !== 0 && ev.button !== 1 && ev.button !== 2) return;
  canvas.setPointerCapture(ev.pointerId);
  activePointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,startX:ev.clientX,startY:ev.clientY,button:ev.button,pointerType:ev.pointerType,moved:false});
  if (activePointers.size === 2 && ev.pointerType !== 'mouse') beginPinch();
  else if (activePointers.size === 1) {
    const p=activePointers.get(ev.pointerId);
    gestureState={type:(ev.pointerType==='mouse'&&ev.button===1)?'pan':'tap',id:ev.pointerId};
  } else {
    gestureState={type:'ignore'};
    suppressNextTap=true;
  }
});
canvas.addEventListener('pointermove', ev => {
  const p=activePointers.get(ev.pointerId);
  if (!p) return;
  const prevX=p.x,prevY=p.y;
  p.x=ev.clientX;p.y=ev.clientY;
  if(Math.hypot(p.x-p.startX,p.y-p.startY)>8)p.moved=true;

  if(activePointers.size>=2){
    const pair=getTouchPair();
    if(!gestureState||gestureState.type!=='pinch')beginPinch();
    if(pair.length>=2&&gestureState?.type==='pinch'){
      const [a,b]=pair,rect=canvas.getBoundingClientRect();
      const midX=((a.x+b.x)/2-rect.left)*canvas.width/rect.width;
      const midY=((a.y+b.y)/2-rect.top)*canvas.height/rect.height;
      const distance=Math.max(1,Math.hypot(b.x-a.x,b.y-a.y));
      camera.zoom=Math.max(.55,Math.min(2.8,gestureState.zoom*distance/gestureState.distance));
      camera.x=midX-gestureState.worldX*camera.zoom;
      camera.y=midY-gestureState.worldY*camera.zoom;
      clampCamera();
    }
    suppressNextTap=true;
    return;
  }
  if(!gestureState||gestureState.id!==ev.pointerId)return;
  if(gestureState.type==='pan'){
    const rect=canvas.getBoundingClientRect();
    camera.x+=(p.x-prevX)*canvas.width/rect.width;
    camera.y+=(p.y-prevY)*canvas.height/rect.height;
    clampCamera();
  }else if(gestureState.type==='tap'&&p.moved){
    // Arrastrar con un dedo en modo construcción cancela el toque; no mueve ni construye.
    gestureState.type='cancel';
    suppressNextTap=true;
  }
});
function finishPointer(ev,cancelled=false){
  const p=activePointers.get(ev.pointerId);
  if(!p)return;
  const wasMultiTouch=activePointers.size>1||gestureState?.type==='pinch'||gestureState?.type==='ignore';
  activePointers.delete(ev.pointerId);
  if(wasMultiTouch)suppressNextTap=true;
  if(gestureState?.id===ev.pointerId||activePointers.size===0){
    if(!cancelled&&!wasMultiTouch&&gestureState?.type==='tap'&&!p.moved&&!suppressNextTap){
      handleMapClick({clientX:ev.clientX,clientY:ev.clientY,button:p.button});
    }
    gestureState=null;
  }
  if(activePointers.size===1&&wasMultiTouch){
    const remaining=[...activePointers.entries()][0];
    gestureState={type:'cancel',id:remaining[0]};
  }
  if(activePointers.size===0){
    if(canvas.hasPointerCapture(ev.pointerId))canvas.releasePointerCapture(ev.pointerId);
    suppressNextTap=false;
  }
}
canvas.addEventListener('pointerup',ev=>finishPointer(ev,false));
canvas.addEventListener('pointercancel',ev=>finishPointer(ev,true));
canvas.addEventListener('lostpointercapture',ev=>finishPointer(ev,true));
canvas.addEventListener('wheel',ev=>{
  if(!gameStarted)return;
  ev.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const px=(ev.clientX-rect.left)*canvas.width/rect.width;
  const py=(ev.clientY-rect.top)*canvas.height/rect.height;
  const worldX=(px-camera.x)/camera.zoom,worldY=(py-camera.y)/camera.zoom;
  camera.zoom=Math.max(.55,Math.min(2.8,camera.zoom*Math.exp(-ev.deltaY*.0012)));
  camera.x=px-worldX*camera.zoom;camera.y=py-worldY*camera.zoom;
  clampCamera();
},{passive:false});

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
const goldHud = document.createElement('div');
goldHud.id = 'gold-hud';
goldHud.innerHTML = '<span class="gold-icon">◆</span><span>ORO</span><strong id="gold-value">120</strong>';
document.getElementById('app').appendChild(goldHud);
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
    <div id="context-title" class="context-title" hidden></div>
    <div id="build-options"></div>
    <div id="selected-tower-actions" hidden>
      <button id="sell-selected-tower" type="button">Vender torre · +18 oro</button>
    </div>
    <div id="gem-forge" hidden>
      <div class="forge-title">Forja · 25 de oro</div>
      <div id="gem-shop" class="gem-choices"></div>
      <div class="forge-title">Inventario <span id="gem-count">0/24</span></div>
      <div id="gem-inventory"></div>
      <button id="gem-fuse" type="button" disabled>Fusionar 2 gemas iguales</button>
    </div>
    <p id="build-hint">Elegí Muros, Torres o Gemas para comenzar a construir.</p>
  </section>`;
document.body.appendChild(buildRoot);
const fab = document.getElementById('build-fab');
const panel = document.getElementById('build-panel');
const options = document.getElementById('build-options');
const hint = document.getElementById('build-hint');
const closeBuild = () => { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); };
document.getElementById('sell-selected-tower').addEventListener('click', () => {
  if (!selectedTowerKey) return;
  const coords = selectedTowerKey.split(',').map(Number);
  if (sellTowerAt(coords[0], coords[1])) {
    selectedTowerKey = null;
    document.getElementById('selected-tower-actions').hidden = true;
    draw();
  }
});
fab.addEventListener('click', () => {
  panel.hidden = !panel.hidden;
  fab.setAttribute('aria-expanded', String(!panel.hidden));
});
document.getElementById('build-close').addEventListener('click', closeBuild);

function setBuildCategory(category) {
  buildSelection = category;
  panel.querySelectorAll('[data-category]').forEach(btn => btn.classList.toggle('selected', btn.dataset.category === category));
  options.replaceChildren();
  const forge = document.getElementById('gem-forge');
  forge.hidden = category !== 'gem';
  if (category === 'wall') {
    options.innerHTML = '<button class="build-option selected" data-cost="4">🧱 Muro · 4 oro</button>';
    hint.textContent = 'Tocá un casillero del camino para colocar un muro. Clic derecho para venderlo por 2.';
  } else if (category === 'tower') {
    options.innerHTML = '<button class="build-option selected" data-cost="30">♜ Torre · 30 oro</button>';
    hint.textContent = 'Tocá un terreno libre para construir una torre. Clic derecho para venderla por 18.';
  } else {
    hint.textContent = 'Forjá gemas por 25 de oro, seleccioná una y tocá una torre vacía para engarzarla.';
    const shop = document.getElementById('gem-shop');
    shop.replaceChildren();
    for (const id of GEM_TYPE_LIST) {
      const g = GEM_TYPES[id];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gem-choice';
      button.dataset.cost = GEM_COST;
      button.innerHTML = '<i style="--gem-color:' + g.color + '"></i><span>' + g.nameEs + ' · 25 oro</span>';
      button.addEventListener('click', () => forgeGem(id));
      shop.appendChild(button);
    }
    document.getElementById('gem-fuse').onclick = fuseSelectedGems;
    renderGemInventory();
  }
  updateGoldHud();
}
panel.querySelectorAll('[data-category]').forEach(btn => btn.addEventListener('click', () => setBuildCategory(btn.dataset.category)));

function showTileActions(tile, x, y, key) {
  const categories = panel.querySelector('.build-categories');
  const title = document.getElementById('context-title');
  const sellActions = document.getElementById('selected-tower-actions');
  const forge = document.getElementById('gem-forge');
  const addAction = (label, action, disabled = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'build-option';
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', action);
    options.appendChild(button);
  };
  const openPanel = () => { panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); };
  selectedTowerKey = null;
  buildSelection = null;
  options.replaceChildren();
  forge.hidden = true;
  sellActions.hidden = true;
  categories.hidden = true;
  title.hidden = false;

  if (tile === TILE.PATH) {
    title.textContent = 'Camino · ¿Qué querés colocar?';
    addAction('🧱 Colocar muro · 4 oro', () => {
      if (gold < WALL_COST) { setBuildHint('Oro insuficiente para construir un muro.'); return; }
      if (map.placeWall(x, y, 100)) { gold -= WALL_COST; updateGoldHud(); setBuildHint('Muro colocado.'); draw(); closeBuild(); }
    }, gold < WALL_COST);
  } else if (tile === TILE.EMPTY) {
    title.textContent = 'Terreno · ¿Qué querés colocar?';
    addAction('♜ Colocar torre · 30 oro', () => {
      if (gold < TOWER_COST) { setBuildHint('Oro insuficiente para construir una torre.'); return; }
      map.set(x, y, TILE.TOWER); placedTowers.set(key, null); gold -= TOWER_COST;
      updateGoldHud(); setBuildHint('Torre construida. Tocala para engarzar una gema.'); draw(); closeBuild();
    }, gold < TOWER_COST);
  } else if (tile === TILE.TOWER) {
    selectedTowerKey = key;
    const gem = placedTowers.get(key);
    title.textContent = gem ? 'Torre con gema' : 'Torre vacía';
    if (gem) {
      addAction('💎 Quitar gema (devolver al inventario)', () => {
        if (playerGems.length >= INVENTORY_LIMIT) { setBuildHint('Inventario lleno: no se puede recuperar la gema.'); return; }
        playerGems.push(gem); placedTowers.set(key, null); renderGemInventory();
        setBuildHint('Gema devuelta al inventario.'); draw(); closeBuild();
      }, playerGems.length >= INVENTORY_LIMIT);
      addAction('✖ Destruir gema', () => {
        placedTowers.set(key, null); setBuildHint('Gema destruida.'); draw(); closeBuild();
      });
    } else {
      addAction('💎 Colocar gema', () => {
        forge.hidden = false;
        const shop = document.getElementById('gem-shop');
        shop.replaceChildren();
        for (const id of GEM_TYPE_LIST) {
          const g = GEM_TYPES[id], button = document.createElement('button');
          button.type = 'button'; button.className = 'gem-choice'; button.dataset.cost = GEM_COST;
          button.innerHTML = '<i style="--gem-color:' + g.color + '"></i><span>' + g.nameEs + ' · 25 oro</span>';
          button.addEventListener('click', () => forgeGem(id));
          shop.appendChild(button);
        }
        renderGemInventory();
        setBuildHint('Elegí una gema del inventario para engarzarla, o forjá una nueva.');
      }, !playerGems.length && gold < GEM_COST);
    }
    sellActions.hidden = false;
    document.getElementById('sell-selected-tower').textContent = 'Destruir torre · recuperar 18 oro';
  } else if (tile === TILE.WALL) {
    title.textContent = 'Muro';
    addAction('Quitar muro · recuperar 2 oro', () => {
      if (map.removeWall(x, y)) { gold += 2; updateGoldHud(); setBuildHint('Muro retirado.'); draw(); closeBuild(); }
    });
  } else {
    title.textContent = 'Casillero no edificable';
    setBuildHint('No se puede construir en este casillero.');
  }
  updateGoldHud();
  openPanel();
}

hint.textContent = 'Tocá un camino para colocar un muro o terreno para construir una torre.';


btnWall.classList.add('active');
updateGoldHud();
renderGemInventory();

canvas.width = map.width * TILE_SIZE;
canvas.height = map.height * TILE_SIZE;

requestAnimationFrame(loop);
