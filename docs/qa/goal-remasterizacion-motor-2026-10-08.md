# GOAL — Remasterización de los motores de PPT y Word, y su editor, sobre los recetarios (2026-10-08)

- **Estado**: En curso (loop indefinido, tick de 300 s, elegido por Gonzalo)
- **ADR**: [0092](../adrs/0092-el-recetario-es-el-estandar-del-motor.md)
- **Checklist**: [checklist-remasterizacion-motor-2026-10-08.md](checklist-remasterizacion-motor-2026-10-08.md)

## Vara

> «Estos recetarios son dos principalmente que quiero que se vuelvan la membrana de todo lo que vamos a hacer a continuación… el recetario de PPT, tanto como el recetario de Word, son a lo que tenemos que apuntar. Y precisamente ante eso es lo que el motor debe ajustarse… no solo me refiero al motor que genera los gráficos, sino a la interfaz que permite la generación de los mismos gráficos… necesito que sea muy fino, que sea muy cuidadoso, que respete las proporciones, que respete los estándares que ya están establecidos en los recetarios.» (Gonzalo, 2026-10-08)

## Contexto
Los dos recetarios ya están cerrados y son la norma:
- la propuesta de diseño en PPT (`recetario-moderna.pptx`, 272 láminas, 22 tipos de lámina);
- la propuesta en Word (`propuesta-word.docx`, 81 páginas).

Gonzalo pide que sean «la membrana de todo lo que vamos a hacer». Hay que remasterizar el motor de gráficos de Prosecnur (R) y su editor (React) para producir exactamente eso. El trabajo es profundo, se ejecuta entre hoy y el fin de semana, y tiene que ser fino, cuidadoso y respetar proporciones y estándares.

Lo que encontró la exploración:
- **Estilo disperso.** Está repartido en al menos cuatro capas que se contradicen:
  - presets de `graficos_metadata.R` (por ejemplo, base en 14 pt, cuando el estándar es 10);
  - defaults de cada graficador (`graficar_barras_apiladas`: título 11, leyenda 8, grosor mínimo 0.32);
  - valores sueltos dentro de `reporte_plan_ppt.R`;
  - paletas Likert y dicotómica que viven sólo en perfiles.
- **Geometría que viene de la plantilla.** Los márgenes varían por layout (0.315, 0.347 y 0.505 in) y los datos empiezan en 1.2–1.33 in en vez de 1.65.
  - No existe el antetítulo.
  - La pregunta se dibuja dentro de la imagen.
  - El grosor de barra es una fracción de la fila, no la tabla por número de filas.
  - No existe la regla de aire para cifras chicas.
  - La columna Top Two Box es proporcional, no de 1 in.
- **Catálogos que no coinciden.** El motor tiene 32 `p_slide_*`; la interfaz conoce 20 y marca las otras 12 como «versión futura». El recetario define 22.
- **Word.** Reusa los mismos graficadores con ajustes sólo para apiladas.
  - Arma el documento a mano: sin estilos, sin página definida, sin rótulos con campo SEQ, sin índice de gráficos y sin secciones.
  - Las notas (`entry$note`) se pierden.
- **Gráficos sin equivalente en la app:** metas, matriz de conteos, forest, cambio, peso, dicotómica partida y puntos por competencia.
- **Editor.** El «selector dinámico» (`ChartLayoutEditor`, `ChartLayoutPopover.tsx`) mezcla proporciones y pulgadas, y R no reescala igual.
  - Cada movimiento del deslizador apila un deshacer y dispara el autoguardado.
  - Los valores saltan entre heredado y propio, y los listeners se re-enganchan en cada render.
  - Cambiar de vista marca el plan como modificado.
- **Archivos congelados.** `reporte_plan_ppt.R` (9817), `graficador_dimensiones.R` (5007) y `editor-v2.css` (33 123) no pueden crecer. Lo nuevo va en archivos propios.

