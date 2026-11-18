'use strict';

/* ---------- eventos ---------- */
function cellFrom(ev){
  const r=cv.getBoundingClientRect();
  return {x:Math.floor((ev.clientX-r.left)*W/r.width/CS),y:Math.floor((ev.clientY-r.top)*H/r.height/CS)};
}
const mobileQuery=window.matchMedia('(max-width: 900px) and (pointer: coarse)');
function isMobileMode(){return mobileQuery.matches;}
function syncMobileOrientation(){
  document.body.classList.toggle('mobile-portrait',isMobileMode()&&window.matchMedia('(orientation: portrait)').matches);
}
mobileQuery.addEventListener?.('change',syncMobileOrientation);
window.addEventListener('orientationchange',syncMobileOrientation);
window.addEventListener('resize',syncMobileOrientation);
syncMobileOrientation();
let painting=false;
function closeCellMenu(){ $('cellMenu').classList.remove('open'); $('cellMenu').innerHTML=''; }
function showCellMenu(c,ev){
  const menu=$('cellMenu');menu.innerHTML='';
  const add=(label,fn,disabled=false)=>{
    const b=document.createElement('button');b.textContent=label;b.disabled=disabled;
    b.onclick=()=>{fn();closeCellMenu();};menu.appendChild(b);
  };
  const v=S.grid[c.y][c.x];
  if(v===0){
    const valid=canBlock(c.x,c.y);
    add('Construir muro · 4 maná',()=>placeWall(c.x,c.y),!valid||S.mana<WALL_COST);
    add('Construir torre · 30 maná',()=>{if(placeTower(c.x,c.y))openTowerDrawer(towerAt(c.x,c.y));},!valid||S.mana<TOWER_COST);
  }else if(v===1){
    add('Vender muro · +2 maná',()=>removeAt(c.x,c.y));
  }
  add('Cancelar',()=>{});
  menu.classList.add('open');
  const x=ev.clientX,y=ev.clientY,w=210,h=menu.offsetHeight||150;
  menu.style.left=Math.max(8,Math.min(window.innerWidth-w-8,x))+'px';
  menu.style.top=Math.max(8,Math.min(window.innerHeight-h-8,y))+'px';
}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',ev=>{
  if(S.over) return;
  const c=cellFrom(ev);
  if(c.x<0||c.y<0||c.x>=COLS||c.y>=ROWS) return;
  if(isMobileMode()){
    ev.preventDefault();closeCellMenu();
    if(S.grid[c.y][c.x]===2){openTowerDrawer(towerAt(c.x,c.y));return;}
    closeTowerDrawer();
    showCellMenu(c,ev);return;
  }
  if(ev.button===2){removeAt(c.x,c.y);return;}
  leftClick(c.x,c.y);
  if(S.tool==='wall') painting=true;
});
cv.addEventListener('pointermove',ev=>{
  const c=cellFrom(ev); S.hv=c;
  if(painting&&S.tool==='wall'&&c.x>=0&&c.y>=0&&c.x<COLS&&c.y<ROWS&&S.grid[c.y][c.x]===0) placeWall(c.x,c.y);
});
cv.addEventListener('pointerleave',()=>{S.hv=null;});
window.addEventListener('pointerup',()=>{painting=false;});

$('tCursor').onclick=()=>setTool('cursor');
$('tWall').onclick=()=>setTool('wall');
$('tTower').onclick=()=>setTool('tower');
$('tSell').onclick=()=>setTool('sell');
$('fuse').onclick=fuse;
$('mobileFuse').onclick=()=>{fuse();renderMobileDrawer();};
$('bWave').onclick=startWave;
$('bAdvance').onclick=advanceWave;
$('mBuild').onclick=()=>{S.selTower=null;openTowerDrawer(null);};
$('mWaveStart').onclick=startWave;
$('mAdvance').onclick=advanceWave;
$('mSpeed').onclick=()=>{S.speed=S.speed%3+1;};
$('drawerClose').onclick=closeTowerDrawer;
$('drawerShade').onclick=closeTowerDrawer;
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('#cellMenu')&&!e.target.closest('#c')) closeCellMenu();
});
$('bSpeed').onclick=()=>{S.speed=S.speed%3+1;$('bSpeed').textContent='x'+S.speed;};
$('bPause').onclick=()=>{S.paused=!S.paused;};
$('auto').onchange=e=>{S.auto=e.target.checked;};
$('again').onclick=newGame;
window.addEventListener('keydown',e=>{
  if(e.key==='1') setTool('wall');
  else if(e.key==='2') setTool('tower');
  else if(e.key==='3'||e.key==='Escape'){setTool('cursor');S.sel=[];refreshUI();}
  else if(e.key===' '){e.preventDefault();startWave();}
  else if(e.key==='p'||e.key==='P') S.paused=!S.paused;
  else if(e.key==='f'||e.key==='F') fuse();
  else if(e.key==='Escape'){closeCellMenu();closeTowerDrawer();}
});
