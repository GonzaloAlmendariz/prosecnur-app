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
| L1b | **Cluster ACNUR**: contenidos fuera de su placeholder en el render (pie sobre logo, footer en panel, subtexto/fecha invisibles, pie en hueco de ícono) | ~30 slots × plantilla acnur | **Hecho (P3)** — quedan D2 y D3 en bandeja |
| L2 | Slides estructurales: portada, índice, sección, texto, tabla técnica, objetivo | 42 args | **Hecho (P4–P6)** — 32/42 args con diferencial (top_two_box va en L3); H11/H16/H17 reparados; queda paridad Word (→L11) e ícono de catálogo |
| — | **Regla de cola (pedido de Gonzalo 2026-08-03): todo lo específico de ACNUR (D2, D3, re-render acnur de L2+) se difiere al FINAL de la cola** | | Vigente |
| L3 | Slides de gráficos (1/2/4/n, narrativos, población) | 68 args | **Hecho (P7+P8)** — contrato saneado (11 fantasmas fuera, 2 destapados) y diferenciales de render mirados; queda H18 (borde top_two_box) y paridad (→L11) |
| L4 | `p_barras_agrupadas` + preset `barras_agrupadas` | 55 | **En curso (P9)** — defaults editoriales reparados (leyenda/colores de cruce/Base única); quedan H18, H20 (orden) y el barrido arg-por-arg |
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
| D2 | El cajón inferior-derecho de la plantilla ACNUR (9.20,6.92) se superpone al arte del logo UNHCR del propio template: cualquier pie/footer alineado a la derecha ahí pisa el wordmark | (a) encoger/mover el box en el template hasta ~x 10.9; (b) alinear izquierda solo en acnur; (c) suprimir pies inferiores-derechos en acnur | Se deja el box del template como destino (es SU box declarado); la reparación de la plantilla es data de diseño y la decide Gonzalo. El perfil ACNUR ya esquiva esto en slide_1 vía `source_footer_*` (2.15,6.96) |
| D3 | La portada ACNUR tiene `subtexto` y `fecha` aparcados a 0×0 fuera de lámina (labels sembrados `prosecnur:title_slide:subtexto`/`date` en (13.55,7.72)): ¿diseño deliberado o accidente del sembrado? | (a) diseño: ocultar ambos campos en la UI cuando template=acnur; (b) accidente: darles geometría real en el template | Se asume (a) —la portada ACNUR no muestra fecha/subtexto— y el motor los deja invisibles; la UI los sigue ofreciendo (mejora pendiente si se confirma (a)) |
| D4 | `iconos_focos_left_cm`/`top_cm` del índice y `etiqueta` de 1/2/4_graficos y población: formals sin superficie u ofrecidos sin efecto. ¿Exponer/implementar o dejar ocultos? | (a) left/top: exponer con validación de rango; (b) dejar ocultos (foot-gun de composición); (c) etiqueta: implementarla como tag visual donde falta placeholder | Adoptado (b) para left/top (decisión previa fijada en test) y retirada la `etiqueta` de la superficie donde el motor no la consume; (c) queda como mejora si Gonzalo la pide |

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

### P3 — L1b: el motor coloca pies, textos e íconos por geometría real (2026-08-03)

**Causa raíz confirmada**: los `type_idx` del contrato están calibrados contra
`plantilla_16_9` y la ACNUR **no tiene el body-logo**, así que toda su
numeración de `body` corre en uno; el fallback por tipo colocaba en el primer
body del layout. Además el perfil `acnur_kobo_cruncher_plus` ya reposiciona el
pie de `slide_1` vía `source_footer_*` (2.15,6.96) — ese caso concreto no
llegaba al entregable con perfil; los footers de narrativos/text_*/población y
los íconos sí.

**Reparado (motor):**

