# Inventario F6 — el editor de Gráficos frente a los motores nativos (2026-10-09)

Tipo: Inventario QA fechado
Estado: En curso
Fecha: 2026-10-09
Autoridad: Evidencia de lectura de código; no reemplaza contratos ejecutables ni ADR aceptados

Gonzalo, 2026-10-09: «Estamos en una de las etapas mas fundamentales de el loop. La remasterizacion de la UI, Recuerda que
ahora ambos motores usanos elementos nativos y ya no ggplot y que el recetario tiene muchas funciones elementos nuebos, una
biblioteca de icnos. Y demas y el UI tiene que estar a la altura». Checklist: [checklist-remasterizacion-motor-2026-10-08.md](checklist-remasterizacion-motor-2026-10-08.md)
(R2, R3, R4, R14, R16, F6). ADR [0093](../adrs/0093-el-motor-dibuja-con-formas-nativas.md).

## Parte B — controles del editor sin efecto en la salida nativa

Método: args reales de `.GRAFICADORES_META` y `.PRESETS_META` (`api/R/graficos_metadata.R`) contra lo que leen la
`pulso_espec`, las láminas (`api/R/lamina_*.R`) y los renderers Word (`api/R/reporte_word_graficos_*.R`). Lectura de código,
sin renders.

**Hecho general.** Ninguna lámina nativa ni renderer Word lee `size_*`, `color_*` (salvo la paleta de series), `font_family`,
`canvas_*`, `legend_*`, `grosor_*`, `alto_por_categoria`, `textos_negrita`, `umbral_*` ni `debug_ph_*`: tipografía, geometría y
partición salen de `.std_pt`, `.std_color`, `.std_geom` y `.std_word`. Esos args sólo actúan en la ruta anterior (ggplot):
gráfico sin espec, `*_cabe()` en FALSE, `meta$motor_nativo = FALSE`, o tipo sin renderer Word (nube, serie temporal, heatmap
de criterios). Ningún control lleva marca de «sin efecto nativo» ni avisa (ADR 0092 punto 3 prometía «se migran o se avisan»).

| Graficador | Con efecto nativo | Sólo ggplot | Impuestos |
|---|---|---|---|
| barras_apiladas / multi_apiladas | var(s), cruces, excluir_opciones, significancia; decimales, metodo_redondeo, categorías en cero, invertir, barra extra top2/top3/bottom2 y sus labels, paleta | textos_negrita, tendencias y umbrales del box, títulos de grupo, mostrar_valores, colores y tamaños de texto, conectores, wrap/ancho de eje, leyenda, canvas_*, alto_por_categoria, grosor. **multilista** no es nativo (cowplot) | etiquetas_arriba_si_no_caben, size_barra_extra, size_titulo_extra, color_barra_extra, color_conectores_etiquetas |
| barras_agrupadas | Sólo sin cruce: var, excluir, max_categorias, otros, orden, invertir, decimales, n, significancia; usar_eje_libre y marcas_eje **sin control en la UI** | mostrar_ceros, otros_al_final, umbrales, ancho/lineheight de eje, colores_series, leyenda, barra extra, tamaños, grosor, canvas_*. **Con cruce no hay espec** | — |
| barras_categoricas | var, excluir, max_categorias, otros, orden, decimales, redondeo | formato_valor, colores, promedio, ejes, grid, tamaños | — |
| divergentes | var(s), direccion_escala, n_negativas, neutro, excluir; decimales, paleta | mostrar_saldo, umbral, grosor, tamaños, leyenda, ejes | — |
| pie / dona | var, top_k, otros; tipo_pie, orden, decimales, redondeo, nota | etiquetas, leyenda, tamaños, donut_hole, canvas_* | — |
| dumbbell | corte, orden, mostrar_brecha; etiqueta_brecha, decimales, paleta | umbral_brecha_pct, tamaños, colores, leyenda, ejes | — |
| histograma | Nativo sólo sin grupo/bins/ancho_bin, enteros y rango ≤ 40: modo, decimales, limite_superior | el resto (límites, bins vacíos, etiquetas de cima, colores, leyenda, ejes) | — |
| boxplot | var, cruce; `cortes_chip` saca la lámina del nativo | chip_decimales, semáforo, outliers, leyenda | — |
| media_rango | Sólo modo score: var, cruce, chip_decimales, tipo_rango | ref_label, semáforo, **cortes_chip se pierden en silencio** | — |
| radar | modo, var(s), cruce, corte, top_n, eje_min/limites, tabla y su título/encabezados, decimales, paleta | grilla, niveles, radios, relleno, ejes, línea, leyenda, estilo de tabla | — |
| dim_heatmap | modo, objetivo, cruce, total, filtros; brechas sacan la lámina del nativo | etiquetas de brecha, total_x, n_cruce, semáforo, ejes, tamaños | — |
| dim_radar | sin espec: todo ggplot | — | — |
| mapa | scope, ubigeo, unit, coverage_mode, mostrar_manzanas | — | — |
| base (estilo común) | formato, sufijo_auto, nota_redondeo | tamaños y colores de título/subtítulo/ejes/nota; las láminas estructurales nativas usan el estándar | size_nota_pie, size_titulo_slide, size_leyenda, size_texto_barras, font_family |

