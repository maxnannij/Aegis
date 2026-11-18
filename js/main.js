'use strict';

/* ---------- bucle ---------- */
let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now;
  if(!S.paused&&!S.over){ for(let i=0;i<S.speed;i++) update(dt); }
  draw(); updateHud();
  requestAnimationFrame(frame);
}
newGame();
requestAnimationFrame(frame);
