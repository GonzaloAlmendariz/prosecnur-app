# Contrato de movimiento F6 — editor de Gráficos, pestaña Láminas (2026-10-10)

Pedido de Gonzalo: «necesitamos un especialista en animaciones que se asegure que los elementos que agregamos,
modificamos o cambiamos tengan animaciones elegantes, dinámicas y profesionales».

Alcance: `frontend/src/features/graficos/laminas/*` (LaminasWorkbench, EstructuraInforme, VisorLamina, InspectorLamina,
TiraMiniaturas, RanurasSobreLamina, BarraLaminas, PanelAvisos, EditorAmplio, DatosGrafico y sus `.css`) y
`frontend/src/features/graficos/iconos/iconoTipo.css`. Fuentes: `docs/qa/plan-integracion-f6-2026-10-10.md` §2.3–2.5,
`docs/qa/direccion-diseno-editor-graficos-f6-2026-10-09.md` §5, tokens de `frontend/src/app/tokens.css:91-109` y reglas
globales de `frontend/src/app/theme.css`. Fase 1 = sólo lectura; este documento no cambia código.

## 0. Principios que gobiernan (Emil Kowalski, design engineering)

1. **Primero se decide SI anima, por frecuencia.** Lo que se hace cientos de veces por sesión (←/→ entre 67 láminas,
   ↑/↓ entre partes, atajos, cambio de selección por teclado) **no anima**: la animación ahí es latencia percibida.
   Hover y selección con mouse: mínima (≤100–120 ms, sólo color). Paneles, sideover, menús, toasts, apariciones raras:
   estándar.
2. **Cada animación tiene un propósito nombrable**: continuidad espacial (de dónde viene el panel, a dónde se fue el
   espacio), indicación de estado (la vista previa está regenerando), feedback (el botón recibió la presión) o evitar un
   salto (el lienzo se re-encaja). Si no se puede nombrar, no anima.
3. **Curvas fuertes, nunca `ease-in`.** Entradas `ease-out` `cubic-bezier(0.23,1,0.32,1)`; movimiento de algo que ya está
   en pantalla `ease-in-out` `cubic-bezier(0.77,0,0.175,1)`; cajones `cubic-bezier(0.32,0.72,0,1)`. El `ease` genérico
   de CSS es débil: se reemplaza por token.
4. **Duraciones de UI < 300 ms**: presión 100–160, popovers 125–200, menús 150–250, paneles 200–300. **La salida es más
   rápida que la entrada** (≈70 %).
5. **Nunca desde `scale(0)`**: entradas desde `scale(.96–.97)` + `opacity 0`. Popovers con `transform-origin` en su
   disparador; sólo los modales centrados escalan desde el centro.
6. **Sólo `transform` y `opacity`** (y `filter` breve para el crossfade). No se animan `width`, `height`, `padding`,
   `grid-template-columns` ni `top/left`.
7. **Transiciones CSS (interrumpibles) para lo que se dispara rápido**; `@keyframes` sólo para lo que corre solo (spinner,
   barra indeterminada). Para elementos que se montan con `{cond && …}`, la entrada se hace con `@starting-style`
   (Electron 39 = Chromium ≥142, ya se usa en `hojasRuta.css:1523`), que sigue siendo una transición interrumpible.
8. **`:active` → `scale(.97)` en botones**; hover sólo bajo `@media (hover: hover) and (pointer: fine)`.
9. **Blur ≤ 2 px** para enmascarar un crossfade (vista previa «regenerando»).
10. **Stagger corto (30–80 ms) sólo en apariciones raras**; nunca en la lista de láminas al navegar ni al abrir un nodo.
11. **`prefers-reduced-motion` = menos movimiento, no cero**: se quitan desplazamientos y escalas; quedan opacidad y
    color (ver §4, decisión bloqueada sobre la regla global).

## 1. Tokens de movimiento

### 1.1 Existentes (en `tokens.css:92-102`) — se usan tal cual

