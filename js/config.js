'use strict';

'use strict';
const CS=40, COLS=20, ROWS=14, W=COLS*CS, H=ROWS*CS;
const cv=document.getElementById('c'), ctx=cv.getContext('2d');
cv.width=W; cv.height=H;
const SP={x:0,y:7}, GO={x:COLS-1,y:7};
const D4=[[1,0],[-1,0],[0,1],[0,-1]];
const MAXLVL=8, WALL_COST=4, TOWER_COST=30, GEM_COST=25, INV_MAX=24;

const GEMS={
  fuego:{name:'Brasa',color:'#ff5a2a',dmg:10,rate:0.9,range:3.0,desc:'Explota en área y deja quemadura.'},
  hielo:{name:'Escarcha',color:'#5ad2ff',dmg:6,rate:1.1,range:3.2,desc:'Ralentiza a los enemigos.'},
  veneno:{name:'Pestilencia',color:'#7dff4a',dmg:3,rate:1.3,range:3.0,desc:'Veneno que daña con el tiempo.'},
  rayo:{name:'Tormenta',color:'#ffe94a',dmg:7,rate:1.0,range:3.4,desc:'El rayo salta entre varios enemigos.'},
  sombra:{name:'Vacío',color:'#b36bff',dmg:22,rate:0.5,range:4.0,desc:'Golpe pesado; además quita % de vida.'}
};
const GKEYS=Object.keys(GEMS);

const ETYPES={
  gnoll:{hp:1,sp:1,r:12,rw:1,color:'#7a5a3a',spr:'gnoll',size:72},
  veloz:{hp:0.55,sp:1.7,r:8,rw:1.1,color:'#6aa84f'},
  brute:{hp:2.6,sp:0.65,r:14,rw:2.2,color:'#6b5b4b'},
  espectro:{hp:1.1,sp:1.1,r:11,rw:1.6,color:'#9fc5e8',fly:true},
  jefe:{hp:16,sp:0.6,r:20,rw:20,color:'#a01030'}
};
const BASE_SPEED=55;
const SPR={};
function loadSprite(key,src){
  const o={ready:false,img:new Image(),sil:null};
  o.img.onload=()=>{
    const s=document.createElement('canvas'); s.width=o.img.width; s.height=o.img.height;
    const c=s.getContext('2d'); c.drawImage(o.img,0,0);
    c.globalCompositeOperation='source-in'; c.fillStyle='#fff'; c.fillRect(0,0,s.width,s.height);
    o.sil=s; o.ready=true;
  };
  o.img.src=src; SPR[key]=o;
}
// El sprite original mira hacia abajo (+y); por eso se gira a-90° al dibujarlo.
loadSprite('gnoll','assets/gnoll.png');

let S, best=0;
try{best=+localStorage.getItem('abismo_best')||0;}catch(e){}

/* ---------- utilidades ---------- */
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function hash(x,y){let h=(x*374761393+y*668265263)^0x5bd1e995;h=(h^(h>>>13))*1274126177;return ((h^(h>>>16))>>>0)/4294967295;}
function newGrid(){return Array.from({length:ROWS},()=>Array(COLS).fill(0));}
function bfs(grid){
  const d=Array.from({length:ROWS},()=>Array(COLS).fill(Infinity));
  const q=[[GO.x,GO.y]]; d[GO.y][GO.x]=0;
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i];
    for(const [dx,dy] of D4){
      const nx=x+dx, ny=y+dy;
      if(nx<0||ny<0||nx>=COLS||ny>=ROWS) continue;
      if(grid[ny][nx]!==0||d[ny][nx]!==Infinity) continue;
      d[ny][nx]=d[y][x]+1; q.push([nx,ny]);
    }
  }
  return d;
}
function enemyCell(e){return {x:clamp(Math.floor(e.x/CS),0,COLS-1),y:clamp(Math.floor(e.y/CS),0,ROWS-1)};}