Args que la espec lee y **no tienen control**: `fila_total`, `columna_bottom2box`, `orden_escala`, `invertir_segmentos`
(apiladas); `usar_eje_libre`, `marcas_eje` (agrupadas).

**Word.** El job llama a `reporte_word_plan` sin `estilo_documento` ni `opciones_documento`: siempre recetario con portada A y
apertura B. `.word_documento` no recibe `presets_word`; el recetario ignora `image`, `title_style`, `base_style`,
`intro_style`, `section_style`, `subsection_style`, `figure_numbering`, `pagebreak_*` y `toc` (sólo los lee el clásico) y
ninguno tiene control en el frontend. Sí llegan `chart_options.ocultar_etiqueta_si_titulo` y los `chart_presets` con efecto
nativo. Riesgo: `DEFAULT_WORD_PRESETS.barras_apiladas` (`frontend/src/api/graficosConfigNormalizer.ts:5`) trae
`mostrar_barra_extra: false` y `barra_extra_preset: "ninguno"`, que apagan el Top Two Box en Word salvo que el PPT lo pida.

**ChartLayoutPopover (R3).** `frontend/src/features/graficos/ChartLayoutPopover.tsx` (montado en PresetsEditor,
WordPresetsEditor, OverridesEditor y GraficadorForm) edita sólo canvas_*, alto_por_categoria, tabla_ph_*, leyenda, título y
pie: nada de eso lo lee la salida nativa. Sólo sirve en la ruta anterior. Lectura del inventario: retirarlo o limitarlo a la
ruta anterior, no repararlo.

**No determinado.** `mostrar_media` del boxplot nativo; `estilo` y `mostrar_valores` del radar en la lámina 90; equivalente
nativo de la columna «Base / N» o «Total»; serie_temporal, lollipop, puntos_comparativos y mapa_resultado no inventariados a
fondo.

## Parte A — capacidades del motor sin control en el editor

Tres problemas de fondo, antes que la lista:

1. **El frontend no tiene canal para `slide.meta`.** `Slide` (`frontend/src/api/graficos.ts:154`) sólo trae
   `{id, tipo, payload, origen}`; los args `tipo_input:"meta"` caen en `DedicatedSurfaceNotice` (`ArgField.tsx:458`). Ahí viven
   `variante`, `composicion`, `iconos`, `actores`, `metodo`, `antetitulo`, `nivel`, `numero`, `rotulo` y `motor_nativo`.
2. **El job de Word no pasa las opciones del documento** (`router_graficos.R:3507`, `graficos_jobs.R:255-283`): portada,
   apertura, «Cómo leer», redondeo, contacto, `meta_portada`, `titulo_corto` y `fuente` quedan siempre por defecto.
3. **El editor no distingue nativo de respaldo.** La vista previa rasteriza sólo la lámina 1 (`slide_index = 1L`); las
   «(cont.)» no se ven y la caída a la ruta anterior (`*_cabe` en falso, brechas o Total en dimensiones, portada de 3+ líneas)
   no se avisa.

