'use strict';

/* ---------- gemas ---------- */
function gemStats(g){
  const b=GEMS[g.type], m=Math.pow(2.1,g.lvl-1);
  return {
    dmg:b.dmg*m,
    rate:b.rate*(1+0.05*(g.lvl-1)),
    range:b.range+0.12*(g.lvl-1),
    splash:1.1+0.08*g.lvl,
    slow:Math.min(0.75,0.35+0.05*g.lvl),
    chain:2+Math.floor(g.lvl/2)
  };
}
function buyGem(type){
  if(S.over) return;
  if(S.inv.length>=INV_MAX){say('Inventario lleno.');return;}
  if(S.mana<GEM_COST){say('Maná insuficiente.');return;}
  S.mana-=GEM_COST;
  S.inv.push({id:S.nextId++,type,lvl:1});
  refreshUI();
}
function upgradeSocketedGem(t){
  if(S.over||!t||!t.gem) return;
  if(t.gem.lvl>=MAXLVL){say('La gema ya alcanzó el nivel máximo.');return;}
  const cost=GEM_UPGRADE_BASE_COST*t.gem.lvl;
  if(S.mana<cost){say('Necesitás '+cost+' de maná para mejorar esta gema.');return;}
  S.mana-=cost;
  t.gem.lvl++;
  S.selTower=t;
  say(GEMS[t.gem.type].name+' mejorada a nivel '+t.gem.lvl+' por '+cost+' de maná.');
  refreshUI();
}
function toggleSel(id){
  const i=S.sel.indexOf(id);
  if(i>=0) S.sel.splice(i,1);
  else { S.sel.push(id); if(S.sel.length>2) S.sel.shift(); }
  refreshUI();
}
function fuse(){
  if(S.sel.length!==2){say('Seleccioná dos gemas.');return;}
  const a=S.inv.find(g=>g.id===S.sel[0]), b=S.inv.find(g=>g.id===S.sel[1]);
  if(!a||!b) return;
  if(a.type!==b.type||a.lvl!==b.lvl){say('Deben ser del mismo tipo y nivel.');return;}
  if(a.lvl>=MAXLVL){say('Nivel máximo alcanzado.');return;}
  S.inv=S.inv.filter(g=>g!==a&&g!==b);
  const n={id:S.nextId++,type:a.type,lvl:a.lvl+1};
  S.inv.push(n); S.sel=[n.id];
  refreshUI();
}
function socket(t){
  if(S.sel.length!==1){say('Seleccioná UNA gema del inventario.');return;}
  const g=S.inv.find(x=>x.id===S.sel[0]); if(!g) return;
  S.inv=S.inv.filter(x=>x!==g);
  if(t.gem) S.inv.push(t.gem);
  t.gem=g; S.sel=[]; S.selTower=t;
  refreshUI();
}
function unsocket(t){
  if(!t.gem) return;
  if(S.inv.length>=INV_MAX){say('Inventario lleno.');return;}
  S.inv.push(t.gem); t.gem=null; refreshUI();
}
function sellTower(t){
  if(t.gem&&S.inv.length<INV_MAX) S.inv.push(t.gem);
  else if(t.gem){say('Inventario lleno.');return;}
  S.grid[t.cy][t.cx]=0; S.towers=S.towers.filter(x=>x!==t);
  S.mana+=Math.floor(TOWER_COST*0.6);
  if(S.selTower===t) S.selTower=null;
  recompute(); refreshUI();
}
