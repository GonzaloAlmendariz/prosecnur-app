# GOAL · Auditoría total del motor PPT — partícula por partícula

Tipo: Goal operativo QA
Estado: En curso
Fecha: 2026-08-03
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado del motor
Prompt de arranque: `docs/qa/prompt-goal-loop-motor-ppt.md` (pegar tal cual en sesión nueva)

- **Abierto**: 2026-08-03 · **Cierra**: sólo Gonzalo
- **Alcance**: loop de convergencia sobre TODO el motor PPT — cada slide, cada
  graficador, cada argumento, cada placeholder — contra el render real. No se
  cierra hasta que cada partícula del censo tenga sus cinco pruebas en verde.
- **Frontera**: la dimensión base pertenece al loop de Gráficos multibase
  (`goal-loop-graficos-multibase-2026-08-03.md`); los hallazgos multibase se
  anotan allá. Arquitectura → ADR.
- **Banco de prueba**: proyectos de referencia (ADR 0043), en primer lugar
  `acnur_acg` (pipeline completo hasta analítica). Datos sintéticos ad hoc para
  pruebas de borde. Nada de `.pulso` de cliente en el repo.

## Qué se pide

> «Ir revisando cada aspecto del motor del PPT con extremo y sumo detalle, cada
> partícula por insignificante que sea, en profundidad; poner a prueba todas y
> cada una de las funciones, y compararlo renderizando el PPT y revisando
> visualmente con extremo detalle que todo salga bien, se aplique bien o esté
> bien pensado en primor. Ejemplo: hay campos de texto que no son campos de
> texto en el PPT sino espacios de logo u otras cosas donde no debería haber
> texto, pero la UI los muestra como tal.»

## La vara — cinco pruebas por partícula

(Definición completa en el prompt de arranque; se cita por número.)

1. **Existe donde dice existir** — el slot de la UI corresponde a un
   placeholder real del layout, del tipo correcto (`pic` no es campo de texto).
2. **Hace lo que su nombre promete** — label/descripción describen el efecto
   real, verificado encendiendo y apagando.
3. **Su default declarado es el efectivo** — cadena motor → Pulso → base del
   proyecto → tipo → override del slide.
4. **Degrada sin romper** — vacío, N=0, 1 categoría, 20 categorías, etiquetas
   larguísimas, valores especiales 90/94–99, serie de una opción.
5. **Vale igual por los cuatro caminos** — preview, PPTX, Word, consolidado.

Regla de evidencia: **ninguna partícula se declara auditada sin un render
mirado** (censo → prueba diferencial con dos PNG → mirada de detalle → prueba
de borde → paridad). Una partícula que no cambia nada visible al alternarla es
un hallazgo (arg muerto o no cableado).

## Censo medido (2026-08-03)

Medido con `pkgload::load_all("api")` sobre el working tree y
`officer::layout_properties()` sobre las plantillas. Script:
`censo_motor_ppt.R` (scratchpad; reproducible con las estructuras
`.SLIDES_META`, `.GRAFICADORES_META`, `.PRESETS_DEFAULT_PULSO`).

### Código

| Archivo | Líneas |
|---|---|
| `api/R/reporte_plan_ppt.R` | 9.418 |
| `api/R/graficos_metadata.R` | 3.952 |
| `api/R/router_graficos.R` | 3.222 |
| `api/R/graficador_*.R` (13 archivos) | 16.889 |
| `api/R/reporte_plan_word.R` | 449 |

### Slides — 20, con 110 argumentos curados

| Slide | Args | | Slide | Args |
|---|---|---|---|---|
| `p_slide_portada` | 4 | | `p_slide_grafico_texto_izquierda` | 5 |
| `p_slide_indice` | 15 | | `p_slide_2_graficos` | 4 |
| `p_slide_top_two_box` | 16 | | `p_slide_2_graficos_narrativo` | 5 |
| `p_slide_seccion` | 3 | | `p_slide_2_graficos_texto_izquierda` | 5 |
| `p_slide_objetivo_icono` | 3 | | `p_slide_2_graficos_texto_derecha` | 5 |
| `p_slide_texto` | 4 | | `p_slide_4_graficos` | 4 |
| `p_slide_tabla_tecnica` | 3 | | `p_slide_2_graficos_poblacion` | 5 |
| `p_slide_1_grafico` | 4 | | `p_slide_4_graficos_poblacion` | 5 |
| `p_slide_1_grafico_narrativo` | 5 | | `p_slide_5_graficos_poblacion` | 5 |
| `p_slide_grafico_texto_derecha` | 5 | | `p_slide_6_graficos_poblacion` | 5 |