| # | Capacidad | Dónde vive | Control hoy | Exposición propuesta |
|---|---|---|---|---|
| 1 | 12 de 33 tipos de lámina no insertables (redondeo, 2 vertical/asimétrico, 3 gráficos ×4, población ×4, cifras y gráficos) | `reporte_plan_slides.R`; `estandar_pulso.json` `ppt.tipos_lamina` | `SlideType`/`SLIDE_LABELS`/`DEFAULT_PAYLOADS` conocen 21; `SlidePicker.tsx:889` «requiere una versión más reciente» | Selector armado desde registro + ranuras del estándar, con miniatura |
| 2 | Blueprint kinds desconocidos (closing, population3*, kpi_band, grid3_*, grid2_*) | `graficos_metadata.R:729-982` | `metadataSanitizers.ts:78` los vuelve `neutral`; el cierre usa la maqueta de título | Kinds y maquetas desde las ranuras |
| 3 | Opciones del documento Word (portada A/B/C, apertura B/A, Cómo leer, redondeo, contacto, meta_portada, titulo_corto, estilo, fuente) | `reporte_plan_word.R:265`; `.word_documento` | Ninguno | Sección «Documento Word» en Estilo global → `opciones_documento` hasta el worker |
| 4 | Redondeo del «Cómo leer» Word no sigue al informe | `reporte_word_documento.R:104` («estandar» fijo); PPT sí deduce (`.lam_redondeo_metodo`) | — | Deducirlo como el PPT. **Defecto metodológico**, no sólo de editor |
| 5 | Orden declarado vs por Top Two Box | `preparar_escala(orden=)`, `orden_escala`; multiapiladas «var» se reordenan siempre | Ninguno | «Orden de filas: Top Two Box (recetario) / instrumento» |
| 6 | Bottom Two Box junto al Top Two Box | `columna_bottom2box` | `bottom2box_labels` en lista libre | Interruptor + selector de dos chips; Word sólo lo explica si existe `box2` |
| 7 | Fila Total (ΣpN/ΣN) | `fila_total` | Ninguno | Interruptor en escalas |
| 8 | Variantes de portada (centrada, izquierda, banda) | `meta$variante`, `.lam_portada_variante` | Ninguno; descripciones de subtítulo/subtexto viejas | Composición con miniaturas + aviso si el título no cabe |
| 9 | Índice: arcos/facetas/círculos/bloques e íconos por capítulo | `meta$composicion`, `meta$iconos` | `IndiceBuilder` edita `iconos_focos`; **llenar uno fuerza la ruta anterior** | Composición, íconos de la biblioteca, retirar focos |
| 10 | Cierre 61-65 | `variante` y contacto en `slots` | Insertable con maqueta incorrecta; su contacto no llega a la contraportada Word | Maqueta propia y contacto → `opciones_documento$contacto` |
| 11 | Antetítulo por lámina | `meta$antetitulo` | Ninguno | Campo con el heredado como marcador |
| 12 | Separador: nivel, número, rótulo | `meta$nivel/numero/rotulo`; Word usa `word_heading_level` | Ninguno; la ayuda dice «subtítulo sólo Word» (falso) | Selector capítulo/subcapítulo; unificar clave |
| 13 | Lámina de redondeo y su método | `p_slide_redondeo`, `meta$metodo` | No insertable | Insertable, método heredado de Cálculos |
| 14 | Explicación del Top Two Box | `.lam_laminas_top_two_box` (3-5 puntos) | Muestra 8 args de estilo que el nativo ignora | Ocultarlos; chips |
| 15 | Objetivo con actores | `meta$actores`, `**negrita**` | Pide ícono PNG y banda lateral que el nativo no usa | Lista de actores |
| 16 | Marcas 0-25-50-75-100 % y eje libre | `marcas_eje`, `usar_eje_libre` | Ninguno | Interruptor |
| 17 | Biblioteca de íconos del recetario | 124 Lucide navy/blanco, 21 coral, 1 verde (`herramientas/iconos/`); el paquete trae 22 navy y 18 blancos; elección automática por palabra clave | `IconosEditor.tsx` sólo sube PNG propios | Catálogo navegable, elección automática visible y reemplazable; empaquetar los 124 |
| 18 | Lectura bajo figura y secciones en la apertura Word | `.word_figura(lectura=)`, `.word_apertura(secciones=)` sin llamador | — | La narrativa de la lámina alimenta la «Lectura» |
| 19 | Franja de cifras / cifra destacada | `.word_franja` sin llamador; no hay graficador de cifra | — | Primero motor, después pieza «Cifra» |
| 20 | ~90 args del motor anterior visibles en tipos nativos | `.PRESETS_META` | `ChartLayoutEditor`; Estilo global con 8 pestañas | Ocultar por tipo nativo y avisar |
| 21 | Paletas del estándar faltantes (dicotómica, actores, categórica, calor, mapa; Likert 5 con neutro) | `estandar_pulso.json` `ppt.paletas` | Sólo `LIKERT_RECETARIO` (sin `likert_neutro`) | Agregarlas, marcadas «del recetario» |
| 22 | `motor_nativo = FALSE` por lámina | `slide$meta$motor_nativo` | Ninguno | Avanzado «Usar la ruta anterior» + indicador |
| 23 | Ayuda del Top Two Box desactualizada | `graficos_metadata.R:1244`, `ArgField.tsx:1427` | Promete «las dos últimas» | Corregir |
| 24 | Fila «Muestra» de la ficha técnica | `.lam_ficha_muestra` | Sin pista del formato | Ejemplo «172 estudiantes (96 %)» |

