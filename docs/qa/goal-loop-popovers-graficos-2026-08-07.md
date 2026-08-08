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
| Popover de graficadores | `frontend/src/features/graficos/GraficadorPicker.tsx` (809 líneas) | `Dialog` accesible; rail de familias, grilla estable, inspector, roving focus y commit guardado |
| Blueprint de graficadores | `frontend/src/features/graficos/GraficadorBlueprint.tsx` (516 líneas) | 19 formas exhaustivas + fallback; card y hero comparten SVG 16:9 |
| Taxonomía de slides | `v2/timeline/categoryOf.ts` + `SLIDE_LABELS` del store | 20 tipos, 5 familias |
| Taxonomía de graficadores | `graficadorFamily()` en `GraficadorPicker.tsx` | 19 tipos actuales en 6 familias; `other` conserva tipos futuros |
| Catálogo (verdad) | registry del backend (`api/R/graficos_metadata.R`) vía `useGraficosRegistry` | 20 slides, **19 graficadores** en el censo I2; `descripcion`, `slots`, `icono_ui`, `requisito` |
| CSS heredado | `v2/styles/editor-v2.css` — **CONGELADO** (33.123 líneas) | ~1.264 líneas mencionan `pulso-gv2-picker`; I1 confirma cero diff y SHA-256 `aed5548e…bb7f` |
| CSS propio de L1 | `v2/timeline/slidePicker.css` (1.342 líneas) | Namespace `pulso-slide-library-*`, sólo tokens `--pulso-*`, régimen corto con un dueño de scroll |
| CSS propio de L2 | `frontend/src/features/graficos/graficadorPicker.css` (1.032 líneas) | Namespace `pulso-graficador-library-*`, tokens `--pulso-*`, cards iguales y régimen corto con `stage` como dueño |
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
| **L2 · Paridad del GraficadorPicker** | Misma gramática que L1; miniaturas de forma de gráfico; descripciones completas sin truncar; camino a dimensiones (B11, B12, B14, B15) | V1, V3, V8 | **hecho · I2** |
| **L3 · Direccionabilidad + a11y compartida** | `usePanelDireccionable` en ambos; helper de focus trap común; QA puede abrirlos por URL (B7, B8) | V5, V6 | **hecho · I3** |
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
| V1 gramática | ✓ L1 (B1, B9) | ✓ L2 (B11, B15) |
| V2 verdad registry | ✓ parcial (B2; B5 y contraste PPT → L4) | ✓ parcial (catálogo + blueprint; mapping/PPT → L4) |
| V3 decidibilidad | ✓ L1 (B3, B4) | ✓ L2 (B11, B12, B14) |
| V4 flujo | ✓ L1 (B6, B10) | — (un solo pick por apertura, aceptable) |
| V5 accesibilidad | ✓ L1 + I3 (B7) | ✓ L2 + I3 (B7, B16) |
| V6 direccionable | ✓ I3 (B8) | ✓ I3 (B8) |
| V7 degradación | parcial (1024x600; estados degradados y matriz completa → L5) | parcial L2 (`dimOk=false`, no-results y 1024; matriz completa → L5) |
| V8 español | ✓ | ✓ parcial L2 (B15; B13 del registry → L4) |

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
    **APROBADO**. L3–L6 permanecen abiertos y el goal sigue en curso.

