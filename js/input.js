'use strict';

/* ---------- eventos ---------- */
function cellFrom(ev){
  const r=cv.getBoundingClientRect();
  return {x:Math.floor((ev.clientX-r.left)*W/r.width/CS),y:Math.floor((ev.clientY-r.top)*H/r.height/CS)};
}
let painting=false;
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',ev=>{
  if(S.over) return;
  const c=cellFrom(ev);
  if(c.x<0||c.y<0||c.x>=COLS||c.y>=ROWS) return;
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
$('fuse').onclick=fuse;
$('bWave').onclick=startWave;
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
});
