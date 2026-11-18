'use strict';

/* ---------- oleadas ---------- */
function buildWave(w){
  const arr=[], n=Math.floor(7+w*1.4), gap=Math.max(0.35,0.9-w*0.02);
  for(let i=0;i<n;i++){
    let type='gnoll';
    const r=Math.random();
    if(w>=7&&r<0.15) type='espectro';
    else if(w>=5&&r<0.35) type='brute';
    else if(w>=3&&r<0.6) type='veloz';
    arr.push({type,wave:w,gap});
  }
  if(w%10===0) arr.splice(Math.floor(n/2),0,{type:'jefe',wave:w,gap:1.6});
  return arr;
}
function startWave(advance=false){
  if(S.over||S.waveActive) return;
  if(advance&&S.wave>0){
    const bonus=Math.max(0,Math.ceil(S.autoT*2));
    if(bonus>0){S.mana+=bonus;say('Oleada adelantada: +'+bonus+' de maná.');}
  }
  S.wave++;
  const next=buildWave(S.wave);
  S.waveTotal=next.length; S.waveSpawned=0; S.waveDefeated=0; S.waveLeaked=0;
  S.queue.push(...next);
  S.waveActive=true; S.autoT=0;
}
function advanceWave(){
  if(!S.waveActive&&!S.over&&S.wave>0) startWave(true);
}
function spawnEnemy(type,w){
  const t=ETYPES[type], hp=30*Math.pow(1.13,w-1)*t.hp;
  S.enemies.push({type,x:SP.x*CS+CS/2,y:SP.y*CS+CS/2,hp,maxhp:hp,speed:BASE_SPEED*t.sp,
    fly:!!t.fly,r:t.r,color:t.color,spr:t.spr,size:t.size,ang:0,hd:0,reward:Math.round((4+w*0.8)*t.rw),
    slowT:0,slowF:1,poT:0,poD:0,buT:0,buD:0,flash:0,tg:null,dead:false,gone:false,ph:Math.random()*6});
}
