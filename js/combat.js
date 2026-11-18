'use strict';

/* ---------- combate ---------- */
function damage(e,a){
  if(e.dead||e.gone) return;
  e.hp-=a; e.flash=0.08;
  if(e.hp<=0){
    e.dead=true; S.mana+=e.reward; S.kills++; S.waveDefeated++;
    burst(e.x,e.y,e.color,e.type==='jefe'?30:10);
  }
}
function burst(x,y,color,n){
  for(let i=0;i<n;i++){
    const a=Math.random()*6.283, s=30+Math.random()*90;
    S.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.4+Math.random()*0.4,max:0.8,color,r:1+Math.random()*2});
  }
}
function progress(e){
  if(e.fly) return Math.hypot(GO.x*CS+CS/2-e.x,GO.y*CS+CS/2-e.y)/CS;
  const c=enemyCell(e); return S.dist[c.y][c.x];
}
function fireTower(t,dt){
  if(!t.gem) return;
  const st=gemStats(t.gem);
  t.cd-=dt; if(t.cd>0) return;
  let best=null, bv=1e9;
  for(const e of S.enemies){
    if(e.dead||e.gone) continue;
    if(Math.hypot(e.x-t.px,e.y-t.py)<=st.range*CS){
      const v=progress(e); if(v<bv){bv=v;best=e;}
    }
  }
  if(!best) return;
  t.cd=1/st.rate;
  t.ang=Math.atan2(best.y-t.py,best.x-t.px);
  S.proj.push({x:t.px,y:t.py-6,tg:best,type:t.gem.type,st,color:GEMS[t.gem.type].color,trail:[]});
}
function applyHit(p){
  const e=p.tg, st=p.st;
  switch(p.type){
    case 'fuego':
      for(const o of S.enemies){
        if(o.dead||o.gone||o===e) continue;
        if(Math.hypot(o.x-e.x,o.y-e.y)<=st.splash*CS) damage(o,st.dmg*0.6);
      }
      damage(e,st.dmg); e.buT=3; e.buD=Math.max(e.buD,st.dmg*0.3);
      for(let i=0;i<14;i++){const a=Math.random()*6.283,s=40+Math.random()*80;
        S.parts.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.3,max:0.3,color:'#ff8a3a',r:2.5});}
      break;
    case 'hielo':
      damage(e,st.dmg); e.slowT=2; e.slowF=Math.min(e.slowF<1&&e.slowT>0?e.slowF:1,1-st.slow);
      burst(e.x,e.y,'#9fe6ff',5); break;
    case 'veneno':
      damage(e,st.dmg); e.poT=4; e.poD=Math.max(e.poD,st.dmg*1.2); break;
    case 'rayo': {
      const pts=[{x:e.x,y:e.y}], hit=new Set([e]);
      damage(e,st.dmg);
      let cur=e;
      for(let i=0;i<st.chain;i++){
        let nb=null,nd=2.5*CS;
        for(const o of S.enemies){
          if(o.dead||o.gone||hit.has(o)) continue;
          const d=Math.hypot(o.x-cur.x,o.y-cur.y); if(d<nd){nd=d;nb=o;}
        }
        if(!nb) break;
        hit.add(nb); damage(nb,st.dmg*0.8); pts.push({x:nb.x,y:nb.y}); cur=nb;
      }
      S.bolts.push({pts,life:0.18,color:'#fff6a0'});
      break; }
    case 'sombra':
      damage(e,st.dmg+Math.min(e.maxhp*0.04,st.dmg*10));
      burst(e.x,e.y,'#b36bff',8); break;
  }
}
function leak(e){
  e.gone=true; S.lives--; S.waveLeaked++;
  burst(e.x,e.y,'#ff3050',14);
  if(S.lives<=0) gameOver();
}
function gameOver(){
  S.lives=0; S.over=true;
  if(S.wave>best){best=S.wave;try{localStorage.setItem('abismo_best',String(best));}catch(e){}}
  $('overTxt').textContent='Llegaste a la oleada '+S.wave+' · '+S.kills+' enemigos abatidos · Récord: '+best;
  $('over').style.display='flex';
}
function stepEnemy(e,dt){
  let sp=e.speed;
  if(e.slowT>0){e.slowT-=dt; sp*=e.slowF; if(e.slowT<=0)e.slowF=1;}
  if(e.poT>0){e.poT-=dt; damage(e,e.poD*dt); if(e.poT<=0)e.poD=0;}
  if(e.buT>0){e.buT-=dt; damage(e,e.buD*dt); if(e.buT<=0)e.buD=0;}
  if(e.flash>0) e.flash-=dt;
  if(e.dead) return;
  let rem=sp*dt;
  { const df=((e.hd-e.ang+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI; e.ang+=df*Math.min(1,dt*10); }
  if(e.fly){
    const tx=GO.x*CS+CS/2, ty=GO.y*CS+CS/2, d=Math.hypot(tx-e.x,ty-e.y);
    e.hd=Math.atan2(ty-e.y,tx-e.x);
    if(d<=rem){e.x=tx;e.y=ty;leak(e);}
    else {e.x+=(tx-e.x)/d*rem; e.y+=(ty-e.y)/d*rem;}
    return;
  }
  let guard=4;
  while(rem>0&&guard-->0){
    if(!e.tg||S.grid[e.tg.y][e.tg.x]!==0){
      const c=enemyCell(e); let bd=S.dist[c.y][c.x], bn=null;
      for(const [dx,dy] of D4){
        const nx=c.x+dx, ny=c.y+dy;
        if(nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
        if(S.dist[ny][nx]<bd){bd=S.dist[ny][nx];bn={x:nx,y:ny};}
      }
      e.tg=bn;
      if(!bn) break;
    }
    const tx=e.tg.x*CS+CS/2, ty=e.tg.y*CS+CS/2, d=Math.hypot(tx-e.x,ty-e.y);
    if(d>0.01) e.hd=Math.atan2(ty-e.y,tx-e.x);
    if(d<=rem){
      e.x=tx;e.y=ty;rem-=d;
      const reached=e.tg; e.tg=null;
      if(reached.x===GO.x&&reached.y===GO.y){leak(e);return;}
    } else {e.x+=(tx-e.x)/d*rem; e.y+=(ty-e.y)/d*rem; rem=0;}
  }
}

function update(dt){
  S.time+=dt;
  if(S.msgT>0){S.msgT-=dt; if(S.msgT<=0) $('msg').textContent='';}
  if(S.queue.length){
    S.spawnT-=dt;
    if(S.spawnT<=0){const q=S.queue.shift(); spawnEnemy(q.type,q.wave); S.waveSpawned++; S.spawnT=q.gap;}
  }
  for(const e of S.enemies){ if(!e.dead&&!e.gone) stepEnemy(e,dt); }
  for(const t of S.towers) fireTower(t,dt);
  for(const p of S.proj){
    const e=p.tg;
    if(e.dead||e.gone){p.done=true;continue;}
    const d=Math.hypot(e.x-p.x,e.y-p.y), mv=430*dt;
    p.trail.push({x:p.x,y:p.y}); if(p.trail.length>6) p.trail.shift();
    if(d<=mv+4){applyHit(p);p.done=true;}
    else {p.x+=(e.x-p.x)/d*mv; p.y+=(e.y-p.y)/d*mv;}
  }
  S.proj=S.proj.filter(p=>!p.done);
  S.enemies=S.enemies.filter(e=>!e.dead&&!e.gone);
  for(const p of S.parts){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=0.94;p.vy*=0.94;}
  S.parts=S.parts.filter(p=>p.life>0);
  for(const b of S.bolts) b.life-=dt;
  S.bolts=S.bolts.filter(b=>b.life>0);
  if(S.waveActive&&!S.queue.length&&!S.enemies.length&&!S.over){
    S.waveActive=false; S.mana+=10+S.wave*2; S.autoT=4;
  }
  if(!S.waveActive&&S.wave>0&&!S.over&&S.autoT>0){
    S.autoT=Math.max(0,S.autoT-dt);
    if(S.auto&&S.autoT<=0) startWave();
  }
}
