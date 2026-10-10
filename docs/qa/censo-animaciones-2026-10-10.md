# Censo de animaciones y sistema de movimiento (2026-10-10)

Tipo: Censo QA
Estado: Vigente
Fecha: 2026-10-10
Autoridad: Medición sobre `main` el 2026-10-10 con comandos reproducibles; el sistema de movimiento propuesto (§3–§5) es la especificación de la unidad L37 del GOAL y se aprueba mirando la maqueta L37; la dirección creativa v3 (§Motion) y el skill de diseño de interacción de la casa son las fuentes de los principios

Pedido del dueño: «falta un censo de animaciones elegante y profesional y un
pulimiento de animaciones, desplazamiento, deslizaciones y fluidez
profesional».

---

## 1. Qué hay hoy (medido en `frontend/src`)

| Qué | Cifra | Lectura |
|---|---:|---|
| `@keyframes` declarados (todos únicos) | 233 | 61 en `theme.css`, 16 en el editor de Gráficos, 12 en el relato de aulas, 10 en la didáctica Goo; es un vocabulario sin sistema |
| Animaciones `infinite` | 54 | 11 en la didáctica Goo, 9 en `theme.css`, 5 en `boot.css`, 4 en `monitoreo.css`; solo spinners y skeleton deberían serlo |
| Duraciones en ms literales · por token | 1.112 · 1.767 | los picos literales son 120 (276), 140 (168), 160 (143), 150 (89): «casi tokens» que no lo son |
| `cubic-bezier` literales · únicos | 119 · 14 | contra cinco curvas tokenizadas |
| `ease-in-out` | 61 | ocho de ellas en entradas (`in`, `enter`, `slide`, `fade`), donde la curva correcta es `ease-out` |
| Transiciones sobre `width` · `height` · `left` | 27 · 3 · 4 | animan layout: el navegador recalcula geometría en cada frame; casi todas en Cálculo de muestra (barras, embudos, cobertura) y una en `theme.css` |
| `:hover` · con `transform` | 1.476 · 3 | el hover cambia color casi siempre; no hay «física» |
| `:active` con `transform` (press) | 13 | el botón del kit sí; chips, tiles, cards, filas, no |
| `animation-delay` · `transition-delay` | 214 · 7 | escalonados sin regla de tope (hay secuencias de 10+ elementos) |
| `scroll-behavior: smooth` · `scroll-snap` · `overscroll-behavior` | 0 · 1 · 148 | el scroll está contenido (bien) pero nunca es suave ni se ajusta |
| `scrollIntoView` · con `smooth` | 14 · 5 | «ir a» salta en 9 de 14 sitios |
| `position: sticky` · `will-change` | 123 · 15 | muchas cabeceras pegajosas, ninguna señala que hay contenido debajo |
| `prefers-reduced-motion` en CSS · en JS | 78 de 250 archivos · 24 | la regla global de `theme.css` cubre lo global; 172 hojas de features con animación propia no lo contemplan |
| WAAPI `.animate(` · `requestAnimationFrame` · FLIP | 6 · 53 · 2 | el FLIP del Home dura 460 ms (tope v3: 420) |
| Transición de ruta · de sección · de pestaña | solo Procesamiento (`route-enter/forward/back`) · 0 · 0 | cambiar de sección o de pestaña corta en seco |
| `@starting-style` · `startViewTransition` · `allow-discrete` | 24 · 0 · 0 | la entrada moderna por CSS existe en 24 reglas; nada de view transitions |
| `motion` (librería) instalada · importada | sí · 0 | dependencia muerta; la dirección exige CSS puro |

Comandos (desde `frontend/src`): `grep -rho '@keyframes [a-zA-Z0-9_-]*' --include='*.css' . | sort -u | wc -l` ·
`grep -rhoE 'animation[^;]*infinite' --include='*.css' . | wc -l` ·
`grep -rhoE '\b[0-9]{2,4}ms\b' --include='*.css' . | sort | uniq -c | sort -rn` ·
`grep -rhoE 'transition:[^;]*\bwidth\b' --include='*.css' . | wc -l` ·
`grep -rhoE ':active[^{]*\{[^}]*transform' --include='*.css' . | wc -l` ·
`grep -rlE 'prefers-reduced-motion' --include='*.css' . | wc -l`.