### Graficadores — 20, con 213 argumentos curados y 63 formals no curados

| Graficador | Args | No curados | | Graficador | Args | No curados |
|---|---|---|---|---|---|---|
| `p_barras_agrupadas` | 20 | 0 | | `p_boxplot` | 9 | 2 |
| `p_barras_categoricas` | 23 | 0 | | `p_media_rango` | 10 | 2 |
| `p_barras_apiladas` | 7 | 0 | | `p_radar` | 11 | 3 |
| `p_barras_multiapiladas` | 13 | 2 | | `p_tabla` | 12 | 3 |
| `p_nube_palabras` | 8 | 0 | | `p_dim_radar` | 8 | 4 |
| `p_mapa_cobertura_territorial` | 5 | 3 | | `p_dim_radar_tabla` | 9 | 2 |
| `p_pie` | 5 | 0 | | `p_dim_heatmap` | 11 | 11 |
| `p_donut` | 5 | 0 | | `p_dim_comparativo_radarbar` | 9 | 3 |
| `p_numerico` | 8 | 0 | | `p_dim_foda` | 10 | **27** |
| `p_histograma` | 25 | 0 | | `p_dim_heatmap_criterios` | 5 | 1 |

«No curados» = formals de la función que no aparecen en `args` del registry ni
son técnicos (`data`, `diccionario`, `exportar`, `ancho`, `alto`, `...`). Hoy
viajan como `args_extra` sin superficie. `p_dim_foda` concentra 27.

### Presets — `.PRESETS_DEFAULT_PULSO`: 11 tipos, 315 argumentos

| Tipo | Args | | Tipo | Args |
|---|---|---|---|---|
| `base` | 23 | | `barras_numericas` | 14 |
| `barras_apiladas` | 46 | | `histograma` | 39 |
| `multi_apiladas` | 42 | | `pie` | 19 |
| `barras_agrupadas` | 35 | | `donut` | 16 |
| `barras_categoricas` | 33 | | `radar_tabla` | 37 |
| `nube_palabras` | 11 | | | |

Además: `.WORD_PRESETS_DEFAULT_PULSO` (2 entradas contenedoras) y
`.OVERRIDES_DEFAULT_PULSO` (7 tipos, vacíos de fábrica).

### Plantillas — 4, con 73 layouts y 456 placeholders

| Plantilla | Layouts | Placeholders | body | pic | title | dt | ftr | sldNum | ctrTitle | subTitle |
|---|---|---|---|---|---|---|---|---|---|---|
| `plantilla_16_9.pptx` (principal) | 24 | 163 | 97 | **34** | 20 | 4 | 3 | 3 | 1 | 1 |
| `plantilla_acnur_16_9.pptx` | 24 | 133 | 67 | **34** | 20 | 4 | 3 | 3 | 1 | 1 |
| `plantilla_OPSpptx.pptx` | 13 | 83 | 57 | 5 | 9 | 4 | 3 | 3 | 1 | 1 |
| `plantilla.pptx` | 12 | 77 | 54 | 3 | 8 | 4 | 3 | 3 | 1 | 1 |

### Total de partículas

- **Argumentos: 701** = 110 (slides) + 213 (graficadores) + 315 (presets) + 63
  (formals no curados).
- **Placeholders: 456.**

Divergencias con el prompt de arranque (que citaba 17 tipos/385 args de preset,
58 formals, 708 partículas): el prompt fue escrito con números de una medición
anterior; **manda el censo medido de esta tabla**, re-medible con el script. El
working tree contiene cambios sin commitear del loop multibase que pueden
explicar parte del corrimiento.

## Trampas conocidas

- Canvas y no-canvas son dos caminos; el entregable usa canvas
  (`usar_canvas = TRUE`, forzado por el router).
