# Motor PPT: diagnóstico, catálogo y recetario (2026-10-06)

Trabajo para que los mazos de Prosecnur salgan bien sin retoques. El estado vivo
(hallazgos, decisiones, pendientes) está en el checklist:
[`../checklist-motor-ppt-diagnostico-2026-10-06.md`](../checklist-motor-ppt-diagnostico-2026-10-06.md).

## Qué hay y en qué orden mirarlo

| Carpeta o archivo | Qué es | Para qué sirve |
|---|---|---|
| [`1-diagnostico/`](1-diagnostico/) | Dos comparaciones antes y después: una lámina de barras y una de tabla | Ver de un vistazo qué falla hoy y hacia dónde va la propuesta |
| [`2-guia-visualizacion-encuestas.md`](2-guia-visualizacion-encuestas.md) | Investigación con fuentes sobre cómo representar datos de encuestas | Respaldo de cada cambio de gráfico que propone la versión moderna |
| [`3-catalogo/catalogo-laminas-y-graficos.docx`](3-catalogo/catalogo-laminas-y-graficos.docx) | **Word editable**: los 32 tipos de lámina, los 24 tipos de gráfico, 25 situaciones y la matriz de qué gráfico entra en qué lámina | Decidir, en las columnas amarillas, qué entra al recetario |
| [`3-catalogo/catalogo-motor.pptx`](3-catalogo/catalogo-motor.pptx) | **PPT generado por el motor real**: cada tipo de lámina y cada tipo de gráfico, con datos de `acrconta_mazo` | Ver qué produce la app hoy, sin retoques ni paleta del proyecto |
| [`3-catalogo/compatibilidad.csv`](3-catalogo/compatibilidad.csv) | Prueba renderizada: 24 gráficos en 6 disposiciones | Evidencia de la matriz del Word |
| [`4-recetario/`](4-recetario/) | **Recetario v2, identidad visual de acreditación**: unas 100 láminas en dos versiones, con y sin guías de márgenes, cotas y constructor | La propuesta generalista: cubre **los 32 tipos de lámina y los 24 gráficos** del motor y los escenarios que aparecen en los informes de acreditación 2024 a 2026; **fiel** afina el estilo entregado; **moderna** propone cambios con evidencia |
| [`4-recetario/propuesta-word.docx`](4-recetario/propuesta-word.docx) | **Propuesta de diseño en Word**: el documento y sus partes (portadas, índices, aperturas, encabezado, contraportada), las reglas de página y estilo, el paso de PPT a Word, la galería de gráficos, las situaciones de datos, las tablas y un ejemplo por tipo de estudio, con diagramado de revista (APA 7) | Ver cómo se arma un informe en Word |
| [`herramientas/`](herramientas/) | Scripts que generan todo lo anterior, íconos y datos | Regenerar o extender sin rehacer el trabajo |

## Cómo está armado el recetario v2

| Parte | Qué muestra | Script |
|---|---|---|
| Portada y mapa | Portada del recetario y cómo recorrerlo | `recetario.R` |
| I Reglas de la identidad | Tamaño, peso y color de cada elemento (medidos en 6 informes finales con `medir_estilo.py`), retícula, paleta, texto junto a los gráficos, escalas que llegan y reglas de rotulado | `recetario_m0.R`, `recetario_m0b.R` |
| II El informe tipo | Un informe de acreditación completo en el orden de entrega: portada, objetivo, ficha técnica, índice, número de respuestas, Top Two Box, redondeo, perfil, resultados y recomendaciones | `recetario.R`, `recetario_m1b.R` |
| III Catálogo de láminas y gráficos | III.1 disposiciones, III.2 población, III.3 galería de los 24 gráficos, III.4 dimensiones | `recetario_m2*.R` a `recetario_m3e.R` |
| IV Escenarios de acreditación | IV.1 actores y bases; IV.2 escalas, etiquetas y formatos | `recetario_m4.R`, `recetario_m5.R` |
| V Otros estudios de PULSO | Opinión pública, cuasi-experimental, monitoreo posdistribución, encuesta en aulas, estudio por olas | `recetario_m6.R` |

Los escenarios salen de reconstruir con el motor los informes reales de Psicología,
Geografía, Derecho e Ingeniería, y de revisar los de Educación, Comunicaciones,
Escultura, AMDT y Contabilidad (hallazgos H45 a H71 del checklist). La sección 07 usa
la **forma real** de cada proyecto (escalas, actores, n y bases) con **porcentajes
ficticios**: ningún resultado de cliente queda en el repo. Lo cualitativo queda fuera:
el motor sólo ve lo cuantitativo.

### Reglas de rotulado que el recetario aplica (y que el motor debería adoptar)

