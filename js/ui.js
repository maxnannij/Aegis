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
      const cost=GEM_UPGRADE_BASE_COST*t.gem.lvl;
      if(t.gem.lvl<MAXLVL){
        h+='<div class="row"><button id="bUpgrade">Mejorar gema · '+cost+' maná</button><button id="bUn">Retirar gema</button><button id="bSell">Vender</button></div>';
      } else {
        h+='<div class="row"><button id="bUpgrade" disabled>Nivel máximo</button><button id="bUn">Retirar gema</button><button id="bSell">Vender</button></div>';
      }
    } else {
      h+='<span style="color:var(--dim)">Torre vacía. Elegí una gema del inventario y hacé clic en la torre.</span>';
      h+='<div class="row"><button id="bSell">Vender</button></div>';
    }
    info.innerHTML=h;
    if(t.gem&&t.gem.lvl<MAXLVL) $('bUpgrade').onclick=()=>upgradeSocketedGem(t);
    if(t.gem) $('bUn').onclick=()=>unsocket(t);
    $('bSell').onclick=()=>sellTower(t);
  }
  renderMobileDrawer();
}
function renderMobileDrawer(){
  const t=S.selTower, info=$('mobileTowerInfo'), gems=$('mobileGemList'), actions=$('mobileTowerActions');
  if(!info||!gems||!actions) return;
  if(!t){info.textContent='Tocá una torre para ver sus opciones.';gems.innerHTML='';actions.innerHTML='';return;}
  if(t.gem){
    const st=gemStats(t.gem), G=GEMS[t.gem.type];
    info.innerHTML='<b style="color:'+G.color+'">'+G.name+' · nivel '+t.gem.lvl+'</b><br>Daño '+st.dmg.toFixed(0)+' · '+st.rate.toFixed(2)+'/s · Alcance '+st.range.toFixed(1)+'<br><span style="color:var(--dim)">'+effectText(t.gem)+'</span>';
  }else info.innerHTML='<span style="color:var(--dim)">Torre vacía. Elegí una gema para engarzarla.</span>';
  gems.innerHTML='';
  for(const g of S.inv){
    const d=document.createElement('div');
    d.className='gi';d.title=GEMS[g.type].name+' nv.'+g.lvl;
    d.innerHTML='<div class="g" style="background:radial-gradient(circle at 35% 30%,#fff8,'+GEMS[g.type].color+' 55%)"></div><span>'+g.lvl+'</span>';
    d.onclick=()=>{S.sel=[g.id];socket(t);openTowerDrawer(t);};
    gems.appendChild(d);
  }
  actions.innerHTML='';
  const add=(label,fn,disabled=false)=>{const b=document.createElement('button');b.textContent=label;b.disabled=disabled;b.onclick=fn;actions.appendChild(b);};
  if(t.gem){
    if(t.gem.lvl<MAXLVL)add('Mejorar gema · '+(GEM_UPGRADE_BASE_COST*t.gem.lvl)+' maná',()=>upgradeSocketedGem(t),S.mana<GEM_UPGRADE_BASE_COST*t.gem.lvl);
    add('Retirar gema',()=>{unsocket(t);openTowerDrawer(t);},S.inv.length>=INV_MAX);
  }
  add('Vender torre · +18 maná',()=>{sellTower(t);closeTowerDrawer();});
}
function openTowerDrawer(t){
  if(t) S.selTower=t;
  refreshUI();
  $('drawerShade').classList.add('open');
  $('towerDrawer').classList.add('open');
}
function closeTowerDrawer(){
  $('drawerShade').classList.remove('open');
  $('towerDrawer').classList.remove('open');
}
function updateHud(){
  $('sMana').textContent=Math.floor(S.mana);
  $('sLives').textContent=S.lives;
  $('sWave').textContent=S.wave;
  $('mMana').textContent=Math.floor(S.mana);
  $('mLives').textContent=S.lives;
  $('mWave').textContent=S.wave;
  const done=S.waveDefeated+S.waveLeaked, total=S.waveTotal;
  const pct=total?Math.max(0,Math.min(100,done/total*100)):0;
  const remaining=S.queue.length+S.enemies.length;
  const label=S.waveActive?'Oleada '+S.wave:(S.wave>0?'Siguiente: '+(S.wave+1):'Preparado');
  const count=total?(done+' / '+total):'0 / 0';
  for(const [id,text] of [['waveProgressLabel',label],['mWaveLabel',label],['waveProgressCount',count],['mWaveCount',count]]){
    const el=$(id);if(el)el.textContent=text;
  }
  for(const id of ['waveProgressFill','mWaveFill']){const el=$(id);if(el)el.style.width=pct+'%';}
  const remainingText=S.waveActive?(remaining+' enemigos restantes'):'Oleada terminada';
  $('waveRemaining').textContent=remainingText;
  $('waveIntermission').textContent=!S.waveActive&&S.wave>0&&S.autoT>0?'Recompensa por adelantar: +'+Math.ceil(S.autoT*2)+' maná':'';
  $('mWaveStart').textContent=S.waveActive?'En curso':'Invocar';
  $('mWaveStart').disabled=S.waveActive;
  $('bWave').disabled=S.waveActive;
  $('bWave').textContent=S.waveActive?'Oleada en curso':'Invocar oleada (Espacio)';
  const canAdvance=!S.waveActive&&S.wave>0&&!S.over;
  const bonus=Math.max(0,Math.ceil(S.autoT*2));
  $('bAdvance').disabled=!canAdvance;
  $('bAdvance').textContent='Adelantar · +'+bonus+' maná';
  $('mAdvance').disabled=!canAdvance;
  $('mAdvance').textContent='Adelantar +'+bonus;
  $('bPause').textContent=S.paused?'▶':'⏸';
  $('mPause').textContent=S.paused?'Continuar':'Pausar';
  $('bPause').title=S.paused?'Continuar':'Pausar';
  $('mSpeed').textContent='x'+S.speed;
  $('tWall').classList.toggle('off',S.mana<WALL_COST);
  $('tTower').classList.toggle('off',S.mana<TOWER_COST);
  const sh=$('shop').children;
  for(const el of sh) el.classList.toggle('off',S.mana<GEM_COST);
}
