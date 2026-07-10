# Prompt — Elevación estética de los PDFs de avance de monitoreo

> Brief reutilizable para una corrida autónoma. Está escrito para dar **dirección
> general y libertad creativa plena**, no una lista cerrada de tareas. El agente
> decide qué incluir, cómo componerlo y hasta dónde reimaginar — siempre que
> respete el dato, los contratos QA y la familia estética Pulso PDF.

---

## Rol y objetivo

Eres ingeniero senior de R (`grid`) + diseñador editorial trabajando en `prosecnur-app`.
Tu misión es **elevar la estética de TODOS los PDFs de avance de monitoreo a un nivel
profesional, elegante y editorial** — no solo el "avance por distrito", sino el conjunto:
avance territorial, avance de acreditación y reporte de producción.

Esto **no es solo re-estructurar el layout**: es trabajar **toda la estética** —
composición, jerarquía visual, color, tipografía, íconos, gráficos, densidad de
información, uso del blanco, ritmo de lectura— para que cada documento se sienta hecho
por un estudio de diseño, no autogenerado. Tienes **libertad para proponer, reimaginar,
agregar y quitar** secciones/visualizaciones si con ello el documento comunica mejor y
se ve más profesional. No te limites a lo que hoy existe.

## Principio rector

**Conserva la esencia, eleva la ejecución.** Hay activos gráficos ya muy iterados que
son la esencia a mantener (pudiendo pulirlos, no congelarlos): el **mapa coroplético**
de zonas aplicadas y el **avance diario** (combo barras + línea acumulada). El
**reencuadre cuota-por-distrito** (el avance se mide como cumplimiento de la cuota de
encuestas del distrito, no como manzanas/UMP aplicadas) ya está hecho y debe mantenerse.
Sobre esa base, sube el nivel de todo lo demás.

## Semillas de mejora (ejemplos, NO una lista cerrada)

Estas son ideas para arrancar, observadas como faltantes u oportunidades. Trátalas como
inspiración: decide tú cuáles tomar, cómo resolverlas y qué más agregar.

- **Siluetas reales de distrito.** Hoy las tarjetas/tiles caen a un círculo con iniciales
  ("CHO", "ATE"…) en vez de dibujar la silueta real del distrito, aunque el mapa de la
  página 1 sí carga los polígonos. Haz que la identidad de cada distrito use su **forma
  geográfica real**, bien resuelta y estética.
- **Demografía de la muestra con gráficos + íconos reconocibles.** El avance debería
  reportar con claridad, p. ej., **% de hombres/mujeres** y **% por grupo de edad**, con
  visualizaciones limpias (barras, donas, pictogramas) e **íconos legibles**. El dato ya
  existe en el model (cuotas por sexo/edad: observado vs meta).
- **Reporte de ocurrencias y del trabajo realizado.** Que se vea el esfuerzo de campo:
  **cuántas manzanas se intervinieron**, el **estado de cada una**, la **tasa de
  efectividad**, y el **reporte de ocurrencias** registradas. El dato existe en el model.
- Cualquier otra métrica/visual que consideres que un cliente valoraría ver en un reporte
  de avance profesional (ritmo, proyección, calidad del dato, cobertura, etc.).

> Reitero: son semillas. Tienes libertad para descartar, reordenar, fusionar o inventar
> secciones y gráficos nuevos si mejoran el resultado.

## De dónde sale el dato (para no inventar nada)

Todo lo anterior es **derivable del model** — no inventes cifras. Puntos de partida:
- Demografía sexo/edad: secciones `cuotas_ump` / `cierre_cuotas` y `cuotas_resumen`
  (columnas `Sexo Hombre observado/meta/faltante`, `Edad 18-29/30-44/45-59/60+ observado/meta`, matrices esperadas/observadas).
- Ocurrencias: sección `ocurrencias_campo` (o `field_occurrences` del dashboard).
- Manzanas/estados/efectividad: `avance_campo`, `block_progress`, estados operativos,
  y los totales de `.monitoreo_territorial_advance_progress`.
- Cuota-por-distrito: `avance_por_distrito` (Distrito/Meta/Total/Efectivas/% avance/Brecha).

Si un dato no está en el model del PDF que recibes, deriva de forma trazable o exponlo
primero en el builder del model (sin romper los contratos de columnas existentes).

## Restricciones duras (no negociables)

1. **Dato intacto.** No alteres conteos ni inventes valores. Trazabilidad total.
2. **Contratos QA.** No rompas `api/tests/testthat/test-monitoreo-*`. En particular, el
   PDF territorial cliente debe seguir conteniendo `ENCUESTAS\n{efectivas}` por distrito
   y el total, además de los títulos y el footer que los tests grepean
   (`docs/qa/monitoreo/monitoreo_sheets_pdf_matrix.md`, `test-monitoreo-publish-qa.R`).
   Baseline actual: publish-qa **549/3** (los 3 fallos son pre-existentes de acreditación
   xlsx — no los toques), engine **1694/0**.
3. **Cero dependencias nuevas.** Solo paquetes ya en `api/DESCRIPTION` Imports
   (`grid`, `png`, `ggplot2`, `openxlsx`, `qpdf`…). Vía "de casa": `grDevices::pdf()` +
   `grid`. Nada de Quarto/HTML/LaTeX/binarios. Los íconos son **pictogramas dibujados con
   `grid`** o pequeños PNG embebidos zero-dep; no hay SF Symbols en PDF.
4. **Familia estética Pulso PDF.** Adopta la capa compartida (paleta navy `#002457`,
   header título/subtítulo + regla navy, footer logo·periodo·"Pág. N"·hairline, tipografía,
   reglas hairline, tablas estructuradas, calibración de ancho). Ver
   `docs/pdf/pulso-pdf-design-system.md` y `api/R/pulso_pdf_theme.R`. El **layout del
   contenido es libre por motor** (la doble columna es del codebook, no un default).
5. **Locale UTF-8**: corre R con `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`.

## Metodología de verificación (obligatoria — con datos REALES)

No uses solo fixtures sintéticas: **renderiza con los proyectos reales** y revisa
visualmente cada página, iterando hasta que se vea impecable. Bugs como el desborde de
cifras de 5 dígitos solo aparecen con datos reales.

- Proyectos de referencia:
  - Acreditación → `~/Documents/Pulso/pruebas-monitoreo/ACRDCONTA.pulso`
  - Territorial → `~/Documents/Pulso/ACOGIDA ACNUR/ACNURCG.pulso`
- Cómo cargar: un `.pulso` es un zip con `state.rds`; usa `state$monitoreo_snapshot`
  (`$data`, `$config`, `$dashboard` cacheado) y reconstruye el model como el router
  (`router_monitoreo.R:~1451-1487`): `monitoreo_normalize_config(...)`,
  `monitoreo_publication_model(data, cfg, audience="client", dashboard=..., ...)` para
  territorial; `monitoreo_acreditacion_client_report_model(data, cfg)` para acreditación.
  Sourcea el paquete con el patrón de `api/tests/testthat/setup-load-all.R`.
- Render: `pdftoppm -png -r 110 -f N -l N salida.pdf out` + **inspección visual** (Read del
  PNG). Nunca asumas que "se ve bien".
- Al cerrar: corre las suites de monitoreo y confirma que siguen verdes (o solo con los 3
  fallos pre-existentes).

## Entregable

Mejoras **implementadas** en los motores de avance (`api/R/monitoreo_engine.R` y, si
corresponde, sus builders de model), con **antes/después en PNG usando datos reales**, y
las suites de test en verde. Reporta por documento qué elevaste y por qué.