Decisiones de Gonzalo:
1. **Estilos:** el recetario moderno es el estándar por defecto. ACNUR y otros perfiles quedan como variantes que sólo cambian logo y paleta, sobre la misma geometría y reglas.
2. **Proyectos existentes:** migran solos. Un plan guardado se abre y se regenera con el estándar nuevo, y lo que no tenga equivalente se avisa, no se pierde.
3. **Word:** la app produce el documento completo: portada, índices, capítulos con apertura y encabezado, «Cómo leer este informe», figuras con rótulo, base y lectura, tablas y contraportada.
4. **Ritmo:** un loop continuo por fases, cada una cerrada con tests, el agente `verificador` y un commit en main. Hay hitos visibles: un mazo y un Word de ejemplo regenerados en cada fase.

## Principio rector
**Una sola fuente de verdad del estilo, derivada de los recetarios.** Todo valor visual (color, tamaño, márgenes, grosor, aire, posiciones) sale de un estándar versionado, no de defaults locales. Ningún graficador ni renderer decide un valor por su cuenta. Lo que hoy es un número suelto pasa a ser un token con nombre.

## Fases

**F0. Contrato, ADR y banco de comparación (base de todo)**
- `api/inst/estandar/estandar_pulso.json` con la norma extraída de los recetarios (`recetario.R`, `recetario_piezas.R`, `recetario_reglas2.R`, `recetario_word_identidad.R`, `recetario_word_graficos.R`):
  - **Lámina:** paletas por nombre (Likert, dicotómica, actores, texto y realce), escala tipográfica PPT y Word, geometría de la lámina estándar (márgenes, zona de datos de 1.65 a 6.42 in, base a 6.88 in, antetítulo y título), tabla de grosor por filas para escala apilada y categorías, `AIRE_CHICA` de 0.36 in, columna Top Two Box de 1 in, regla de leyenda centrada.
  - **Tipos de lámina:** los 22, con el rectángulo de cada ranura.
  - **Word:** página A4, ancho útil de 15.93 cm, alto por filas, estilos, rótulo APA, nota centrada y piso de 8 pt.
- ADR nuevo: «El recetario es el estándar del motor de PPT y Word». Fija la fuente de verdad, la política de perfiles de cliente y la migración. Revisión de `guardian-contratos`.
- **Banco de comparación:**
  - `scripts/qa_estandar_comparar.R` genera con el motor real una lámina por tipo y por gráfico (sobre `catalogo_motor.R`) y la pone al lado de la lámina equivalente del recetario.
  - Las reglas de `verificar_mazo` (`api/R/graficos_verificar_mazo.R`) se amplían con reglas de conformidad: márgenes, zona de datos, tamaños, grosor según la tabla, cifras chicas sin superposición y leyenda centrada.
  - Es el medidor de todas las fases: «verde por conformidad, no por ausencia».
- Checklist vivo `docs/qa/checklist-remasterizacion-motor-2026-10-08.md` y goal `docs/qa/goal-remasterizacion-motor-2026-10-08.md`, con la vara y el tablero.

**F1. Tokens en el motor**
- `api/R/estandar_tokens.R` carga el JSON y expone accesores: `.std_color()`, `.std_pt()`, `.std_geom()`, `.std_grosor(n, tipo)`, `.std_aire_chica()`.
- `.PRESETS_DEFAULT_PULSO` y `.PULSO_PPT_COLORS` (`graficos_metadata.R`) se derivan de los tokens.
- Los defaults de cada `graficar_*` dejan de ser números y leen tokens. Se cierra la deuda que anota `graficador_paleta.R:16-32`.
- Las paletas Likert y dicotómica pasan al núcleo. `graficos_preset_acreditacion.R` y la paleta de ACNUR quedan como perfiles que sólo sobrescriben color y logo.
- Tests: `test-estandar-tokens.R`, más un test de contrato que falla si un graficador declara un default visual numérico que no venga de un token.

