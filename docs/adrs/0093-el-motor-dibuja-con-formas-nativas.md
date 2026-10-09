# ADR 0093 — El motor PPT dibuja con formas nativas, como el recetario

- **Estado**: Aceptado — revisado por `guardian-contratos` y `revisor-metodologico` (2026-10-08)
- **Ámbito**: Procesamiento › Gráficos — graficadores, motor PPT, motor Word, vista previa y editor
- **Fecha**: 2026-10-08 · **Ratificado**: 2026-10-08 (Gonzalo: «Lo apruebo»)
- **Implementación**: En curso — fases N0 a N9 (abajo); N0 cerrada con este ADR y `scripts/qa_pares_recetario.R`
- **Relación**: implementa [ADR 0092](0092-el-recetario-es-el-estandar-del-motor.md) (los recetarios son el
  estándar); reemplaza la técnica de dibujo de los `graficador_*.R` en el PPT.

## Contexto

El 8 de octubre de 2026 se puso por primera vez una lámina del motor al lado de la misma lámina del recetario,
con los mismos datos (recetario 216, 221 y 68 contra el mazo del catálogo 37, 38 y 36). La diferencia no era
de medidas: era de técnica.

- **El recetario** dibuja cada pieza como forma nativa de PowerPoint con `officer` (`caja()` y `txt()` en
  `docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R:51-65`; `barra_apilada`, `barras_h`,
  `bloque_likert`, `leyenda`, `titulo` y `pie` en el mismo archivo; `likert_panel`, `dicotomia`, `cifra` y
  las llaves en `recetario_piezas.R`). La lámina entera es una composición: antetítulo con barra navy,
  título, premisas con filetes, columna Top Two Box, leyenda centrada en el bloque, base y folio. Si un
  bloque no cabe, la lámina se parte en «(cont.)» y la letra no encoge.
- **El motor** dibuja cada gráfico como una imagen `ggplot` y la pega, vía `rvg::dml`, en un placeholder de la
  plantilla vieja. Un día de ajustes de tokens (grosor, puntos, leyenda nativa) movió medidas sin acercar la
  composición. La conformidad numérica quedó en 45 % y el par visual seguía siendo otro producto.

Gonzalo, al ver el par: «los grafics son drasticamente diferente al recetario… no se ve en absoluto a lo
pulido del recetarios». Y al decidir: «estamos cambiando fundamentalmente absolutamente toda la estructura de
todos los graficadores que pasan de usar ggplot a utilizar una técnica con elementos nativos de PowerPoint…
cambia fundamentalmente todo el motor en absoluto y en consecuencia también toda la interfaz usuaria».

El recetario de Word, en cambio, no usa formas nativas: sus 93 figuras son imágenes `ggplot` a 300 dpi con
fondo transparente, 6.27 in de ancho y alto por filas (`recetario_word_graficos.R`, 28 funciones `g_*`;
inserción en `recetario_word.R:53-65`). No comparte código de dibujo con el recetario PPT. Hoy el motor de
Word reusa el `ggplot` del PPT (`reporte_plan_ppt.R:4069-4084`), así que quedaría colgado del cambio.

## Decisión

1. **Tres capas, no una.** Cada gráfico se separa en:
   - **Especificación** (pura, sin dibujo): lo que el gráfico afirma, ya resuelto por la metodología del
     motor. Filas en su orden, etiquetas, cifras en sus unidades de redondeo, segmentos que se dibujan y los
     que no, N por fila, Top Two Box y Bottom Two Box, letras de significancia, colores por categoría,
     rótulos de leyenda. Se calcula una vez y se testea sin renderizar. **La produce una función pura
     `preparar_*` por familia, en archivo nuevo (`graficos_espec_<familia>.R`), y es el único dueño de la
     metodología**: `graficar_*` pasa a ser «dibujar con ggplot la especificación de `preparar_*`».
     **Transporte durante la transición (N1-N8):** `graficar_*` sigue devolviendo un ggplot y la
     especificación viaja como `attr(g, "pulso_espec")`, el mismo transporte que ya usa la tabla nativa.
     Así no se rompen el rebuild de la vista previa y de los jobs, los `p_slide_*`, el Word
     (`.render_element_impl`, `reporte_plan_ppt.R:4075`) ni los 65 tests que llaman a `graficar_*`.
   - **Compositor de lámina** (PPT): posee la lámina entera. Antetítulo y barra navy, título, ranuras del
     tipo de lámina leídas de `estandar_pulso.json`, la pieza nativa de cada ranura, leyenda, base y folio, y
     la partición en «(cont.)».
   - **Renderers**: el PPT dibuja la especificación con formas nativas, portando las piezas del recetario
     PPT. El Word la dibuja con `ggplot`, portando la geometría del recetario Word (6.27 in, Arial, piso de
     8 pt, fondo transparente, 300 dpi, rótulo, base y lectura como párrafos con estilo).