| Token | Valor | Uso en F6 |
|---|---|---|
| `--motion-dur-press` | 120 ms | `:active`, color de selección con mouse, etiqueta de ranura |
| `--motion-dur-fast` | 160 ms | popovers/menús (entrada), cuerpo de tarjeta, hijos del árbol, chevron, crossfade de vista previa |
| `--motion-dur-base` | 220 ms | entrada de paneles in-grid (Estructura, Inspector), re-encaje FLIP del lienzo |
| `--motion-dur-panel` | 280 ms | entrada de sideovers (Inspector a 1024, Avisos, Editor amplio) |
| `--motion-dur-slow` | 420 ms | **prohibido en F6** (pasa el techo de 300 ms) |
| `--motion-ease-out` | `cubic-bezier(0.23,1,0.32,1)` | toda entrada y todo feedback |
| `--motion-ease-in-out` | `cubic-bezier(0.77,0,0.175,1)` | algo que ya está en pantalla y se desplaza (FLIP del lienzo); barra indeterminada |
| `--motion-ease-drawer` | `cubic-bezier(0.32,0.72,0,1)` | sideovers y paneles laterales |
| `--motion-ease-standard`, `--motion-ease-productive` | — | no se usan en F6 (redundantes con los tres anteriores) |

Las tres curvas fuertes ya existen: **no hace falta crear curvas**. El `ease` literal que aparece en reglas globales de
`theme.css` (p. ej. `:220-223`) queda fuera de F6.

### 1.2 Nuevos propuestos (para `tokens.css`, se escriben en fase 2 con aprobación del lead)

| Token propuesto | Valor | Por qué |
|---|---|---|
| `--motion-dur-hover` | 100ms | «mínima» para hover de filas, miniaturas e íconos; hoy se usa 120 y el plan pide distinguir hover de presión |
| `--motion-dur-salida` | 140ms | salida de popovers/menús/cuerpos (≈70 % de 160–200) |
| `--motion-dur-salida-panel` | 200ms | salida de sideovers y paneles (≈70 % de 280) |
| `--motion-delay-pendiente` | 150ms | retraso antes de mostrar «regenerando»/«desactualizada»: si el motor responde antes, no hay parpadeo |
| `--motion-scale-press` | 0.97 | `:active` (hoy literal en `theme.css:234`) |
| `--motion-scale-entrada` | 0.97 | origen de popovers/menús/tarjetas de estado |
| `--motion-desplaza-panel` | 12px | desplazamiento de entrada de paneles in-grid (no 100 %: el panel no viaja, aparece en su lugar) |
| `--motion-blur-crossfade` | 2px | velo de la vista previa desactualizada |

## 2. Contrato por elemento

Leyenda: **E** = entrada, **S** = salida. «RM» = comportamiento con `prefers-reduced-motion: reduce`.

