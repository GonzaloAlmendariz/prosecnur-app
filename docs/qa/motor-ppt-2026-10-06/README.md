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
| [`4-recetario/`](4-recetario/) | Recetario remasterizado de 68 láminas en dos versiones, con y sin guías de márgenes, cotas y constructor | La propuesta: cubre **los 32 tipos de lámina y los 24 gráficos** del motor; **fiel** respeta el estilo entregado; **moderna** propone cambios con evidencia |
| [`herramientas/`](herramientas/) | Scripts que generan todo lo anterior, íconos y datos | Regenerar o extender sin rehacer el trabajo |

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
| Datos del recetario | los tres scripts de `herramientas/preparar-datos/` dejan `datos_muestra.rds` y `src_conta.rds` en `SP` |
| Recetario | `SP=<datos> ESTILO=fiel\|moderna GUIAS=0\|1 SALIDA=<pptx> Rscript docs/qa/motor-ppt-2026-10-06/herramientas/recetario.R` (carga `recetario_piezas.R` y las secciones `recetario_m2*.R` a `recetario_m3e.R`) |
| Datos de nube y mapa | `SP=<datos> Rscript docs/qa/motor-ppt-2026-10-06/herramientas/preparar-datos/prep_m3e.R` |
| Medir espacio vacío por lámina | `python3 docs/qa/motor-ppt-2026-10-06/herramientas/medir_espacio.py recetario.pdf` |
| Sanear el PPT antes de abrirlo en PowerPoint | `python3 docs/qa/motor-ppt-2026-10-06/herramientas/sanear_ph.py entrada.pptx salida.pptx` |
| Revisar el XML de un mazo | `xml_audit.py` y `detector_encimado.py` en `herramientas/` |

Los íconos son de Lucide, la librería que ya usa la app (licencia ISC);
`iconos.py` los exporta en los colores de la marca.

## Advertencias

- La lámina de selección múltiple del recetario usa cifras agregadas de ACRD
  Ingeniería, que no es un proyecto anonimizado (sólo porcentajes).
- Todo PPT hecho con officer debe pasar por `sanear_ph.py`; sin eso, PowerPoint
  muestra «Click to add text» en cada caja (H19).