2. **El motor replica el recetario, también en sus cifras.** Gonzalo, 2026-10-08: «Debe ser 100% fiel al
   recetario, el motor ahora debe replicar le recetario, precisamrnte para eso lo hicimos». Donde el recetario
   declara una regla, esa regla manda sobre la que el motor tenía:
   - **redondeo**: el de las láminas 20 y 21 del recetario: «Redondeo estándar» (cada cifra por separado,
     desde 0.5 sube; es el `estandar` half-up del motor) y «Redondeo del resto mayor» (`reparto`). El
     `round()` al par que usa el código del recetario es un desliz de implementación: rige lo que la lámina
     declara;
   - **Top Two Box**: lámina 19, «la suma de los dos valores superiores de la escala», con el ejemplo
     «90% = 35% + 55%». Es la **suma de las cifras rotuladas** de las dos categorías superiores, para que el
     lector pueda sumarla. Las «dos superiores» son las categorías sustantivas declaradas por etiqueta
     (`top2box_labels`, emparejadas sin mayúsculas ni tildes); nunca SIN INF ni los códigos 90-99. Bottom Two
     Box igual con las dos inferiores. Un box sobre una escala igual o menor a su tamaño se apaga con motivo
     (`graficador_barras_apiladas.R:2642-2700`). Cambia respecto del motor anterior, que redondeaba la suma
     exacta y podía diferir en un punto de la suma visible;
   - **SIN INF** va como último segmento gris de la barra y dentro de la base (láminas 216 y 221). Excluirlo
     sigue siendo una decisión explícita del analista (`excluir_opciones`), y entonces se excluye en
     segmentos, box, N y base a la vez;
   - **orden**: una batería de un solo público se ordena por Top Two Box de mayor a menor (lámina 221);
     empates por el orden declarado, la fila Total primera y nunca se parte un bloque de actores. Con
     actores, el orden declarado. El analista puede pedir el orden declarado;
   - **anchos**: cada segmento mide su cifra rotulada sobre la suma de las cifras de su fila, como
     `barra_apilada()` del recetario; un segmento que se rotula 0 % no se dibuja.

   La especificación es un esquema versionado que el motor llena **con estas reglas** y que ningún renderer
   recalcula: por segmento la cifra, el ancho y si se dibuja; el denominador explícito; el box y su motivo si
   se apaga; el orden de origen y el aplicado; la fila Total marcada (ΣpN/ΣN); la N por barra decidida contra
   la base (`graficador_n_por_barra.R`); las letras de significancia sólo donde hay cifra
   (`sufijos_etiqueta`); las notas en su orden (`graficos_calculos_gobernados.R:161-171`); los códigos 90-99
   sólo si están presentes. Donde el recetario no declara regla, rige la del motor.
3. **Migración por tipo de gráfico, con respaldo.** Mientras un tipo no tenga pieza nativa, sigue saliendo como
   imagen y la lámina lo avisa. Un tipo pasa a nativo sólo cuando su par recetario|motor coincide.
4. **El gate es visual.** Cada tipo se cierra con el par recetario|motor (misma pregunta, mismos datos),
   mirado y enviado a Gonzalo, además de las medidas. «Verde por conformidad, no por ausencia» se mide sobre el
   par, no sólo sobre números.
