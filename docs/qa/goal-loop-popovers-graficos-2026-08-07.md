# GOAL · Las bibliotecas de Gráficos se eligen mirando, no adivinando

Tipo: Goal operativo QA
Estado: Histórico
Fecha: 2026-08-07
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado de la superficie
Consolidado en: [ADR 0068 · La composición de slides tiene una sola autoridad](../adrs/0068-la-composicion-de-slides-tiene-una-sola-autoridad.md)

- **Abierto**: 2026-08-07 · **Cerrado**: 2026-08-08 por decisión explícita
  de Gonzalo, después de acreditar L7 como último lote
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

**Decisión final de Gonzalo (2026-08-08): L7 es el último lote.** Al
acreditarlo se cierra este goal, no se abre un re-censo L8 y el trabajo pasa a
la bandeja de decisiones pendientes. Esta decisión explícita reemplaza para
operación futura el mandato indefinido de la apertura; el historial I0–I6 se
conserva como evidencia de la regla que gobernó esos lotes.

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
| **L4 · Verdad del registry** | Conteos y subtítulos derivados (B5); blueprints desde `slots`/metadata y no desde `includes()` del nombre; barrida de copy del registry (B13 y hermanos); contraste blueprint↔layout PPT real con `officer::layout_properties()` | V2, V8 | **hecho · I4** |
| **L5 · Degradación y viewports** | Estados vacío/error/sin-resultados/`dimOk=false` en los 5 viewports; matriz con foco en 1024x600 | V7 | **hecho · I5** |
| **L6 · Tests de contrato** | Registry↔picker (todo tipo del registry tiene label, categoría, blueprint), taxonomía y smoke montado de teclado; incorpora promesas A/B diferidas, cardinalidad ARIA, búsqueda, foco/Escape y reemplazo real (B17) | gate | **hecho · I6** |
| **L7 · Paridad preview↔motor PPT** | Resolver template-aware compartido por preview y renderer; corregir portada, objetivo con ícono, `top_two`, texto/splits y slots poblacionales; matriz parametrizada de los 20 tipos contra la plantilla ACNUR. Se coordina con el loop del motor PPT | V2 | **hecho · I7 · último lote** |

La cola queda cerrada en L7. No se ejecuta el re-censo que contemplaba la
regla original; tipos, familias o varas nuevas requieren una decisión nueva y
un goal distinto.

## Regla de cierre

- Gonzalo cerró el loop después de L7; ninguna regla histórica de no detención
  vuelve a arrancarlo por sí sola.
- Los hallazgos no bloqueantes quedan en la bandeja con recomendación y orden;
  decidirlos no modifica retrospectivamente la acreditación I1–I7.
- Un defecto futuro de producto se abre como reparación o goal nuevo con su
  propio scope lock, no como L8 implícito.

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
| V2 verdad registry | ✓ L1 + L4 + I6 + I7 (registry/label/categoría 20/20; card, hero, preview y renderer consumen el contrato PPT v2) | ✓ L2 + L4 + I6 (registry/label/categoría/blueprint 19/19) |
| V3 decidibilidad | ✓ L1 (B3, B4) | ✓ L2 (B11, B12, B14) |
| V4 flujo | ✓ L1 + I6 (N, flechas, Space, Enter, doble clic, insertar-y-seguir) | ✓ I6 (flechas, Space, Enter, doble clic y reemplazo real) |
| V5 accesibilidad | ✓ L1 + I3 + I6 (trap causal, Escape y retorno) | ✓ L2 + I3 + I6 (trap causal, Escape y retorno) |
| V6 direccionable | ✓ I3 + I6 (B8, apertura real y retiro de `panel`) | ✓ I3 + I6 (B8, apertura real y retiro de `panel`) |
| V7 degradación | ✓ I5 + I6 (matriz visual + smoke persistente) | ✓ I5 + I6 (matriz visual, guards y A→B persistentes) |
| V8 español | ✓ L1 + L4 | ✓ L2 + L4 (B13) |
| B17 gate persistente | ✓ I6 (20/20, `categoryOf`, teclado, búsqueda, ARIA y foco) | ✓ I6 (19/19, teclado, guards, reemplazo y A→B) |

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