**F2. Graficadores conformes al recetario**
Una pasada por gráfico, en el orden de uso real (apiladas, categorías, dicotómica, agrupadas, numéricos, puntos y brecha, series, dimensiones, abiertas, mapas):
- Grosor por número de filas, con la tabla de `.std_grosor` y no como fracción. Se resuelve el orden que anota `graficador_grosor_piso.R:58-74`: el alto se decide antes que el grosor.
- Cifras chicas encima con guía y la fila gana aire (`AIRE_CHICA`). La barra no adelgaza.
- Columnas Top Two Box y Bottom Two Box de ancho fijo, con la fila Total separada por un filete.
- Leyenda centrada en todo el bloque. En los mapas, al lado y centrada en vertical, con el ancho ajustado al dibujo.
- Dicotómica partida con cifras grandes.
- Dumbbell con cada cifra al costado exterior de su punto y la columna «Diferencia».
- Serie con la regla robusta de cifras.
- Histograma con el triángulo de la mediana.
- Radar con eje desde `lo` y rótulos en la diagonal.
- Mapa de calor de 80 a 100 con contraste del texto.
- Gráficos nuevos, cada uno en archivo propio con su `p_*` y su test: `graficador_metas.R`, `graficador_matriz_conteos.R`, `graficador_forest.R`, `graficador_cambio.R`, `graficador_peso.R`, `graficador_competencias_puntos.R`.
- Cada graficador entrega su alto sugerido para PPT y para Word (hoy sólo apiladas, agrupadas y dimensiones).
- Gate por gráfico: tests del graficador más el banco de comparación de F0.

**F3. La lámina PPT del recetario**
- Plantilla nueva `api/inst/plantillas/plantilla_pulso_2026.pptx`, construida con `construir_plantilla_ppt.R` desde la geometría del estándar:
  - un margen único y la zona de datos de 1.65 a 6.42 in;
  - antetítulo y título;
  - base a 6.88 in;
  - los 22 layouts del recetario.

  La plantilla actual queda para la migración y los perfiles.
- Renderer de lámina en archivos nuevos, sin crecer `reporte_plan_ppt.R`: `reporte_lamina_estandar.R` y `reporte_lamina_tipos.R`. La pregunta va como cuadro de texto fuera de la imagen. Las cifras destacadas, la narrativa con filete coral y las llaves de dependencia usan las piezas del recetario (`recetario_piezas.R`: `likert_panel`, `dicotomia`, `cifra`, `narrativa`, `llave_h`/`llave_v`/`llave_a_titulo`).
- `reporte_plan_ppt.R` sólo delega. Su línea base de congelado baja si se extrae código.
- Catálogo único de 22 tipos en `graficos_metadata.R` (`.SLIDES_META`), con alias desde los 32 actuales.
- Láminas de identidad: portada, objetivo, índices, separadores, «Cómo leer» (Top Two Box y redondeo) y cierres, como en el capítulo 1 del recetario.

**F4. Word completo**
- `api/R/reporte_word_documento.R` y `api/R/reporte_word_identidad.R`, portados de `recetario_word.R` y `recetario_word_identidad.R`:
  - estilos nativos, página A4 y una sección por capítulo con su encabezado escrito;
  - rótulo «Gráfico N» con campo SEQ y título en cursiva, nota centrada y lectura con `entry$note`;
  - índice de contenido, de gráficos y de tablas;
  - portada A, aperturas B, «Cómo leer este informe» y contraportada.
- `reporte_plan_word.R` queda como fachada.
- Alto de cada figura por filas, piso de 8 pt y ancho de 6.27 in.
- `api/R/docx_conformar.R` absorbe lo que hoy sólo hace `word_nativo.py`: `updateFields`, idioma es-PE, control de viudas, sangría francesa y separación del filete. Sin separación silábica automática.
- Tests: estilos, campos SEQ, índice y lista de figuras, secciones, página, y el validador OOXML en un test de integración local.