### 1.1 Lo que ya está bien y se conserva

- Los tokens: press 120 · fast 160 · base 220 · panel 280 · slow 420 y las
  cinco curvas (`--motion-ease-out` .23/1/.32/1, `in-out`, `standard`,
  `drawer` .32/.72/0/1, `productive`), en `tokens.css`.
- La regla global de `prefers-reduced-motion` en `theme.css` (1 ms y sin
  loops) y su equivalente en `PageFrame`, `MissionControl` y `ContextTabRail`.
- La triada de `PageFrame` por WAAPI (190/150/160) que no bloquea el teclado.
- El hover de la píldora (fill que crece desde el centro, `scaleX .94→1`), el
  press del botón del kit (`scale(.98)`), la burbuja del rail (160 ms, 6 px de
  desplazamiento), el sideover de validación con `--motion-ease-drawer`.
- El carve-out documentado de las barras de aulas (350–500 ms al primer
  render) y los loops ambientales declarados.

### 1.2 Lo que se siente «de otra generación»

1. **Cortes en seco** al cambiar de sección y de pestaña: la superficie
   nueva aparece de golpe; solo Procesamiento transiciona entre rutas.
2. **Sin física en lo que se toca**: 1.476 hovers de color y 13 presses; una
   fila, un chip o un tile no responden al dedo.
3. **Layout animado**: 34 transiciones sobre `width`, `height` y `left`
   (barras y embudos de Cálculo) que tartamudean a 60 fps y disparan reflow.
4. **Saltos al «ir a»**: 9 de 14 `scrollIntoView` sin `smooth`; cero
   `scroll-behavior`; el foco de una fila o una pregunta aparece sin
   contexto.
5. **Keyframes donde van transiciones**: toasts, switches y estados que se
   disparan rápido reinician desde cero en vez de retargetear.
6. **Entradas con `ease-in-out`** (ocho) que arrancan lentas justo cuando el
   usuario mira.
7. **Escalonados sin tope** (214 delays) y 54 loops infinitos, algunos
   decorativos (confeti, pulsos) en `theme.css`.
8. **Reduced motion parcial**: 172 hojas de features con animación propia no
   lo contemplan.
9. **Sin señal de profundidad al desplazar**: 123 cabeceras pegajosas que no
   dicen que hay contenido debajo.
10. **Vocabulario sin sistema**: 233 keyframes únicos para una app que
    necesita unas 20 coreografías.

---

## 2. Principios del sistema de movimiento

1. **Solo `transform` y `opacity`** (y `filter` acotado). Nunca `width`,
   `height`, `top`, `left`, `margin`. Lo que cambia de tamaño se anima con
   `grid-template-rows: 0fr → 1fr` o con `scaleY` desde su origen.
2. **La frecuencia decide si anima.** Lo que se usa cien veces al día no
   anima: la paleta ⌘K, cambiar de pestaña por teclado, abrir un tooltip tras
   el primero. Lo ocasional (diálogo, sideover, toast) anima con la firma. Lo
   raro (primer ingreso, cierre de un operativo) puede tener gracia.
3. **Entradas con `ease-out`, movimientos en pantalla con `ease-in-out`,
   color con `ease`, constante con `linear`.** Nunca `ease-in` en UI.
4. **Bajo 300 ms**, con los cinco tokens de la casa. La salida dura tres
   cuartos de la entrada.
5. **Nada aparece de la nada**: `scale(.96)` + `opacity 0`, nunca `scale(0)`.
   Los popovers nacen de su disparador (`transform-origin`); los modales,
   del centro.
6. **Interrumpible**: lo que se dispara rápido (toasts, switches, selección)
   usa transiciones, no keyframes.