- **I4 · 2026-08-08 · L4 Verdad del registry** — El catálogo R pasa a ser la
  única autoría de orden, conteos, categorías, slots y blueprint para ambas
  bibliotecas. La iteración se acotó a `graficos_metadata.R` y su test, nueve
  rutas frontend —ocho modificadas y un contrato nuevo— y este ledger; no
  tocó CSS, `editor-v2.css`, store, persistencia, `.pulso` ni motor PPT.
  - **B5 / V2:** SlidePicker sirve exactamente los 20 slides y
    GraficadorPicker los 19 graficadores del payload, en orden runtime. Las
    familias observadas son 7/4/4/1/4 en slides y 6/4/2/1/5/1 en
    graficadores. Desaparecen `CANONICAL_TYPES`, `categoryOf()` en el picker,
    `SLIDE_GRAF_SLOTS` en el host y los resolvers nombre→familia/forma; loading,
    error y catálogo vacío no resucitan inventario local.
  - **Wire R↔TS / C5:** los 20 slides declaran `blueprint` y `slot_specs`; los
    19 graficadores declaran `categoria` y `blueprint`. `slot_specs` es
    autoritativo por presencia —incluso `[]`— y `slots` se deriva sólo para
    compatibilidad con backend viejo. El wire actual contiene 33 roles
    `chart` y 5 `icon`; `unknown`, `neutral`, `other` y `future` son sentinels
    exclusivos del frontend. Un slide futuro se puede revisar pero no insertar;
    un graficador futuro disponible conserva inserción con forma neutral.
  - **Host / C4–C5:** la revalidación de commit consulta el registry y exige
    `role=chart`. La QA montada aceptó `chart` y rechazó `icon`, rol futuro
    normalizado a `unknown` y `slot_specs=[]` aunque `slots=[grafico]`; los
    rechazos no mutaron el plan. Metadata ausente devuelve `false`, pero se
    conserva como `INVALID` visual porque sin metadata no existe trigger DOM.
  - **Blueprint↔PPT real / V2:** la auditoría con `officer` cubrió 20/20 tipos,
    20/20 mappings y los 18 layouts PPT únicos de la plantilla ACNUR; todos
    existen. Card y hero comparten resolver y firma para las 20/19 entradas.
    El contraste, sin embargo, encontró deuda real fuera del alcance de L4:
    portada con fecha/subtexto fuera de canvas, objetivo con texto e ícono
    intercambiados y altura cero, preview desconocido para `top_two`, texto y
    splits descalibrados, y claves/geometría divergentes en las cuatro
    poblacionales. Por eso V2 de slides sigue parcial y se crea L7; no se
    presenta `ppt_layout` como fidelidad geométrica.
  - **B13 / V8:** se revisaron 773 cadenas del registry. El radar cambia
    `querés/necesitás` por una descripción neutral visible; `Use` y `Úselo`
    pasan a `Usa` y `Úsalo`. Estas dos últimas formas se acreditan en
    source/runtime, no como copy visible del popover, porque la biblioteca no
    renderiza todas las descripciones de argumentos.
  - **I4.F1 rechazada; I4.F2 acreditada:** la primera entrega reconstruía
    `ArgMetadata` sin `depende`, anulando 18 reglas de visibilidad del backend.
    El test causal falló porque `modo=publicos` conservaba `variable_sm`; la
    reparación tipa y normaliza `depende` escalar/array, preserva las 16 claves
    válidas y prueba `normalizeGraficosRegistry()` → `argsQueAplican()` para
    `publicos` y `sm`. El revisor independiente aprobó 18/18 dependencias. Un
    segundo rechazo por interacción insuficiente quedó cerrado con QA browser
    literal, sin atribuir esa cobertura a Vitest: L6 debe persistir el smoke.
  - **Evidencia visual:** BEFORE en
    `/private/tmp/prosecnur-l4-before-YJBJkt/` (`l4-before-report.json`, SHA-256
    `c2904b897eca29bcdf8326ee4364f54eb4b31b936f33b3f21d9766ad998d1973`).
    AFTER en `/private/tmp/prosecnur-l4-after-QJN5lI/`: 4/4 aperturas reales
    (slides/graficadores × 1440x1000/1024x600), 42 grupos geométricos, 0
    issues, misses, overflow, scroll jails o errores; reporte focal SHA-256
    `faa35a056211d8336f663cec7d20bfa08d6e80d9e607da0471d92dff4103f9e2`,
    runner `f7c9ed1f11899cff53263d5fc657211b66b1b4bdd6b243ad52de66d05feac344`
    y acta `e778eac6c604e890225ded33e1bfc7308afc58809eac0013e97ed021217109c0`.
    El slide futuro conservó el mismo hash de plan por Enter, doble clic y CTA;
    el graficador futuro se insertó con payload exacto y restauró foco a
    «Cambiar». La copia canónica del proyecto quedó prístina.
  - **Auditoría PPT:** matriz `/private/tmp/prosecnur-l4-ppt-audit-Z7iloy/matrix-20.csv`
    (SHA-256 `b2625a7e786768f1cf81a50280113073ac64bbc89f8ad47dadf0989a851c00d1`),
    plantilla `plantilla_acnur_16_9.pptx` SHA-256
    `60f18ee74cdefb2767ac24f1cfbfe321486a47132b328ebf9cb65cf487b009bd`,
    13,3333×7,5 pulgadas, master `Office Theme`.
  - **Gate final:** backend 47 tests / 1.187
    expectativas; frontend Gráficos 38 archivos / 202 tests, focal L4 19/19,
    `pnpm -C frontend typecheck`, build Vite aislado de 1.421 módulos y
    `git diff --check` verdes; Agentic OS 60/60, sync check/audit sin
    bloqueantes; revisiones independientes estática, contractual y visual y
    verificador serial **APROBADAS**. El gate documental global conserva su
    baseline ajeno de 11 errores/33 warnings —goal aún no enlazado y rutas
    transitorias de evidencia—, sin divergencia causal de L4.
    `editor-v2.css` conserva 33.123 líneas y SHA-256
    `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
    L5–L7 permanecen abiertos y el goal sigue en curso.

- **I5 · 2026-08-08 · L5 Degradación y viewports** — Ambos pickers comparten
  un modelo explícito `ready/loading/error/empty/no-results`, conservan el
  marco completo en degradación y fallan cerrados al cambiar de sesión. El
  lote queda acotado a `useGraficosRegistry.ts`, ambos pickers, sus dos hojas
  propias, un contrato focal nuevo y este ledger; no toca `SessionContext`,
  API/wire, backend, store, persistencia, `.pulso`, motor PPT, navegación ni
  `editor-v2.css`.
  - **V7 / C1–C3:** galería e inspector declaran el mismo estado y conservan
    grupo `intrinsic`, miembro/capacidad y CTA nativo visible pero
    deshabilitado. Hay una sola live-region degradada dentro del `listitem`:
    error es `alert/assertive`, los demás estados son `status/polite`, todos
    atómicos y sólo loading queda busy. El count anuncia únicamente en ready.
  - **V7 / C4:** GraficadorPicker redistribuye la suma lateral de
    `176+316` a `196+296` y, en compacto, de `150+278` a `170+258`;
    SlidePicker redistribuye sus regímenes compactos de `144+248` a
    `156+236` y de `132+236` a `156+212`. El ancho central agregado, cards,
    ownership de scroll, terminal alcanzable y geometría ready quedan
    invariantes; desaparecen los cortes arbitrarios de palabras en los rails.
  - **V7 / C5:** cualquier forma de rechazo sirve un mensaje público constante
    y veraz —conexión + recarga de la aplicación— y registra sólo tipo, nombre
    y código corto allowlisted, nunca message/body/stack. El snapshot del
    registry queda etiquetado por `sid`: A→B expone de inmediato registry nulo,
    maps vacíos y loading; sólo una caché del mismo sid conserva
    stale-while-revalidate. `dimOk` exige `state.session_id === sessionId`,
    `available=false` permanece cerrado y el modo consulta manda sobre toda
    promesa de inserción.
  - **I5.F1 rechazada; I5.F2 acreditada:** la primera entrega pasó pruebas pero
    fue vetada por dos revisiones independientes: conservaba el catálogo A
    bajo B, duplicaba regiones vivas, publicaba una recuperación falsa,
    filtraba el error técnico y contradecía el modo consulta. La segunda pasada
    del mismo writer y los mismos seis archivos cerró los seis vetos; guardian
    contractual y censo causal quedaron **APROBADOS**, sin P1/P2, migración ni
    ADR. La respuesta tardía puede reemplazar la entrada única del caché y
    provocar una recarga redundante posterior, pero no contamina la vista;
    su prueba montada queda en L6.
  - **Evidencia BEFORE:** síntesis
    `/private/tmp/prosecnur-l5-before-OhdzO8/L5-BEFORE-SYNTHESIS.md`
    (SHA-256 `3980c5db61081acca867b2f991ba8e088b63ecc532c7d175bc8b1b42ba712334`),
    matriz principal SHA-256
    `1dc61ec45b7027488444f4e5ec96aea38a0b21f3b1d6d356519e72a83ac2d29e`
    y complemento causal A→B
    `/private/tmp/prosecnur-l5-before-OhdzO8/l5-before-cross-session-report.json`.
    El BEFORE final era 10 PASS / 50 FAIL / 0 INVALID: 35/35 celdas de
    Graficadores partían palabras; SlidePicker confundía loading/error/empty
    en el inspector; y registry B antes de state B heredaba `dimOk` de A.
  - **Evidencia AFTER:** auditoría
    `/private/tmp/prosecnur-l5-after-corrective-gfVJaa/L5-AFTER-CORRECTIVE-AUDIT.md`
    (SHA-256 `b09a9d222066da524b2e2987c7a6ef6a7bface73ad44a0951e023fc25950c882`)
    y reporte final (SHA-256
    `f84dc7e2ba69d920fecb76ef93d03fd94a64c9a3cf3cc4fb067fcbdf2e3a4c7d`):
    60/60 celdas y C1–C5 PASS en 1710×1107, 1440×1000, 1366×768,
    1280×720 y 1024×600; 12/12 probes extra PASS —ocho formas de rechazo y
    ambos órdenes A→B en 1440/1024—; 0 overflow, jails, errores adicionales o
    escrituras. Foco adelante/atrás, Escape, retiro de `panel` y restauración
    conectada pasan 60/60. Root, galería, suma rail+inspector y cards ready
    tienen delta 0 px contra BEFORE. Las capturas obligatorias de todos los
    estados viven en esa misma carpeta; proyecto canónico y copia temporal
    conservan SHA-256
    `70ca67b9f5dcdbf2ad06c7144a005f48023122a57c97b152c11862412b4fde70`.
  - **Run visual rechazado conservado:**
    `l5-after-corrective-report.run1.json` (SHA-256
    `a2320ee500a4ec4db5f6f5b8ba6f7e0f613b0f8d1966b3f9dadc7ac0c0dcf27e`).
    El harness confundía la elipsis histórica del hint secundario con el
    contrato primario, buscaba `Listo para revisar` fuera del inspector y
    contaba dos veces cada abort esperado. Sólo cambió el probe temporal y se
    reejecutó la matriz completa; no hubo reclasificación manual.
  - **Gate final:** focal L5 9/9, Gráficos 39 archivos /
    211 tests, `tsc -b --force`, `pnpm -C frontend typecheck` y diff-check
    acotado verdes. `editor-v2.css` conserva 33.123 líneas y SHA-256
    `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
    El verificador serial quedó **APROBADO**: ownership exacto de seis rutas +
    ledger, índice vacío, hashes QA coincidentes, 50 capturas existentes y
    ningún P0/P1/P2 de L5. El gate documental conserva el baseline preexistente
    de 11 errores/33 advertencias, sin categoría causal nueva. L6–L7 siguen
    abiertos y el goal continúa activo.