- **I2 · 2026-08-07 · L2 GraficadorPicker** — Paridad completa por Rama 2 en
  `GraficadorPicker.tsx`, `GraficadorBlueprint.tsx` y
  `graficadorPicker.css`, sin tocar `GraficadorSlot.tsx`,
  `GraficadorTypeIcon.tsx`, `editor-v2.css`, API, registry ni `.pulso`.
  - **Censo / C5:** la fuente runtime contiene 19, no 20, graficadores. El
    picker pasa de 11 visibles —tres ordinarios sin categoría y cinco
    dimensiones ocultas— a 19/19, distribuidos 6/4/2/1/5/1 en Distribución,
    Resumen numérico, Comparación, Texto abierto, Dimensiones y Territorio;
    `Otros` conserva cualquier tipo futuro.
  - **B11 / V1 / C1–C4:** BEFORE medía anchos 273,5–1.130 px y alto
    147,94–188,8 px en 1440, y anchos 300,66–926 px en 1024, con 3/5
    descripciones truncadas. AFTER-2 fija 254×366 y 252×366, respectivamente,
    con Δ ancho/alto 0/0, singleton sin stretch, texto completo, overflow X 0
    y cero issues, misses o scroll jails focales. AFTER-1 fue rechazado por
    heredar `white-space: nowrap` (59/61 overflows; 330/291 px de X oculta) y
    se reparó antes de acreditar el lote.
  - **B12 / V3:** los 19 tipos actuales resuelven una forma SVG específica y
    un fallback futuro; card e inspector montan el mismo componente, `viewBox`
    `0 0 160 90` y marcas equivalentes. Barras, histograma, nube, radar,
    radar+barras, FODA, heatmaps y mapa se inspeccionaron en vivo.
  - **B14 / V3:** las cinco dimensiones permanecen visibles con
    `dimOk=false`, se pueden seleccionar para decidir, no aceptan Enter,
    doble clic ni CTA, explican el requisito y enlazan a `/analitica`. El mapa
    respetó la capability real del proyecto; la rama `available=false` conserva
    `disabled_reason` y queda en la matriz explícita de L5.
  - **B15 / V1/V8:** desaparece «Usar modelo»; «Insertar modelo» es el único
    commit. Click/Espacio sólo seleccionan; Enter, doble clic y CTA convergen
    en un guard central. Los bloqueados dicen «Revisa el requisito» en vez de
    prometer una inserción silenciosa.
  - **B16 / C4:** Radix `Dialog`, nombre y descripción, autofocus, trap,
    Escape y backdrop restauran al trigger. En 1024x600 `stage` es el único
    dueño Y (max 3.425); grilla e inspector tienen max 0, y el último modelo y
    el CTA son alcanzables. El estado sin resultados declara grupo, miembro y
    capacidad tanto en galería como inspector.
  - **Evidencia antes:**
    `/private/tmp/prosecnur-l2-baseline.jcvFuV/l2-before-picker-1440x1000-open.png`
    y `l2-before-picker-1024x600-open.png`. **AFTER-1 rechazado:**
    `/private/tmp/prosecnur-l2-after.q8FwpA/graficador-picker-after-report.json`.
    **Después aprobado:**
    `/private/tmp/prosecnur-l2-after2.YHLAf8/l2-after2-picker-1440x1000-open.png`,
    `l2-after2-picker-1024x600-open.png` y
    `graficador-picker-after2-report.json` (SHA-256
    `0d3073a625c70bc5cdf7196884ab04d48008be68674fc1a36481465b1ad21a95`).
  - **Gate final:** `pnpm -C frontend typecheck`; Vitest Gráficos 36 archivos /
    185 tests; `pnpm -C frontend build`; audit agentic; censo
    R↔taxonomía↔blueprint 19/19; verificador serial **APROBADO**.
    `editor-v2.css` conserva 33.123 líneas y SHA-256
    `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
    B13 y L3–L6 permanecen abiertos; el goal sigue en curso.

- **I3 · 2026-08-08 · L3 Direccionabilidad + a11y compartida** — Host único
  de bibliotecas y contrato de apertura/cierre común por Rama 2. El cambio se
  acotó a `GraficosLibrariesHost.tsx`, `panelesGraficos.ts`,
  `useLibraryDialogA11y.ts`, los cinco consumidores de Gráficos,
  `manifiesto.ts` y un test de contrato focal; no añadió ni modificó CSS,
  `editor-v2.css`, API, registry R, persistencia ni `.pulso`.
  - **B8 / V6:** BEFORE retenía la URL pero abría 0/4 diálogos por dirección y
    las cuatro aperturas interactivas escribían 0/4 parámetros `panel`. AFTER-2
    acredita 4/4 deep links y 4/4 escrituras de URL con
    `panel=biblioteca-slides` o `panel=biblioteca-graficadores`; ambos ids están
    declarados en el manifiesto, montados una sola vez en el editor y consumen
    exactamente una instancia de `usePanelDireccionable`.
  - **B7 / V5 / C4:** ambos diálogos conservan Radix modal y comparten captura
    del trigger lógico, autofocus, trap bidireccional, Escape, backdrop y
    restauración. Hay 30/29 focables en la biblioteca de slides/graficadores;
    la apertura inmediata tras cerrar pasa 2/2 y no permite que un ciclo viejo
    robe el foco al nuevo.
  - **C5 / deep link de graficadores:** como una URL no identifica slot, la
    apertura directa entra en modo de consulta, sin target ni commit implícito,
    con razón visible y CTA «Listo para revisar». Las dos pruebas de consulta
    no cambian slide, slot, modo, inspector ni autosave. La apertura desde un
    slot captura y revalida el target. La inserción desde un slot vacío pasa
    2/2 y el foco vuelve al mismo lugar lógico cuando «Elegir gráfico» se
    convierte en «Cambiar»; el reemplazo comparte esa ruta por contrato de
    código, pero no se presenta aquí como secuencia visual ejercitada.
  - **I3.1 rechazada; I3.2 acreditada:** la primera implementación difería la
    limpieza del target y dejaba pasar `N` dentro del modal, de modo que una
    reapertura rápida podía heredar estado o competir por foco. La corrección
    limpia el target sincrónicamente, captura el `RefObject` estable, invalida
    retornos de foco de ciclos anteriores e ignora `N` dentro de cualquier
    diálogo. AFTER-2 pasa 2/2 reaperturas a 79/96 ms y 2/2 guards del atajo.
  - **C1–C5 / geometría visual:** 102/102 comprobaciones, 2/2 cláusulas C1–C5,
    0 errores de consola/página/API/recursos, sin scroll jail y con contenido
    terminal alcanzable. Al no tocar estilos, se conserva la geometría
    acreditada de L1/L2: tiles de slides 290×286 en 1440 y graficadores 254×366;
    en 1024 la gramática compacta tampoco deriva.
  - **Evidencia BEFORE:**
    `/private/tmp/prosecnur-l3-before.vVVWtR/before-slides-{1440x1000,1024x600}-url.png`,
    `before-slides-{1440x1000,1024x600}-key-n-open.png`,
    `before-graphs-{1440x1000,1024x600}-url.png` y
    `before-graphs-{1440x1000,1024x600}-click-open.png`;
    `l3-before-direccionabilidad-report.json` (SHA-256
    `f0b4a6f4c747c1d0b58db310a1fa09728b4460150390fae27e66e224e0cad7da`).
  - **Evidencia AFTER-2:**
    `/private/tmp/prosecnur-l3-after2.JnBYJs/after2-slides-{1440x1000,1024x600}-url-open.png`,
    `after2-slides-{1440x1000,1024x600}-n-open.png`,
    `after2-graphs-{1440x1000,1024x600}-url-open.png`,
    `after2-graphs-{1440x1000,1024x600}-slot-open.png` y
    `after2-graphs-{1440x1000,1024x600}-slot-committed.png`;
    `l3-after2-direccionabilidad-report.json` (SHA-256
    `dd18e7122350cd6446d4b330884ea96e74781c1ce3f6688d40e3b8c40db4cd3b`) y
    `visual-inspection.md` en el mismo directorio.
  - **Primer gate serial de cierre rechazado:** el producto y todos los checks
    quedaron verdes, pero el ledger mezclaba los 76 ms de un intento previo con
    los 79 ms del reporte final y atribuía a las 2/2 inserciones una prueba de
    reemplazo que no se ejecutó. Ambas sobreafirmaciones se retiraron antes del
    re-gate. El SHA del runner corresponde expresamente a
    `runner/report.json`, no a la sonda `probe-l3-after2.mjs`.
  - **Gate final:** `pnpm -C frontend typecheck`; Vitest focal 9/9 y Gráficos
    37 archivos / 194 tests; build Vite de 1.421 módulos; audit agentic;
    revisiones independientes de arquitectura y Contrato de Superficie
    **APROBADAS**; re-gate serial del verificador **APROBADO**. `editor-v2.css`
    conserva 33.123 líneas y SHA-256
    `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
    L4–L6 permanecen abiertos y el goal sigue en curso.