5. **El editor se rehace sobre el modelo nuevo.** La vista previa ya rasteriza el pptx real
   (`POST /api/graficos/preview-slide`, `router_graficos.R:2993-3314`, con `.render_pptx_slide_preview`), así
   que las formas nativas se ven sin tocarla. Cambia lo que se edita:
   - el «selector dinámico» (`ChartLayoutEditor`, `ChartLayoutPopover.tsx:113`), que reparte el lienzo de
     ggplot con `canvas_w_*`, `canvas_h_*_in` y `alto_por_categoria`, se reemplaza por las ranuras estándar de
     cada tipo de lámina y, si hace falta, un ajuste fino acotado sobre la ranura;
   - las opciones propias de ggplot (`canvas_*`, `grosor_barras` como fracción, `legend_*_npc`,
     `size_texto_barras` en mm, `debug_ph_*`; `.PRESETS_META`, `graficos_metadata.R:1991-3548`) dejan de
     mostrarse para los tipos nativos;
   - lo que el analista sí decide queda y alimenta la especificación: pedir el orden declarado en lugar del
     orden por Top Two Box, qué categorías suman el Top Two Box, excluir SIN INF, si va Bottom Two Box o fila
     Total, textos y antetítulo. Por defecto, todo como en el recetario;
   - la micro-maqueta de respaldo (`SlidePreview.tsx:539-660`) se dibuja desde las ranuras y la especificación.
6. **La partición en «(cont.)» no recalcula ni reordena.** Las premisas son atómicas (un bloque de actores no
   se parte); primero el mínimo de láminas y luego el corte más parejo, sin partes de una sola premisa si hay
   alternativa. Cada parte repite base, cabecera del Top Two Box, leyenda y notas. En multibase, el pie de una
   parte sólo nombra los públicos que esa parte contiene.
7. **Las piezas nativas de una ranura van agrupadas** (un `p:grpSp` por ranura). Así la lámina se mueve y se
   edita en PowerPoint como un bloque, y los medidores (`graficos_verificar_mazo.R`,
   `scripts/qa_estandar_conformidad.R`) siguen encontrando «el gráfico». officer 0.7 no tiene API de grupos:
   el grupo se arma con xml2 y entra con `ph_with.xml_document`, igual que hoy el `grpSp` de rvg
   (`reporte_plan_ppt.R:631-641`). Receta obligatoria: transformación identidad (`chOff`/`chExt` iguales a
   `off`/`ext`), `cNvPr id` únicos en la lámina, y la leyenda dentro del grupo (la leyenda nativa actual,
   `reporte_lamina_leyenda.R`, se dibuja suelta y se reubica en N1).
8. **Dos enganches, nombrados.** Por ranura: `.ppt_colocar_dml` (`reporte_lamina_leyenda.R`), al que
   `.ph_with_strict` ya delega todo `dml` (`reporte_plan_ppt.R:656`); despacha al renderer nativo si
   `attr(value$ggobj, "pulso_espec")` existe y el tipo está migrado, y si no al dibujo ggplot. Cero líneas en
   el archivo congelado. Por lámina entera: una rama hermana del precedente `.SLIDES_COMPOSICION` /
   `.composicion_render` (`reporte_plan_ppt.R:8950-8976`), unas 6 líneas. **Se sube la línea base de
   `reporte_plan_ppt.R` de forma deliberada** en `agentic/manifest.json` en ese commit, o se compensa
   extrayendo código del mismo archivo; el compositor sigue llenando `rendered`.
9. **La medición de texto es determinista.** El ancho de tinta (leyenda, partición) se mide con
   `systemfonts` y Arial, que pasan a estar declarados: `systemfonts` en `Imports` de `api/DESCRIPTION` y la
   fuente garantizada en el empaquetado (o embebida), con un test que falla si la medición cae al estimado
   por caracteres. Sin eso, el número de láminas de una partición cambiaría según la máquina.

## Migración y compatibilidad

- **Claves persistidas.** Guardan planes y opciones `graficos_config`, `graficos_config_por_base`,
  `graficos_consolidado`, `graficos_consolidado_draft`, `graficos_share_snapshot` y los defaults
  (`session_schema.R:349-358`; poda en `project_pulso.R:2338-2340`). Las claves nuevas (opciones del analista
  para tipos nativos, ajuste fino de ranura) son **aditivas** y la versión sube a `graficos/5` en los cuatro
  sitios donde hoy está fija (`router_graficos.R:1176, 1471, 2609`, `graficos_share.R:7`), con un migrador
  `graficos/4 → 5` en el normalizador.
- **Proyecto viejo en app nueva:** se abre y migra solo (ADR 0092); cada opción ggplot que un tipo nativo
  ignora se nombra en un `[PULSO-AVISO]` («canvas_w_* de barras_apiladas ya no aplica: la lámina usa la
  ranura estándar»), y se conserva en el plan para el Word y el respaldo.
- **Paquete de compartir nuevo en app vieja:** el manifiesto declara `graficos/5`; la app vieja ignora las
  claves que no conoce y renderiza con ggplot. `manifest.n_slides` pasa a contar láminas entregadas.
