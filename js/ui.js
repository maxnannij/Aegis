'use strict';

/* ---------- interfaz ---------- */
function effectText(g){
  const st=gemStats(g);
  switch(g.type){
    case 'fuego': return 'Área '+st.splash.toFixed(1)+' casillas + quemadura';
    case 'hielo': return 'Ralentiza '+Math.round(st.slow*100)+'%';
    case 'veneno': return 'Veneno '+(st.dmg*1.2).toFixed(0)+'/s durante 4s';
    case 'rayo': return 'Salta a '+st.chain+' enemigos más';
    case 'sombra': return '+4% de vida máx. del objetivo';
  }
  return '';
}
function refreshUI(){
  const shop=$('shop');
  if(!shop.children.length){
    for(const k of GKEYS){
      const b=document.createElement('button');
      b.title=GEMS[k].desc;
      b.innerHTML='<span class="dot" style="background:'+GEMS[k].color+'"></span>'+GEMS[k].name;
      b.onclick=()=>buyGem(k);
      shop.appendChild(b);
    }
  }
  const inv=$('inv'); inv.innerHTML='';
  for(const g of S.inv){
    const d=document.createElement('div');
    d.className='gi'+(S.sel.includes(g.id)?' sel':'');
    d.title=GEMS[g.type].name+' nv.'+g.lvl;
    d.innerHTML='<div class="g" style="background:radial-gradient(circle at 35% 30%,#fff8,'+GEMS[g.type].color+' 55%)"></div><span>'+g.lvl+'</span>';
    d.onclick=()=>toggleSel(g.id);
    inv.appendChild(d);
  }
  const a=S.sel.length===2?S.inv.find(g=>g.id===S.sel[0]):null, b=S.sel.length===2?S.inv.find(g=>g.id===S.sel[1]):null;
  $('fuse').classList.toggle('off',!(a&&b&&a.type===b.type&&a.lvl===b.lvl&&a.lvl<MAXLVL));
  const info=$('info'), t=S.selTower;
  if(!t){
    info.innerHTML='<span style="color:var(--dim)">Seleccioná una torre, o colocá una con la herramienta Torre. Después engarzale una gema.</span>';
  } else {
    let h='';
    if(t.gem){
      const st=gemStats(t.gem), G=GEMS[t.gem.type];
      h+='<b style="color:'+G.color+'">'+G.name+' nv.'+t.gem.lvl+'</b><br>Daño '+st.dmg.toFixed(0)+' · '+st.rate.toFixed(2)+'/s · Alcance '+st.range.toFixed(1)+'<br><span style="color:var(--dim)">'+effectText(t.gem)+'</span>';
    } else h+='<span style="color:var(--dim)">Torre vacía. Elegí una gema del inventario y hacé clic en la torre.</span>';
    h+='<div class="row"><button id="bUn">Retirar gema</button><button id="bSell">Vender</button></div>';
    info.innerHTML=h;
    if(t.gem&&t.gem.lvl<MAXLVL) $('bUpgrade').onclick=()=>upgradeSocketedGem(t);
    $('bUn').onclick=()=>unsocket(t);
    $('bSell').onclick=()=>sellTower(t);
  }
}
function updateHud(){
  $('sMana').textContent=Math.floor(S.mana);
  $('sLives').textContent=S.lives;
  $('sWave').textContent=S.wave;
  $('tWall').classList.toggle('off',S.mana<WALL_COST);
  $('tTower').classList.toggle('off',S.mana<TOWER_COST);
  const sh=$('shop').children;
  for(const el of sh) el.classList.toggle('off',S.mana<GEM_COST);
}