| # | Elemento | ¿Anima? | Disparador | Propiedad | Duración | Curva | Salida | RM | Propósito / porqué |
|---|---|---|---|---|---|---|---|---|---|
| M1 | Navegación ←/→ entre láminas, ↑/↓ entre partes, clic en fila o miniatura | **No anima** | teclado / clic | — | 0 | — | — | igual | Acción de altísima frecuencia (67 láminas): animarla es latencia. La imagen cambia en seco. |
| M2 | Fila de lámina activa (`.pulso-f6-lamina.is-activa`) e ícono con acento (`aria-current`) | **No anima** la selección | cambio de lámina | `background`, `box-shadow`, `--icono-acento` | 0 | — | — | igual | Sigue al teclado; si se transiciona, el fondo «persigue» a la fila mientras se mantiene ← pulsada. |
| M3 | Hover de filas (Estructura), cabezas de nodo, miniaturas, tabs del Inspector, ítems de menú | Mínima | `:hover` (sólo `hover:hover` + `pointer:fine`) | `background-color` / `border-color` / `color` | E 100 (`--motion-dur-hover`); S 0 | `--motion-ease-out` | instantánea (la transición se declara en la regla `:hover`) | igual (sólo color) | Feedback de apuntado sin estela al barrer la lista con el mouse. |
| M4 | `:active` de botones (`.pulso-f6-boton`, `.pulso-f6-icono-boton`, `.pulso-f6-parte`, miniatura, ítems de menú) | Sí | `:active` | `transform: scale(var(--motion-scale-press))` | 120 | `--motion-ease-out` | 120 | sin escala | Feedback táctil. La regla global `theme.css:233-235` ya lo da, pero sólo se ve si la `transition` local incluye `transform` (hoy la pisan, §3). |
| M5 | `:active` de superficies grandes (fila de 44 px × 280 px, zona de ranura sobre la lámina, cabeza de tarjeta) | **No escala** | `:active` | `transform: none` explícito; feedback por `background` | 0 | — | — | igual | Escalar una fila ancha o un marco superpuesto a la lámina desalinea el marco respecto del dibujo. |
| M6 | Ranura sobre la lámina: marco en hover | Mínima | `:hover` | `border-color`, `background-color` | E 100; S 0 | `--motion-ease-out` | instantánea | igual | Descubrir qué zonas son clicables sin ruido. |
| M7 | Ranura sobre la lámina: etiqueta («Gráfico 2 · …») | Sí | hover / foco / `is-activa` | `opacity` 0→1 (+ `translateY(2px)`→0) | 120 | `--motion-ease-out` | 80 | sólo opacidad | Hoy pasa de `display:none` a `block` en seco. |
| M8 | Ranura sobre la lámina: activa (clic) | Sí | `is-activa` por clic | `box-shadow` (anillo) + `border-color` | 120 | `--motion-ease-out` | 0 | igual | Feedback de selección con mouse; baja frecuencia. Si la activa cambia por teclado, igual queda ≤120 ms. |
| M9 | Columna **Estructura** al abrirse (marco ancho) | Sí | toggle / cierre del Inspector | contenido: `opacity` 0→1 + `translateX(calc(-1 * var(--motion-desplaza-panel)))`→0 | 220 | `--motion-ease-drawer` | **S 0**: la columna se pliega en seco y la continuidad la lleva el lienzo (M11) | sólo opacidad | Mutuamente excluyente con el Inspector: el panel que entra cuenta la historia; el que sale no compite. |
| M10 | Columna **Inspector** (≈420–440 px) al abrirse en el marco ancho | Sí | clic en ranura, botón Ajustes, cierre de Estructura | contenido: `opacity` + `translateX(var(--motion-desplaza-panel))`→0 | 220 | `--motion-ease-drawer` | S 0 (igual que M9) | sólo opacidad | Continuidad espacial: entra desde su borde. **El ancho NO se anima**: el grid salta a su plantilla final en un frame. |
| M11 | **Re-encaje del lienzo** (la lámina llena el área, «como Canva o PowerPoint») | Sí | cambio de columnas del grid (M9/M10, entrar/salir del modo ancho) | FLIP sobre `.pulso-f6-hoja`: se mide el rect antes y después del cambio de clase (`useLayoutEffect`), se aplica `transform: translate(dx,dy) scale(s)` inverso y se transiciona a `none` | 220 | `--motion-ease-in-out` (ya está en pantalla y se desplaza) | — | sin FLIP: crossfade `opacity .85→1` 120 ms | Evitar el salto de tamaño de la lámina cuando el grid cambia. Sólo `transform`; el layout ocurre una vez. Fallback si FLIP no cabe en fase 2: crossfade `opacity .6→1` + `scale(.985)→1` 160 ms `ease-out`. Las ranuras se ocultan (`opacity 0`) durante los 220 ms para no quedar desfasadas. |
| M12 | Inspector como **sideover a 1024** (`.pulso-f6-inspector-marco` compacto) | Sí | `is-inspector-abierto` | `transform: translateX(100%)`→`none` | E 280 | `--motion-ease-drawer` | S 200 (`--motion-dur-salida-panel`) con `--motion-ease-drawer`; `visibility` diferida 200 | sin desplazamiento: `opacity` 0→1 160 / 1→0 120 | Cajón: viene de fuera de la pantalla. Hoy la salida dura lo mismo que la entrada. |
| M13 | Velo del sideover (`.pulso-f6-velo`) | Sí | montaje | `opacity` 0→1 vía `@starting-style` | 160 | `--motion-ease-out` | 0 (se desmonta) | igual | Hoy aparece de golpe sobre la lámina; el velo debe acompañar al cajón, no adelantarse. |
| M14 | Panel de **Avisos** (sideover 380 px) | Sí | montaje (`avisos.abierto`) | `translateX(100%)`→0 vía `@starting-style` | 280 | `--motion-ease-drawer` | S 0 mientras se desmonte; si fase 2 lo mantiene montado, 200 | `opacity` 160 | Igual que M12. |
| M15 | **Editor amplio** (sideover 760 px) | Sí | montaje | `translateX(24px)` + `opacity`→0/1 (no 100 %: 760 px viajando es demasiado) | 280 | `--motion-ease-drawer` | 200 si queda montado; si no, 0 | `opacity` 160 | Panel grande: aparecer en su sitio con desplazamiento corto. |
| M16 | Menú **Más ▾** (`.pulso-f6-mas-menu`) y popover **Exportar ▾** | Sí | montaje | `opacity` 0→1 + `scale(var(--motion-scale-entrada))`→1, `transform-origin: top right` (bajo su disparador, alineado a la derecha) | 160 | `--motion-ease-out` | 0 al desmontar (o 140 si queda montado) | sólo opacidad | Popover que nace de su botón. El Exportar vive en `graficos/v2/styles/editor-v2.css:20129` (fuera de `laminas/`): se aplica desde `barraLaminas.css` con un selector acotado a `.pulso-f6-barra`. |
| M17 | Cuerpo de **tarjeta de gráfico expandible** (Inspector, `.pulso-f6-ranura.is-abierta`) | Sí | `aria-expanded` | cuerpo: `opacity` 0→1 + `translateY(-4px)`→0 vía `@starting-style`; chevron único `rotate(0→90deg)` | 160 | `--motion-ease-out` | 0 (desmonta) | sólo opacidad | Indicar de dónde salió el contenido. **No se anima la altura** (contradice la nota «el árbol y las partes animan altura» de la dirección §5; queda reemplazada por este contrato). |
| M18 | Hijos de un **nodo del árbol** (Estructura) | Sí | expandir nodo | `opacity` + `translateY(-4px)` del bloque `.pulso-f6-nodo-hijos` (uno solo, sin stagger) | 160 | `--motion-ease-out` | 0 | sólo opacidad | Igual que M17. Sin stagger: un capítulo puede tener 30 láminas. |
| M19 | Chevron del nodo | Sí (ya correcto) | `is-abierto` | `rotate(90deg)` | 160 | `--motion-ease-out` | 160 | sin rotación animada | Ya cumple (`estructuraInforme.css:87`). |
| M20 | Vista previa **cargando** sin imagen previa (`.pulso-f6-hoja-estado`) | Sí | estado | tarjeta: `opacity` 0→1 + `scale(.97)`→1 con `transition-delay: var(--motion-delay-pendiente)` | 160 | `--motion-ease-out` | 120 | sólo opacidad | No mostrar «Generando» si el motor responde en <150 ms. |
| M21 | Vista previa **desactualizada** (imagen anterior mientras regenera) | Sí | `is-desactualizada` | `opacity .55`, `filter: blur(var(--motion-blur-crossfade)) saturate(.6)` con delay 150 a la ida; a la vuelta sin delay | E 160 (+150 delay) | `--motion-ease-out` | 160 al llegar la nueva imagen (desenfoque → nítido enmascara el cambio de `src`) | sin blur, sólo opacidad | Indicación de estado + crossfade. El plan §2.3–2.5 ya pide blur. |
| M22 | Barra de progreso indeterminada (`.pulso-f6-progreso i`) | Sí (corre sola) | mientras carga | `transform: translateX(-100%→250%)` sobre una pieza de 40 % de ancho (no `width`) | 1400 por ciclo | `--motion-ease-in-out` | — | estática al 60 % (ya existe) | Hoy anima `width` y dura 2,4 s. |
| M23 | Chip sobre la lámina («ves la versión anterior…» / error con Reintentar) | Sí | montaje | `opacity` 0→1 + `translate(-50%, -4px)`→`translate(-50%,0)` vía `@starting-style`; el info con delay 150 | 160 | `--motion-ease-out` | 0 | sólo opacidad | El error **no** lleva delay (es urgente). |
| M24 | **Error** de vista previa (tarjeta `is-error`) | Sí | estado | igual que M20, sin delay | 160 | `--motion-ease-out` | 120 | sólo opacidad | Sin sacudidas (`shake`): el error ya se lee por color y `role=alert`. |
| M25 | **Tira de miniaturas**: aparición de la tira, desplazamiento a la activa | Aparición: sí; desplazamiento: **no** | toggle de la tira / cambio de lámina | tira: `opacity` + `translateY(8px)`→0; `scrollIntoView` **sin** `behavior:smooth` | 160 | `--motion-ease-out` | 0 | sólo opacidad | El scroll sigue al teclado (M1): suave sería latencia. |
| M26 | Miniatura activa (`outline` del acento) | **No anima** | cambio de lámina | — | 0 | — | — | igual | M2. |
| M27 | Íconos por tipo (acento al seleccionar) | **No anima** | `aria-current` / `aria-selected` | `--icono-acento` | 0 | — | — | igual | Acompaña a la selección (M2). Excepción: dentro de la galería de tipos (aparición rara, clic) puede llevar `color` 120 `ease-out`. |
| M28 | Toast «Lámina N eliminada · Deshacer» | Ya existe (`components/toaster.css:41`) | — | `translateY(6px)` + `opacity` | 280 | `--motion-ease-out` | — | none | Fuera de alcance; cumple. |
| M29 | Acciones de Estructura (subir/bajar/duplicar/insertar/eliminar) | **No anima** el reordenamiento | clic / Alt+↑↓ / Cmd+D / Supr | — | 0 | — | — | igual | Frecuente y vía teclado; el foco sigue a la lámina (ya implementado). Opcional fase 2: destello de 1 frame en la fila movida (`background` del acento-soft → transparente 300 ms) sólo para Alt+↑↓ repetidos: **no** se recomienda. |
| M30 | Zoom del lienzo (`select`) | **No anima** | cambio de zoom | — | 0 | — | — | igual | Cambio explícito; cambiar `width` por `--pulso-f6-zoom` animado sería layout por frame. |
| M31 | Contadores de avisos en la barra | **No anima** | cambio de número | — | 0 | — | — | igual | Números `tabular-nums`; un conteo animado ralentiza la lectura. |
| M32 | Indicador de la tab del Inspector | Ya lo anima `GlidingTabList` | clic | — | — | — | — | — | Fuera de alcance; no duplicar con transiciones locales. |