## Bandeja de decisiones

- ¿«Popover» o toma completa? I1 materializa el supuesto conservador como toma
  completa declarada con Radix `Dialog`; la UI la llama «Biblioteca», no
  «popover». Gonzalo puede reabrir la decisión sin bloquear L2.
- ¿Los colores por familia se mantienen? Resuelto operativamente en I1: no se
  reutilizan cyan/steel/ámbar/rosa como semántica de familia. Todas conservan
  el acento de Procesamiento y se distinguen por icono, etiqueta y composición;
  L2 adoptó la misma regla. Introducir una paleta de familias exigiría
  tokens ratificados por identidad, no aliases locales.
- ¿El catálogo tiene 19 o 20 graficadores? I2 corrige el censo a los 19 nombres
  que el registry R y el payload runtime sirven hoy; no se inventa un modelo
  vigésimo para satisfacer el baseline histórico. L4 debe rastrear si el conteo
  anterior fue deriva documental o una retirada deliberada.
- ¿Cómo envuelve el rail compacto? AFTER-2 conserva todo el texto sin clipping,
  pero `overflow-wrap:anywhere` puede partir «Distribución» o «Dimensiones» en
  1024. Recomendación para L5: ensanchar el rail o reservar mejor el count antes
  de relajar el wrap; el supuesto conservador actual prioriza contenido completo.
- ¿Qué foco recibe una inserción que reemplaza el trigger vacío? Resuelto en I3:
  el mismo `RefObject` estable pertenece al trigger lógico antes y después del
  reemplazo, por lo que «Elegir gráfico» puede convertirse en «Cambiar» sin
  perder la restauración; existe además un ancla sólo para lectores de pantalla
  si no queda trigger lógico montado.
- ¿Qué hace un deep link a graficadores sin slot? I3 adopta el supuesto
  conservador de sólo consulta: no inventa un destino ni altera el proyecto.
  Si se necesitara commit direccionable, la recomendación es diseñar un
  parámetro `slot=` validado y no inferir el slot activo.
- La revalidación de commit usa hoy `SLIDE_GRAF_SLOTS`, la misma verdad estática
  del editor. L4 debe contrastarla con el registry/runtime y decidir una fuente
  canónica antes de cambiar el contrato.
- El test focal de I3 cubre el contrato estructural y el QA en vivo acredita
  Router, Radix y `requestAnimationFrame`; L6 debe añadir el smoke montado
  reproducible para que esas carreras no dependan sólo de evidencia manual, e
  incluir un reemplazo real desde un slot ya poblado.