- `.enriquecer_presets` (router) es el punto común de preview/PPTX/Word/
  consolidado y aplica el suelo `.PRESETS_DEFAULT_PULSO`; la herencia
  `base$args → tipo$args` la hace el motor después. `.merge_args(base, preset,
  overrides)`: el último gana.
- Presets de usuario (`s$graficos_presets_defaults`, «Guardar como default»)
  tienen prioridad sobre los de fábrica en `.graficos_default_config`.
- Jobs `callr` corren contra el paquete instalado (`R CMD INSTALL` tras tocar
  código de jobs). Locale `en_US.UTF-8`. Goldens versionados pueden
  verificarse a sí mismos.

## Cola de lotes

| # | Lote | Partículas | Estado |
|---|---|---|---|
| L0 | Fundación: censo + doc | — | **Hecho (P1)** |
| L1 | Placeholders ↔ campos que ofrece la UI (prueba 1) — defecto fundacional `pic` como texto | 163 ph plantilla principal | **Hecho (P2)** — lado UI; el lado motor pasó a L1b |
| L1b | **Cluster ACNUR**: contenidos fuera de su placeholder en el render (pie sobre logo, footer en panel, subtexto/fecha invisibles, pie en hueco de ícono) | ~30 slots × plantilla acnur | Cola (siguiente) |
| L2 | Slides estructurales: portada, índice, sección, texto, tabla técnica, objetivo | 42 args | Cola |
| L3 | Slides de gráficos (1/2/4/n, narrativos, población) | 68 args | Cola |
| L4 | `p_barras_agrupadas` + preset `barras_agrupadas` | 55 | Cola |
| L5 | `p_barras_apiladas` + `p_barras_multiapiladas` + presets | 108 | Cola |
| L6 | `p_barras_categoricas` + `p_numerico` + `p_histograma` + presets | 142 | Cola |
| L7 | `p_pie` + `p_donut` + `p_nube_palabras` + `p_mapa_cobertura` + presets | 72 | Cola |
| L8 | `p_boxplot` + `p_media_rango` + `p_radar` + `p_tabla` + preset `radar_tabla` | 86 | Cola |
| L9 | Familia dimensiones (`p_dim_*`) + sus 48 formals no curados | 100 | Cola |
| L10 | Preset `base` (23) + cadena de herencia completa (prueba 3 transversal) | 23 | Cola |
| L11 | Paridad Word y consolidado (prueba 5 transversal) | — | Cola |
| L12 | Formals no curados: curar con superficie o retirar | 63 | Cola |
| L13 | Plantillas secundarias (acnur, OPS, plantilla.pptx) | 293 ph | Cola |

Al vaciar la cola se reaudita desde L1 con la vara más alta.

## Ledger de cobertura

| Fecha | Args con 5/5 | Placeholders con 5/5 | Nota |
|---|---|---|---|
| 2026-08-03 | 0 / 701 | 0 / 456 | Censo fundacional |
| 2026-08-03 | 0 / 701 | 0 / 456 | P2: avance parcial, aún ninguna partícula con 5/5. Prueba 1 verificada para los 89 slots del contrato en plantilla principal (estático + render en 6 tipos de slide); en acnur, prueba 1 FALLA en ~14 slots (→ L1b). Faltan bordes y paridad para acreditar 5/5 |

## Bandeja de decisiones

| # | Decisión pendiente | Opciones | Supuesto adoptado |
|---|---|---|---|
| D1 | Censo del prompt vs censo medido (17/385 vs 11/315 presets; 58 vs 63 formals) | (a) corregir el prompt; (b) dejar nota | (b) manda este doc; el prompt no se toca hasta que Gonzalo lo pida |

## Bitácora

### P1 — Fundación del loop (2026-08-03)

- Censo completo medido y archivado arriba: 701 partículas de argumento, 456
  placeholders, 20+20 funciones, 4 plantillas.
- Metodología reproducible: script R contra `.SLIDES_META` /
  `.GRAFICADORES_META` / `.PRESETS_DEFAULT_PULSO` + `officer`.
- Hallazgo de censo H1: **63 formals sin superficie**, con `p_dim_foda` a la
  cabeza (27) y `p_dim_heatmap` (11) → L12.
- Hallazgo de censo H2: `.OVERRIDES_DEFAULT_PULSO` existe con 7 tipos vacíos —
  verificar en L10 si la UI los expone o son ruta muerta.