**No determinado.** Si el normalizador conserva `payload.meta`; si `ArgField` escribe defaults del registro (bastaría
`iconos_focos_objeto_unico = TRUE` para mandar el índice a la ruta anterior sin que nadie lo toque); estado nativo exacto
de los 33 tipos; si el recetario PPT tiene lámina de Bottom Two Box.

## Línea base visual

Capturas antes del rediseño: 1440×1000 y 1024×600 sobre una copia de corrida de `acrconta_mazo` (`ui-quick-check`,
`--require-geometry`): 132 avisos `overflow-y`, 22 grupos de superficies sin declarar (C1), 0 errores de página o API. La
pestaña Estilo ofrece «Buscar entre 61 ajustes» del graficador; la lámina nativa sólo se ve con «Ver lámina»; los tipos de
lámina son fichas de texto en el timeline, sin selector visual de los 22 tipos ni biblioteca de íconos; a 1024 px la barra de
herramientas pierde etiquetas.

## Propuesta de dirección (aprobada por Gonzalo, 2026-10-09)

Problema: el editor sigue siendo el de la era ggplot —61 ajustes de estilo que la salida nativa no lee, la lámina real
escondida tras un botón, 12 tipos del recetario no insertables y el Word sin una sola opción—. Tarea primaria: armar un informe
viendo la lámina que va a salir y decidiendo sólo lo que el motor de verdad usa. Se conserva: navegación v3 (Procesamiento ›
Gráficos, top bar), timeline de láminas, tono del módulo, `PageFrame workbench`. Criterio de éxito: todo control visible
cambia la salida; toda capacidad del recetario tiene un control; la lámina nativa se ve siempre.

Partes, una por tick con par en pantalla y verificador:

| Parte | Qué | Ítems |
|---|---|---|
| F6.1 Verdad del editor | Indicador nativo/respaldo por lámina; controles sin efecto nativo bajo un desplegable «Ruta anterior» (no se borran: siguen sirviendo al respaldo); ayudas corregidas; `DEFAULT_WORD_PRESETS` sin apagar el Top Two Box; ChartLayoutPopover limitado a la ruta anterior | B, A20, A22, A23 |
| F6.2 Canal `meta` y Documento Word | `Slide.meta` de punta a punta; sección «Documento Word» en Estilo global que viaja como `opciones_documento`; redondeo deducido | A3, A4, A10, A18 |
| F6.3 Láminas desde el registro | Selector visual de los 33 tipos con miniatura desde las ranuras del estándar; variantes de portada, índice, cierre, separador; antetítulo; objetivo con actores | A1, A2, A8, A9, A11-A15, A24 |
| F6.4 Biblioteca de íconos | Empaquetar los 124; catálogo navegable; la elección automática se ve y se reemplaza | A17 |
| F6.5 Controles de escala y paletas | Orden, Bottom Two Box con chips, Fila Total, marcas del eje, paletas del estándar | A5-A7, A16, A21, N9b |

