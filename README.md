# Aegis

Tower defense webapp inspirado en **GemCraft Labyrinth**.

Fusiona gemas/torres, construye defensas, protege tu orbe.

## Jugar (demo)

Activá GitHub Pages en el repo (Settings → Pages → branch `main` / root).
Luego: `https://maxnannij.github.io/Aegis/`

## Lógica de Mapas (implementada)

- Los enemigos **solo caminan por tiles de tipo PATH**.
- Podés colocar **muros (WALL)** sobre los caminos para forzar rutas más largas / redirigir.
- Pathfinding con **A\*** en tiempo real.
- Si bloqueás **todos** los accesos al orbe → el mapa queda *fully blocked*.
- En ese estado los enemigos pasan a **modo ataque**: se dirigen a los muros que están sellando el camino y los golpean hasta destruirlos.
- Cuando un muro cae, se recalcula el path y vuelven a caminar normalmente.

Archivos clave:
- `src/map.js` → grid, tiles, A*, detección de bloqueo, muros atacables
- `src/enemy.js` → comportamiento walk / attack

## Gemas básicas

| Color | Nombre | Efecto principal |
|-------|--------|------------------|
| Amarillo | Multiple Damage | Chance de daño multiplicado |
| Naranja | Mana Gathering | Roba mana al golpear |
| Rojo | Bloodbound | Daño aumenta con kills |
| Púrpura | Armor Tearing | Reduce armadura del objetivo |
| Verde | Poisonous | Daño por tiempo (ignora armadura) |
| Azul | Slowing | Ralentiza al enemigo |
| Cian | Shocking | Chance de paralizar |
| Lima | Chain Hit | Chance de golpear múltiples enemigos |

## Estado actual

- [x] Repositorio + estructura base
- [x] 8 gemas básicas + sistema de fusión (esqueleto)
- [x] Lógica de mapas, pathfinding y ataque a muros
- [ ] Imágenes de gemas (las vas a pasar)
- [ ] Sistema de torres / colocación de gemas
- [ ] Oleadas, mana, orbe, etc.

## Desarrollo

HTML + Canvas + JS vanilla (sin build step → ideal para GitHub Pages).