**F5. Migración de planes y proyectos**
- El normalizador de planes (`router_graficos.R` `.normalize_plan`, `.validar_plan_json`) traduce:
  - los tipos de lámina viejos a los 22;
  - los argumentos visuales sueltos a tokens, descartando los que el estándar fija;
  - los overrides de tamaño a su equivalente.
- Lo que no tenga equivalente genera un aviso con nombre (patrón `[PULSO-AVISO]`), sin descartarlo en silencio.
- Prueba con los proyectos de referencia (`api/inst/reference_projects/`: `acrconta`, `acnur_acg`, `acnur_pdm`, `hsvg2026`) y con `acrconta_mazo.pulso`: se abren, regeneran PPT y Word sin errores y pasan las reglas de conformidad.

**F6. El editor**
Se conserva lo bueno: la línea de tiempo, el inspector por pestañas, el autoguardado y el lienzo. Se rehace lo inestable, con `/revamp-visual`, `govern-visual-harmony`, `/contrato-superficie` y `emil-design-eng` para las microinteracciones.
- **Selector de láminas:** los 22 tipos del recetario, con miniaturas tomadas del recetario y su ficha (cuándo se usa y medidas).
- **Distribución del espacio:** se reemplaza el arrastre libre por las proporciones estándar de cada tipo de lámina, más un ajuste fino acotado, en una sola unidad y con un solo paso de deshacer por gesto. Se arreglan:
  - el deslizador sin regulación;
  - el salto entre heredado y propio;
  - los listeners re-enganchados;
  - las vistas que marcan el plan como modificado.
- **Vista previa:** fiel por lámina, servida por el motor real, y reutilizada mientras no cambie.
- **«Estilo global»:** se reduce a dos cosas.
  - Perfil de cliente: logo y paleta.
  - Opciones del documento Word: portada, índices, «Cómo leer» y capítulos.
  - Lo que el estándar fija deja de ser editable.
- **CSS:** va en hojas nuevas por componente, sin crecer `editor-v2.css`.
- **Código muerto:** se retiran `SlideEditor.tsx`, `TimelinePanel.tsx`, `ModeToolbar.tsx` y `ConfiguracionGlobal.tsx`, con doble confirmación y ADR o pedido explícito (gate 3).
- **Gates:** `make gate-front AREA=graficos`, `ui-quick-check` de `/graficos` y QA visual en la matriz de viewports.

**F7. Cierre integral**
- Se regeneran el mazo y el Word completos de dos proyectos de referencia y se comparan, lámina por lámina, con el recetario.
- Conformidad en verde en todas las reglas, `verificador`, notas de versión (`/notas-parche`) y actualización de `docs/arquitectura-prosecnur.md`.

## Orquestación y ritmo
- **Loop** con `/preparar-loop-indefinido`. Al empezar te pregunto la cadencia del tick. El encargo vive en `ENCARGO_LOOP.md`, con la vara textual: «los recetarios son la membrana; el motor debe ajustarse a ellos, fino, cuidadoso, respetando proporciones y estándares».
- **Oleadas** según `/orquestar-trabajo`: hasta tres trabajadores y dos escritores, con globs de escritura sin solape.
  - `backend-r` o `especialista-entregables`: tokens, graficadores, lámina y Word.
  - `frontend-react`: editor.
  - `guardian-contratos`: ADR, persistencia `.pulso` y API.
  - `revisor-metodologico`: Top Two Box y Bottom Two Box, redondeo, bases y significancia.
  - `verificador`: al cierre de cada fase.
- **Commits** en main por unidad coherente, por nombre de archivo, sin tocar archivos de otras sesiones.
- **Instalación del paquete** sólo con `pgrep` y sin bloqueo previo, y avisando antes, porque deja la app caída mientras dura.
- **Hitos visibles:** al cerrar F2, F3, F4 y F6 te envío un mazo y un Word regenerados desde un proyecto de referencia, para que comentes sobre algo concreto.

