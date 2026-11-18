'use strict';

/* ---------- dibujo ---------- */
const bg=document.createElement('canvas'); bg.width=W; bg.height=H;
(function(){
  const c=bg.getContext('2d');
  c.fillStyle='#0f0d15'; c.fillRect(0,0,W,H);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const h=hash(x,y), l=14+Math.floor(h*8);
    c.fillStyle='rgb('+l+','+(l-1)+','+(l+5)+')';
    c.fillRect(x*CS+1,y*CS+1,CS-2,CS-2);
    c.strokeStyle='rgba(0,0,0,.35)'; c.strokeRect(x*CS+.5,y*CS+.5,CS-1,CS-1);
    if(h>0.7){
      c.strokeStyle='rgba(0,0,0,.5)'; c.beginPath();
      const sx=x*CS+hash(y,x)*CS, sy=y*CS+hash(x+9,y)*CS;
      c.moveTo(sx,sy); c.lineTo(sx+(h-0.8)*60,sy+(hash(x,y+3)-0.5)*30); c.stroke();
    }
  }
})();

function gemShape(c,x,y,r){
  c.beginPath(); c.moveTo(x,y-r); c.lineTo(x+r*0.8,y); c.lineTo(x,y+r); c.lineTo(x-r*0.8,y); c.closePath();
}
function drawGem(c,x,y,r,color,glow){
  c.save();
  if(glow){c.shadowColor=color;c.shadowBlur=glow;}
  gemShape(c,x,y,r); c.fillStyle=color; c.fill();
  c.shadowBlur=0; c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=1; c.stroke();
  c.fillStyle='rgba(255,255,255,.35)';
  c.beginPath(); c.moveTo(x,y-r); c.lineTo(x+r*0.8,y); c.lineTo(x,y); c.closePath(); c.fill();
  c.restore();
}
function drawEnemy(e){
  const c=ctx, t=S.time;
  c.save(); c.translate(e.x,e.y);
  if(e.tg){const tx=e.tg.x*CS+CS/2-e.x; if(Math.abs(tx)>0.5) e.face=tx<0?-1:1;}
  if(e.face===-1) c.scale(-1,1);
  const bob=e.fly?Math.sin(t*4+e.ph)*3:0;
  c.translate(0,bob);
  c.globalAlpha=e.fly?0.8:1;
  const sp=e.spr&&SPR[e.spr];
  if(sp&&sp.ready){
    c.save();
    c.rotate(e.ang+Math.PI/2+Math.sin(t*8+e.ph)*0.07);
    const s=e.size;
    c.drawImage(sp.img,-s/2,-s/2,s,s);
    if(e.flash>0){c.globalAlpha=0.65;c.drawImage(sp.sil,-s/2,-s/2,s,s);}
    c.restore();
  } else {
  c.fillStyle=e.flash>0?'#fff':e.color;
  c.shadowColor=e.color; c.shadowBlur=e.type==='jefe'?14:6;
  if(e.type==='veloz'){
    c.beginPath(); c.moveTo(e.r+2,0); c.lineTo(-e.r,-e.r*0.8); c.lineTo(-e.r*0.5,0); c.lineTo(-e.r,e.r*0.8); c.closePath(); c.fill();
  } else if(e.type==='espectro'){
    c.beginPath(); c.arc(0,-2,e.r,Math.PI,0);
    for(let i=0;i<4;i++){const x=e.r-i*e.r/2; c.lineTo(x-e.r/4,e.r+Math.sin(t*6+i)*2); c.lineTo(x-e.r/2,e.r-4);}
    c.closePath(); c.fill();
  } else if(e.type==='esbirro'){
    const r=e.r, sway=Math.sin(t*5+e.ph)*1.5;
    c.beginPath(); c.ellipse(0,r*0.35,r*0.9,r*0.6,0,0,6.283); c.fill();
    c.beginPath(); c.arc(sway*0.4+r*0.25,-r*0.55,r*0.55,0,6.283); c.fill();
    c.fillStyle='#e6dcc4';
    c.beginPath(); c.moveTo(r*0.2,-r*0.8); c.lineTo(r*0.9,-r*0.95); c.lineTo(r*0.25,-r*0.45); c.closePath(); c.fill();
    c.fillStyle=e.flash>0?'#fff':e.color;
    c.strokeStyle='#e6dcc4'; c.lineWidth=1.5;
    c.beginPath(); c.moveTo(r*0.6,r*0.1); c.lineTo(r*1.8+sway,-r*1.2); c.stroke();
    c.fillStyle='#ffb347';
    c.beginPath(); c.arc(r*1.8+sway,-r*1.2,2,0,6.283); c.fill();
  } else {
    c.beginPath(); c.arc(0,0,e.r,0,6.283); c.fill();
    if(e.type==='brute'||e.type==='jefe'){
      c.fillStyle='#d8cdb8'; const k=e.type==='jefe'?5:2;
      for(let i=0;i<k;i++){
        const a=-Math.PI/2+(i-(k-1)/2)*(e.type==='jefe'?0.55:1.3);
        c.beginPath(); c.moveTo(Math.cos(a-0.15)*e.r,Math.sin(a-0.15)*e.r);
        c.lineTo(Math.cos(a)*(e.r+8),Math.sin(a)*(e.r+8)); c.lineTo(Math.cos(a+0.15)*e.r,Math.sin(a+0.15)*e.r); c.fill();
      }
    }
  }
  c.shadowBlur=0;
  c.fillStyle='#ffdd55';
  c.fillRect(-e.r*0.45,-e.r*0.25,3,3); c.fillRect(e.r*0.15,-e.r*0.25,3,3);
  }
  if(e.slowT>0){c.strokeStyle='#7fdcff';c.lineWidth=2;c.beginPath();c.arc(0,0,e.r+3,0,6.283);c.stroke();}
  if(e.poT>0){c.fillStyle='#7dff4a';c.beginPath();c.arc(e.r*0.6,-e.r,3,0,6.283);c.fill();}
  if(e.buT>0){c.fillStyle='#ff8a3a';c.beginPath();c.arc(-e.r*0.6,-e.r,3,0,6.283);c.fill();}
  c.restore();
  if(e.hp<e.maxhp){
    const w=e.r*2+4, x=e.x-w/2, y=e.y-e.r-9+bob;
    c.fillStyle='#000a'; c.fillRect(x,y,w,4);
    c.fillStyle=e.type==='jefe'?'#ff4060':'#c33'; c.fillRect(x,y,w*Math.max(0,e.hp/e.maxhp),4);
  }
}
function drawTower(t){
  const c=ctx, x=t.px, y=t.py;
  c.fillStyle='#2a2433'; c.fillRect(x-17,y-17,34,34);
  c.strokeStyle='#4a4058'; c.lineWidth=1; c.strokeRect(x-17+.5,y-17+.5,33,33);
  c.fillStyle='#1b1722';
  c.beginPath(); c.moveTo(x-9,y+14); c.lineTo(x-5,y-12); c.lineTo(x,y-17); c.lineTo(x+5,y-12); c.lineTo(x+9,y+14); c.closePath(); c.fill();
  c.strokeStyle='#58496a'; c.stroke();
  if(t.gem){
    const col=GEMS[t.gem.type].color, pulse=8+Math.sin(S.time*3+t.cx)*2;
    drawGem(c,x,y-2,6+t.gem.lvl*0.5,col,pulse+t.gem.lvl);
    c.fillStyle='#fff'; c.font='bold 10px Georgia'; c.textAlign='center'; c.fillText(t.gem.lvl,x,y+13);
  } else {
    c.fillStyle='#07060a'; c.beginPath(); c.arc(x,y-2,5,0,6.283); c.fill();
    c.strokeStyle='#58496a'; c.stroke();
  }
}
function drawWall(x,y){
  const c=ctx, px=x*CS, py=y*CS;
  c.fillStyle='#262030'; c.fillRect(px+2,py+2,CS-4,CS-4);
  c.fillStyle='#322a3e'; c.fillRect(px+2,py+2,CS-4,6);
  c.strokeStyle='#0c0a10'; c.lineWidth=1;
  c.beginPath(); c.moveTo(px+2,py+CS/2); c.lineTo(px+CS-2,py+CS/2);
  c.moveTo(px+CS/2,py+2); c.lineTo(px+CS/2,py+CS/2); c.moveTo(px+CS/4,py+CS/2); c.lineTo(px+CS/4,py+CS-2); c.stroke();
}
function drawPortals(){
  const c=ctx, t=S.time;
  let x=SP.x*CS+CS/2, y=SP.y*CS+CS/2;
  for(let i=0;i<3;i++){
    c.strokeStyle='rgba(170,90,255,'+(0.6-i*0.15)+')'; c.lineWidth=2;
    c.beginPath(); c.ellipse(x,y,16-i*4,16-i*4,t*(1+i*0.6),0,4.5); c.stroke();
  }
  x=GO.x*CS+CS/2; y=GO.y*CS+CS/2;
  const g=c.createRadialGradient(x,y,2,x,y,24);
  g.addColorStop(0,'rgba(255,60,90,.9)'); g.addColorStop(1,'rgba(255,60,90,0)');
  c.fillStyle=g; c.beginPath(); c.arc(x,y,24+Math.sin(t*3)*2,0,6.283); c.fill();
  c.fillStyle='#e8d6a0'; c.beginPath(); c.arc(x,y,6,0,6.283); c.fill();
}
function draw(){
  const c=ctx;
  c.drawImage(bg,0,0);
  // vista previa del camino
  if(S.dist[SP.y][SP.x]!==Infinity){
    c.strokeStyle='rgba(200,170,255,.18)'; c.setLineDash([4,6]); c.lineWidth=2; c.beginPath();
    let cx=SP.x, cy=SP.y; c.moveTo(cx*CS+CS/2,cy*CS+CS/2);
    for(let g=0;g<400&&S.dist[cy][cx]>0;g++){
      let bd=S.dist[cy][cx], bn=null;
      for(const [dx,dy] of D4){const nx=cx+dx,ny=cy+dy;
        if(nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
        if(S.dist[ny][nx]<bd){bd=S.dist[ny][nx];bn={x:nx,y:ny};}}
      if(!bn) break; cx=bn.x; cy=bn.y; c.lineTo(cx*CS+CS/2,cy*CS+CS/2);
    }
    c.stroke(); c.setLineDash([]);
  }
  drawPortals();
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++) if(S.grid[y][x]===1) drawWall(x,y);
  // rangos
  const showR=S.selTower||(S.hv&&S.grid[S.hv.y]&&S.grid[S.hv.y][S.hv.x]===2?towerAt(S.hv.x,S.hv.y):null);
  if(showR&&showR.gem){
    const st=gemStats(showR.gem);
    c.strokeStyle=GEMS[showR.gem.type].color+'88'; c.lineWidth=1;
    c.beginPath(); c.arc(showR.px,showR.py,st.range*CS,0,6.283); c.stroke();
    c.fillStyle=GEMS[showR.gem.type].color+'14'; c.fill();
  }
  for(const t of S.towers) drawTower(t);
  if(S.selTower){
    c.strokeStyle='#c9a86a'; c.lineWidth=2; c.strokeRect(S.selTower.cx*CS+1,S.selTower.cy*CS+1,CS-2,CS-2);
  }
  // hover
  if(S.hv&&S.hv.x>=0&&S.hv.y>=0&&S.hv.x<COLS&&S.hv.y<ROWS&&(S.tool==='wall'||S.tool==='tower')&&S.grid[S.hv.y][S.hv.x]===0){
    const ok=canBlock(S.hv.x,S.hv.y)&&S.mana>=(S.tool==='wall'?WALL_COST:TOWER_COST);
    c.fillStyle=ok?'rgba(120,255,160,.22)':'rgba(255,70,70,.28)';
    c.fillRect(S.hv.x*CS,S.hv.y*CS,CS,CS);
  }
  for(const e of S.enemies) if(!e.fly) drawEnemy(e);
  for(const e of S.enemies) if(e.fly) drawEnemy(e);
  for(const p of S.proj){
    for(let i=0;i<p.trail.length;i++){
      c.globalAlpha=i/p.trail.length*0.5; c.fillStyle=p.color;
      c.beginPath(); c.arc(p.trail[i].x,p.trail[i].y,2.5,0,6.283); c.fill();
    }
    c.globalAlpha=1; c.save(); c.shadowColor=p.color; c.shadowBlur=10;
    c.fillStyle=p.color; c.beginPath(); c.arc(p.x,p.y,4,0,6.283); c.fill(); c.restore();
  }
  for(const b of S.bolts){
    c.strokeStyle=b.color; c.lineWidth=2.5; c.globalAlpha=b.life/0.18; c.beginPath();
    b.pts.forEach((p,i)=>{
      if(i===0) c.moveTo(p.x,p.y);
      else {
        const q=b.pts[i-1], mx=(p.x+q.x)/2+(Math.random()-0.5)*14, my=(p.y+q.y)/2+(Math.random()-0.5)*14;
        c.lineTo(mx,my); c.lineTo(p.x,p.y);
      }
    });
    c.stroke(); c.globalAlpha=1;
  }
  for(const p of S.parts){
    c.globalAlpha=Math.max(0,p.life/p.max); c.fillStyle=p.color;
    c.beginPath(); c.arc(p.x,p.y,p.r,0,6.283); c.fill();
  }
  c.globalAlpha=1;
  const v=c.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,W*0.65);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.6)');
  c.fillStyle=v; c.fillRect(0,0,W,H);
  if(S.paused&&!S.over){
    c.fillStyle='rgba(0,0,0,.5)'; c.fillRect(0,0,W,H);
    c.fillStyle='#c9a86a'; c.font='28px Georgia'; c.textAlign='center'; c.fillText('PAUSA',W/2,H/2);
  }
}
