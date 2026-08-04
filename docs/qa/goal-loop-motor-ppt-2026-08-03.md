# GOAL · Auditoría total del motor PPT — partícula por partícula

Tipo: Goal operativo QA **permanente e indefinido**
Estado: En curso — **sin condición de cierre; no se detiene**
Fecha: 2026-08-03
Autoridad: Objetivo de trabajo medible; no certifica por sí solo el estado del motor
Prompt de arranque: `docs/qa/prompt-goal-loop-motor-ppt.md` (pegar tal cual en sesión nueva)

- **Abierto**: 2026-08-03 · **Cierra**: sólo Gonzalo (y su mandato del
  2026-08-03 es explícito: el goal es indefinido y **no debe parar jamás**)
- **Alcance**: loop de convergencia sobre TODO el motor PPT/Word — cada slide,
  cada graficador, cada argumento, cada placeholder — contra el render real.
  Al vaciar la cola se re-audita desde el principio con la vara más alta.

## Mandato expandido (2026-08-03, pedido de Gonzalo)

Pedido textual (transcripción fiel, ortografía normalizada):

> «Nuestro interés es que el generador de PPTs y Word sea un generador sólido
> y profesional, pero ahora tiene una serie de dimensiones combinadas que
> evitan ello: una UI que necesita un mayor revamp — aunque bien encaminada,
> aún hay muchos elementos que en términos de UI resultan algo confusos y no
> muy pulidos —; un motor de gráficos que tiene para generar PPTs, para cada
> gráfico y para slides con distintos elementos en él — todos funcionan, pero
> no se ha hecho un intento sostenido y continuado de poner absolutamente
> todas las posibles combinaciones actuales existentes entre todas y comprobar
> si el motor genuinamente genera elementos visuales bien diseñados y con
> buena sofisticación visual —. Además la UI tiene gran especificidad para
> ajustar cada detalle de cada gráfico, pero ¿de verdad los tiene?
> ¿Multiapiladas puede ajustar cada detalle de sus gráficos en función de cada
> decisión que se tome, por ejemplo si son dos o tres columnas para agregar
> elementos? No. He ahí el detalle: necesitamos un goal indefinido, que no
> termina ni finaliza, que genera una revisión extremadamente exhaustiva y no
> infiera sino compruebe visualmente al mayor grado posible de detalle todas
> las funciones, todos los gráficos, todas las configuraciones en su
> totalidad, todo y absolutamente todo lo que esto puede generar; mejorarlo,
> corregirlo, perfeccionarlo, añadir las funcionalidades, documentar cambios
> y mejoras, proponer cosas increíbles y profesionales, mejorar por completo
> la UI y verificar que coincida con todo lo que el motor es capaz de hacer y
> facilitarle la vida al usuario para que pueda usar con mayor facilidad esta
> herramienta. Sé que es bastante, pero es fundamental que esto sea un goal
> totalmente indefinido y que no pare por absolutamente nada. No debe parar,
> repito, no debe parar jamás.»

El generador de PPT/Word debe ser **sólido y profesional**, y hoy lo frenan
tres dimensiones combinadas. El goal pasa de «auditar» a
«auditar-mejorar-perfeccionar», en tres ejes permanentes:

1. **Eje motor — sofisticación visual comprobada.** No basta que cada función
   corra: hay que generar **todas las combinaciones posibles** entre slides,
   graficadores y configuraciones, mirar el render de cada una y comprobar que
   el resultado es visualmente bien diseñado. Lo que se vea pobre se mejora,
   no solo se anota (patrón P9/P13/P15: default editorial > default funcional).
2. **Eje paridad — la UI ofrece exactamente lo que el motor hace.** En ambos
   sentidos: todo control ofrecido tiene efecto real (fantasmas fuera), y toda
   capacidad real del motor tiene superficie utilizable — incluida la
   especificidad condicional (ej.: si multiapiladas rinde 2 o 3 columnas, la
   UI debe permitir ajustar cada columna, no solo el conjunto).
3. **Eje experiencia — la herramienta facilita la vida.** Revamp continuo de
   la UI de Gráficos: elementos confusos o poco pulidos se rediseñan;
   funcionalidades nuevas y propuestas profesionales se documentan y
   construyen; cada mejora queda registrada en esta bitácora.

Regla de no-parada: al agotar un lote se pasa al siguiente; al agotar la cola
se re-censa y se re-audita con vara más alta; nunca se declara «terminado».
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
| L5 | `p_barras_apiladas` + `p_barras_multiapiladas` + presets | 108 | **Hecho (A: P16–P21)** — quedan H24–H26 |
| L6 | `p_barras_categoricas` + `p_numerico` + `p_histograma` + presets | 142 | **En curso (A: P23–P24)** — bloqueado por archivos en vuelo de A |
| L7 | `p_pie` + `p_donut` + `p_nube_palabras` + `p_mapa_cobertura` + presets | 72 | **HECHO (B: B19–B22, B26, B28–B29)** |
| L8 | `p_boxplot` + `p_media_rango` + `p_radar` + `p_tabla` + preset `radar_tabla` | 86 | **HECHO (B: B1–B8)** |
| L9 | Familia dimensiones (`p_dim_*`) + sus 48 formals no curados | 100 | **HECHO (B: B10–B18, B23–B24)** |
| L10 | Preset `base` (23) + cadena de herencia completa (prueba 3 transversal) | 23 | Cola — espera el router (A); suelo auditado en B8 |
| L11 | Paridad Word y consolidado (prueba 5 transversal) | — | **Word HECHO para L7/L8/L9 (B7, B23–B24)**; consolidado espera el router |
| L12 | Formals no curados: curar con superficie o retirar | 63 | **HECHO para carriles B (B17–B18, B22)**; quedan los de A |
| L13 | Plantillas secundarias (acnur, OPS, plantilla.pptx) | 293 ph | Diferido al FINAL por regla de Gonzalo |

Al vaciar la cola se reaudita desde L1 con la vara más alta.

## Ledger de cobertura

| Fecha | Args con 5/5 | Placeholders con 5/5 | Nota |
|---|---|---|---|
| 2026-08-03 | 0 / 701 | 0 / 456 | Censo fundacional |
| 2026-08-04 | ~430 / ~690 con diferencial mirado | 89 / 163 (plantilla ppal., prueba 1) | B25/B30: carriles A (L1–L5 y parte de L6) + carriles B (L7/L8/L9 completos con sweeps, bordes, suelo, Word y curación); ninguna partícula acredita aún 5/5 formal porque el consolidado (prueba 5) espera el router |
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

### P11 — L4: guías de placeholders en el harness (pedido de Gonzalo) (2026-08-03)

Gonzalo pidió comprobar los espacios de los placeholders con guías. El motor
ya lo trae: `presets$base$debug_ph_bordes = TRUE` (mecanismo `debug_ph` del
router) dibuja el borde de cada zona del canvas. Queda incorporado al harness
como modo estándar de verificación (script `render_guias.R`, patrón
replicable).

**Lo que las guías destaparon en barras agrupadas:**

- **H23 (regresión de P9, REPARADA)**: el suelo reservaba
  `canvas_h_legend_in = 0` (coherente con la leyenda apagada de antes); con
  la leyenda encendida, «Mujer/Hombre» invadía la última barra. Suelo a 0.35;
  sin leyenda el graficador colapsa la reserva a 0 solo. Verificado con
  guías: la leyenda vive en su propia fila.