## Archivos críticos
- **Nuevos en `api/R/`:** `estandar_tokens.R`, los `graficador_*.R` nuevos, `reporte_lamina_estandar.R`, `reporte_lamina_tipos.R`, `reporte_word_documento.R` y `reporte_word_identidad.R`.
- **Nuevos en `api/inst/`:** `estandar/estandar_pulso.json` y `plantillas/plantilla_pulso_2026.pptx`.
- **Se modifican, sin crecer los congelados:**
  - `api/R/graficos_metadata.R` (presets y catálogo);
  - los `api/R/graficador_*.R` (defaults a tokens);
  - `api/R/reporte_plan_ppt.R` (sólo delegación);
  - `api/R/reporte_plan_word.R` (fachada);
  - `api/R/docx_conformar.R`;
  - `api/R/router_graficos.R` (normalizador y migración);
  - `api/R/graficos_verificar_mazo.R` (reglas de conformidad).
- **Frontend** (`frontend/src/features/graficos/`): `v2/timeline/SlidePicker.tsx`, `ChartLayoutPopover.tsx`, `GraficadorForm.tsx`, `store.ts`, `v2/shell/EstiloGlobalDialog.tsx`, `SlidePreview.tsx` y `api/graficos.ts`.
- **Reutilizables de los recetarios:** las piezas de `docs/qa/motor-ppt-2026-10-06/herramientas/` (`recetario_piezas.R`, `recetario_word_graficos.R`, `recetario_word_identidad.R`, `word_nativo.py`) se portan al paquete con tests y no se copian sin contrato.

## Verificación
- **Por fase:**
  - tests del área con `make gate-area` para R y `make gate-front AREA=graficos` para el frontend, más los contratos transversales;
  - el banco de comparación de F0 en verde por conformidad;
  - el agente `verificador`.
- **Instalación:** antes de probar los jobs, reinstalación con las precauciones de CLAUDE.md.
- **Integral:** el mazo y el Word regenerados desde `acrconta` y `acnur_acg` se comparan con los recetarios; los docx pasan el validador OOXML; los `.pulso` existentes abren y regeneran sin pérdidas silenciosas; y el QA visual del editor pasa en la matriz de viewports.
- **Lo que sólo Gonzalo puede confirmar:** abrir el PPT y el Word en Office real.

## Línea base de conformidad (F0.3, 2026-10-08)

Mazo `catalogo-motor-raw.pptx` del motor actual (58 láminas, `catalogo_motor.R` en modo deck, proyecto `acrconta_mazo`), medido con
`Rscript scripts/qa_estandar_conformidad.R <mazo.pptx> <tipos.csv>`: **530 medidas, 209 conformes (39 %)**.

| Medida | Conformes | Desvío medio |
|---|---|---|
| Tamaño de la base | 0 % | 4 pt (sale en 14, el estándar es 10) |
| Altura de la base | 72 % | 0.08 in |
| Gráfico: x | 18 % | 1.31 in |
| Gráfico: y | 13 % | 0.63 in (en un gráfico, empieza en 1.21 y no en 1.65: la pregunta va dentro de la imagen) |
| Gráfico: ancho | 51 % | 0.88 in |
| Gráfico: alto | 4 % | 0.88 in |
| Número de gráficos | 85 % | 0.24 |
| Título: tamaño | 94 % | 0.41 pt |
| Título: x | 62 % | 0.19 in |

Tipos del motor que el estándar aún no cubre (10 láminas): portada, índice, sección (3), objetivo con ícono, Top Two Box, redondeo,
tabla técnica y las variantes «población» de 2, 3 y 4 gráficos. Las láminas de identidad entran al estándar en F3 (capítulo 1 del
recetario); las variantes «población» se mapean a «Dos gráficos», «Tres gráficos en corona» y «Cuatro gráficos» en F5.