1. Nuevo `.ppt_calibrar_pies_iconos` en `reporte_plan_helpers.R` (el monolito
   congelado queda en su línea base, 9.418): recalibra por geometría del
   layout real — pie = cajón inferior más a la derecha; base = el más a la
   izquierda; panel de texto = cajón alto lateral; ícono = cuadrado chico
   centrado. Absorbe el bloque ad-hoc que ya hacía esto para `slide_1`
   (`.ppt_bottom_text_specs` sigue existiendo y testeado).
2. Sin cajón utilizable → `spec$suppress` y `.ph_with_strict` omite el
   contenido en vez de colocarlo en un placeholder arbitrario.
3. Con un solo cajón inferior y slot `base` presente, el pie se suprime (el
   cajón es de la base).

**Evidencia de render (antes → después, acnur):** footer narrativo pisando el
texto → cajón inferior derecho; texto principal de `text_r` abajo-izquierda
pisando la Base y panel vacío → texto en su panel, Base legible; pie de
`poblacion_5` en el hueco del ícono → cajón inferior. Genérica: sin cambios
visibles (paridad verificada lámina a lámina). PNGs regenerables con
`api/scripts/qa_motor_ppt_render.R`.

**Gate:** `test-reporte-plan-calibracion-pies.R` nuevo (20 asserts: posiciones
acnur, posiciones históricas de la genérica, supresión sin cajón) + 14 suites
de plan/render: **726 PASS / 0 FAIL**. Audit de congelados limpio para
`reporte_plan_ppt.R`.

**Abierto:** D2 (box acnur sobre su propio logo) y D3 (portada acnur sin
fecha/subtexto) en bandeja; verificación visual en app (canvas + preview con
proyecto acnur) pendiente para un pase de QA visual conjunto.

### P4 — L2 parcial: slides estructurales, camino feliz + bordes (2026-08-03)

Decks diferenciales A (mínimos) y B (todo activado) sobre la genérica,
10 láminas miradas (script en scratchpad, patrón replicable con el harness).

**Verificado en verde (pruebas 1–3 sobre 17 args):**

- Portada: `titulo`/`subtitulo`/`fecha`/`subtexto` — presentes y en su sitio
  en B, ausentes limpiamente en A.
- Sección: `titulo` ✓; `subtitulo` e `introduccion_word` NO aparecen en PPT,
  consistente con sus labels (van a Word). Diferencial confirmado.
- Texto: `titulo`/`texto`/`bullets` (con viñetas)/`base` ✓ en B; A sin restos.
- Tabla técnica: `titulo`/`filas`/`pie` ✓; con 2 filas degrada sin romper.
- Objetivo: `texto` ✓; `titulo` e `icono` con hallazgos (abajo).

**Hallazgos nuevos:**

- **H10 (texto)**: el bloque ocupa una fracción mínima de la lámina (caja de
  12.4×2.8 con tipografía chica y el resto vacío). Funcional pero pobre;
  candidato a tamaño adaptativo. Decisión de diseño pendiente.
- **H11 (objetivo)**: `titulo` cae en la franja vertical del layout
  (0.75×4.54, banner lateral sin rotación declarada) y se rasteriza vertical
  letra-a-letra: ilegible. El registry no avisa que ese título es un banner
  lateral. Reparar en el próximo tramo (aviso en registry o estilo rotado
  deliberado).
- **H12 (tabla técnica)**: las filas se estiran a llenar toda la caja — con 2
  filas quedan celdas de altura enorme. Borde sin rotura, estética pobre.
- **H13 (objetivo/icono)**: un graficador arbitrario como `icono` desborda el
  cuadro (etiquetas y caption por fuera). El camino real usa el catálogo de
  íconos; falta la prueba con ícono del catálogo y el borde «gráfico como
  ícono» debería recortarse o avisarse.

**Pendiente L2:** índice (15 args), top_two_box va en L3; paridad Word de
sección (`subtitulo`/`introduccion_word` deben SÍ aparecer allá); prueba con
ícono real del catálogo.

