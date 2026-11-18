'use strict';

/* ---------- estado ---------- */
function newGame(){
  S={mana:120,lives:20,wave:0,grid:newGrid(),towers:[],enemies:[],proj:[],parts:[],bolts:[],
     inv:[],sel:[],queue:[],spawnT:0,waveActive:false,over:false,speed:1,paused:false,tool:'cursor',
     auto:$('auto').checked,autoT:0,waveTotal:0,waveSpawned:0,waveDefeated:0,waveLeaked:0,nextId:1,time:0,kills:0,selTower:null,hv:null,dist:null,msgT:0};
  S.dist=bfs(S.grid);
  $('over').style.display='none';
  setTool('cursor');
  refreshUI();
}
function recompute(){S.dist=bfs(S.grid);}

function canBlock(x,y){
  if((x===SP.x&&y===SP.y)||(x===GO.x&&y===GO.y)) return false;
  if(S.grid[y][x]!==0) return false;
  for(const e of S.enemies){
    if(e.dead||e.gone||e.fly) continue;
    const c=enemyCell(e);
    if(c.x===x&&c.y===y) return false;
    if(e.tg&&e.tg.x===x&&e.tg.y===y) return false;
  }
  S.grid[y][x]=1;
  const d=bfs(S.grid);
  let ok=d[SP.y][SP.x]!==Infinity;
  if(ok){
    for(const e of S.enemies){
      if(e.dead||e.gone||e.fly) continue;
      const c=enemyCell(e);
      if(d[c.y][c.x]===Infinity){ok=false;break;}
    }
  }
  S.grid[y][x]=0;
  return ok;
}

function say(t){ $('msg').textContent=t; S.msgT=2.5; }