- **Listas cerradas.** El rebuild filtra args por `formals()` (`router_graficos.R:203, 489, 3188, 3218`) y el
  normalizador del front tiene su whitelist: toda clave nueva se declara en ambos lados en el mismo commit, o
  se descarta en silencio.
- **Contrato de la partición en «(cont.)».** Se expande **antes del render**, como ya se pagina «Otros»
  (`.make_otros_slides`, `reporte_plan_ppt.R:3093-3130`): una entrada del plan produce N láminas con un
  `parte`/`de_partes`. `n_slides` de jobs (`graficos_jobs.R:186`, `router_graficos.R:3392, 3562`), del
  compartir y del preflight multibase (`multibaseReportMenuModel.ts:40`) pasan a contar láminas entregadas; la
  vista previa devuelve todas las partes (`slide_preview` como lista, con `n_partes`) y el editor las muestra;
  el índice y el folio cuentan partes; `verificar_mazo` y los medidores emparejan por `(entrada, parte)`.
- **Mapa de tipos.** El motor tiene 32 `p_slide_*`, el estándar 22 con ranuras. Los otros diez (portada,
  índice, Top Two Box, redondeo, sección, objetivo con ícono, ficha técnica y `p_slide_{2,3,4}_graficos_poblacion`)
  se mapean en N7 a su lámina de identidad del recetario o a un tipo de los 22. **Una sola fuente de ranuras**:
  el compositor y `slide-layout-matrix` / `slide-layout-preview` leen `estandar_pulso.json`, para que la
  micro-maqueta y el PPT no se desalineen.
- **Multibase y consolidado.** El PPT multibase va por `ppt-all` con `per_base` (`router_graficos.R:3400-3470`);
  la especificación cubre los elementos multifuente (`.is_multi_source_element`), el consolidado,
  `graficos_radar_multibase.R` y `graficos_barras_comparativo.R`.
- **Jobs.** Las funciones nuevas son internas; los workers `callr` las ven sólo con el paquete reinstalado,
  así que cada fase que las use cierra con una corrida del job real sobre el paquete instalado. La clave de
  `graficos_preview_cache` incluye la versión del estándar y el modo (nativo o respaldo) de cada tipo.
- **`images` de preview-slide** (`router_graficos.R:3268`) queda vacío con formas nativas; el tipo del front
  (`graficos.ts:882`) lo declara opcional.

## Evidencia de partida

Prototipo en el scratchpad de la sesión del 2026-10-08 (piezas `bloque_likert`, `barra_apilada`, `leyenda`,
`titulo` y `pie` del recetario portadas con tokens del estándar, alimentadas con `acrconta_mazo.pulso` y el
redondeo del motor `.pulso_pct_unidades`). Contra las láminas 216, 221 y 222 del recetario difiere en
1.2 %, 1.3 % y 1.5 % de los píxeles a 70 ppp (bordes de letra y de segmento), y reproduce la partición en
«(cont.)», el Top Two Box como suma de las cifras rotuladas y el orden por Top Two Box. Su única desviación
del punto 2: dibujó los anchos con la proporción exacta en vez de la cifra rotulada, y N1 lo alinea. El mismo dato en el motor actual (láminas 37 y 38 del catálogo) es otra
composición. Con el banco `scripts/qa_pares_recetario.R` (fracción de píxeles distintos, 70 ppp, tolerancia
de color 8 %):

| Par | Motor actual (ggplot) | Prototipo nativo |
|---|---|---|
| 216, apilada de una fila con Top Two Box | 16.2 % | 1.2 % |
| 221, batería con Top Two Box | 24.8 % | 1.3 % |
| 222, su «(cont.)» | — (el motor no parte) | 1.5 % |
| 68, categórica | 28.9 % | (N3) |
| 79, histograma | 16.2 % | (N4) |

La cifra acompaña; el veredicto sale de mirar los pares.

## Fases

