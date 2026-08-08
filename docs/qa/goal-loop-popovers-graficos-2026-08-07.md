# GOAL · Las bibliotecas de Gráficos se eligen mirando, no adivinando

Tipo: Goal operativo QA
Estado: En curso
Fecha: 2026-08-07
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado de la superficie

- **Abierto**: 2026-08-07 · **Cierra**: sólo Gonzalo
- **Alcance**: loop de convergencia permanente sobre las dos bibliotecas del
  editor de Gráficos — el **popover de slides** (`SlidePicker`) y el **popover
  de graficadores** (`GraficadorPicker`) — incluidos sus triggers, atajos,
  estados degradados y el flujo de inserción completo. El mandato del usuario:
  el de slides «merece un alto y enorme esfuerzo de reconfiguración».
- **Banco de prueba**: `acnur_acg` (copia de referencia en
  `outputs/reference-runs/`) para catálogo completo con dimensiones apagadas;
  `acrconta` cuando haga falta multibase. Nunca commitear un `.pulso`.

## Qué se pide

> «Revisa la UI de Gráficos, en especial el popover de slides y el de
> gráficos. El de slides merece un alto y enorme esfuerzo de reconfiguración.
> Necesito que diseñes un loop que nunca se detenga de mejoras y criterios
> para que se mejore.» (Gonzalo, 2026-08-07)

**MANDATO PERMANENTE: este goal es INDEFINIDO — no termina, no finaliza y no
se detiene por absolutamente nada.** Al agotar la cola de lotes se re-censa y
se re-audita con la vara más alta. Sólo Gonzalo lo cierra.

## Las superficies (censo)

| Pieza | Archivo | Notas |
|---|---|---|
| Popover de slides | `frontend/src/features/graficos/v2/timeline/SlidePicker.tsx` (713 líneas) | `Dialog` accesible; rail de familias, grilla estable, inspector e inserción continua |
| Blueprint de slides | `v2/timeline/SlidePickerBlueprint.tsx` (318 líneas) | 20 composiciones exhaustivas; card y hero comparten la misma geometría 16:9 |
| Trigger + atajos | `TimelinePanelV2.tsx` (`SlidePickerTrigger`, teclas `N`/`A`) | CTA fijo arriba del timeline + CTA del vacío |
| Popover de graficadores | `frontend/src/features/graficos/GraficadorPicker.tsx` (353 líneas) | Portal + backdrop; secciones planas por categoría, focus trap propio |
| Taxonomía de slides | `v2/timeline/categoryOf.ts` + `SLIDE_LABELS` del store | 20 tipos, 5 familias |
| Catálogo (verdad) | registry del backend (`api/R/graficos_metadata.R`) vía `useGraficosRegistry` | 20 slides, 20 graficadores; `descripcion`, `slots`, `icono_ui`, `requisito` |
| CSS heredado | `v2/styles/editor-v2.css` — **CONGELADO** (33.123 líneas) | ~1.264 líneas mencionan `pulso-gv2-picker`; I1 confirma cero diff y SHA-256 `aed5548e…bb7f` |
| CSS propio de L1 | `v2/timeline/slidePicker.css` (1.342 líneas) | Namespace `pulso-slide-library-*`, sólo tokens `--pulso-*`, régimen corto con un dueño de scroll |
| Tests | **ninguno** | Cero referencias a `SlidePicker`/`GraficadorPicker` en `*.test.*` |

Regla derivada del censo: **todo CSS nuevo de estos popovers va en hoja
propia** (p. ej. `slidePicker.css`, `graficadorPicker.css`) que el editor
importa; a `editor-v2.css` no le crece ni una línea.

## La vara — los ocho criterios

Un lote sólo aprueba si lo que tocó cumple los criterios que le aplican, con
evidencia visual. Se citan por código (`V2 en SlidePicker > tile población`,
nunca «se ve raro»).

1. **V1 · Una sola gramática de biblioteca.** Ambos popovers comparten
   anatomía (header, búsqueda, familias, card, CTA), tokens `--pulso-*` sin
   hex, y geometría declarada. Hoy son dos lenguajes distintos.
2. **V2 · Todo lo que el popover afirma es verdad del registry.** Conteos,
   subtítulos, slots y miniaturas se derivan del catálogo real, no de
   constantes locales ni de parsear el nombre del tipo (`type.includes("2_graficos")`).
   La miniatura card y la hero dibujan el **mismo** blueprint, y ese blueprint
   corresponde al layout PPT real.
3. **V3 · Se puede decidir sin insertar.** Preview fiel, uso recomendado, qué
   requiere (dimensiones, territorio) y qué viene después. Chips que no
   informan («Slot 1», «Editorial» tres veces) no cuentan como información.