- **I6 · 2026-08-08 · L6 Tests de contrato** — B17 deja de depender de probes
  temporales: un contrato Vitest exhaustivo y un smoke `node:test` + Playwright
  montan la aplicación React real servida por Vite, con API fail-closed y una
  fixture versionada/sanitizada derivada de `acnur_acg`. El lote sólo toca el
  contrato registry↔picker, el smoke y su fixture, la exportación de ciclo de
  vida ya existente en `scripts/ui-quick-check.mjs` y este ledger; no modifica
  pickers, hooks, host, store, `SessionContext`, CSS, backend, API/wire,
  navegación, persistencia, `.pulso` ni motor PPT.
  - **B17 / V2:** la fixture `prosecnur.qa.graficos_libraries_fixture.v1`
    queda anclada al SHA-256 canónico
    `70ca67b9f5dcdbf2ad06c7144a005f48023122a57c97b152c11862412b4fde70`.
    El contrato fija orden, label, categoría, blueprint, layout y slots de
    20/20 slides; label, taxonomía y blueprint de 19/19 graficadores; y
    card=hero para los 39 modelos. `categoryOf()` se ejerce directamente sobre
    los 20 tipos con distribución exacta 7 estructurales, 4 `1g`, 4 `2g`,
    1 `grid` y 4 población. Los sentinels conservan slide futuro sólo revisable
    y graficador futuro insertable.
  - **B17 / V4–V6:** el smoke abre Slides con `N`, comprueba autofocus, cruza
    ambos extremos del trap, busca/no-results/limpia, recorre con flechas,
    Home/End y Space, inserta con Enter y doble clic y acredita deltas reales
    `+1/+2` sin cerrar «insertar y seguir». En Graficadores, Space selecciona,
    Enter y doble clic convergen en reemplazo, Escape retira el panel y el foco
    vuelve al mismo trigger lógico.
  - **B17 / reemplazo real:** el slot poblado parte de
    `p_barras_agrupadas` con `variable`, `titulo` y el sentinel `obsoleto`; tras
    Enter queda un único `p_pie` en el mismo slide/slot, conserva los dos args
    compatibles y elimina `obsoleto`. El test consulta la misma instancia de
    Zustand montada y exige que el tipo anterior desaparezca del DOM.
  - **B17 / V7:** `loading/error/empty/no-results` montan exactamente una
    live-region en cada biblioteca con rol, politeness, atomicidad y busy
    correctos. Slide futuro, `dimOk=false` y `available=false` fallan cerrados;
    el graficador futuro disponible inserta. State B y registry B se difieren
    en ambos órdenes y una respuesta registry A llega deliberadamente después
    de que B ya es visible: nunca reaparecen inventario ni capacidad de A. No
    se exige cero refetch redundante del caché singleton, conforme a I5.
  - **Aislamiento/CI:** el router sólo admite endpoints enumerados y un POST
    computacional de coverage; cualquier endpoint imprevisto o escritura
    persistente hace fallar el test. El guard recursivo rechaza correos, claves
    PII, `state.rds` y rutas absolutas de usuario. Chromium se cierra sin
    silenciar el error y queda desconectado; Vite verifica PID muerto, puerto
    cerrado y temporal eliminado. El nombre
    `ui-quick-check-graficos-libraries-mounted.test.mjs` entra en el glob del
    job `ui-contracts`; `check-r-lock` confirma 0 contratos huérfanos.
  - **F1 rechazada; F2 acreditada:** el guardian inicial vetó seis falsos
    verdes —sin `categoryOf`, sin `N`, cleanup Chromium silenciado, trap sin
    cruzar extremos, reemplazo no exacto y sanitización sólo declarativa—. El
    mismo writer los cerró en cuatro correctivos acotados. Guardian F2 quedó
    **APPROVED / COMPATIBLE**, sin P0–P2, migración ni ADR, sobre hashes finales:
    contrato `b1c24b71ae3ce5b1c50a076ad4b9f635fb576aa36ba8552e6b827101415f581e`,
    smoke `8dfdf2b8b65f41d2c497112725ec2c77c236be4b7f3e7059c046671af49297dc`,
    fixture `638de6e790933086d62bef27b394c64dc8bff1336b6fde018a7e7219373153bc`
    y runner `b375435f0f0efe679acc39f0e063accdce4cd1632b738687c0c0cb41655af246`.
  - **Evidencia visual:** acta independiente
    `/private/tmp/prosecnur-l6-qa-EwfNSK/L6-VISUAL-QA-AUDIT.md` (SHA-256
    `7fa5c64eadae6e54b271955d532cb6f3674cfe881065fc696f6e41813dce5f45`)
    y runner `report.json` (SHA-256
    `df869ee84bbec11ed5acca205828655da5818c278e1256390b77f5278618b655`):
    4/4 capturas causales —`N` y `Cambiar`— en 1440×1000 y 1024×600;
    V1–V8 y C1–C5 PASS, 42 grupos geométricos, 0 issues/misses/jails/overflow
    o errores. Los cuatro pares equivalentes L5→L6 son píxel-exactos
    (`AE=0`, `RMSE=0`); no hay cambio visual de producto. Proyecto canónico y
    copias conservan el SHA anterior; todos los procesos/puertos propios se
    limpian y el backend ajeno 8787/PID 40553 se preserva.
  - **Gate final:** smoke final 5/5, focal 4 archivos / 31 tests,
    Gráficos 39 archivos / 214 tests, `tsc -b`, typecheck, `node --check`,
    `git diff --check` y `check-r-lock` verdes. `editor-v2.css` conserva
    33.123 líneas y SHA-256
    `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
    El verificador serial quedó **APPROVED** sobre ownership exacto de cinco
    rutas, índice vacío, hashes sin drift, capturas y cleanup; no halló
    P0/P1/P2 de L6. El diff-check global sólo conserva la línea final en blanco
    de `classroomMethodStories.css`, ruta CalcMuestra ajena y dirty desde la
    entrada. El gate documental conserva exactamente su baseline de 11 errores
    y 33 advertencias, sin categoría causal nueva. L7 permanece abierto y el
    goal continúa activo.

- **I7 · 2026-08-08 · L7 Paridad preview↔motor PPT · último lote** — La
  geometría de las 20 láminas deja de bifurcarse entre renderer, endpoint y
  React. El scope final quedó congelado en
  `/private/tmp/prosecnur-l7-scope.UKLmMK/scope-lock.md` (SHA-256
  `82427dd70d27f7bec4973427906a02a3c1835356b8bfad10507cdadcf50a6c26`),
  con chrome L6 pixel-estable y `editor-v2.css`, template, proyecto canónico,
  `SlidePreviewMockup` y `SlideCard` expresamente fuera.
  - **V2 / autoridad única:** `api/R/graficos_slide_template_contract.R`
    resuelve después de abrir la plantilla el contrato
    `graficos.slide_layout_matrix/v2`; `reporte_ppt_plan()` consume ese mismo
    objeto interno y los serializers publican sólo identidad/huella, canvas,
    `tipo`, `render_key`, layout, regiones normalizadas y diagnósticos. El GET
    aditivo acepta `scope=active|consolidated`; el endpoint v1 queda como
    adaptador. La decisión está registrada en
    [ADR 0068](../adrs/0068-la-composicion-de-slides-tiene-una-sola-autoridad.md).
  - **Seis familias causales:** portada oculta fecha/subtexto sin área útil;
    objetivo usa texto e ícono en sus bodies efectivos; `top_two` tiene
    `render_key` propio; texto y cuatro splits usan paneles calibrados; las
    cuatro poblacionales publican las mismas claves/roles que el renderer.
    Los 20 tipos ACNUR resuelven sin `layout_missing`, región visible de área
    cero ni fallback. Plantillas secundarias conservan candidatos
    `Graficos2→Graficos`, `Title and Content→General Objective` y fallback al
    primer placeholder del tipo cuando falta el `type_idx` exacto.
  - **Identidad y jobs:** `template_id` se propaga transitoriamente por preview,
    worker individual, todas-las-bases y consolidado hasta
    `reporte_ppt_plan()`. No entra en la receta persistida ni en `.pulso`; query
    explícita gana a aliases snake/camel y configuración legacy. React rechaza
    antes de cachear cualquier id/source contradictorio.
  - **Scope y persistencia fail-closed:** card, hero y `SlidePreview` consumen
    `useSlideCompositions` y el mismo objeto. La matriz sólo se pide tras un
    ack exitoso y exacto por `sid+scope+revision+generation`; no existe el
    reloj de 2,5 s. GET, autosave, guardado consolidado, flush de proyecto e
    imports acreditan el snapshot leído/enviado; failure, ack viejo,
    rehidratación de igual revisión y request en vuelo quedan cerrados y no
    reutilizan caché.
  - **A1–A9 / revisiones independientes:** dos barridas contractuales
    encontraron y cerraron propagación consolidada, scope efectivo, aliases de
    identidad/layout/placeholder, identidad de respuesta, carrera de autosave
    y rutas directas de config. El primer AFTER real añadió A8: Plumber
    reinyectaba query params y devolvía `500/E_INTERNAL unused argument` aunque
    el resolver directo fuera verde. Los callbacks matrix/v1 ahora absorben
    `...` pero leen exclusivamente `req$argsQuery`; la regresión HTTP real pasa
    de matrix/v1 `500` a `200`, matriz v2/20 ACNUR y stderr vacío. El dictamen
    contractual final es **COMPATIBLE**, sin P0/P1/P2. El primer gate serial
    detectó A9, dos resolvers diferidos de test que TypeScript estrechaba a
    `never`; se inicializaron de forma explícita sin cambiar producto ni la
    semántica de las pruebas.
  - **Gate automatizado:** backend termina `DONE` en metadata, layout preview,
    template routing, jobs, matriz y consolidado; la matriz incluye seis
    mutantes y un deck real de 20 sentinelas cuyo contrato serializado coincide
    con el renderer. Frontend termina 42 archivos / 250 tests de Gráficos,
    focal A6–A9 35/35 y focal A9 21/21; `pnpm -C frontend typecheck` y
    diff-check acotado quedan verdes tras A9. El gate serial post-A9 termina
    **APPROVED**, P0/P1/P2/P3 en cero: 93/93 tests del cliente, 1.634
    aserciones R sin fallos y HTTP real matrix v2/v1 en `200`, con stderr vacío
    y sin procesos ni puertos propios residuales.
  - **BEFORE:** acta
    `/private/tmp/prosecnur-l7-before-NiYP0i/captures/BEFORE-AUDIT.md`
    (SHA-256
    `24949aed85ba989f675e77ac7cd900c5f1589034327e3536d35512b6b68aca9f`),
    4/4 capturas reales `N`/`Cambiar` × 1440×1000/1024×600. V2 rechazaba
    `p_slide_top_two_box`: card/hero seguían referencia local sin matriz del
    renderer.
  - **AFTER visual independiente:** acta
    `/private/tmp/prosecnur-l7-after-1MnfiC/captures/AFTER-AUDIT.md`
    (SHA-256
    `21d19fe683f00465112e13790f2663ebd9dd75600b158bc6d5ff731295e024ed`)
    y metadata (SHA-256
    `afe6d8d7b4073e5e0d72120141283f2cb1255c2ddf6996b4cc5b44333bbd2cc7`):
    **APROBADO VISUAL**, V1–V8 y C1–C5 PASS, 4 PASS / 0 FAIL / 0 DEBT /
    0 INVALID. GET HTTP `200`, v2, identidad ACNUR explícita, 20/20 firmas
    card↔hero↔matriz, `SlidePreview` exacto, fallback 0 y errores
    consola/página/API/request `0/0/0/0`. Chrome BEFORE→AFTER deriva como
    máximo 0,02 px. Hashes PNG: Slides 1440
    `5f1fa0a06a334de7aabc8442a05a6183a52f99c7d2a536e7dc4c98c47041ebdf`,
    Slides 1024
    `fb16ad380fe91f7c26cf4ecfe65bd79301f407b359251deaf9e10d36876f59ee`,
    Graficadores 1440
    `c1fbe307a139b3889ee7dcc33bf9f1f132bdd5480457d61f38205755f0216f44`
    y Graficadores 1024
    `306f63a967c83edcec481be119d0efbefb54830487eb654ecb09ceb852b8bbcf`.
  - **Invariantes y documentación:** proyecto/copia conservan SHA-256
    `70ca67b9f5dcdbf2ad06c7144a005f48023122a57c97b152c11862412b4fde70`,
    plantilla
    `60f18ee74cdefb2767ac24f1cfbfe321486a47132b328ebf9cb65cf487b009bd`
    y `editor-v2.css`
    `aed5548e28d8008d8458d51f409487d7b4892d35daa4223492193130daf6bb7f`.
    El gate documental global conserva 10 errores y 35 advertencias heredados;
    ADR 0068 y este cierre no introducen categoría causal nueva.
  - **Cierre por decisión del usuario:** Gonzalo declara L7 como último lote.
    Tras el gate serial y el commit conventional se finaliza el goal, no se
    abre L8 y la siguiente conversación parte de la bandeja priorizada.

## Bandeja de decisiones

### Pendientes priorizadas después del cierre

1. **Identidad persistida de plantilla/perfil.** Hoy la sesión pasa
   `template_id=acnur_16_9` de forma explícita y transitoria; el `.pulso` no
   gana campos ni infiere por nombre o path. **Recomendación:** decidir primero
   la UX y el dueño arquitectónico en un ADR; sólo después evaluar una
   migración portable. Supuesto conservador: identidad transitoria explícita.
2. **Portada: fecha y subtexto.** La plantilla ACNUR los deja ocultos porque no
   ofrece región útil. **Recomendación:** decidir si se retiran del contrato de
   producto o si la plantilla gana placeholders gobernados; no dibujarlos con
   coordenadas locales.
3. **Pie/base y wordmark ACNUR.** Falta decidir qué información pertenece al
   renderer y cuál queda nativa en la plantilla. **Recomendación:** conservar
   el wordmark en el master y limitar el renderer a campos declarados.
4. **Plantillas genérica y secundarias.** L7 conserva aliases compatibles de
   layout y placeholder, pero la acreditación visual profunda es ACNUR.
   **Recomendación:** abrir una matriz versionada por plantilla antes de
   prometer paridad visual equivalente.
5. **Caché de composiciones.** Los maps de matriz/ack no tienen expulsión y un
   reemplazo in-place del binario con la misma identidad puede reutilizar la
   huella anterior hasta rehidratar. **Recomendación:** caché LRU por
   `sid+scope` y revisión explícita del catálogo de plantillas; no observar
   paths ni sondear archivos desde React.
6. **Overrides por instancia.** La biblioteca muestra composición efectiva por
   tipo; reglas por slide/instancia pueden variar el render final.
   **Recomendación:** diseñar un contrato de instancia separado antes de
   mezclarlo con la matriz de catálogo.
7. **Regiones dinámicas de índice, sección y tabla.** **Recomendación:** sólo
   incorporarlas cuando el renderer exponga roles y capacidad estables; no
   estimar geometría a partir del contenido en TypeScript.
8. **Superficies nominales fuera del picker.** `SlidePreviewMockup`,
   `PlanNodeCard` y el `SlideCard` de timeline no entraron a L7.
   **Recomendación:** censarlas en un goal propio si deben adoptar la misma
   gramática, preservando el PNG del renderer como oracle final.
9. **Caché del registry por sesión.** I6 acredita que una respuesta A tardía no
   contamina B, pero puede haber refetch redundante. **Recomendación:** medir
   antes de migrar el singleton a caché por `sid`.

### Historial de decisiones del loop

- ¿«Popover» o toma completa? I1 materializa el supuesto conservador como toma
  completa declarada con Radix `Dialog`; la UI la llama «Biblioteca», no
  «popover». Gonzalo puede reabrir la decisión sin bloquear L2.
- ¿Los colores por familia se mantienen? Resuelto operativamente en I1: no se
  reutilizan cyan/steel/ámbar/rosa como semántica de familia. Todas conservan
  el acento de Procesamiento y se distinguen por icono, etiqueta y composición;
  L2 adoptó la misma regla. Introducir una paleta de familias exigiría
  tokens ratificados por identidad, no aliases locales.
- ¿El catálogo tiene 19 o 20 graficadores? Resuelto en I4: registry R, payload
  y UI coinciden en 19/19; el vigésimo pertenecía al baseline documental y no
  hay evidencia de una entrada runtime retirada que deba resucitarse.
- ¿Cómo envuelve el rail compacto? Resuelto para la vara L5 en I5: el rail de
  Graficadores gana 20 px tomados del inspector, las palabras y counts quedan
  completos y el hint secundario se oculta sólo en compacto. SlidePicker aplica
  la misma redistribución en sus dos regímenes compactos. En 1710/1440/1366,
  cuatro hints secundarios de Slides conservan la elipsis CSS histórica; no se
  presentan como contenido completo. Recomendación para una vara posterior:
  decidir entre dos líneas o retirar esos hints, sin reducir cards ni galería.
- ¿Qué foco recibe una inserción que reemplaza el trigger vacío? Resuelto en I3:
  el mismo `RefObject` estable pertenece al trigger lógico antes y después del
  reemplazo, por lo que «Elegir gráfico» puede convertirse en «Cambiar» sin
  perder la restauración; existe además un ancla sólo para lectores de pantalla
  si no queda trigger lógico montado.
- ¿Qué hace un deep link a graficadores sin slot? I3 adopta el supuesto
  conservador de sólo consulta: no inventa un destino ni altera el proyecto.
  Si se necesitara commit direccionable, la recomendación es diseñar un
  parámetro `slot=` validado y no inferir el slot activo.
- La fuente de slots queda resuelta en I4: `slot_specs` del registry manda por
  presencia y el host sólo acepta rol `chart`; `slots` existe como fallback de
  backend viejo, no como segunda autoría.
- La plantilla ACNUR auditada contiene los 18 layouts referenciados, pero la
  selección del perfil sigue implícita por nombre/ruta del estudio porque el
  `.pulso` canónico no persiste `profile_id/template_id`. Recomendación: que el
  loop del motor PPT cierre esa identidad sin migrar `.pulso` dentro de este
  goal; el supuesto conservador mantiene la autodetección actual.
- El contraste real detectó seis familias de deuda preview↔renderer —portada,
  objetivo, `top_two`, texto, splits y población—. Se acotan en L7 y se
  coordinan con `goal-loop-motor-ppt-2026-08-03.md`; L4 no modifica el motor ni
  promete geometría por exponer `ppt_layout`.
- «Overrides de estilo» aparece una vez y se propaga a 18 graficadores. No es
  voseo ni un fallo funcional; recomendación para una barrida posterior de V8:
  evaluar «Ajustes de estilo» con el vocabulario técnico completo, sin un
  reemplazo aislado en L4.
- En 1024x600 el rail de Graficadores ya conserva etiquetas, counts, contenido
  y scroll sin `overflow-wrap:anywhere`; I5 lo acredita en los siete estados y
  C1–C5. La composición compacta queda resuelta sin esconder el label primario.
- I6 resuelve la dependencia de evidencia temporal: el smoke montado persiste
  promesas A/B en ambos órdenes y A tardía, cardinalidad de live-regions,
  búsqueda, teclado, foco/Escape y reemplazo real desde un slot poblado. Los
  contratos estructurales de I3–I5 permanecen como guard complementario, no
  como sustituto del browser real.
- El caché del registry sigue siendo una entrada módulo única. I6 confirma que
  una respuesta A tardía no vuelve a exponer inventario, maps ni capacidad de A
  bajo B; no exige ausencia de una recarga redundante posterior. Recomendación:
  medir esa recarga como coste separado en el próximo re-censo y migrar a caché
  por sid sólo si se materializa; no ampliar persistencia ni `.pulso` por esta
  deuda.