- Una cifra que no cabe en su segmento va encima de la barra, con una guía fina; nunca se omite, ni siquiera un 1 %.
- Encima de la barra hacen falta 0,36 in libres: si la fila no los tiene, la barra adelgaza (mínimo 0,24 in). La letra no encoge.
- Cifras chicas seguidas se separan 0,46 in; si el grupo pasaría el final de la barra, se corre entero a la izquierda.
- SIN INF y «No he usado» van siempre al final y en gris, aunque la base los traiga primero.
- En los radares, las cifras de los anillos van entre los dos primeros ejes, con fondo, por encima de las series.

Gate de cada publicación: `sanear_ph.py`, `xml_audit.py` (Arial, sin formas fuera de la lámina, sin XML fuera de orden), `detector_encimado.py` (choques por tinta estimada) y `medir_espacio.py` (franjas vacías).

## Diferencia entre el catálogo y el recetario

- **El catálogo** (`catalogo-motor.pptx`) es lo que el motor hace **hoy**, con
  sus presets genéricos. Por eso ahí la escala sale con el extremo negativo en
  rojo y aparecen los defectos registrados (H38 a H42 del checklist).
- **El recetario** son maquetas de cómo **debería** verse, con la paleta
  validada (extremo negativo en naranja `F4B183`). Sólo usa láminas y gráficos
  que el motor tiene; cada lámina lleva su constructor al pie en la versión con
  guías.

## Cómo regenerar

Todo se corre desde la raíz del repo.

| Qué | Comando |
|---|---|
| Mazo real de `acrconta_mazo` | `SP=<carpeta con una copia del .pulso> Rscript docs/qa/motor-ppt-2026-10-06/herramientas/generar_mazo.R` |
| Catálogo PPT | `MODE=deck Rscript docs/qa/motor-ppt-2026-10-06/herramientas/catalogo_motor.R` (también `single` y `compat`) |
| Catálogo Word | `Rscript docs/qa/motor-ppt-2026-10-06/herramientas/catalogo_word.R` |
| Datos del recetario | `src_conta.rds` y `src_acg.rds` son `.graficos_processing_sources()` de `api/inst/reference_projects/acrconta_mazo` y `acnur_acg` (cargados con `load_pulso`); `ing.pulso` es una copia del proyecto de Ingeniería Mecánica (base `ingenieria_mecanica`, 131 egresados), fuera del repo. Con eso, `prep.R`, `prep_ing.R`, `prep_ing3.R`, `prep_m3e.R` y `prep_m3e_texto.R` de `herramientas/preparar-datos/` dejan el resto en `SP`. Reconstruido así el 2026-10-09: las páginas 1-22 del Word salieron idénticas |
| Recetario | `SP=<datos> ESTILO=fiel\|moderna GUIAS=0\|1 SALIDA=<pptx> Rscript docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R` (carga `recetario_piezas.R` y las partes `recetario_m0*.R` a `recetario_m7.R`; la Parte VI, banco de recursos, es `recetario_m7.R`) |
| Datos de nube y mapa | `SP=<datos> Rscript docs/qa/motor-ppt-2026-10-06/herramientas/preparar-datos/prep_m3e.R` |
| Propuesta de diseño en Word | `SP=<datos> LOGOS=<media de la plantilla PPT> SALIDA=<docx> [MAZO=<recetario-moderna.pptx>] Rscript docs/qa/motor-ppt-2026-10-06/herramientas/recetario_word.R` (carga `recetario_word_graficos.R` y `recetario_word_identidad.R`, y pasa `word_nativo.py`) |
| Medir espacio vacío por lámina | `python3 docs/qa/motor-ppt-2026-10-06/herramientas/medir_espacio.py recetario.pdf` |
| Sanear el PPT antes de abrirlo en PowerPoint | `python3 docs/qa/motor-ppt-2026-10-06/herramientas/sanear_ph.py entrada.pptx salida.pptx` |
| Revisar el XML de un mazo | `xml_audit.py` y `detector_encimado.py` en `herramientas/` |
| Prueba con un `.pulso` real | `PULSO=<copia> OUT=<carpeta> [BASES=a,b] [OTROS=1] Rscript docs/qa/motor-ppt-2026-10-06/herramientas/probar_pulso.R` |
| Bases limpias por la ruta de la app | `W=<carpeta> BASES="actor=ruta.sav;..." Rscript docs/qa/motor-ppt-2026-10-06/herramientas/canon_bases.R`, luego `planes/<proyecto>.R` |
| Radiografía y tipografía de un informe entregado | `analizar_ppt_entregado.py <pptx> --detalle` y `medir_estilo.py <pptx>...` |

Los íconos son de Lucide, la librería que ya usa la app (licencia ISC);
`iconos.py` los exporta en los colores de la marca.

## Advertencias

- La lámina de selección múltiple del recetario usa cifras agregadas de ACRD
  Ingeniería, que no es un proyecto anonimizado (sólo porcentajes).
- `recetario.R` llama a `sanear_ph.py` al escribir (no es un paso aparte). El cuadro nombrado «Titulo lamina» queda como título nativo de la lámina.
- Todo PPT hecho con officer debe pasar por `sanear_ph.py`; sin eso, PowerPoint
  muestra «Click to add text» en cada caja (H19).