4. **V4 · Insertar N seguidos no castiga.** Modo «insertar y seguir», Enter
   inserta lo seleccionado, flechas mueven la selección en la grilla,
   doble-click documentado, el estado no se resetea de forma punitiva entre
   inserciones consecutivas.
5. **V5 · Accesible de verdad.** Focus trap + restauración de foco (hoy sólo
   lo tiene GraficadorPicker), roles y labels correctos, teclado completo,
   contraste AA. El estándar mínimo es el mejor de los dos popovers.
6. **V6 · Direccionable.** Cada popover se conecta con `usePanelDireccionable`
   y se abre por URL (`panel=biblioteca-slides` / `panel=biblioteca-graficadores`).
   Sin esto el QA visual no puede abrirlos solo (lección del QA de superficies
   efímeras) y viola la regla de overlays del contrato v3.
7. **V7 · Degrada contenida.** Catálogo vacío, registry caído, búsqueda sin
   resultados, `dimOk=false`, y los 5 viewports de la matriz (crítico:
   1024x600). El marco no se rompe con sus datos (C2/C3 del Contrato de
   Superficie).
8. **V8 · Español de la casa.** Tú peruano/neutro — nada de voseo — y sin
   sobreexplicar (la afordancia no se escribe, se ve).

## Baseline B0 — medido el 2026-08-07 (acnur_acg, 1440x1000)

### SlidePicker

- **B1** Anatomía de tile inconsistente: las 7 estructurales son cards
  compactas casi sin cuerpo; las de gráfico llevan miniatura enorme. Alturas
  dispares → la grilla parece masonry accidental. *(V1)*
- **B2** La miniatura card de «4 gráficos + ícono (población)» no dibuja el
  2×2: muestra 2 slots apilados a la izquierda y dos astillas verticales
  desbordadas en el borde derecho; la hero del inspector sí dibuja 2×2 +
  ícono. Card y hero divergen para el mismo modelo. *(V2)*
- **B3** La «Vista previa PPT» de los modelos editoriales (Portada…) es una
  caja blanca con un ícono de documento: promete preview y no la da. *(V3)*
- **B4** Chips del inspector redundantes o vacíos: «Base editorial» +
  «Editorial» + «Sin slots de gráfico» dicen lo mismo tres veces; «Slot 1…4»
  no dice qué va en cada slot. *(V3, V8)*
- **B5** El subtítulo «20 modelos de composición» sale de `ALL_TYPES.length`
  hardcodeado, no de `availableTypes` del registry: miente si el registry
  difiere. *(V2)*
- **B6** Insertar exige doble-click (sin afordancia) o viajar al CTA del
  inspector en el extremo derecho; Enter/Espacio sólo seleccionan; no hay
  flechas en la grilla. *(V4)*
- **B7** `aria-modal` sin focus trap: Tab se escapa al fondo. GraficadorPicker
  sí trae trap y restauración de foco — inconsistencia entre hermanos. *(V5)*
- **B8** No es direccionable: `useState` local, sin `usePanelDireccionable`
  ni `panel=`. *(V6)*
- **B9** Colores por familia (azul/teal/ámbar/rosa) sin gobierno declarado
  frente al tono del módulo; el CSS vive en un archivo congelado con la clase
  raíz redefinida en 3 estratos. *(V1)*
- **B10** Al abrir se resetea todo (búsqueda, familia, selección) y al
  insertar siempre cierra: armar 5 slides de población obliga a re-navegar 5
  veces. *(V4)*

### GraficadorPicker

- **B11** Descripciones truncadas a media frase con «…» («Ideal par…»);
  alturas de card desiguales; fila huérfana de 1 card. *(V1, V3)*
- **B12** Sin miniatura de la forma del gráfico — sólo un ícono chico; elegir
  visual es una decisión de forma y el popover no la muestra. Inconsistente
  con el hermano que sí dibuja blueprints. *(V1, V3)*
- **B13** Voseo argentino servido por el registry: `graficos_metadata.R:1002`
  «Ideal cuando querés la tabla en otro slot o no la necesitás». *(V8)*
- **B14** «5 modelos de dimensión ocultos» informa pero no da camino (link a
  Analítica); la regla ya fijada por el loop del radar es mostrar el control
  con su motivo y su salida. *(V3)*
- **B15** Dos vocabularios de CTA para el mismo acto: «Insertar modelo» vs
  «Usar modelo». *(V1, V8)*
- **B16** Lo que ya está bien y es el estándar a igualar: focus trap,
  restauración de foco, `data-audit-ready`, catálogo 100% registry-driven.