### P5 — L2: los 15 args del índice, con 11 renders mirados (2026-08-03)

Nueve variantes + dos de formato de subíndices, todas contra la genérica.

**En verde (diferencial confirmado):** índice vacío → layout de plantilla con
índice de fábrica; `titulo`+`secciones` → filas numeradas; `subtemas` → 3.1…
bajo la última sección (como documenta el registry); `subindices` distribuye
por sección cuando llega **nombrado** (`list("Sección"=c(...))`), como
data.frame o como líneas `Sección: item` — mi primera prueba con lista sin
nombres cayó a la última sección, que es exactamente el fallback documentado
(H14 cerrado: correcto); `mostrar_iconos_focos=FALSE` conserva los focos
originales de la plantilla; `iconos_focos` reemplaza posicionalmente;
`iconos_focos_diametro_cm`/`icon_scale` actúan; `subtopic_badge_fill/width/gap`
tiñen y compactan los badges; `redibujar_focos` + `objeto_unico` +
`left_cm`/`top_cm` mueven los focos redibujados (con la advertencia de que las
bombillas del fondo de plantilla no se mueven — puede quedar descentrado, es
el efecto pedido).

**Hallazgos:**

- **H15 (menor)**: `iconos_focos_fill` escalar tiñe solo el primer foco (el
  código rellena el resto con los defaults, deliberado). El label «Colores de
  focos» no lo dice; falta descripcion que aclare el comportamiento posicional.
- **H16 (borde, reparar)**: con 10 secciones el índice **desborda la lámina**
  (subtemas cortados por abajo) y el badge de dos dígitos parte «10.1» en dos
  líneas. No compacta ni avisa.
- **H17 (borde, reparar)**: un título de índice que envuelve a dos líneas
  queda **pisado por la primera fila** (sin reflow del bloque).

**Gate:** solo renders (sin diff de código en este tramo).

### P6 — L2: reparación de H11, H16 y H17 con render verificado (2026-08-03)

**Reparado:**

1. **H16/H17 — geometría adaptativa del índice.** Nuevo `.indice_fit_layout`
   (`reporte_plan_helpers.R`; el monolito congelado baja a 9.402, −16 bajo su
   línea base): estima las líneas del título (mayúsculas bold, 0.85 em/char),
   agranda su caja y corre la tabla; dimensiona el badge de subtema por
   dígitos reales (0.26 + 0.07 por carácter extra sobre «9.9»); y comprime
   filas/subtemas con pisos (0.26/0.34) y reducción tipográfica suave cuando
   el bloque desborda el límite de 7.05 — el colchón fijo no se escala, la
   reducción recae entera en las filas. Overrides del analista = punto de
   partida; la compresión solo actúa ante desborde.
2. **H11 — honestidad del título del objetivo.** El registry ahora lo llama
   «Título (banda lateral)» y explica que va en la banda vertical angosta del
   costado (recomienda una palabra corta). La banda es diseño del layout
   (0.75×4.54 sin rotación declarada); no se toca el motor.

**Evidencia de render (antes → después):** título de 3 líneas completo con la
tabla debajo (antes: tercera línea pisada); 10 secciones + 6 subtemas dentro
de lámina con badges «10.x» enteros (antes: desborde y «10.1» partido);
control de 3 secciones idéntico al histórico. Residuo menor: en el peor caso
el descender de la última fila roza el borde inferior — anotado, no bloquea.

**Gate:** `test-reporte-plan-indice-fit.R` nuevo (16 asserts: geometría
histórica intacta, corrimiento por título, compresión al presupuesto, badge
adaptativo, overrides respetados) + engine-plan-ppt-texto (113), calibración
de pies (20) y layout-geometry (78): **todo verde**. Audit de congelados
limpio.