- **H22 (abierto, diseño listo)**: en paneles a media lámina (slide_2,
  text_r) una etiqueta de 29 caracteres desborda la lámina por la izquierda.
  Causa raíz: el graficador no conoce el ancho real del device (el canvas se
  calibró para lámina completa; `ancho` formal queda en su default 10"). El
  fix requiere que el motor inyecte el ancho del slot como hint al renderizar
  elementos de slides multi-gráfico, y que el wrap efectivo se derive de
  `ancho × canvas_w_etiquetas` y el tamaño tipográfico. Entra como ítem
  propio del lote.
- **H21/D5 (bandeja)**: con eje 0–100 (`usar_eje_libre=FALSE`, comparabilidad
  entre láminas) y valores máximos bajos, dos tercios de la caja de barras
  quedan vacíos; y `canvas_w_etiquetas=0.45` fijo desperdicia espacio con
  etiquetas cortas (el perfil ACNUR ya usa `canvas_w_adaptativo=TRUE`).
  Opciones: (a) mantener 0–100 (defendible) + ancho adaptativo de etiquetas
  en el suelo; (b) eje libre por default. Recomendación: (a). Decide Gonzalo.
- Detalle pendiente: orden de la leyenda vs orden vertical de las barras
  (`invertir_leyenda`) y padding swatch-texto de la leyenda.

**Gate:** defaults-editoriales 6, presets-contrato 9, argumentos-ui 459,
var-cruce 323: todo verde.

### P12 — L4: barrido exhaustivo de barras agrupadas, 22 variantes miradas (2026-08-03)

Pedido de Gonzalo: ir gráfico por gráfico generando **todas las
configuraciones y combinaciones** y comprobar que cada una se vea profesional.
Patrón instaurado: script de barrido (`SWEEP/sweep_agrupadas.R`, replicable
por graficador) — una lámina por variante con guías activas, hojas de
contacto para el barrido grueso y zoom forense donde algo se ve mal.

**Reparado en este pase:**

- **Leyenda pegada** (lo que señaló Gonzalo): `legend_espaciado` de la firma
  era **0.20 puntos** (cero visual) — a 6 pt, más margen swatch-texto en el
  theme y `legend.spacing.x`; el arg UI declaraba 4 y ahora declara 6 con
  descripción. Verificado con zoom: «■ Mujer  ■ Hombre» respira.

**Las 22 variantes (todas renderizadas y miradas):** defaults serie
única/cruce ✓; mayor_menor/menor_mayor ✓; orden manual ✓; mostrar_ceros ✓;
excluir opción con N recalculado (150→125) ✓; top-5 + Otros ✓ (con la lámina
extra auto-generada del detalle de Otros — feature `auto_otros_slides`);
etiqueta de Otros custom ✓; Otros sin forzar al final ✓; mayúscula inicial ✓;
wrap 12 / interlineado / forzar 45 / etiquetas 25 % ✓; cruce sin leyenda
explícito ✓; leyenda invertida ✓; combo cruce+top4+orden ✓; 1 sola categoría
degrada sin romper ✓.

**Hallazgos nuevos:**

- **H24**: `max_categorias` se ignora si `agrupar_resto_en_otros=FALSE`
  (salen las 12 barras apretadas). Decidir semántica: recortar sin agrupar o
  documentar que solo aplica agrupando.
- **H25**: la semántica de `umbral_posicion` no es la de su descripción — con
  0.5, 17 % y 35 % siguen dentro (parece primar «si el texto cabe en la
  barra, va dentro», que estéticamente es correcto). Ajustar descripción o
  comportamiento.
- **H26**: 12 categorías × cruce no dispara split de lámina (24 barras
  ilegibles); revisar el auto-split con cruce.
- **D6 (bandeja)**: con `invertir_leyenda=TRUE` la leyenda queda en el mismo
  orden vertical que las barras del dodge — candidata a default de la casa.
- Detalle: interlineado alto + wrap agresivo pueden invadir la categoría
  vecina (los knobs lo permiten; el default está sincronizado).

**Ledger L4:** 18 de los 20 args del graficador con diferencial mirado
(faltan formals técnicos), más leyenda/espaciado del preset. Pendiente: H22
(ancho por slot), H18 (top_two_box), barrido fino de los 35 args del preset
(canvas_*).

### P13 — L4: el swatch de la leyenda es cuadrado SIEMPRE (2026-08-03)

Reporte directo de Gonzalo: el cuadrito de color se estiraba a rectángulo y
los ítems seguían muy pegados de por sí. Forense con zoom: el key box de
ggplot hereda la **altura del texto** de la leyenda (más alto que ancho), así
que tanto el glifo default (además encogido por `grosor_barras`) como
`draw_key_rect` salían rectangulares.

**Reparado:** glifo propio `.draw_key_cuadrado` de tamaño **absoluto**
(`legend_key_cm` × `legend_key_cm`, centrado en el box) — cuadrado siempre,
sin importar tipografía ni grosor de barra. Separación general por defecto:
margen derecho del ítem a 2.5× `legend_espaciado` y `legend.key.spacing.x`
0.22 cm — los pares swatch+texto se leen como unidades separadas. Verificado
con zoom en leyendas de 2 y 3 series (la 3.ª toma el amarillo de la casa).

**Gate:** defaults-editoriales 9 (nuevo assert de firma + glifo),
argumentos-ui 459, override-colores 19, var-cruce 323: todo verde. Réplica
pendiente del patrón en los demás graficadores con leyenda (apiladas,
categóricas, pie/donut, radar) cuando toque su lote.

### P14 — L4: H22 reparado — el wrap conoce el ancho real del panel (2026-08-03)

**Reparado:** `.render_element` acepta `ancho_slot` y los 16 puntos de render
de gráficos del motor pasan el ancho físico de su cajón (12.5/12.75 lámina
completa; 6.1 mitades y grids 2×2; 5.1–5.2 población; 3.95 población 5/6).
El graficador, **solo en paneles angostos (<9")**, deriva el wrap efectivo del
espacio real (`ancho × canvas_w_etiquetas` ÷ ancho de carácter) — la lámina
completa queda intacta por construcción. El override explícito de `ancho` del
analista sigue mandando.

**Evidencia (guías activas, antes → después):** en dos-gráficos «Ni
satisfecho ni insatisfecho» desbordaba fuera de la lámina; ahora envuelve a
dos líneas dentro de su caja. Grid 2×2: las cuatro celdas contenidas.
Gráfico+texto: etiquetas dentro. Control de lámina completa: sin cambios.

**Gate:** defaults-editoriales 9, var-cruce 323, plan-texto 113, calibración
de pies 20, override-colores 19: todo verde. Congelado en 9.418 exacto, audit
limpio. Con esto **L4 queda con H18 (top_two_box), H24–H26 y el barrido de
los 35 args del preset** antes de declararse hecho; sigue L5 (apiladas) con
el patrón completo (sweep + glifo cuadrado + espaciado de leyenda).

### P15 — H18 reparado: top_two_box degrada con gradiente y leyenda adaptativa (2026-08-03)

**Reparado:**

1. **Paleta interpolada, no reciclada** (`.top_two_parse_colors`): con n>4 el
   reciclado repetía rojo/amarillo en el extremo positivo; ahora
   `colorRampPalette` interpola la escala declarada — el gradiente conserva
   la semántica negativo→positivo (verificado: 10 categorías rinden rojo→
   naranja→amarillo→verdes, con el segmento top-two en verde).
2. **Leyenda adaptativa** (`.top_two_legend_svg`, nuevo en helpers; el
   monolito baja a 9.412): gap derivado del ancho de la barra, swatches
   centrados (ya no desbordan sobre el texto del extremo), tipografía
   escalonada (n>6 y n>8) y etiquetas envueltas a lo sumo en dos líneas con
   elipsis.

Control de 4 categorías idéntico al histórico. Residuo menor anotado: con 10
etiquetas larguísimas los textos truncados quedan densos (legibles pero
apretados) — mejorable con leyenda multi-fila si algún estudio real lo
necesita.

**Nota para Gonzalo (pregunta del tramo):** los defaults editoriales viven en
el suelo `.PRESETS_DEFAULT_PULSO` + firmas de graficador y son
**parametrizables desde la UI** (preset de proyecto u override por gráfico);
el glifo cuadrado es regla fija (su tamaño `legend_key_cm` sí es knob); los
anchos por slot de H22 son constantes del motor que reflejan la geometría de
los layouts — refinamiento anotado: derivarlos de `layout_properties` en vez
de constantes.

**Gate:** plan-texto 113, indice-fit 16, calibración 20; audit limpio.

### P16 — L5 arranca: el glifo cuadrado es de la casa y apiladas lo adopta (2026-08-03)

**Reparado:** `.graficos_key_glyph_cuadrado(lado_cm)` pasa a
`graficador_helpers.R` como constructor compartido; agrupadas lo consume y
**apiladas** reemplaza su `draw_key_rect` (mismo mal: box con altura de
texto) y sube `legend_espaciado` de 0.20 pt a 6. Render verificado con guías:
leyenda de 5 ítems con swatches cuadrados, aire y multi-fila centrada (la
ruta canvas manual de apiladas ya era buena y quedó intacta).

**Hallazgos nuevos del primer render de apiladas (cola L5):**

- **H27**: TRIPLE marca de N en la lámina — caption del gráfico («Base: 150
  respuestas»), placeholder del slide (ídem) y la columna N verde («150»).
  La deduplicación de P9 cubría solo `barras_agrupadas`; decidir el default
  de apiladas (probable: caption + columna N, sin placeholder).
- **H28**: la paleta likert-5 de apiladas mezcla semáforo (rojo/amarillo/
  verde) con navy y gris en los dos tramos más positivos — no comunica
  intensidad. Candidata a gradiente coherente en el suelo.

**Gate:** parse de los tres archivos + render mirado; suites de apiladas
pendientes de correr en el sweep L5 completo.

### P17 — L5: H27 reparado — apiladas deja de triplicar el N (2026-08-03)

**Reparado:** la supresión del auto-base del slide (P9) se extiende a
`barras_apiladas`: quedan el caption del gráfico («Base: N respuestas») y la
columna N verde por fila — dos marcas con roles distintos; el placeholder del
slide ya no duplica. La base manual del analista se materializa siempre.
Multiapiladas espera su propio render antes de decidir. Verificado con guías.

**D7 (bandeja):** la escala likert-5 de apiladas rinde rojo/amarillo/verde/
navy/gris — los dos tramos más positivos no comunican intensidad. La paleta
NO está en el suelo (sale del graficador); investigar su origen en el sweep
L5 y decidir si pasa a gradiente coherente o es estilo deliberado de reportes
reales.

### P18 — L5: sweep de apiladas (12 variantes) y el hallazgo H29 (2026-08-03)

Sweep con el patrón de P12 (hoja de contacto + guías). **En verde (9/12):**
default; excluir opción con N recalculado (200→157) y paleta reindexada; sin
leyenda; sin columna N; sin valores; un decimal; barra delgada; dicotómica; y
leyenda a 2 por fila (queda descentrada a la derecha — detalle anotado).

**H29 (GRAVE, confirmado por diferencial Y por código):** `cruces` de
`p_barras_apiladas` es **inerte** — A02 (cruce por zona) y A03 (6 grupos)
rinden idénticos al default con una sola barra, cuando el registry promete
«cada barra es un grupo de la variable de cruce». Causa:
`.render_barras_apiladas` (reporte_plan_ppt.R:4280) construye la tabla solo
con `var` y **jamás lee `el$cruces`**. Ruta de reparación diseñada: con cruce
presente, delegar a la maquinaria de multiapiladas `modo="cruce"` (que ya
construye una fila apilada por grupo). Por regla de la casa, nace con su test
rojo primero — primera prioridad del siguiente tramo. Mientras tanto la UI
sigue ofreciendo el campo: mismo perfil que el defecto fundacional.

Otros detalles del sweep: umbral de etiquetas de apiladas (A10) sin efecto
visible con 12 % — verificar semántica como H25; con cruce, la etiqueta de
fila muestra el label completo de la variable (parte de H29).

### P19 — H29 REPARADO: el cruce de apiladas rinde una fila por grupo (2026-08-03)

Regla de la casa cumplida: primero el test rojo
(`test-graficador-apiladas-cruce.R`, 2 fallos exactos que demuestran el
defecto), luego el fix. `.render_barras_apiladas` ahora **delega al modo
"cruce" de multiapiladas** cuando `el$cruces` viene poblado (una fila apilada
por grupo, vía el dispatcher para heredar todo el wiring de presets); el
código muerto que dejó la delegación (ramas del switch de excluir_base para
agrupadas/apiladas) se retiró y el monolito queda en 9.418 exacto.

**Evidencia de render (guías activas):** «Cruce por zona» rinde tres filas
apiladas (Callao/Lima Norte/Lima Sur) con columna N por grupo (76/55/69),
caption con rango («Base: 55-76 respuestas»), leyenda multi-fila con swatches
cuadrados y conector para el segmento pequeño (2 %). Sin cruce, la barra
única histórica intacta (test lo fija).

**Gate:** apiladas-cruce 4, apiladas-frecuencia 11, agrupadas-defaults 9,
plan-texto 113, var-cruce 323: **todo verde**. Audit de congelados limpio.

### P20 — L5: sweep de multiapiladas (7 variantes) + tres reparaciones (2026-08-03)

**En verde del sweep:** multilista default (3 filas, N por fila); Top2Box con
columna 79/67/71; numerar OE; modo cruce explícito; variables × cruce con
títulos de grupo aplicados; Top2 con labels explícitos.

**Reparado:**

1. **H30 — `titulos_grupo` honra su doc:** el registry documenta el formato
   textual «clave=Título» pero el constructor lo rechazaba (el builder de la
   UI envía objeto nombrado, por eso no reventaba desde ahí). El constructor
   ahora parsea el formato textual — la promesa es cierta por todos los
   caminos. Test en `test-graficador-apiladas-cruce.R`.
2. **Doble Base de multiapiladas (dedup P9/P17 extendida con matiz):** la
   base auto del slide se suprime salvo cuando los refs son **multi-fuente**
   («Base: 2 docentes, 3 estudiantes…» no vive en el caption del gráfico y se
   conserva — el test de var-cruce que la fija siguió verde). Helper
   `.base_multifuente_el` en helpers; monolito en 9.418 exacto.
3. El código del fix se apoyó en el hallazgo de que el modo interno del
   multilista de la UI es `"var"` (no `"multilista"`) — anotado para el censo.

**Abiertos nuevos:** H31 — `wrap_y` de multiapiladas sin efecto visible en el
diferencial 18 vs default (verificar con zoom); H32 — en variables × cruce
(2 grupos × 3 filas) la leyenda pisa la franja del caption.

**Gate:** var-cruce 323 (incluida la base multi-fuente), apiladas-cruce 7,
plan-texto 113, consolidado 95: **todo verde**. Audit limpio.

### Claim de carril — sesión paralela B (2026-08-03 ~22:15)

Hay **dos sesiones corriendo este goal sobre el mismo árbol**. La sesión A
está en vuelo sobre L4/L5 (agrupadas, apiladas, metadata, router — archivos
modificados sin commitear). Para no duplicar fixes (trampa documentada:
4 de 9 ramas históricas repararon el mismo bug dos veces), la sesión B —la
que formalizó el mandato expandido— **reclama L8**: `p_boxplot`,
`p_media_rango`, `p_radar`, `p_tabla` + preset `radar_tabla` (86 partículas),
en `graficador_radar.R`, `graficador_boxplot.R`, `graficador_media_rango.R` —
cero solape con los archivos en vuelo de A. Sus entradas de bitácora se
numeran `B1, B2…` para no chocar con la serie P de A. Regla para ambas:
antes de editar un archivo, verificar que no esté modificado sin commitear
por la otra sesión (`git status`).

### P21 — H31 REPARADO: wrap_y de multiapiladas por fin manda (2026-08-03)

Diferencial computacional (magick compare): 0 píxeles de cambio con
`wrap_y = 18` — inerte confirmado. Dos causas encadenadas, ambas reparadas:

1. **Cascada invertida:** `el$wrap_y` (la decisión por gráfico) estaba DEBAJO
   del preset de tipo — el suelo `multi_apiladas$ancho_max_eje_y = 40` lo
   pisaba siempre. Reordenada: override > elemento > preset multi > preset
   single (los dos puntos: `wrap_y_eff` y `block_wrap`).
2. **Re-wrap del graficador:** el motor envolvía las etiquetas a `wrap_y_eff`
   pero el graficador apiladas re-envolvía con SU `ancho_max_eje_y` (suelo
   22), borrando la diferencia. El motor ahora impone `wrap_y_eff` tras el
   merge en los do.call de modo var y var_cruce.

Verificación: 8.016 píxeles de diferencial tras el fix; M04 rinde las
etiquetas a 3 líneas dentro de su caja, con la lámina notablemente mejor
compuesta. **Gate:** var-cruce 323, apiladas-cruce 7, plan-texto 113,
frecuencia-etiquetas 11, consolidado 95 — todo verde; monolito 9.417 (bajo
línea base); audit limpio.

### P22 — H32 REPARADO: el slot expandido respeta el borde de la lámina (2026-08-03)

Forense por XML (EMU→pulgadas): el dibujo de variables×cruce terminaba en
**7.62"** — 0.12" más allá del borde físico (7.5) — porque la expansión
`pulso_needs_tall_plot_slot` (+1.2 cm para etiquetas altas) no conocía el
límite inferior. `.plot_slot_expand_down_cm` ahora clampa el bottom a 7.32"
(la altura original nunca se reduce). Verificado por XML (bottom = 7.32
exacto) y por render: caption «Base: 59-61 respuestas» completo, leyenda en
su fila, seis filas de var×cruce contenidas.

**Gate:** var-cruce 323, apiladas-cruce 7, plan-texto 113,
frecuencia-etiquetas 11: todo verde. Monolito 9.418 tras compactación; audit
limpio. La técnica del forense EMU por XML queda anotada para verificar
bordes sin depender del rasterizado.

### P23 — L6 arranca: sweep de barras categóricas, 13 variantes (2026-08-03)

**En verde (11/13 + 2 aclarados):** default; formato solo-%/solo-n; mayor a
menor; colores custom por categoría; ejes y grid visibles; límite Y
(confirmado por diferencial computacional: 44.204 píxeles — el ojo en
miniatura engañaba); barras finas + texto grande; mayúscula inicial + wrap;
excluir con N recalculado (200→148); ceros visibles con filtro.

**Aclarados con forense:**

- `mostrar_promedio`/`promedio_label` dieron 0 píxeles con el banco de labels
  de texto — y **1.926 píxeles (Promedio: 3.8 en el caption) con códigos
  1–5**: el arg funciona y su descripción YA declara que exige códigos
  numéricos. Regla del harness reforzada: bancos de escalas siempre con
  `name` numérico y `label` textual (como el XLSForm real).
- **Doble Base reaparecía en categóricas** (caption + placeholder): la dedup
  P9/P17/P20 ahora la incluye.

**Detalles anotados:** el eje Y visible muestra proporciones crudas
(0.00–1.00) en vez de porcentajes (H35, menor); composición con mucho aire
lateral y superior en lámina completa (familia D8, decisión editorial).

**Gate:** render mirado (13 láminas + 2 de verificación de promedio) y
diferenciales computacionales; suites del área corridas en P22 sin cambios de
lógica adicionales (la dedup se cubre por el patrón ya testeado).

> **Nota de coordinación (P23):** el commit `7d6c422d` arrastró sin querer un
> hunk de la sesión B (activación de `score_ref` cuando `mostrar_ref_label`
> se enciende — carril L8): ya está commiteado, B no necesita re-commitearlo.
> Regla desde ahora: TODOS los archivos compartidos (incluido el monolito) se
> stagean por hunks mientras haya dos sesiones sobre el árbol.

### B1 — L8 arranca: sweep de radar/tabla/boxplot/media_rango (16 variantes) + tres reparaciones (2026-08-03, sesión B)

Sweep `SWEEP_L8` (patrón P12: banco sintético con orders_list canónico, guías,
16 láminas miradas). Primera cosecha del carril:

**Reparado (con test y render verificado):**

1. **B-H1 — `get_categorias` moría con orders_list informal.** Una entrada de
   `orders_list` como vector plano (formato que circula en fixtures propios,
   p.ej. `test-engine-reporte-cruces-dimensiones-jerarquia.R:87`) reventaba
   `obj[["names"]]` con subscript-out-of-bounds y degradaba la lámina entera a
   «Sin datos». Ahora el vector plano se normaliza (nombrado = código→label) y
   el formato canónico `list(names, labels)` queda intacto.
   `test-reporte-cruces-orders-informales.R` (8 asserts, incluye
   `.radar_build_box`).
2. **B-H4 — `p_tabla` renderizaba el radar que promete no tener.** Doble
   bloqueo: `radar_scale=0` se trataba como inválido (reset a 1 + clamp
   [0.70,1.10]) y `tabla_ph_ancho=1.0` caía al default 0.40. Ahora
   `radar_scale=0` + tabla activa = modo **solo tabla** (el radar no se
   dibuja, la tabla se centra a ancho completo; leyenda usa el ancho entero).
   Render antes/después mirado: T01 pasó de radar+tabla a tabla sola limpia.
   `test-graficador-radar-solo-tabla.R` (5 asserts, fallback histórico fijado).
3. **B-H7 — «Mostrar referencia» de media_rango era inerte.** La
   línea/etiqueta del promedio global solo existe en `modo="score_ref"` y la
   UI no cura `modo`: el switch jamás podía actuar. El glue ahora activa
   `score_ref` cuando el analista enciende el switch sin declarar modo. (Este
   hunk viajó en el commit `7d6c422d` de la sesión A por barrido del working
   tree compartido — anotado, código correcto.)

**En verde del sweep:** radar sm default/cruce/top_n+omit; radar box T2B 5
preguntas y cruce 3 zonas; tabla box con cruce (columnas por grupo); boxplot
3 zonas/sin cruce/semáforo grupos/degradado auto (paleta de la casa ✓);
media-rango 3 zonas y minmax 2 grupos.

**Hallazgos abiertos del carril (B-serie):**

- **B-H2**: ningún test renderiza radar_tabla de verdad (el único usa
  `solo_lista=TRUE`) — el builder ya quedó cubierto; falta smoke de render.
- **B-H3**: `modo_semaforo="degradado_manual"` de media_rango exige
  `semaforo_gradiente_colores/valores` que la UI no ofrece → lámina muerta
  «Sin datos». Curar los args o degradar a automático con warning.
- **B-H5 (editorial radar)**: leyenda «Total» de serie única no se
  auto-oculta (patrón P9); `legend_espaciado=0.25pt` (cero visual, patrón
  P12/P16 pendiente de réplica); paleta de cruce no es la de la casa
  (hcl "Dark 3"); radar chico en lámina completa sin valores en vértices.
- **B-H6**: la tabla T2B pinta de rojo todo valor `<umbral_rojo_pct` (60
  default) — el knob existe como formal pero no está curado ni la semántica
  se declara en ninguna parte visible.
- **B-H8**: boxplot ordena el eje X por su cuenta (¿alfabético?) ignorando el
  orden del instrumento; media_rango sí lo respeta. Unificar.
- **B-H9 (editorial)**: chips de promedio microscópicos e ilegibles, rojos
  por defecto sin cortes (semántica engañosa: media 7.1/10 en rojo); puntos
  jitter casi invisibles (alpha 0.28 lavado); cortes de semáforo del boxplot
  en líneas blancas punteadas invisibles sobre fondo claro.
- **B-D1 (bandeja)**: `p_radar_tabla` combinado (compat) rinde radar SIN
  tabla por default (`mostrar_tabla_derecha=FALSE` de fábrica) — el nombre
  promete ambos. Decidir default o retirar del motor.
- **RT/M02**: `accent` del diferencial de `mostrar_ref_label` ahora sí debe
  verificarse con render (fix aplicado post-sweep).

**Gate:** cruces-categorias, cruces-jerarquia, dimensiones-ppt-radar,
dimensiones-iconos-foda-radar, radar-solo-tabla (5), orders-informales (8):
**todo verde**.

### P24 — L6: sweep de p_numerico — metrica y formato son fantasmas de motor (2026-08-03)

Cinco variantes renderizadas. La tarjeta numérica (big number) funciona en
default, cruce por sexo y N por grupo. **Dos fantasmas confirmados con
números duros:**

- **H36 — `metrica` ignorada:** pedida `median` por sexo sobre ingreso
  lognormal, el render muestra **exactamente las medias** (2.171,1/2.253,7;
  medianas reales 1.961,5/1.991,5) y la leyenda dice «Media» fija.
  `.render_numerico` (reporte_plan_ppt.R:6156) calcula `mean(x2)` y
  `.m = mean(.data$.x)` sin leer jamás `el$metrica` (opciones declaradas:
  N/pct/mean/median).
- **H37 — `formato` ignorado:** `formato = "S/ %s"` rinde «2.214,1» pelado.

**Plan de fix (próximo tramo, test rojo primero):** cascada
`overrides$metrica %||% el$metrica %||% preset %||% "mean"`; switch
mean/median/N/pct en los DOS sitios de cálculo; etiqueta de leyenda dinámica
(«Media»/«Mediana»/«N»/«%»); `sprintf(formato, valor)` con formato validado.
Banco discriminante: ingreso lognormal (media ≠ mediana).

Detalle menor: leyenda «Media» bajo tarjeta única es ruido (candidata a
auto-hide como la serie sintética de agrupadas).

### B2 — L8: leyenda del radar y chips honestos, con render verificado (2026-08-03, sesión B)

**Reparado:**

1. **B-H5a/b — leyenda del radar al estándar de la casa.**
   `legend_espaciado` 0.25pt→6pt y `legend_key_spacing_x_cm` 0.10→0.22 (firma
   y fallbacks); la serie única sintética «Total» ya no dibuja leyenda
   (paridad con el auto-hide de «Porcentaje» en agrupadas, P9) — una serie
   única con nombre propio la conserva. Render verificado: R01 sin leyenda
   muerta y con el radar aprovechando el slot liberado.
2. **B-H9 — el semáforo del chip solo actúa cuando se le pide.** Sin
   `cortes_chip` y en modo `grupos`, boxplot y media_rango pintaban los chips
   con terciles automáticos de las medias: SIEMPRE un grupo rojo aunque todos
   promediaran 7+/10 (color relativo con semántica absoluta). Default nuevo:
   chip neutral blanco con texto navy, legible (`size_media` boxplot
   2.3→3.2); el semáforo exige cortes declarados o modo degradado. Docs del
   formal actualizados. Render verificado en B01 (7.1/7.3/6.8 legibles) y
   M01/M02/M04.
3. **B-H7 (segunda pasada) — el fix del glue no disparaba por
   partial-matching de R**: `args$modo` casaba con `modo_semaforo` y
   `is.null()` nunca era TRUE. Movido a helper
   `.media_rango_activar_score_ref` (reporte_plan_helpers.R; el monolito
   recupera sus líneas) con indexado `[["modo"]]` exacto. Render verificado:
   M02 muestra por fin línea de referencia global, slot «Promedio», deltas
   ±0.2 y chips circulares. Test con mock que captura los args reales del
   graficador.

**Gate:** l8-defaults-editoriales 14 (firma, auto-hide, chips neutral/semáforo
×2 graficadores, glue score_ref con mock), plan-ppt-boxplot 35,
media-rango-significancia 5, radar-solo-tabla 5, orders-informales 8: todo
verde. Audit del congelado: mi neto es 0; queda **+1 de la sesión A**
(dedup de categóricas, `7d6c422d`) y +100 de editor-v2.css (loop multibase) —
les corresponde resolverlos.

**Residuos anotados:** B-H10 — en score_ref el label del slot de referencia
(«Promedio general») se encima con su chip; leyenda de radar con cruce aún en
paleta hcl ajena a la casa (B-H5c, requiere decidir contra el sistema de
paletas por proyecto); puntos jitter del boxplot casi invisibles (alpha
0.28); cortes de semáforo del boxplot en líneas blancas invisibles (B03).

### B3 — L8: orden del instrumento en boxplot, degradado manual que no mata, slot de referencia legible (2026-08-03, sesión B)

**Reparado (render antes/después mirado en las tres láminas):**

1. **B-H8 — boxplot respeta el orden del instrumento.** El graficador hacía
   `unique(df$categoria)` (orden de aparición en los datos), pisoteando el
   factor ordenado que el glue arma desde las choices. Portado el patrón de
   media_rango (preservar niveles entrantes, unique solo como fallback).
   B01 rinde Callao → Lima Norte → Lima Sur.
2. **B-H3 — `degradado_manual` sin gradiente ya no mata la lámina.** En
   media_rango degrada a `degradado_automatico` con warning (y con gradiente
   completo sigue siendo manual — test lo fija); en boxplot —que ni siquiera
   expone args de gradiente— ese modo siempre degrada con aviso. M03 pasó de
   «Sin datos» a lámina viva con cortes punteados 6–8. El stop del helper
   compartido de dimensiones queda intacto (es de L9).
3. **B-H10 — el slot «Promedio general» respira.** Doble causa: altura
   relativa 0.13 y un `span_use` calculado SOLO con las medias (que se
   agrupan en décimas: span 0.5 sobre un plot de 3+ unidades). Ahora el span
   incluye los bigotes del rango y la altura sube a 0.24. M02 muestra cajón
   redondeado con label arriba y chip 7.1 abajo, separados y legibles.

**Gate:** plan-ppt-boxplot 35, media-rango-significancia 5,
l8-defaults-editoriales 20 (3 tests nuevos: orden de factor, degradación con
aviso ×2, manual-completo sigue manual), radar-solo-tabla 5: todo verde.

**Pendientes del carril tras B3:** B-H5c (paleta de cruce del radar — decidir
contra el sistema de paletas por proyecto), B-H6 (curar `umbral_rojo_pct`),
B-H2 (smoke de render radar_tabla), B-D1 (combinado compat sin tabla),
jitter/cortes invisibles del boxplot (editorial menor), paridad Word (L11).

### B4 — L8: la paleta de la casa llega al radar + smoke del camino real (2026-08-03, sesión B)

**Reparado:**

1. **B-H5c — series del radar en paleta de la casa.** Sin override ni paleta
   de proyecto, el radar caía al `hue_pal` de ggplot (salmón/verde/celeste) y
   el box multi-fuente a hcl «Dark 3». Ambos defaults pasan a
   `.graficos_mk_palette` (navy #0B4F8C / teal #2A9D8F / dorado…), las mismas
   series que agrupadas post-P9. La paleta de proyecto (`paleta_<list>`)
   sigue mandando cuando existe. Render verificado: R05 navy/teal/dorado.
   De paso el monolito vuelve a **9.418 exacto** (el default_palette de 4
   líneas quedó de 3).
2. **B-H2 — smoke del camino real.** Test con mock que atraviesa
   `reporte_ppt_plan` de verdad: el radar sm recibe datos construidos (≥3
   opciones del select multiple) y el contrato solo-tabla de `p_tabla`
   (mostrar_tabla_derecha + radar_scale=0) llega hasta el graficador.
   Detalle del camino: con `build_render_meta` cada elemento se renderiza
   también para Word, así que las llamadas se filtran por firma.

**Gate:** l8-defaults-editoriales 27, radar-solo-tabla 5, dimensiones-ppt-
radar 36, dimensiones-iconos-foda-radar 52: todo verde. Monolito 9.418.

**Pendiente del carril:** B-H6 (curar umbral_rojo_pct — `graficos_metadata.R`
sigue en vuelo de la sesión A, se hará cuando libere), B-D1, editorial menor
de boxplot (jitter/cortes invisibles), radar chico en lámina completa (parte
de la familia H9), paridad Word (L11).

### B5 — L8: el boxplot se deja leer (2026-08-03, sesión B)

Pulido editorial con render verificado (B01/B03): los puntos jitter suben de
alpha 0.28→0.45 y toman una versión oscurecida (×0.55) del color de su caja —
con el MISMO color desaparecían sobre la caja y se lavaban fuera; las líneas
punteadas de los cortes del semáforo pasan de #C7CDD6 (invisible sobre fondo
claro) a #8A97A8 con 0.5 de grosor. Test: alpha de firma + paleta de puntos
disjunta de la de cajas (30 asserts del archivo en verde).

**Estado del carril L8 tras cinco tramos:** 12 hallazgos cerrados con test y
render (B-H1, B-H2, B-H3, B-H4, B-H5a/b/c, B-H7, B-H8, B-H9, B-H10, B5
editorial). Quedan: B-H6 (curar umbral_rojo_pct — esperando que la sesión A
libere graficos_metadata.R), B-D1 (combinado compat), radar chico en lámina
completa (familia H9, común a varios graficadores), paridad Word (L11) y el
barrido fino del preset radar_tabla (37 args).

### B6 — L8: el radar gana su ancla numérica — `mostrar_valores` (2026-08-03, sesión B)

**Capacidad nueva (eje 1 + eje 2 del mandato).** El radar no ofrecía ningún
anclaje numérico: sin niveles (apagados por default editorial) ni valores, el
lector no podía distinguir 30% de 60%. `graficar_radar` gana
`mostrar_valores` (+ `size_valores`, `valores_decimales`): porcentaje por
vértice coloreado por serie, con offset radial y **separación tangencial por
serie** (dos series con valores parecidos caían sobre el mismo rayo y se
montaban — verificado y corregido con render). Default FALSE (opt-in).
Render mirado: serie única limpia (42–45% legibles) y dos series separadas
(68%/77% en el mismo vértice, ambos legibles).

También se evaluó y DESCARTÓ el «radar chico en lámina completa» como fix de
geometría: el `lim_xy = 1.18×` reserva espacio de etiquetas que en canvas son
externas, pero encogerlo arriesga clipping de los labels de los vértices
superiores (anclan al corner mapeado por lim_xy) y la ganancia neta es ~6%.
La pequeñez restante es inherente a un gráfico radial en 16:9 — el ancla
numérica ataca el problema real (legibilidad, no tamaño).

**Superficie UI pendiente**: curar `mostrar_valores`/`valores_decimales` en
el registry cuando la sesión A libere `graficos_metadata.R` (junto con B-H6).

**Gate:** l8-defaults-editoriales 34 (test del diferencial de capas GeomText
con labels %), radar-solo-tabla 5, dimensiones-ppt-radar 36: todo verde.

### B7 — L8: paridad Word verificada para el carril completo (2026-08-03, sesión B)

Prueba 5 de la vara sobre las cuatro superficies del carril, con
`reporte_word_plan` real (docx → pdf → png, 2 páginas miradas; script
`sweep_word.R` del harness):

- **Radar sm con cruce**: paleta de la casa, leyenda espaciada, sin tabla.
- **Tabla box**: tabla SOLA (el contrato B-H4 se sostiene en Word), regla
  roja <60% activa (43% en rojo, 63/73% en negro).
- **Boxplot**: chips neutrales blancos legibles, orden del instrumento
  (Callao→LN→LS), puntos oscurecidos visibles, paleta de la casa.
- **Media-rango con referencia**: línea global + slot «Promedio general»
  legible + deltas ±0.1/−0.2 — el fix B-H7/B-H10 completo vive en Word.

Veredicto: **paridad PPT↔Word del carril L8 en verde sin reparaciones** —
ambos caminos comparten graficadores y glue, así que los 13 cierres de la
sesión B viajan solos al Word. Pendiente de la prueba 5: preview y
consolidado (rutas del router), que se auditarán como lote transversal L11.

### B8 — L8: el suelo de producción auditado para el carril (prueba 3) (2026-08-03, sesión B)

Tres renders con `.PRESETS_DEFAULT_PULSO` aplicado como lo hace el router
(flat → `p_presets` → `normalize_block` envuelve en `$args`), mirados:

- **Resuelto el misterio del censo**: el suelo de `radar_tabla` guarda sus 37
  claves en lista PLANA (sin `$args`), a diferencia de la lectura que hice en
  B1 — el formato es consistente con `.enriquecer_presets` y `p_presets` lo
  normaliza; el suelo SÍ llega al graficador en producción.
- **Regla de harness (nueva, para todos los lotes)**: los sweeps deben correr
  DOS veces — firma pelada (`p_presets()`) y suelo de producción
  (`do.call(p_presets, lapply(.PRESETS_DEFAULT_PULSO, as.list))`) — porque el
  suelo transforma la superficie (la tabla T2B pasa de líneas simples a
  header navy con filas alternadas). Los sweeps B1–B7 fueron con firma
  pelada; el pase con suelo de radar/tabla quedó verde (solo-tabla, regla
  roja y leyenda sobreviven).
- **B-H11 (estructural, anotado)**: `boxplot`, `media_rango` y `numerico` NO
  tienen suelo Pulso (`.PRESETS_DEFAULT_PULSO` cubre 11 tipos; ellos no
  están): su default efectivo en producción es la firma del graficador — que
  tras B2/B3/B5 ya es editorial. Decidir si merecen suelo propio cuando se
  audite L10 (cadena de herencia completa).
- **B-D1 con workaround verificado**: el combinado compat muestra radar +
  tabla correctamente con `overrides = list(mostrar_tabla_derecha = TRUE)`;
  el default FALSE de fábrica sigue siendo discutible pero tiene salida.
- Detalle menor anotado: con `tabla_auto_fit = FALSE` del suelo y pocas
  filas, los valores (73%) quedan chicos frente a filas muy altas — misma
  familia que H12 (tabla técnica estirada).

**Gate:** solo renders (pase de auditoría sin diff de producto).

### B9 — L8 en paneles compartidos: los cuatro se adaptan; B-H6 se afila (2026-08-03, sesión B)

Cuatro láminas con suelo de producción y guías (`sweep_multi.R`): radar+boxplot
a media lámina, tabla+media-rango a media lámina, grid 2×2 con los cuatro, y
radar en panel de gráfico+texto. **Sin roturas**: los cuatro graficadores del
carril se adaptan al ancho del slot (wrap de etiquetas del radar a dos
líneas, chips y slot de referencia legibles en cuartos de lámina, auto-hide
de leyenda operando en paneles mínimos, tabla compacta de 6 filas en un
cuarto).

**B-H6 afilado con evidencia**: en el cuarto de lámina, la tabla sm de «Uso
de servicios» sale con TODAS sus celdas en rojo (44/45/40/40/44/45% < umbral
60) — la regla trata un porcentaje de USO como si fuera una satisfacción
reprobada. `umbral_rojo_pct` existe como formal pero: (a) no está curado en
la UI, (b) no puede desactivarse declarativamente desde ahí, y (c) su default
60 solo tiene sentido para T2B de satisfacción. Cuando el registry se libere:
curar el arg con descripción honesta y permitir apagarlo (p.ej. 0 = sin
regla). La lámina M3 es el caso de demostración.

**Gate:** solo renders (pase de auditoría; sin diff de producto).

### Claim de carril — sesión B toma L9 (2026-08-03 ~23:40)

L8 quedó agotado en lo que no depende del registry (que la sesión A mantiene
en vuelo desde hace ~1h junto con agrupadas/apiladas/router). La sesión B
reclama **L9 — familia dimensiones**: `p_dim_radar`, `p_dim_radar_tabla`,
`p_dim_heatmap`, `p_dim_comparativo_radarbar`, `p_dim_foda`,
`p_dim_heatmap_criterios` + sus **48 formals no curados** (foda concentra
27), en `graficador_dimensiones.R` e `indicador_dimensiones_shared.R` —
ambos libres. Pendiente diferido de L8 (para cuando el registry se libere):
curar `mostrar_valores`/`valores_decimales` del radar, `umbral_rojo_pct` con
apagado, y decidir B-H11/B-D1.

### B10 — L9 arranca: censo args↔formals de la familia dimensiones (2026-08-03, sesión B)

Censo reproducible (`.GRAFICADORES_META` vs `formals()`, excluyendo técnicos;
`overrides/filtros/base` son passthroughs curados, no fantasmas). Hallazgos:

- **B-H12 — `iter_var`/`iter_level` ocultos en los 5 elementos dim** con
  constructor: la capacidad de iterar el gráfico por nivel existe en toda la
  familia y no tiene superficie en ninguna parte.
- **B-H13 — inconsistencia entre hermanos**: `radar_min_ejes` está curado en
  `p_dim_comparativo_radarbar` pero oculto en `p_dim_radar`; `modo_semaforo`
  curado en `p_dim_heatmap` pero oculto en `p_dim_foda` (que además tiene
  `cortes_chip` oculto). El mismo concepto se ofrece o esconde según el
  elemento.
- **B-H14 — `p_dim_heatmap` esconde su mejor funcionalidad**: 9 formals sin
  superficie (etiquetas y colores/cortes de brecha, gradiente, títulos de
  totales, tamaño de eje X, N por cruce) — la UI ofrece los switches de
  brecha pero no sus controles.
- **B-H15 — `p_dim_foda` con 27 formals ocultos** (confirma el censo P1):
  semáforo completo, geometría de tarjetas/matriz/dispersión, textos de
  áreas, jitter. El elemento más configurable del motor es una caja negra
  desde la UI.
- `p_dim_heatmap_criterios`: solo `source` oculto (técnico multibase — OK).

Plan del carril: sweep de renders por elemento (banco = patrón
`make_dimensiones_ppt_fixture` de los tests: `reporte_dimensiones` +
`subindice`/`indice`), luego curar por valor (no las 48 a ciegas: primero
mirar cuáles cambian algo visible — prueba 2 — y proponer la superficie
mínima que haga a la familia consistente).

### B11 — L9: primer sweep de dimensiones (7 láminas) + leyenda del FODA reparada (2026-08-03, sesión B)

Banco propio a escala (8 vars → 3 subíndices → 1 índice, cruce de 3 zonas,
N=150; `sweep_dim.R`), con suelo y guías. **En verde:** dim_radar general y
con cruce; dim_heatmap simple y con brechas (filas+columnas, colores y
totales correctos); comparativo radarbar (barras agrupadas legibles con
valores); FODA subíndices (cuadrantes con tarjetas y chips).

**Reparado:**

- **B-H18 — la leyenda del FODA decía «Rojo / Ambar / Verde»**: los nombres
  de los colores como etiquetas (AI slop; ninguna información). Ahora usa el
  significado — «Menor a 60 / 60 - 80 / Mayor a 80» vía `.dim_range_labels`
  con los cortes reales del semáforo (helper `.dim_foda_legend_labels`
  testeado; sin cortes degrada a Bajo/Medio/Alto, jamás a nombres de color).
  Render antes/después mirado.

**Hallazgos nuevos:**

- **B-H16**: `p_dim_radar_tabla` está RETIRADO del flujo PPT (el constructor
  aborta con deprecación) pero el registry lo sigue curando con 9 args — la
  UI ofrece un elemento que el motor rechaza. Retirarlo del registry cuando
  se libere (o el validador de planes debería marcarlo).
- **B-H17**: la descripción de `objetivo` promete texto libre («ej.
  'Satisfacción'») pero el motor exige la CLAVE del catálogo
  (`idx_global`) — con el texto humano la lámina muere en «Sin datos» sin
  explicar por qué. Curar con hint honesto y/o resolver por label.
- **B-H19**: `modo="indicadores"` de dim_radar degrada a «Sin datos» con un
  catálogo válido de subíndices+índice — diagnosticar si exige objetivo de
  otro nivel o está roto.
- Editorial: banda superior vacía dentro del panel en heatmap/comparativo
  (espacio reservado sin contenido); paleta del comparativo es la de
  dimensiones (azul/naranja/verde IPE), consistente dentro de la familia.

**Gate:** dim-foda-leyenda 4 (nuevo), graficador-dimensiones 39,
dimensiones-iconos-foda-radar 52: todo verde.

### B12 — L9: el índice recupera su nombre (B-H20) y B-H19/H17 se re-diagnostican (2026-08-04, sesión B)

**Diagnóstico que corrige a la bitácora anterior:**

- **B-H19 CERRADO como emparejamiento**: `modo="indicadores"` funciona — su
  catálogo se indexa por claves de SUBÍNDICE (`atencion`, no `idx_global`).
  Render verificado (radar de los 3 ítems del subíndice). El problema real
  es UX: el par modo↔objetivo es una trampa invisible y el error explicativo
  del motor (que hasta sugiere el modo correcto) muere en stderr — el
  analista solo ve «Sin datos».
- **B-H17 re-diagnosticado**: el resolver de `.dim_build_payload` SÍ acepta
  clave o etiqueta humana. Mi prueba falló por el hallazgo de fondo:

**B-H20 REPARADO — el catálogo perdía la etiqueta humana del índice.**
`indice("global", "Índice global de satisfacción", ...)` se presentaba y
resolvía como «Global»: `label_idx` embellecía la clave ANTES de consultar
`meta_indices$etiqueta` (que ni miraba) y los labels reales de la columna —
mientras `label_sub` sí consulta su meta (inconsistencia entre hermanos).
Precedencia corregida: config → etiqueta del meta → label de la columna →
clave embellecida. Con esto el objetivo por etiqueta humana funciona
(diagnóstico X2: 0 láminas degradadas) y los títulos de la familia muestran
el nombre que el analista declaró.

**Gate:** dim-foda-leyenda+B-H20 6, graficador-dimensiones 39,
dimensiones-ppt-radar 36, iconos-foda-radar 52, cruces-jerarquia 21: todo
verde.

**Pendiente afilado para cuando el registry se libere**: la descripción de
`objetivo` debe decir «clave o etiqueta del índice/subíndice según el modo»
y idealmente la UI debería ofrecer un selector poblado desde el catálogo en
vez de texto libre (propuesta de eje 3).

### B13 — L9: diferenciales de los formals ocultos + leyenda del FODA sincronizada (2026-08-04, sesión B)

Ocho diferenciales renderizados y mirados (`sweep_ocultos.R` + `diag_o.R`):

**VIVOS y valiosos (candidatos a superficie UI cuando el registry libere):**

- Heatmap: `etiq_brecha_filas`/`etiq_brecha_cols` (renombran fila/columna de
  brecha), `brecha_cortes` (recalibra el gradiente), `titulo_total_x`
  («Nacional»), `mostrar_n_cruce_x` (N por columna: «Callao (N=56)») — los
  cinco actúan y se ven profesionales.
- FODA: `cortes_chip` (recolorea chips), `titulos_areas_foda` (retitula
  cuadrantes — **claves SINGULARES**: `fortaleza/oportunidad/debilidad/
  amenaza`; con claves equivocadas se ignora en silencio — robustez menor
  anotada).

**Reparado:**

- **B-H21 — la leyenda del FODA ignoraba los cortes efectivos**: un override
  de `cortes_chip = c(50, 65)` recoloreaba los chips pero la leyenda seguía
  declarando 60–80 (¡peor que no tener leyenda!). Ahora usa `chip_cortes`
  efectivos — render verificado («Menor a 50 / 50 - 65 / Mayor a 65»).

**Gate:** dim-foda-leyenda 6, graficador-dimensiones 39, iconos-foda-radar
52: todo verde.

### B14 — L9: bordes de la familia dimensiones en verde (2026-08-04, sesión B)

Seis láminas de borde renderizadas y miradas (`sweep_bordes.R`): radar de 12
subíndices con nombres largos (wrap a 2 líneas, dodecágono legible, cero
solapes), heatmap de 14 filas con cruce de N=10 (compacto, completo),
FODA de 12 subíndices (tarjetas en 2 columnas por cuadrante), comparativo
12×2, radar de 1 subíndice y FODA de 1 subíndice (degradan sanos). **Sin
roturas** — la familia es estructuralmente robusta.

**Bandeja nueva:**

- **B-D2**: el corte de puntaje del FODA (default 80) deja los cuadrantes
  altos (Fortalezas/Oportunidades) VACÍOS en todos los bancos probados
  (puntajes reales 47–70): el default sugiere que todo está mal. ¿Derivar el
  corte de la mediana de los puntajes, bajarlo, o es un estándar
  metodológico deliberado? Decisión de Gonzalo/revisor metodológico.
- **B-D3 (metodológica, C5)**: la celda de cruce con N=10 («Frontera») se
  muestra con la misma confianza visual que la de N=140 — sin marca de base
  chica. Considerar umbral de advertencia (asterisco o atenuado) — cruza con
  el criterio del revisor metodológico.

**Estado del carril L9**: camino feliz + ocultos de alto valor + bordes
auditados. Queda: modos dispersión/multilista del FODA, `iter_var`
diferencial, y la curación UI (bloqueada por el registry).

### B15 — L9: dispersión e iter_var están vivos; el censo de capacidades ocultas queda completo (2026-08-04, sesión B)

Cuatro diferenciales más (`sweep_disp.R`):

- **`modo_foda="dispersion"` VIVO y valioso**: scatter Puntaje×Desviación con
  cuadrantes y tarjetas posicionadas — pero **exige `corte_score`** (oculto)
  y sin él la lámina muere en «Sin datos» (misma familia que B-H3: el modo se
  ofrece sin su acompañante obligatorio). Residuos editoriales: las tarjetas
  truncan el label del indicador («El trato fue»), y el tick del corte SD se
  encima con el tick regular del eje X.
- **`iter_var`/`iter_level` VIVOS** (radar y heatmap): filtran el gráfico al
  nivel pedido — la capacidad de iterar existe de verdad (B-H12 confirmado
  como capacidad real sin superficie). Validación correcta: iter_var no
  puede coincidir con cruce (error claro… que muere en stderr, como todos).

**Censo de capacidades ocultas de L9 COMPLETO**: de los 48 formals no
curados, los verificados vivos y valiosos son iter_var/iter_level (×5),
brechas del heatmap (×5), cortes/títulos/dispersión del FODA (×4+). El
patrón transversal más dañino de la familia: **todos los errores útiles del
motor mueren en stderr y el analista solo ve «Sin datos»** — la lámina
degradada debería llevar el motivo (propuesta eje 3, transversal al motor).

### B16 — Especificación de curación UI de los carriles B (lista para aplicar al liberar el registry) (2026-08-04, sesión B)

Superficie mínima propuesta, verificada partícula por partícula en B1–B15.
Cada línea = un arg a curar en `graficos_metadata.R` con su descripción
honesta:

**`p_radar` / `p_tabla` (L8):**
- `mostrar_valores` (bool, valores) — «Porcentaje en cada vértice, coloreado
  por serie» · `valores_decimales` (number, valores, default 0).
- `umbral_rojo_pct` en `p_tabla` (number, semaforo, default 60) — «Valores
  bajo este umbral se resaltan en rojo. 0 = sin resaltado» (requiere cablear
  el 0 como apagado — hoy siempre resalta).

**`p_dim_heatmap` (L9):**
- `etiq_brecha_filas` / `etiq_brecha_cols` (string, textos) — renombran la
  fila/columna de brecha.
- `brecha_cortes` (codigos_list, semaforo) — cortes del gradiente de brecha.
- `titulo_total_x` (string, textos) — título de la columna Total.
- `mostrar_n_cruce_x` (bool, valores) — «(N=…) bajo cada columna del cruce».

**`p_dim_foda` (L9):**
- `modo_foda` ya curado, pero «dispersion» debe curar junto `corte_score`
  (number, datos, obligatorio en dispersión — hoy su ausencia mata la lámina).
- `cortes_chip` (codigos_list, semaforo) — recolorea chips Y leyenda (B-H21).
- `titulos_areas_foda` (4 strings, textos) — claves singulares
  fortaleza/oportunidad/debilidad/amenaza.

**Toda la familia dim:** `iter_var` (variable_opt, datos) + `iter_level`
(string, datos) — «Renderiza el gráfico solo para un nivel de esta variable
(no puede ser la de cruce)».

**Retiros:** `p_dim_radar_tabla` sale del registry (B-H16, el motor lo
rechaza); la descripción de `objetivo` en toda la familia pasa a «Clave o
etiqueta del índice (modo general) o subíndice (modo indicadores)» —
idealmente selector poblado del catálogo.

**Transversal (propuesta eje 3):** la lámina degradada «Sin datos» debe
mostrar el motivo real del motor (hoy muere en stderr) — es la mejora de
UX/depuración de mayor palanca encontrada en toda la sesión B.

### B17 — La especificación B16 aplicada: la UI por fin ofrece lo que el motor hace (2026-08-04, sesión B)

Aplicada la curación al registry (commit por hunks — `git apply --cached
--reverse` del patch de la sesión A, que conserva su trabajo en el árbol):

- **p_radar**: `mostrar_valores` + `valores_decimales` (nuevos formals del
  wrapper que rutean a overrides). **p_tabla**: ídem `umbral_rojo_pct`, y el
  graficador ahora trata `0` como regla roja APAGADA (antes 0% aún se
  pintaba).
- **Familia dim**: `iter_var`/`iter_level` curados en radar, heatmap,
  comparativo y foda; heatmap gana superficie para `etiq_brecha_*`,
  `brecha_cortes`, `titulo_total_x` y `mostrar_n_cruce_x`; foda para
  `cortes_chip` y `corte_score` (nuevo formal, obligatorio en dispersión —
  su descripción lo declara). La descripción de `objetivo` en las 4 entradas
  dice la verdad: clave o etiqueta según catálogo y nivel.
- **`p_dim_radar_tabla` RETIRADO del registry** (B-H16): el motor lo rechaza
  desde hace tiempo; la UI deja de ofrecerlo (compat de planes viejos sigue
  en el motor).
- Diferido: `titulos_areas_foda` (necesita input de mapa clave→texto o
  parseo textual en el constructor — como el de multiapiladas P20).

**Gate:** argumentos-ui 459, metadata 228 (los -2 son las entradas del
elemento retirado), radar-solo-tabla 5, dim-foda-leyenda 6: todo verde.

### B18 — El FODA completa su superficie: títulos de cuadrante desde la UI (2026-08-04, sesión B)

`titulos_areas_foda` cierra el último diferido de la espec B16: el
constructor parsea el formato textual del textarea («cuadrante=Título» por
línea, patrón P20 de multiapiladas) y **tolera plurales** (fortalezas→
fortaleza…), que antes se ignoraban en silencio. Curado en el registry como
textarea con descripción del formato. Tests del parseo y del mapeo de alias
(4 asserts nuevos; el campo viaja en `overrides$titulos_areas_foda`).
Commit por hunks otra vez — el trabajo de la sesión A sigue intacto.

**Gate:** dim-foda-leyenda 10, argumentos-ui 461, metadata 228: todo verde.

### Claim de carril — sesión B toma L7 (2026-08-04 ~00:50)

Con L8 y L9 completos (auditoría + curación), la sesión B reclama **L7 —
`p_pie` + `p_donut` + `p_nube_palabras` + `p_mapa_cobertura` y sus presets
`pie` (19) y `donut` (16) + `nube_palabras` (11)** en
`graficador_pie_dicotomico.R`, `graficador_nube_palabras.R` y
`graficador_mapa_cobertura.R` — los tres libres. El registry sigue con el
trabajo en vuelo de A (técnica de hunks vigente).

### B19 — L7 arranca: fantasmas de la nube reparados y dedup de Base para pie/donut (2026-08-04, sesión B)

Censo del carril: `p_pie`/`p_donut` con contrato limpio; **`max_palabras` y
`min_chars` de la nube eran FANTASMAS** (el puente los descartaba por no ser
formals — defecto fundacional otra vez); `p_mapa` con titulo/contexto
ocultos (menor).

**Reparado con render verificado:**

1. **B-H26 — fantasmas de la nube**: formals nuevos con passthrough a
   overrides. Q6 rinde exactamente 5 palabras de ≥6 caracteres.
2. **B-H22 — pie/donut entran a la dedup de Base** (P9/P17/P23): el
   placeholder auto ya no duplica el caption del gráfico. La base manual del
   analista se respeta siempre (regla de la casa).

**Hallazgos abiertos del carril (siguiente tramo):**

- **B-H23**: paleta del pie ajena a la casa (morado/cyan/lima/salmón).
- **B-H24**: la leyenda del pie desborda su banda y pisa el caption
  (geometría del canvas del preset — perfil H23 de agrupadas).
- **B-H25**: el pie ordena una ordinal por frecuencia, ignorando el
  instrumento (perfil B-H8/H20).

**Gate:** l7-pie-nube 3 (nuevo), plan-texto 113, argumentos-ui 459: verde.

### B20 — L7: el pie se vuelve de la casa (paleta, orden, leyenda) y B-H27 al descubierto (2026-08-04, sesión B)

**Reparado con render antes/después (Q2):**

1. **B-H23 — paleta de la casa**: sin override, el pie caía al hue crudo de
   ggplot (morado/cyan/lima/salmón); ahora usa `.graficos_mk_palette`
   (navy/teal/dorado/naranja) — paridad con radar (B4) y barras (P9).
2. **B-H25 — orden del instrumento**: el suelo forzaba `"asc"` (reordena por
   valor y destruye ordinales); pasa a `"ninguno"` y la leyenda rinde
   Muy bajo → Alto.
3. **B-H24 — la leyenda cabe en su banda**: suelo
   `canvas_h_legend_bottom` 0.08→0.14 (2 filas contenidas, ya no pisan el
   caption). Defaults declarados de la UI alineados (prueba 3).
4. **B-H27 (¡descubierto al curar!)** — la UI ofrecía el valor `"natural"`
   («orden del instrumento») que `match.arg` del graficador RECHAZABA: elegir
   la opción correcta mataba la lámina. El graficador acepta `natural` como
   alias de `ninguno`, su default de firma pasa a `ninguno`, y la UI pone
   «Natural» como default y primera opción.

Residuo anotado: el caption del pie roza el borde de su banda
(`canvas_h_caption = 0` con caption presente) — menor.

**Gate:** l7-pie-nube 9, argumentos-ui 459, metadata 228,
presets-defaults-contrato: todo verde. Commit por hunks (trabajo de A
intacto).

### B21 — L7: el donut hereda todo y el caption gana su franja (2026-08-04, sesión B)

Verificado con render: el donut hereda paleta de la casa, orden del
instrumento y leyenda derecha limpia (comparte `graficar_pie` vía
`tipo_pie`). El residuo del caption pisando el borde quedó reparado: los
suelos de pie y donut reservan `canvas_h_caption = 0.10` (antes 0.00 con
caption presente) — Q2 rinde cada zona en su banda: pie, leyenda y Base sin
solaparse. Commit por hunks (trabajo de A intacto).

**Gate:** presets-defaults-contrato 9, argumentos-ui 459, l7-pie-nube 9:
todo verde. Queda del carril: sweep de la nube con `parent_var`, mapa de
cobertura (titulo/contexto ocultos + banco territorial) y bordes.

### B22 — L7: bordes del carril y B-H28 reparado (2026-08-04, sesión B)

Bordes renderizados y mirados (`sweep_bordes7.R`): pie/donut de 1 categoría
degradan sanos; **la nube vacía degrada con mensaje específico y honesto**
(«Sin respuestas abiertas para mostrar» — el ejemplo a seguir para el «Sin
datos» mudo del resto del motor); nube con `parent_var` renderiza.

**Reparado (B-H28, con render antes/después):** el pie de 12 categorías
desbordaba su leyenda sobre el caption y el borde. Dos piezas:

1. **La banda de leyenda se auto-deriva de las filas necesarias**
   (`ceiling(n/columnas) × 0.055`, piso = valor declarado, techo 0.34): 12
   ítems viven en su banda; 4 categorías no pagan de más.
2. **`top_k` + `etiqueta_otros` curados** en pie Y donut (formals nuevos en
   los constructores — existían solo en el graficador): R6 rinde top-6 +
   «Otros» 39% en paleta de la casa, leyenda contenida.

Residuo anotado: etiquetas % de slices contiguos chicos aún pueden rozarse
(umbral/leader-lines como refinamiento futuro).

**Gate:** argumentos-ui 459, l7-pie-nube 9, presets-contrato 9: todo verde.
Commit por hunks (trabajo de A intacto).

### B23 — L9: paridad Word de dimensiones — 3/4 en verde y B-H29 (2026-08-04, sesión B)

`reporte_word_plan` real con los 4 elementos de la familia (docx→png,
2 páginas miradas):

- **En verde**: dim_radar con cruce (4 series + Total, leyenda espaciada),
  dim_heatmap con brechas (la leyenda de umbrales del fix B-H18 viaja a
  Word), comparativo radarbar (valores y leyenda correctos).
- **B-H29 (nuevo, Word-específico)**: las tarjetas del FODA truncan el label
  («Atención al usuari…») y el chip de puntos desborda el borde derecho — en
  PPT las mismas tarjetas se ven bien; el render Word usa un ancho menor y
  el ancho de tarjeta relativo no compensa el texto de tamaño fijo. Queda
  como primer ítem del carril L9-Word (la maquinaria de anchos por slot de
  H22/P14 es el patrón de reparación candidato).

Con esto la prueba 5 del carril L9 queda barrida (Word); falta consolidado
(L11 transversal, router en vuelo de A).

### B24 — B-H29 REPARADO: las tarjetas del FODA caben en Word (2026-08-04, sesión B)

Causa: Word renderiza a 6.0–6.6" (vs 12.5 del PPT) y las tarjetas usan ancho
relativo con texto en puntos absolutos — a la mitad del ancho físico, el
label truncaba y el chip desbordaba. Fix con el patrón de la casa: el bloque
ad-hoc de ajustes Word de media_rango se absorbe en un helper por tipo
(`.word_ajustar_el`, reporte_plan_helpers) que suma la rama `dim_foda`
(texto de tarjeta 7pt, chip 7.5pt, tarjeta al 88% del ancho). **El monolito
baja a 9.400 (−18 bajo su línea base)** y el render Word muestra las
tarjetas completas con chips dentro del borde.

**Gate:** l8-defaults 34 (incluye el mock del glue que pasa por el camino
Word), media-rango-significancia 5, dim-foda-leyenda 10, plan-texto 113:
todo verde. Audit de congelados limpio.

### B25 — Re-censo tras 31 pases de la sesión B y estado de la cola (2026-08-04, sesión B)

**Censo re-medido** (mismo script del P1, sobre el working tree con las
curaciones B):

| Métrica | P1 (2026-08-03) | B25 (2026-08-04) | Δ |
|---|---|---|---|
| Graficadores en registry | 20 | **19** | −1 (`p_dim_radar_tabla` retirado, B-H16) |
| Args curados de graficadores | 213 | **227** | +14 (curaciones B17/B18/B20/B22) |
| Args curados de slides | 110 | 101 | −9 (fantasmas retirados por A en P7/P8) |
| Presets suelo | 11 tipos / 315 | 11 / 315 | = (cambios de valor, no de censo) |
| Monolito `reporte_plan_ppt.R` | 9.418 | **9.400** | −18 (lógica movida a helpers) |

**Estado de la cola global**: L1–L3 hechos (A); L4/L5/L6 de A con
remanentes (H24–H26, preset agrupadas, sus archivos siguen en vuelo);
**L7, L8 y L9 CERRADOS por la sesión B** (censo, sweeps, diferenciales,
bordes, suelo, paridad Word y curación UI — 31 pases, ~30 reparaciones, 2
capacidades nuevas, 1 retiro); L10/L11-consolidado esperan el router;
L12 hecho para los carriles B (quedan los de A); L13/ACNUR diferido al final
por regla de Gonzalo. Pendientes B menores: mapa territorial (banco de
referencia), etiquetas de slices contiguos, B-D1/B-D2/B-D3 en bandeja.

**Lo que solo Gonzalo puede destrabar**: los archivos en vuelo de la sesión A
(agrupadas/apiladas/metadata/router + frontend multibase) llevan ~3h sin
commitear; si esa sesión murió, conviene commitear o descartar ese trabajo
para liberar L4–L6, L10 y L11.

### B26 — L7 COMPLETO: el mapa territorial rinde con banco sintético y B-H30 reparado (2026-08-04, sesión B)

El mapa de cobertura territorial renderiza con un contexto sintético (2
distritos × 3 manzanas, los 5 estados, labels y summary — patrón de banco
documentado en `sweep_mapa.R`): zonas coloreadas, labels de distrito y
leyenda completa. **B-H30 al primer vistazo**: «Comparación territorial»
(#00A98F) y «Cobertura efectiva» (#00B398) eran dos teals indistinguibles —
estados opuestos con el mismo color en mapa y leyenda. Reparación con
criterio institucional: la comparación CONSERVA su teal ACNUR (paridad con
las series de barras, P9) y es la efectiva la que pasa al verde de éxito de
la casa (#2E7D32). Test de distinguibilidad: toda pareja de estados con
distancia RGB > 40.

**Con esto L7 queda COMPLETO** (pie, donut, nube y mapa: censo, sweeps,
bordes, fantasmas reparados, dedup, paleta, orden, leyenda y estados).

**Gate:** l7-pie-nube 12: verde. Render antes/después mirado.

### B27 — Vara más alta: combinaciones cruzadas entre familias (2026-08-04, sesión B)

Cuatro láminas mezclando familias que nunca habían compartido lámina
(`sweep_cross.R`): dim_radar+pie, heatmap+donut, grid de 4 familias
(radar box + nube + pie + comparativo), foda+texto.

**En verde:** la nube se adapta al cuarto de lámina sin desbordes; radar box
y comparativo legibles en cuartos; heatmap+donut conviven; dim_radar+pie a
media lámina correctos.

**Hallazgos nuevos (mismo linaje que H22, con patrón de fix conocido):**

- **B-H31 — el pie corta sus etiquetas en panel angosto**: en el cuarto de
  lámina, «31% (46)» y «69% (104)» se clipean en los bordes — el pie no
  consume el `ancho_slot` que el motor inyecta desde P14.
- **B-H32 — las tarjetas del FODA truncan también en PPT compartido**
  (gráfico+texto): el mismo mal que B-H29 en Word; el fix por tipo de B24
  cubre solo la variante Word — el render PPT del foda necesita consumir
  `ancho_slot` y escalar tarjetas/chips como hace el wrap de barras.

Ambos son el siguiente objetivo de reparación (B28). Nota de banco: el radar
box exige `vars` con list_name compartido — las columnas recodificadas
`r100_*` no sirven como ejes de box (error claro del motor… en stderr, como
siempre).

### B28 — B-H31 y B-H32 REPARADOS: pie y FODA conocen su slot (2026-08-04, sesión B)

Ambos consumen ahora el ancho físico que el motor inyecta desde P14
(`el$overrides$ancho`):

1. **Pie (B-H31)**: en paneles < 9" las etiquetas escalan al ancho real
   (`× ancho/12.5`, piso 2.6) — X3 rinde «31% (46)» y «69% (104)» completos
   en el cuarto de lámina. Test: la etiqueta del slot es menor que la de
   lámina completa.
2. **FODA (B-H32)**: en paneles < 9" el texto de tarjeta y chip escalan
   (factor `ancho/12.5`, pisos 5.5/6) y la tarjeta se ensancha hasta el
   clamp oficial (0.90) — X4 rinde tarjetas íntegras con chips dentro del
   borde en gráfico+texto. Completa a B24 (que cubría solo Word).

**Gate:** l7-pie-nube 13, graficador-dimensiones 39, iconos-foda-radar 52,
dim-foda-leyenda 10: todo verde. Renders antes/después mirados (X3/X4).

### B29 — Vara alta 2: población 5 con cinco familias y narrativo con heatmap (2026-08-04, sesión B)

Los cajones de 3.95" (los más angostos del motor) con pie, donut, boxplot,
media_rango y radar box a la vez, más heatmap en slide narrativo
(`sweep_pob.R`):

- **En verde**: boxplot, media_rango y radar box legibles en cajón mínimo
  (los escalados de B2–B28 rinden); pie con etiquetas completas; heatmap en
  narrativo convive con su bloque de texto.
- **B-H33 reparado**: el donut clipeaba su etiqueta izquierda porque la
  leyenda DERECHA le robaba ancho al panel en cajones mínimos — en slots
  < 5" la leyenda pasa abajo automáticamente (render verificado: anillo más
  grande y leyenda contenida).
- Residuos menores anotados (cajón mínimo): la etiqueta izquierda del donut
  aún roza el borde en 3.95" y el caption se apretuja contra la leyenda —
  rendimientos decrecientes; candidatos a un pase futuro de micro-tipografía.

**Gate:** l7-pie-nube 13: verde. Renders mirados.

### B32 — Eje 3 verificado EN LA APP REAL: la curación B llega al analista (2026-08-04, sesión B)

Con `/ver-ui` sobre la pila de referencia `acnur_acg` (API 8801 + Vite 5191,
navegación por `__pulsoNav`, readiness real):

- **Hallazgo operativo primero**: el backend de la pila llevaba 12h corriendo
  con el paquete VIEJO — la API servía el registry pre-curación (20
  graficadores, cero args nuevos). R no hace hot-reload: **toda verificación
  UI tras tocar el registry exige reiniciar el backend** (regla para el
  harness). Reiniciada la pila huérfana, la cadena quedó fresca.
- **API verificada**: `/api/graficos/registry` sirve 19 graficadores
  (`p_dim_radar_tabla` retirado ✓) y TODOS los args curados: mostrar_valores/
  valores_decimales (radar), umbral_rojo_pct (tabla), top_k/etiqueta_otros
  (pie), brechas/totales/N/iter (heatmap), cortes/corte_score/títulos/iter
  (foda), max_palabras/min_chars (nube).
- **UI verificada con proyecto real**: biblioteca de graficadores sin el
  retirado (búsqueda «radar» → solo Radar y Tabla); slide de Radar creado; la
  pestaña Estilo muestra «Valores en vértices» con la descripción honesta de
  B6 y sus decimales (screenshot en evidencia). Los 5 modelos de dimensión
  correctamente ocultos por requisito en un proyecto sin dimensiones.

Higiene: pila de referencia dejada VIVA para uso de Gonzalo (API 8801, Vite
5191, proyecto acnur_acg abierto); el resto de servers de otras sesiones
intactos.