### Transversal

- **B17** Cero tests: ni de contrato (registry↔picker), ni de taxonomía
  (`categoryOf`), ni de accesibilidad. *(gate)*
- **B18** Nota de tooling: en el Browser pane los clicks reales por
  coordenada caían fuera (escalado); el trigger y las tiles responden bien a
  clicks programáticos y al atajo `N`. No es bug de producto; verificar
  triggers a mano antes de reportarlos rotos.

## Cola de lotes

La unidad de trabajo es el **lote**; cada lote entra por un writer con globs
acotados y termina en `verificador`. Prioridad fijada por el usuario: L1 es
la reconfiguración grande.

| Lote | Contenido | Criterios | Estado |
|---|---|---|---|
| **L1 · Reconfiguración del SlidePicker** | Anatomía única de tile con miniatura blueprint para TODAS las familias (editoriales incluidas); grilla de altura estable; miniatura card = hero (B1, B2); inserter «insertar y seguir» + Enter + flechas (B6, B10); inspector con preview fiel y slots con significado (B3, B4); focus trap (B7); CSS en hoja nueva | V1–V5 | **hecho · I1** |
| **L2 · Paridad del GraficadorPicker** | Misma gramática que L1; miniaturas de forma de gráfico; descripciones completas sin truncar; camino a dimensiones (B11, B12, B14, B15) | V1, V3, V8 | pendiente |
| **L3 · Direccionabilidad + a11y compartida** | `usePanelDireccionable` en ambos; helper de focus trap común; QA puede abrirlos por URL (B7, B8) | V5, V6 | pendiente |
| **L4 · Verdad del registry** | Conteos y subtítulos derivados (B5); blueprints desde `slots`/metadata y no desde `includes()` del nombre; barrida de copy del registry (B13 y hermanos); contraste blueprint↔layout PPT real con `officer::layout_properties()` | V2, V8 | pendiente |
| **L5 · Degradación y viewports** | Estados vacío/error/sin-resultados/`dimOk=false` en los 5 viewports; matriz con foco en 1024x600 | V7 | pendiente |
| **L6 · Tests de contrato** | Registry↔picker (todo tipo del registry tiene label, categoría, blueprint), taxonomía, y smoke de teclado (B17) | gate | pendiente |

Al vaciar la cola: re-censar (¿tipos nuevos en el registry?, ¿familias
nuevas?), subir la vara (¿animación/microinteracción?, ¿modo oscuro?,
¿previews con datos reales del proyecto?) y volver a L1.

## Reglas de no detención

- **Este loop NO se detiene. Sólo Gonzalo lo cierra.** Al cerrar un lote
  empieza el siguiente de inmediato, hasta agotar el contexto de la sesión.
- **No se detiene por una decisión**: se anota en la bandeja de abajo con
  opciones y recomendación, se toma el supuesto más conservador y se sigue.
- **No se detiene por un hallazgo ajeno**: si es del motor PPT va al loop del
  motor (`goal-loop-motor-ppt-2026-08-03.md`); si es multibase, al de
  Gráficos multibase; si es de arquitectura, a un ADR. Se anota y se sigue.
- **No se detiene por un defecto grande**: se acota, se le pone guard y entra
  a la cola como lote propio.

## Gate por lote

Proporcional al diff, siempre con evidencia visual:

- Typecheck + vitest del feature si se tocó TS; testthat de
  `^graficos` si se tocó el registry R.
- **Screenshot antes/después por hallazgo reparado**, en 1440x1000 y
  1024x600 mínimo, con el popover abierto por dirección (cuando L3 aterrice)
  o por atajo documentado.
- Contrato de Superficie citado por cláusula; verde por conformidad, no por
  ausencia.
- Ledger y registro actualizados aquí. **Un lote que no actualiza este doc no
  existió.**

## Ledger de cobertura

| Criterio | SlidePicker | GraficadorPicker |
|---|---|---|
| V1 gramática | ✓ L1 (B1, B9; paridad transversal continúa en L2) | ✗ (B11, B15) |
| V2 verdad registry | ✓ parcial (B2; B5 y contraste PPT → L4) | ✓ parcial (catálogo sí; sin blueprint) |
| V3 decidibilidad | ✓ L1 (B3, B4) | ✗ (B11, B12, B14) |
| V4 flujo | ✓ L1 (B6, B10) | — (un solo pick por apertura, aceptable) |
| V5 accesibilidad | ✓ L1 (B7) | ✓ (B16) |
| V6 direccionable | ✗ (B8) | ✗ (B8) |
| V7 degradación | parcial (1024x600; estados degradados y matriz completa → L5) | sin medir |
| V8 español | ✓ | ✗ (B13) |