Contrato de armonía (govern-visual-harmony, modo Direct, v1): tres columnas del workbench —timeline a 240 px (rail), lienzo con
la lámina nativa 16:9 siempre visible al centro, inspector a la derecha— con el inspector en secciones fijas
**Contenido · Composición · Datos · Ruta anterior**; escala `--pulso-space-*` (4/8/12/16/24) sin literales; miniaturas de tipo
y de variante en grupo `equal` 16:9 (C2); íconos en grupo `equal` cuadrado; vacíos dentro de su caja (C3); un solo dueño de
scroll por columna (C4). Viewports 1440×1000 y 1024×600; a 1024 el inspector pasa a sideover.

### Decisiones de Gonzalo (2026-10-09), textuales, una por parte

1. F6.1: «Cuanod buscamos remasterizar, es una remasterizaiocn completa y fiel, se van». Los controles sin efecto nativo
   **salen del editor**, no van a un desplegable «Ruta anterior». La ruta anterior usa sus valores por defecto.
2. F6.2: «Debee hacer todo lo que el recetairo dice que hace». El documento Word expone todo lo que el recetario Word hace.
3. F6.3: «Si, e suna gran oportunidad para ahora hacerlos bien». Los 33 tipos desde el registro, bien hechos.
4. F6.4: «Bien, en especial para lanimas que lo usan como el de los iconos del indice». Los 124 íconos se empaquetan; el
   índice es el primer consumidor.
5. F6.5: «Esta bien, el recetario tiene cosas que el motor debe ser capaz de hacer y mostrar».

Hechos antes de construir: A4 (`6cf858893`, redondeo del Word deducido) y A23 (ayudas del Top Two Box).

Gonzalo, 2026-10-09, textual: «Ademas que esto dbee ser una remasterizaic9 completa dle diseño para que sea vea mejor y seas
intuitivo». F6 es un rediseño completo del editor, no una poda de controles sobre el diseño actual. Antes de F6.1 va **F6.0:
dirección de diseño**, una maqueta del editor nuevo a 1440 y 1024 que Gonzalo aprueba antes de implementar.

## Parte C — ¿la app puede mostrar la lámina tal cual? (medido, 2026-10-09)

Gonzalo: «comprueba que la app pueda realmente mostrar la lamina tal cual como lo publicitas». Medido con Plumber propio en
:8799 sobre una copia de `acrconta_mazo.pulso`, llamando a `POST /api/graficos/preview-slide` por HTTP.

| Lo que promete la maqueta | Hoy | Evidencia | Qué falta |
|---|---|---|---|
| La lámina real al centro | Parcial | Mismo motor del export (`reporte_ppt_plan`, `router_graficos.R:3243`) sobre un mini-PPTX, rasterizado; sólo bajo demanda en una burbuja (`SlidePreview.tsx:283`). Frente al export: portada y lámina de 4 gráficos 0 px distintos; la escala 13, 3.707 px (falta el antetítulo heredado del separador y el folio dice «1») | Pasar antetítulo y folio del plan al mini-plan; unificar el `rebuild_slide` del preview (`:3133-3228`) con `.graficos_rebuild_slide_json` del export (`:423-505`); panel central fijo |
| Se regenera al cambiar | Parcial | Regenera por hash con la burbuja abierta. 4–7 s por lámina con soffice (un proceso por llamada, ~3 s fijos); 11–15 s con artifact-tool; caché 5 min | Debounce, cancelación y estado «desactualizada»; soffice persistente para bajar a 1–2 s |
| Partes «(cont.)» | No | El mini-PPTX de la 13 trae 2 láminas; se rasteriza sólo la 1 (`slide_index = 1L`, `:2449`); la respuesta no cuenta partes | Rasterizar las N páginas del PDF (`.pdf_page_to_png` ya acepta `page`) y devolver `partes` |
| Indicador nativa / ruta anterior | No | La decisión vive en `.lam_compositor_aplica*` (`lamina_compositor.R:88-122`) y no se registra; los [PULSO-AVISO] se pierden | Registrar `motor_nativo` por lámina (o deducirlo del XML: grupos `prosecnur:*` frente a `<p:pic>`) y capturar los avisos |
| Visor del Word | No | Sin endpoint ni UI. DOCX→PDF 10 s (60 págs), PNG 6,6 s; generar el DOCX ~200 s; SEQ resueltos, **TOC vacío** en LibreOffice, PDF sin marcadores | Job DOCX→PDF→PNG, mapa de capítulos por `pdftotext`, visor paginado; rellenar el TOC o avisar |
| Renderer en la app de escritorio | No | LibreOffice, pdftoppm y `magick` no se empaquetan (`desktop/package.json:69-98`); `.preview_renderer_status` dice disponible con sólo ver soffice; sin renderer cae en silencio a una aproximación | Detectar bien y avisar en la UI; o empaquetar LibreOffice + Poppler (300–600 MB, firma) |