**Regla nueva de cola:** por pedido de Gonzalo, todo lo ACNUR (D2, D3 y
re-render acnur) se difiere al final. Siguiente: **L3 — slides de gráficos
(68 args, incluye top_two_box)** sobre la plantilla genérica.

### P7 — L3: el contrato args↔formals de los 14 slides, saneado (2026-08-03)

**Hallazgo estructural (misma familia que el defecto fundacional):** el puente
payload→constructor filtra con `payload[names(payload) %in% formals(fn)]`
(router_graficos.R) — **todo arg curado sin formal muere en silencio**. Censo
sistemático (script R contra `.SLIDES_META` + `formals()`):

| Slide | Fantasmas (UI ofrecía, motor descartaba) | Ocultos con render real |
|---|---|---|
| `p_slide_1_grafico` | `etiqueta` | `subtitulo` |
| `p_slide_2_graficos` | `etiqueta` | — |
| `p_slide_4_graficos` | `etiqueta` (formal existe pero el motor la ignora: «tag/etiqueta no tiene placeholder en 4_paneles») | — |
| `p_slide_2_graficos_poblacion` | `pie`, `etiqueta` | `texto` |
| `p_slide_4_graficos_poblacion` | `pie`, `etiqueta` | — |
| `p_slide_5/6_graficos_poblacion` | `base` | — |
| `p_slide_indice` | — | `left_cm`/`top_cm` (ocultos a propósito → D4) |

**Reparado:** los helpers `.args_slide_titulos_base` /
`.args_slide_poblacion_basico` ahora reciben `incluir` y cada slide ofrece
exactamente lo que su constructor acepta y el motor consume. Se dio superficie
a `subtitulo` (1_grafico — render verificado: aparece bajo el título) y
`texto` (poblacion_2 — ya verificado en P2). `etiqueta` sigue viva donde sí
funciona (narrativos y grafico+texto, se combina con el texto).

**Guard permanente:** `test-graficos-slides-args-contrato.R` — todo arg
curado debe ser formal del constructor; los destapados no pueden volver a
esconderse; la etiqueta no puede volver a ofrecerse donde no se consume.

**Gate:** contrato 47, metadata 230, argumentos-ui 459, slide-layout-preview
25: **todo verde**. Render diferencial del subtítulo mirado (con/sin).
Detalle menor anotado: el color default del subtítulo (`#85BB85`) tiene
contraste flojo sobre el fondo gris — va al lote de presets (L10).

**Pendiente L3:** diferencial de render por slide de gráficos (top_two_box,
2/4 gráficos, etiqueta en narrativos, íconos de catálogo en población) y
bordes.

### P8 — L3: diferenciales de render de los slides de gráficos (2026-08-03)

Trece láminas miradas (decks `L3_sub`, `L3_ttb`, `L3_rest` del harness).

**En verde:** `subtitulo` de 1_grafico (bajo el título); `top_two_box` con
defaults y con 12 args customizados a la vez (valores, etiquetas, índices
abajo-izquierda, extremos, paleta, grosores, tamaños, color de %, margen de
llave, flecha) — borde de 1 sola categoría degrada sin romper; 2_graficos y
4_graficos con base/pie en su sitio; `etiqueta` de narrativo se combina sobre
el texto como promete; población 4/6 con **ícono real de catálogo** centrado y
pie abajo-izquierda (la calibración de P3 en acción).

**Hallazgos:**

- **H18 (borde, reparar)**: `top_two_box` con 10 categorías **recicla la
  paleta cada 4** (el segmento top-two queda con colores «negativos»), las
  etiquetas largas de la leyenda se superponen ilegibles y los swatches
  desbordan sobre el texto del extremo derecho.
- **H19 (cerrado en esta pasada)**: `etiqueta` de poblacion_5/6 es un formal
  aceptado pero **jamás dibujado** — retirada de la superficie y sumada al
  guard del contrato (49 asserts).