## Registro de iteraciones

- **I0 · 2026-08-07** — Censo, vara y baseline B1–B18 con evidencia en vivo
  (acnur_acg, 1440x1000). Cola L1–L6 constituida. Sin código tocado.
- **I1 · 2026-08-07 · L1 SlidePicker** — Reconfiguración completa por Rama 2
  en `SlidePicker.tsx`, `SlidePickerBlueprint.tsx` y `slidePicker.css`, sin tocar
  `TimelinePanelV2.tsx`, `editor-v2.css`, API, store, registry ni `.pulso`.
  - **B1 / C2:** las 20 cards pasan de una deriva de alto de 140 px
    (1440x1000) y 124 px (1024x600) a marcos idénticos: 290×286 y 198×248,
    respectivamente, con Δ ancho/alto 0/0.
  - **B2 / V2:** Población 4 usa un solo blueprint `population4` / `poblacion_4`
    con cuatro zonas semánticas tanto en card como en hero; desviación
    normalizada máxima 0,000143 y 0,003689. La acreditación profunda contra el
    PPT real sigue en L4, por eso V2 queda parcial.
  - **B3/B4 / V3:** las editoriales muestran composición real; el inspector
    consume `titulo_humano`, `descripcion`, `slots` y `args`, llama a sus zonas
    por significado y usa copy neutral («Vista previa de composición»).
  - **B6/B10 / V4:** Enter inserta, Espacio selecciona, flechas/Home/End recorren
    la grilla, el doble clic queda visible y «Insertar y seguir» conserva
    búsqueda, familia y selección; el modo de cerrar también fue ejercitado.
  - **B7 / V5:** Radix `Dialog`, `aria-modal=true`, nombre y descripción reales,
    autofocus, trap bidireccional, Escape y restauración al trigger persistente.
  - **C1–C5:** cards y zonas internas declaran grupos `equal`, miembro y
    capacidad en el mismo frame; zonas multi-miembro tienen Δ máximo 0,02 px.
    En 1024x600 el único dueño es `stage` (505/1912, max 1407), mientras grilla
    e inspector tienen max 0; último tile y CTA son alcanzables. El runner final
    devuelve `ok=true`, 2 capturas, 0 issues, 0 misses, 0 scroll jails y 0
    errores de consola, página, API o recursos.
  - **Evidencia antes — B1/B3/B4/B6/B7/B10:**
    `/private/tmp/prosecnur-l1-baseline.ieQ85Y/slidepicker/slidepicker-1440x1000-open-n.png`
    y `slidepicker-1024x600-open-n.png`. **Después:**
    `/private/tmp/prosecnur-l1-baseline.ieQ85Y/slidepicker-after-3/slidepicker-after-3-1440x1000-open-n.png`
    y `slidepicker-after-3-1024x600-open-n.png`.
  - **Evidencia antes — B2:**
    `/private/tmp/prosecnur-l1-baseline.ieQ85Y/slidepicker/slidepicker-1440x1000-population-selected.png`
    y `slidepicker-1024x600-population-selected.png`. **Después:**
    `/private/tmp/prosecnur-l1-baseline.ieQ85Y/slidepicker-after-3/slidepicker-after-3-1440x1000-population-selected.png`
    y `slidepicker-after-3-1024x600-population-selected.png`. Inserción/scroll:
    `slidepicker-after-3-1024x600-stage-{0,mid,max,cta-before,cta-after}.png`.
  - **Reportes:** `slidepicker-after-3-report.json`,
    `probe-after-3-contract.json`, `probe-after-3-zones.json` y
    `runner/report.json` bajo `/private/tmp/prosecnur-l1-baseline.ieQ85Y/slidepicker-after-3/`.
    Checks finales: `pnpm -C frontend typecheck`; Vitest Gráficos 36 archivos /
    185 tests; `node agentic/sync-agentic-os.mjs --audit`; verificador serial
    **APROBADO**. L2–L6 permanecen abiertos y el goal sigue en curso.

## Bandeja de decisiones

- ¿«Popover» o toma completa? I1 materializa el supuesto conservador como toma
  completa declarada con Radix `Dialog`; la UI la llama «Biblioteca», no
  «popover». Gonzalo puede reabrir la decisión sin bloquear L2.
- ¿Los colores por familia se mantienen? Resuelto operativamente en I1: no se
  reutilizan cyan/steel/ámbar/rosa como semántica de familia. Todas conservan
  el acento de Procesamiento y se distinguen por icono, etiqueta y composición;
  L2 debe adoptar la misma regla. Introducir una paleta de familias exigiría
  tokens ratificados por identidad, no aliases locales.