- Abierto: ninguno. Siguiente: L1.

### P2 — L1: los campos que la UI ofrece vs los placeholders reales (2026-08-03)

**Censo.** Resolución slot→placeholder ejecutada para los 16 tipos del
contrato × 4 plantillas (script reproducible; harness de render versionado en
`api/scripts/qa_motor_ppt_render.R`). En la plantilla principal los 89 slots
resuelven al placeholder correcto (prueba 1 OK). El resolvedor compartido
(router y motor) cae **silenciosamente al primer placeholder del tipo** cuando
el `type_idx` pedido no existe — y en estas plantillas el primer `body` es el
logo.

**Evidencia de render** (12 PNG, plan de 6 láminas × 2 plantillas de
producción; regenerable con el harness):

- Genérica (`plantilla_16_9`): estructuralmente correcta. Portada con
  subtexto/fecha en su sitio; pie abajo-derecha; footer y texto en sus cajas.
- ACNUR (`plantilla_acnur_16_9`), todo confirmado mirando la lámina:
  - Portada: `subtexto` **desaparece** (label sembrado
    `prosecnur:title_slide:subtexto` apunta a un placeholder 0×0 en
    (13.6,7.7), fuera de lámina) y `fecha` también desaparece.
  - `slide_1`: el `pie` se escribe **encima del logo UNHCR** (azul sobre azul).
  - Narrativo: el `footer` se superpone al texto narrativo (ambos en la caja
    (0.3,1.3)).
  - `text_r`: el texto principal cae abajo-izquierda pisando la Base, el panel
    derecho queda vacío y el footer aparece dentro del panel.
  - `poblacion_5`: el `pie` cae **dentro del hueco del ícono central**.
- OPS y clásica: no alcanzables por `template_id` (solo genérica y acnur
  llegan a producción vía `.graficos_resolve_template_pptx`); además les
  faltan 11 de 16 layouts → `.add_slide_strict` abortaría el export. Se
  auditarán en L13 o se propondrá retirarlas.

**Reparado (lado UI, motor intacto):**

1. `router_graficos.R` · `.graficos_select_placeholder_props`: con `type_idx`
   declarado e inexistente devuelve `NULL` (el slot no se ofrece) en vez de
   caer al primer placeholder del tipo. Regresión: preview acnur de
   `text_r` ya no ofrece `footer`; la genérica lo conserva.
2. Contrato + `.graficos_placeholder_role`: los slots pueden declarar `role`;
   `slide_1/right` (el pie de texto) deja de clasificarse como `chart` por la
   heurística de nombres. El motor ignora el campo.
3. Registry: `p_slide_seccion.subtitulo` ahora se llama «Subtítulo (solo
   Word)» con descripción honesta — verificado en código que
   `.ph_with_slide_subtitle` solo corre para slides de gráfico.

**Gate:** `test-graficos-slide-layout-preview.R` 25/25 (3 tests nuevos) +
layout-geometry, template-routing, metadata, argumentos-ui (459 PASS, warns
preexistentes de fuentes) y engine-plan-ppt-texto: verdes. Sin TS tocado.

**Hallazgos que siguen abiertos:**

- **H3–H7 → L1b** (cluster ACNUR, lote siguiente): el render del motor sigue
  colocando mal; incluye verificar si el perfil `acnur_kobo_cruncher_plus`
  suprime base/pie (`suppress_base_placeholder`) y por tanto cuánto de esto
  llega al entregable real del cliente.
- **H8 (portada acnur)**: título rojo sobre azul y subtítulo navy sobre azul
  con contraste dudoso en el render con presets de fábrica; verificar contra
  el perfil real en L1b/L10.
- **H9 (graficadores, para L4)**: en ambas plantillas el gráfico ocupa una
  fracción menor de su caja (márgenes enormes); leyenda «Porcentaje» para una
  serie única; glifos diminutos ilegibles en el borde derecho de cada gráfico;
  y doble base («Base: 60 respuestas» del caption + «Base: 60 casos» del
  slot).
- La UI del canvas con acnur queda con menos slots dibujados (los inexactos ya
  no se dibujan); la verificación visual en app queda para el pase de L1b.