7. **Press en todo lo presionable**: `scale(.97)` en 120 ms, con `ease-out`.
8. **El desplazamiento tiene un dueño, es suave cuando lo pide el usuario y
   no se roba el foco**: `overscroll-behavior: contain`, `scrollIntoView`
   suave con `block: nearest` y 16 px de reserva, instantáneo cuando lo
   dispara el teclado; una cabecera pegajosa gana sombra cuando hay contenido
   bajo ella; las tiras de miniaturas usan `scroll-snap`.
9. **Escalonado con tope**: máximo cuatro elementos y 30 ms entre ellos.
10. **Loops infinitos solo en spinners y skeleton.** Confeti y pulsos
    decorativos salen del shell.
11. **`prefers-reduced-motion` en todo**: cambio de estado inmediato, sin
    desplazamiento, sin loops; el escalonado desaparece.
12. **Un vocabulario**: unas veinte coreografías con nombre, token y dónde
    se usan; un keyframe nuevo exige entrar al catálogo.

---

## 3. Catálogo de coreografías (el vocabulario)

| # | Coreografía | Cuándo | Propiedades | Duración · curva | Hoy |
|---|---|---|---|---|---|
| M1 | Cambio de módulo | click en el dock | superficie: `opacity 0→1` + `translate3d(0,6px,0)` | base 220 · out | solo Procesamiento tiene transición de ruta |
| M2 | Cambio de sección | píldora | misma firma de 6 px; la píldora activa desliza el fill | base 220 · out | corte en seco |
| M3 | Cambio de pestaña | rail | solo `opacity` 120 (frecuente); por teclado, ninguna | press 120 · out | corte en seco |
| M4 | Diálogo | abrir/cerrar | `scale .96→1` + `opacity`; scrim `opacity`; centrado | base 220 · out; cierre 160 | 61 artesanales; algunos desde `scale(0)` |
| M5 | Sideover | abrir/cerrar | `translateX(24px→0)` + `opacity` | panel 280 · drawer; cierre 220 | `pulso-lens-slide` ya lo hace |
| M6 | Popover y tooltip | abrir | `scale .96→1` + `opacity` desde el disparador; tooltips siguientes sin retardo ni animación | fast 160 · out | `pulso-popover-in-kf` desde el centro |
| M7 | Press | `:active` en botón, chip, tile, fila, card | `scale(.97)` | press 120 · out | 13 sitios |
| M8 | Hover físico | elemento elevable | `translateY(-2px)` + sombra del nivel siguiente | fast 160 · out | 3 sitios con transform |
| M9 | Selección (fill) | píldora, segmented, chip | fill `scaleX .94→1` desde el centro | fast 160 · out | píldora sí; segmented y chips no |
| M10 | Switch | cambio de estado | perilla `translateX`; pista `background` | fast 160 · out | el maestro sí; los bespoke no |
| M11 | Insertar fila o card | lista | contenedor `grid-template-rows 0fr→1fr` + `opacity` | base 220 · out | aparece de golpe o anima `height` |
| M12 | Quitar fila | lista | inverso de M11 | fast 160 · in-out | — |
| M13 | Reordenar | lista, cards del Home | FLIP `translate` | base 220 · in-out | Home a 460 ms |
| M14 | Skeleton → contenido | fin de carga | crossfade `opacity` | fast 160 · out | corte en seco |
| M15 | Skeleton | espera | shimmer `translateX` | 1,4 s · linear, infinite | solo Home |
| M16 | Job | progreso | anillo por `stroke-dashoffset` o `conic-gradient` con transición | base 220 · linear | — |
| M17 | Toast | entra/sale | `translateY(8px→0)` + `opacity`; salida 160; transición, no keyframe | base 220 · out | keyframe |
| M18 | Scroll «ir a» | foco, buscar, paleta | `scrollIntoView({behavior: smooth, block: nearest})` + reserva 16 px; instantáneo por teclado | — | 9 de 14 saltan |
| M19 | Cabecera pegajosa | hay contenido debajo | sombra `--pulso-shadow-low` con `opacity` | fast 160 · ease | ninguna lo señala |
| M20 | Tira de miniaturas | láminas, páginas del Word | `scroll-snap-type: x mandatory` | — | 1 uso |
| M21 | Crecimiento de barras | primer render de un gráfico CSS | `scaleX` desde la izquierda, una vez | 350–500 · out (carve-out) | anima `width` |
| M22 | Reduced motion | preferencia del sistema | todo a cambio inmediato | 1 ms | 78 de 250 hojas |