### 2.1 Cómo se re-encaja el lienzo sin animar layout (M9–M11, detalle)

1. **El grid salta** a su `grid-template-columns` final en un frame (se elimina la `transition` de
   `laminasWorkbench.css:30`). El ancho del Inspector (420–440) no se anima nunca.
2. En el mismo commit de React, un hook `useReencajeLienzo(ref, deps=[estructuraVisible, inspectorVisible, modoAncho])`
   mide `getBoundingClientRect()` de `.pulso-f6-hoja` antes (en el render previo, guardado en un ref) y después
   (`useLayoutEffect`), calcula `dx, dy, s = anchoAntes / anchoDespues` y aplica
   `transform: translate(dx,dy) scale(s); transition: none`, fuerza reflow y luego
   `transition: transform var(--motion-dur-base) var(--motion-ease-in-out); transform: none`.
   Interrumpible: si el usuario vuelve a alternar a mitad, se mide desde el rect actual (incluye el transform vivo).
3. El panel que entra hace M9/M10 en paralelo (220, mismo reloj) → una sola sensación de «la lámina cede espacio al panel».
4. La capa de ranuras (`.pulso-f6-ranuras-capa`) va dentro de `.pulso-f6-hoja`, así que escala con ella; se le baja
   `opacity` a 0 durante el FLIP para que el hit-testing no quede desfasado.
