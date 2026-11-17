/** Gemas originales de Abismo de Ceniza. */
export const GEM_TYPES = {
  fuego: { id:'fuego', name:'Brasa', nameEs:'Brasa', color:'#ff5a2a', colorName:'Fuego', description:'Explota en área y deja quemadura.', baseDamage:[10,10], baseRange:3*32, baseFireRate:0.9, special:'fire', specialParams:{} },
  hielo: { id:'hielo', name:'Escarcha', nameEs:'Escarcha', color:'#5ad2ff', colorName:'Hielo', description:'Ralentiza a los enemigos.', baseDamage:[6,6], baseRange:3.2*32, baseFireRate:1.1, special:'ice', specialParams:{} },
  veneno: { id:'veneno', name:'Pestilencia', nameEs:'Pestilencia', color:'#7dff4a', colorName:'Veneno', description:'Veneno que daña con el tiempo.', baseDamage:[3,3], baseRange:3*32, baseFireRate:1.3, special:'poison', specialParams:{} },
  rayo: { id:'rayo', name:'Tormenta', nameEs:'Tormenta', color:'#ffe94a', colorName:'Rayo', description:'El rayo salta entre varios enemigos.', baseDamage:[7,7], baseRange:3.4*32, baseFireRate:1, special:'chain', specialParams:{} },
  sombra: { id:'sombra', name:'Vacío', nameEs:'Vacío', color:'#b36bff', colorName:'Sombra', description:'Golpe pesado; además quita % de vida.', baseDamage:[22,22], baseRange:4*32, baseFireRate:0.5, special:'shadow', specialParams:{} }
};
export const GRADE_SHAPES = {1:'triangle-curved',2:'triangle-concave',3:'square',4:'square-concave-top',5:'square-all-concave',6:'diamond',7:'kite',8:'pentagon'};
export function createGem(typeId, grade=1) {
  if (!GEM_TYPES[typeId]) throw new Error('Unknown gem type: ' + typeId);
  return { id: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'gem-' + Date.now() + '-' + Math.random(), typeId, grade, types:[typeId], isPure:true, kills:0 };
}
export function fuseGems(a,b) {
  if (a.typeId !== b.typeId || a.grade !== b.grade) throw new Error('Solo se fusionan gemas iguales.');
  return createGem(a.typeId, Math.min(8,a.grade+1));
}
export function getGemStats(gem) {
  const type=GEM_TYPES[gem.typeId];
  if (!type) return {damageMin:0,damageMax:0,range:0,fireRate:0,specials:[],grade:gem.grade,types:[gem.typeId]};
  const level=Math.max(1,gem.grade||1), damage=type.baseDamage[0]*Math.pow(2.1,level-1);
  return {damageMin:damage,damageMax:damage,range:type.baseRange+0.12*32*(level-1),fireRate:type.baseFireRate*(1+0.05*(level-1)),specials:[{type:type.special,params:{}}],splash:1.1+0.08*level,slow:Math.min(0.75,0.35+0.05*level),chain:2+Math.floor(level/2),grade:level,isPure:true,types:[gem.typeId]};
}
export const GEM_TYPE_LIST=Object.keys(GEM_TYPES);