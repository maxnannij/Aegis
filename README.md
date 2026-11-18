# Abismo de Ceniza

Juego de defensa de torres en HTML, CSS y JavaScript vanilla.

## Estructura

- `index.html`: estructura de la interfaz y carga de recursos.
- `styles.css`: estilos visuales.
- `js/config.js`: constantes, configuración, sprite y utilidades compartidas.
- `js/state.js`: estado de partida, grilla y búsqueda de caminos.
- `js/gems.js`: gemas, inventario, engarce y fusión.
- `js/building.js`: herramientas, construcción y venta.
- `js/waves.js`: creación e invocación de oleadas.
- `js/combat.js`: enemigos, movimiento, daño y actualización de la simulación.
- `js/render.js`: dibujo del mapa, torres, enemigos y efectos en canvas.
- `js/ui.js`: panel, inventario, estadísticas y mensajes.
- `js/input.js`: controles de puntero, botones y atajos de teclado.
- `js/main.js`: bucle principal e inicio de partida.
- `assets/gnoll.png`: sprite del gnoll extraído del HTML original.

## Interfaz móvil y oleadas

- En celulares, el juego usa una interfaz propia en orientación horizontal; en vertical muestra una indicación para girar el dispositivo.
- Tocá una casilla libre para construir muros o torres; tocá una torre para abrir sus gemas y mejoras.
- El panel de oleadas muestra enemigos derrotados y restantes. Entre oleadas podés adelantar la siguiente y recibir maná adicional según el tiempo de espera que quede, o dejar que avance automáticamente.

## Ejecución

Abrí `index.html` desde un servidor estático (por ejemplo, GitHub Pages). No requiere dependencias ni proceso de compilación.