5. Con RM: sin FLIP; `opacity .85 → 1` en 120 ms.

## 3. Revisión del código actual

| # | Archivo:línea | Antes | Después | Por qué |
|---|---|---|---|---|
| R1 | `laminas/laminasWorkbench.css:29-31` | `transition: grid-template-columns 160ms ease-out` | sin transición en el grid; FLIP del lienzo (M11) + entrada del panel (M9/M10) | Anima layout: cada frame recalcula `100cqw/100cqh` de la hoja, la imagen y las ranuras. Además `visibility:hidden` (`:42-46`, `:57-61`) corta el contenido en el frame 0, así que la columna se encoge vacía. Y entre `is-vacia` (2 pistas) y 3 pistas no interpola. |
| R2 | `laminas/laminasWorkbench.css:110` / `:116` | salida y entrada del sideover ambas 280 ms drawer | entrada 280 drawer; salida 200 (`--motion-dur-salida-panel`) y `visibility … 200ms` | La salida debe ser más rápida que la entrada. |
| R3 | `laminas/laminasWorkbench.css:79-87` + `LaminasWorkbench.tsx:265-267` | velo montado en seco | `@starting-style { opacity: 0 }` + `transition: opacity 160ms ease-out` | Aparece de golpe antes que el cajón (M13). |
| R4 | `laminas/laminasWorkbench.css:209` | `.pulso-f6-boton { transition: background-color 120ms … }` | `transition: background-color var(--motion-dur-hover) var(--motion-ease-out), transform var(--motion-dur-press) var(--motion-ease-out)` | Pisa la `transition` global (`theme.css:218-223`) y el `scale(.97)` de `:active` (`theme.css:233-235`) salta sin interpolar. |
| R5 | `laminas/laminasWorkbench.css:216-232` | `.pulso-f6-icono-boton` sin `transition` propia | igual que R4 | Hereda la transición global de `button` (`theme.css:218-223`), que usa el `ease` genérico de CSS en `background`/`color`; el `:active` sí interpola. Se fija con tokens para no depender del global. |
| R6 | `laminas/laminasWorkbench.css:184`, `:212`, `:229` | `:hover` sin media query | dentro de `@media (hover: hover) and (pointer: fine)` | En táctil el hover queda «pegado» tras el toque. |
| R7 | `laminas/estructuraInforme.css:163` | `.pulso-f6-lamina { transition: background-color 120ms }` | sin transición en reposo; `transition: background-color var(--motion-dur-hover)` sólo dentro de `.pulso-f6-lamina:hover` (bajo media hover); `.pulso-f6-lamina:active { transform: none }` | La transición se aplica también al cambio de `is-activa` por ←/→ (M2) y pisa el `scale(.97)` global, que en una fila de 280 px además sobra (M5). |
| R8 | `laminas/estructuraInforme.css:80`, `:166`, `:281` | `:hover` sin media query; cabeza de nodo sin transición | media hover + `--motion-dur-hover` en el `:hover` | M3. |
| R9 | `EstructuraInforme.tsx:150` (`{abierto && <div className="pulso-f6-nodo-hijos">`) | hijos montan en seco | `.pulso-f6-nodo-hijos { transition: opacity 160ms, transform 160ms ease-out } @starting-style { opacity:0; transform: translateY(-4px) }` | M18; sin animar altura. |
| R10 | `laminas/barraLaminas.css:95-108` | `.pulso-f6-mas-menu` aparece en seco, sin `transform-origin` | `transform-origin: top right`; `@starting-style { opacity:0; transform: scale(.97) }`; `transition: opacity 160ms, transform 160ms var(--motion-ease-out)` | M16. |
| R11 | `laminas/barraLaminas.css:127` | `.pulso-f6-mas-menu button:hover` sin media | media hover | M3. |
| R12 | `graficos/v2/styles/editor-v2.css:20129` (fuera de `laminas/`) | popover de Exportar sin entrada | regla acotada en `barraLaminas.css`: `.pulso-f6-barra .pulso-gv2-export-menu-popover { transform-origin: top right; … @starting-style … }` | M16; no se toca el CSS de v2 (archivo compartido y enorme). |
| R13 | `laminas/panelAvisos.css:3-15` + `LaminasWorkbench.tsx:264` | panel monta en seco | `@starting-style { transform: translateX(100%) }`, `transition: transform 280ms var(--motion-ease-drawer)` | M14. |
| R14 | `laminas/editorAmplio.css:2-15` | sideover monta en seco | `@starting-style { opacity:0; transform: translateX(24px) }`, 280 drawer | M15. |
| R15 | `laminas/tiraMiniaturas.css:56` | `transition: border-color 120ms` | `border-color` en `:hover` con `--motion-dur-hover`; `transform` 120 para `:active` | Pisa el `scale(.97)` global; hover sin media (`:59`). |
| R16 | `laminas/inspectorLamina.css:86` | tab hover sin media | media hover | M3. |
| R17 | `InspectorLamina.tsx:263` | `ChevronDown`/`ChevronRight` intercambiados | un solo `ChevronRight` con clase que rota 90° (160 ease-out), como `estructuraInforme.css:87` | Cambiar de glifo es un salto; rotar da continuidad (M17). Cuerpo de la tarjeta con `@starting-style`. |
| R18 | `laminas/visorLamina.css:114-117` | `is-desactualizada`: `opacity .55; filter: saturate(.6)` inmediato | `filter: blur(2px) saturate(.6)`; `transition-delay: var(--motion-delay-pendiente)` sólo a la ida | M21: sin delay parpadea en cada regeneración rápida; sin blur no enmascara el cambio de `src`. |
| R19 | `laminas/visorLamina.css:183-190` | `animation: pulso-f6-progreso 2.4s ease-in-out infinite` sobre `width` | `transform: translateX()` sobre pieza fija, 1,4 s | Anima layout y es lento (M22). |
| R20 | `laminas/visorLamina.css:119-126` | `.pulso-f6-hoja-estado` aparece en seco | tarjeta con `@starting-style` (`opacity 0, scale(.97)`), delay 150 en «cargando», sin delay en error | M20/M24. |
| R21 | `laminas/visorLamina.css:192-197` | chip `.pulso-f6-lienzo-aviso` aparece en seco | `@starting-style` con `translate(-50%,-4px)`; delay 150 sólo en `.is-info` | M23. |
| R22 | `laminas/visorLamina.css:324` | `.pulso-f6-ranura-zona { transition: border-color, background-color 120ms }` | igual pero en el `:hover` (100) y `transform: none` en `:active` | Pisa la transición global y el `scale(.97)` global saltaría sobre un marco superpuesto a la lámina (M5). |
| R23 | `laminas/visorLamina.css:327` | `.pulso-f6-ranura-zona:hover` sin media | media hover | M3/M6. |
| R24 | `laminas/visorLamina.css:343-361` | etiqueta de ranura `display:none → block` | `display:block; opacity:0; transform: translateY(2px)` → `opacity:1; transform:none` 120 ease-out | M7. |
| R25 | `laminas/visorLamina.css:240` | `.pulso-f6-parte` sin `transition` | `transition: background-color var(--motion-dur-hover), transform var(--motion-dur-press) var(--motion-ease-out)` | Hereda la transición global con `ease` genérico; se fija con tokens. El cambio de parte por ↑/↓ sigue sin animar. |
| R26 | `iconos/iconoTipo.css:11-19` | acento sin transición | **sin cambio** (M27) | Correcto: acompaña a la selección por teclado. |
| R27 | `laminas/estructuraInforme.css:87` | chevron 160 ease-out | sin cambio | Ya cumple. |
| R28 | `laminas/visorLamina.css:111` | img `opacity, filter 160 ease-out` | sin cambio (se añade el delay de R18 en la regla de ida) | Ya cumple. |
| R29 | `TiraMiniaturas.tsx:31`, `EstructuraInforme.tsx:46` | `scrollIntoView({ block: "nearest" })` sin `behavior` | sin cambio (no poner `smooth`) | Ya cumple M1/M25. |
| R30 | `laminas/*.css` (`:49-51`, `:132-137`, `:256-261`, `:267-270`, `:364-366`, `tiraMiniaturas.css:114`) | `@media (prefers-reduced-motion) { transition: none }` | quitar sólo `transform` de las reglas (dejar `opacity`/`color`) | Principio 11; ver §4: hoy la regla global los anula igual. |