---

## 4. Antes y después (formato de revisión)

| Antes | Después | Por qué |
|---|---|---|
| `transition: width 300ms` en barras y embudos de Cálculo (27 sitios) | `transform: scaleX(var(--p))` con `transform-origin: left` y `transition: transform var(--motion-dur-slow) var(--motion-ease-out)` | `width` dispara layout en cada frame; `transform` corre en el compositor |
| Cambiar de sección o de pestaña corta en seco | superficie con `opacity` + `translate3d(0,6px,0)` en `--motion-dur-base`; por teclado, sin animación | continuidad espacial sin castigar al que navega cien veces al día |
| `@keyframes toast-in` | `transition: transform var(--motion-dur-base) var(--motion-ease-out), opacity …` con `@starting-style` | un toast nuevo mientras sale otro retargetea en vez de reiniciar |
| 8 entradas con `ease-in-out` | `--motion-ease-out` | la entrada arranca cuando el usuario mira; `in-out` la retrasa |
| popover `transform-origin: center` | `transform-origin` en el disparador (Radix lo expone) | el popover nace de donde se pidió |
| `scale(0)` en apariciones | `scale(.96)` + `opacity 0` | nada aparece de la nada |
| 1.476 hovers de color, 13 presses | `:active { transform: scale(.97) }` en todo lo presionable; `translateY(-2px)` en lo elevable | la interfaz responde al dedo |
| `scrollIntoView()` a secas (9) | `scrollIntoView({ behavior: "smooth", block: "nearest" })` + `scroll-margin: 16px`; `auto` si lo disparó el teclado | «ir a» mantiene el contexto |
| 123 cabeceras pegajosas mudas | sombra baja que aparece con `IntersectionObserver` de un centinela | se ve que hay contenido debajo |
| 214 `animation-delay` sin tope | stagger de hasta 4 × 30 ms; el resto sin escalonar | el escalonado largo se siente lento |
| 54 loops infinitos, 9 decorativos en `theme.css` | loops solo en spinner y skeleton; confeti y pulsos fuera del shell | el movimiento que no informa, distrae |
| FLIP del Home a 460 ms | 420 (`--motion-dur-slow`) | tope de la dirección v3 |
| 1.112 ms y 119 beziers literales | cinco tokens de duración y cinco de curva; contrato que falla con literal nuevo | un solo sistema |
| 172 hojas sin `prefers-reduced-motion` | regla global por `[data-reduced-motion]` en `:root` + contrato | respeto a la preferencia en toda la app |
| `motion` ^12 instalado, 0 imports | fuera de `package.json` | la dirección exige CSS puro |

---

## 5. Cómo se verifica

- **Contrato de movimiento** (vitest sobre el CSS): cero `transition` sobre
  `width/height/top/left/margin/padding`; cero `ms` literales y cero
  `cubic-bezier` fuera de `tokens.css` en archivos migrados; cero
  `animation … infinite` fuera de spinner y skeleton; `animation-delay` ≤ 90
  ms.
- **Medición en runtime** (Playwright): `performance` de un cambio de sección
  y de la apertura de un diálogo sin frames largos (> 16 ms) en 1440×1000;
  captura con `prefers-reduced-motion: reduce` emulado donde nada se mueve.
- **La maqueta L37** es la vara visual: cada coreografía se siente ahí con
  los tokens reales antes de implementarse.

---

## 6. Trampas conocidas del movimiento

- Las animaciones infinitas cuelgan el scroll del runner de QA y dejan
  capturas en blanco: para QA, variante estática.
- En pestañas en segundo plano las transiciones CSS no avanzan: asertar
  estados finales con `transition: none` inyectado.
- `grid-template-columns` solo interpola entre listas de pistas con la misma
  estructura (`56px ↔ 240px`, no `length ↔ minmax()`).
- El FLIP necesita medir antes y después en el mismo frame; con
  `requestAnimationFrame` doble se pierde la posición previa.
