'use strict';

/* ---------- construcción ---------- */
function setTool(t){
  if(S) S.tool=t;
  $('tCursor').classList.toggle('on',t==='cursor');
  $('tWall').classList.toggle('on',t==='wall');
  $('tTower').classList.toggle('on',t==='tower');
}
function towerAt(x,y){return S.towers.find(t=>t.cx===x&&t.cy===y);}
function placeWall(x,y){
  if(S.mana<WALL_COST){say('Maná insuficiente.');return false;}
  if(!canBlock(x,y)){return false;}
  S.grid[y][x]=1; S.mana-=WALL_COST; recompute(); return true;
}
function placeTower(x,y){
  if(S.mana<TOWER_COST){say('Maná insuficiente.');return false;}
  if(!canBlock(x,y)){return false;}
  S.grid[y][x]=2; S.mana-=TOWER_COST;
  const t={cx:x,cy:y,px:x*CS+CS/2,py:y*CS+CS/2,gem:null,cd:0,ang:0};
  S.towers.push(t); S.selTower=t; recompute(); refreshUI(); return true;
}
function removeAt(x,y){
  const v=S.grid[y][x];
  if(v===1){S.grid[y][x]=0; S.mana+=2; recompute();}
  else if(v===2){const t=towerAt(x,y); if(t) sellTower(t);}
}
function leftClick(x,y){
  if(x<0||y<0||x>=COLS||y>=ROWS||S.over) return;
  if(S.grid[y][x]===2){
    const t=towerAt(x,y);
    if(S.sel.length===1) socket(t); else {S.selTower=t; refreshUI();}
    return;
  }
  if(S.tool==='wall') placeWall(x,y);
  else if(S.tool==='tower') placeTower(x,y);
  else {S.selTower=null; refreshUI();}
}