- `accent_color` de top_two_box quedó con diferencial no concluyente (el color
  de prueba era casi idéntico al default) — re-probar en la reauditoría.

**Gate:** contrato 49 + metadata 230 + argumentos-ui 459: todo verde. Sin TS.

**Ledger tras P8:** los 110 args de slides tienen censo y ~70 tienen
diferencial mirado en la genérica; ninguno acredita aún 5/5 (falta paridad
Word/consolidado — L11 — y bordes sistemáticos por slide).

### P9 — L4: los defaults de barras agrupadas se ven bien de verdad (2026-08-03)

Mandato directo de Gonzalo: «los gráficos no solo deben ser funcionales,
tenemos que establecer el default que se vea mejor». Diagnóstico con render
lado a lado (firma del motor vs suelo Pulso — producción usa el suelo) y
forense de píxeles + código:

**Tres defectos de default, reparados con render antes/después:**

1. **Cruce ilegible (gris sobre gris).** `reporte_plan_ppt.R` asignaba
   colores de serie con la regla ACNUR hardcodeada («intervención»→azul,
   «comparación»→teal, **todo lo demás→#B8C4CE**): un cruce por sexo salía
   con ambas series del mismo gris y porcentajes blancos invisibles. Ahora,
   si ninguna serie tiene marca institucional, decide la paleta de la casa
   (`.graficos_mk_palette`): azul marino/teal distinguibles. La regla ACNUR
   sobrevive intacta para intervención/comparación.
2. **Leyenda muerta.** El suelo traía `mostrar_leyenda = FALSE` global — con
   cruce no había forma de saber qué barra era de quién. Ahora el suelo dice
   TRUE, el graficador **auto-oculta la serie sintética única** («Porcentaje»)
   y una serie única con nombre propio conserva su leyenda. De paso: el arg
   UI tenía `default` **duplicado** (`FALSE` y `TRUE` — R leía el primero);
   quedó un solo TRUE coherente con el suelo.
3. **Base duplicada.** Cada lámina mostraba «Base: N» dos veces (caption del
   gráfico + placeholder auto del slide). El placeholder ya no auto-infiere
   para `barras_agrupadas`; la base manual del analista se respeta siempre.

**Gate:** `test-graficador-agrupadas-defaults-editoriales.R` nuevo (6 asserts:
leyenda auto-oculta/conservada, colores de cruce distinguibles y sin gris
uniforme, Base única en XML + base manual respetada) + presets-defaults-
contrato (expectativas del criterio de la casa actualizadas a TRUE),
argumentos-ui 459, metadata 230, var-cruce 323, override-colores 19: **todo
verde**. Audit de congelados limpio (monolito 9.412 ≤ 9.418).

**Abierto en L4:** H20 — el orden efectivo de barras parece frecuencia aunque
el suelo pide `instrumento` (diferencial dedicado pendiente con empates
rotos); detalle del orden leyenda↔barras (`invertir_leyenda`); H18 de
top_two_box; y el barrido arg-por-arg de los 20+35 del graficador/preset.

### P10 — L4: H20 cerrado — el orden del instrumento SÍ manda (2026-08-03)

Diferencial dedicado con frecuencias que discriminan (instrumento A,B,C;
frecuencias B>C>A): **con `orders_list` poblado** —que es lo que el pipeline
real arma siempre desde las choices del XLSForm— el default `instrumento`
rinde A,B,C y el override `mayor_menor` rinde B,C,A. Ambas caras verificadas
en render. H20 se cierra como **artefacto de fixture**: mis bancos sintéticos
omitían `orders_list` y el motor caía al orden de la tabla de frecuencias.
Matiz anotado para la vara: en bases sin diccionario el orden efectivo es
frecuencia — fallback razonable, pero la descripción del arg podría decirlo.

Con esto, `orden_barras` acredita pruebas 1–3; los bancos del harness deben
llevar `orders_list` de aquí en adelante (regla para todos los lotes de
graficadores).