| Fase | Qué | Gate |
|---|---|---|
| N0 | Este ADR, el doc de arquitectura y el banco de pares recetario\|motor (misma pregunta, mismos datos) | revisiones de `guardian-contratos` y `revisor-metodologico` incorporadas (ambas «aceptable con cambios», 2026-10-08); Gonzalo aprueba |
| N1 | Especificación (esquema versionado) + compositor de lámina + piezas base (texto, caja, título con antetítulo, pie con folio, leyenda) en archivos nuevos; enganche en un solo punto de `reporte_plan_ppt.R` | primero los tests de invariantes de la especificación (abajo), sin renderizar; después los pares de 216 y 221 |
| N2 | Escalas: apiladas, multiapiladas, Likert compacto en paneles, Top Two Box y Bottom Two Box, fila Total, partición «(cont.)» | pares 74, 76, 77, 133, 142, 182-186, 197-222 |
| N3 | Proporciones: categóricas (columnas y barras), agrupadas, dicotómica partida, divergentes, lollipop, cifra destacada | pares 68, 71-74, 122-128 |
| N4 | Números: numérico, histograma, boxplot, media y rango, dumbbell, puntos comparativos, serie de dos mediciones | pares 79-82, 85-87 |
| N5 | Dimensiones: mapas de calor y comparativo | pares 92-94 |
| N6 | Los que el propio recetario dibuja con ggplot (torta, dona, radar, serie de 3 o más, nube, mapa): siguen en ggplot con el estilo del recetario | pares 69, 70, 88, 90, 98-106 |
| N7 | Los 22 tipos de lámina y las de identidad compuestos por el compositor | pares 121-169 y 19-65 |
| N8 | Word: renderer ggplot propio con la geometría del recetario Word, alimentado por la especificación | pares contra `propuesta-word.docx` |
| N9 | Editor: ranuras en lugar del selector de lienzo, opciones nativas, migración de proyectos con aviso | QA visual de `/graficos` en la matriz de viewports |

**Invariantes de la especificación (gate de N1, sin renderizar):** (1) en cada fila los anchos son cifra/Σcifras,
suman 1, y un segmento que se rotula 0 % tiene ancho 0 y no se dibuja; (2) con `estandar` cada cifra es el
half-up de su porcentaje (lámina 20) y con `reparto` la suma de cifras es 100·10^dec (lámina 21); (3) Top Two
Box = suma de las cifras rotuladas de las dos categorías superiores declaradas (lámina 19), con un caso donde
difiere del redondeo de la suma exacta; (4) un box sobre una escala igual o menor a su tamaño se apaga, y
ninguno incluye 90-99 ni SIN INF; (5) SIN INF es el último segmento y entra en la base salvo exclusión
explícita, y con `excluir_opciones` la base, la N, los segmentos y el box usan el mismo denominador; (6) una
batería de un público sale ordenada por Top Two Box, empates por el orden declarado, Total primera; con actores
o con orden declarado pedido, el declarado; (7) partir conserva el multiconjunto de filas y la base; (8) fila
Total = ΣpN/ΣN, sin fila con N = 0 o NA; (9) filas que suman 0 dan anchos 0, no NaN; (10) las letras sólo
aparecen donde hay cifra.

Los gráficos sin tipo en el motor (metas, significancia, matriz de conteos, peso, llaves) entran después de N7,
cada uno con revisión metodológica.

## Consecuencias

- `reporte_plan_ppt.R` sigue congelado: el compositor y las piezas viven en archivos nuevos y el renderer
  delega en un punto.
- Los tests que inspeccionan `ggplot_build` de los graficadores siguen valiendo para la ruta Word y para los
  tipos aún no migrados. La ruta PPT nativa se testea sobre la especificación y sobre las formas del pptx.
- Las opciones de estilo propias de `ggplot` dejan de aplicar en el PPT: se migran o se avisan (ADR 0092,
  punto 3). Viven en `graficos_config` del `.pulso` (`plan.slides[].payload[slot].args/.overrides`,
  `presets`, `w_presets`, `overrides_reusables`), así que la migración pasa por el normalizador existente.
- Unos 25 atributos `pulso_*` viajan hoy colgados del objeto ggplot (`pulso_tabla_nativa`,
  `pulso_leyenda_nativa`, `pulso_needs_tall_plot_slot`…). Durante la transición se suman en
  `pulso_espec`; al terminar N8 la especificación deja de depender del ggplot.
- 43 archivos de test inspeccionan `ggplot_build` o `$layers`, 65 llaman a `graficar_*` y 42 leen atributos.
  Siguen valiendo mientras el graficador ggplot exista para el Word y para los tipos de N6.
- La vista previa del editor no cambia de mecanismo: ya es el pptx real rasterizado.
- El Word deja de depender del ggplot del PPT (`reporte_plan_ppt.R:4069-4084`) en N8.