No se encontró `transition: all`, ni `ease-in`, ni duraciones >300 ms en `laminas/` ni `iconos/` (salvo la barra
indeterminada de 2,4 s, R19). El problema dominante es otro: **las `transition` locales pisan la transición global de
`transform`**, así que el `:active scale(.97)` de la app salta en seco en casi todos los botones nuevos (R4, R7, R15, R22;
R25 sí interpola porque no declara `transition` propia, pero lo hace con el `ease` genérico).

## 4. Decisiones abiertas

| Ítem | Estado | Dónde vive | Nota |
|---|---|---|---|
| Regla global `prefers-reduced-motion` (`theme.css:185-194`) pone **toda** transición y animación a 1 ms con `!important` | **Bloqueado** (decisión de lead / app entera) | `frontend/src/app/theme.css` | Contradice «menos movimiento, no cero»: ahoga también opacidad y color. Opciones: (a) aceptar el cero en toda la app; (b) cambiar la regla global por `transition-property: opacity, color, background-color, border-color` + `animation: none`. F6 no puede hacer (b) sola sin `!important` de mayor especificidad. Hasta decidir, las reglas RM locales se escriben como si (b) existiera (no hacen daño con (a)). |
| Nota «el árbol y las partes animan altura» (dirección §5) | Reemplazada por M17/M18 | `docs/qa/direccion-diseno-editor-graficos-f6-2026-10-09.md` §5 | Altura = layout por frame; se usa `opacity + translateY(-4px)`. |
| Salidas de componentes que se desmontan (`{cond && …}`) | Aceptado: salida 0 | M13–M18, M20, M23 | Para salida animada habría que mantenerlos montados con `transition-behavior: allow-discrete` + `display:none`. Sólo vale la pena en Avisos y Editor amplio si Gonzalo lo pide. |
| Hook FLIP del lienzo (M11) | Pendiente fase 2 | `laminas/useReencajeLienzo.ts` (nuevo) | Fallback documentado en M11 si mide con jank. |

## 5. Verificación (fase 2)

- Capturas/videos a 1440×1000 y 1024×600: abrir/cerrar Inspector y Estructura (M9–M12), Avisos, Más ▾, Exportar ▾,
  expandir tarjeta y nodo, estado regenerando/error, ←/→ sostenido (debe ser seco).
- Performance panel: el toggle de paneles no debe mostrar `Layout` por frame durante los 220 ms (sólo al inicio).
- `prefers-reduced-motion` emulado: ningún desplazamiento ni escala; opacidad según la decisión bloqueada de §4.
- `make gate-front AREA=graficos` (contratos `tokensDefinidos`, `cssConcatenable`).