Consecuencia para F6: la maqueta se puede construir, pero la lámina real al centro exige primero una pieza de backend (contexto
del plan, partes, indicador nativo, avisos, renderer garantizado). Se trata como **F6.0b**, antes de la UI.

**Decisión de Gonzalo (2026-10-09), textual:** «se instala en el instalador de escritorio». LibreOffice viaja dentro del
instalador (`Internals/preview-renderer/`, que `.preview_renderer_roots` ya busca); la vista previa no depende de que el
usuario lo instale. Falta además el paso PDF→PNG (hoy `pdftoppm` o `magick`, ninguno empaquetado): se resuelve en la misma
pieza. Construir no autoriza firmar ni publicar.

## Parte D — plan para empaquetar LibreOffice (diagnóstico del agente de empaquetado, 2026-10-09)

Hallazgos que cambian el plan: (1) el respaldo `magick` no funciona sin `pdftools` (lo llama por dentro) y no está en
`api/DESCRIPTION`, así que sin `pdftoppm` la rasterización devuelve NULL aunque soffice funcione; (2) `system2` no pone
comillas: soffice falla con rutas con espacios (lo normal en Windows, `router_graficos.R` ~2306/2385/2387); (3) en macOS el
backend encuentra el renderer sólo por el directorio de trabajo (`desktop/main.cjs` no pasa `PULSO_APP_ROOT` ni la ruta).

LibreOffice 26.2.x oficial (TDF), fijado en `downloadarchive`: DMG arm64 284 MB, x64 294 MB, MSI Windows 356 MB; instalado
~795 MB. MPL-2.0 + LGPL: avisos intactos, enlace al fuente, marca respetada. En macOS se copia entero (quitar archivos rompe
la firma de TDF); en Windows un recorte es posible en una fase 2. Instaladores estimados: ~850–950 MB (Windows), ~800 MB (DMG).
PDF→PNG con el paquete R `pdftools` (poppler estático en los binarios CRAN mac/win, ~24 MB).

| # | Pieza | ¿Aprobación de Gonzalo? |
|---|---|---|
| P1 | Comillas en `system2` y URI del perfil codificada | No |
| P2 | `pdftools` en Imports + `renv.lock`; `.pdf_page_to_png` sobre pdftools; quitar `magick`; `.pdf_page_count` | No (sí el cambio en `quality.yml`) |
| P3 | `.preview_renderer_status` verifica también el rasterizador | No |
| P4 | `main.cjs` pasa `PROSECNUR_PREVIEW_RENDERER_DIR` | No |
| P5 | `packaging/preview-renderer.lock.json` + descarga verificada (SHA + firma) + aviso de licencia | No |
| P6 | Staging macOS en `build-dmg.sh` + `extraResources` | No para construir; sí para distribuir |
| P7 | Staging Windows con `msiextract` (+ VC++ runtime si hace falta) | No para construir |
| P8 | `release.yml`: caché, `msitools`, verificación del payload | **Sí** |
| P9 | Docs + ADR del renderer empaquetado | **Sí** |
| P10 | Fase 2: recorte en Windows | **Sí** |

Sin verificar: build real, `msiextract` arrancable, symlinks del `.app` anidado con electron-builder, notarización con código
de otro Team ID.

Hallazgo de paso: en el mazo exportado de acrconta, la lámina 4 (explicación del Top Two Box) sale con el título «N»
(`pdftotext` lo confirma). Defecto del motor por investigar.
