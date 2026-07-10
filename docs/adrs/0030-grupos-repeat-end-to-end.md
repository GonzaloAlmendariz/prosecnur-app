# ADR 0030: Soporte de grupos repeat (begin_repeat) end-to-end

Estado: Aceptado

Fecha: 2026-07-10

## Contexto

Un `begin_repeat` de XLSForm es una estructura one-to-many: cada submission
tiene N instancias del bloque repetido. El modelo de base canónico de Prosecnur
es ANCHO (una fila por submission; linaje ADR 0006 / 0017), que no puede
representar un repeat sin perder la cardinalidad.

El disparador fue un estudio real (ACNUR PDM, asset Kobo `astk3QSFRmQuHbAbtwygYL`,
430 respuestas): su instrumento tiene un `begin_repeat` `rep_servicios` (batería
de satisfacción por servicio) y una matriz Likert con header `appearance="label"`.
El import fallaba con `E_DATA_XLSFORM_INCOMPATIBLE` (faltan 12 de 54 variables).

Una auditoría cross-stage (2026-07-10, evidencia con `archivo:línea`) reveló:

- **Ingesta**: el endpoint JSON `/data/` de Kobo devuelve el repeat ANIDADO como
  columna blob (`kobo_api_flatten_results`, `flatten=TRUE`, no expande). La forma
  long nativa de Kobo solo existe vía su API de exports asíncronos.
- **Validación** es la etapa más consciente de repeats — motor AST con reglas por
  `Tabla`, `repeat_context`, `repeat_length` y `aggregate_check`, más
  `validacion_lector_limpieza.R` — PERO anclada al modelo de **XLSX multi-hoja**
  con llaves `_parent_index`/`_index`/`_submission__id`, y DESCONECTADA de la
  ingesta por API (que reescribe todo a una sola hoja `datos`). En un proyecto con
  repeats, la base madre genera reglas anidadas que apuntan a una tabla
  inexistente → `missing_data_table`/`no_evaluada`.
- El fix inicial (`carga_kobo_repeats.R`) creó un modelo PARALELO: base hija long
  con llaves `_parent_id`/`_repeat_index`. Las dos convenciones son
  incompatibles: aunque se cargue padre+hija, no enlazan.
- **Analítica/Gráficos**: no hay join entre bases; "multibase" = apilar bases
  hermanas de misma estructura (`rbind`) o analizar cada base por separado. El
  `link_key`/`parent_base` se persiste pero nadie lo consume. Además el picker de
  la base ancha muestra variables fantasma del repeat.
- **Dashboard/Monitoreo**: sin soporte (dashboard descarta las vars del repeat en
  silencio; el handoff monitoreo→procesamiento dropea el repeat).
- **Entregables/PDF**: por-base; fuga de `_parent_id` como variable basura en
  export SPSS; N de la hija = instancias (668), no personas (427), sin etiquetar;
  el PDF de formulario no anota cardinalidad de repeat.
- **Referencias dinámicas** sin manejo end-to-end: `jr:choice-name()` en el
  calculate de `current_label`, piping `${current_label}` en labels de las
  preguntas del repeat, y `select_one ${var}` dinámicos.

Fuerzas en tensión: reutilizar el subsistema de validación maduro vs. construir
uno nuevo; invariante de base ancha vs. one-to-many; motor de join vs.
denormalización; épico multi-unidad vs. incremental.

## Decisión

1. **Modelo canónico**: base madre ancha (una fila por submission) + una base
   hija long por cada `begin_repeat`, vinculada con las **llaves canónicas
   ODK/Kobo**: `_index` (instancia), `_parent_index` (fila del padre) y
   `_submission__id`↔`_id` del padre. Se **abandona** la convención interina
   `_parent_id`/`_repeat_index` de `carga_kobo_repeats.R`.
2. **Reconectar, no duplicar**: alimentar el subsistema multi-tabla existente
   (`lector_limpieza` + AST `repeat_length`/`aggregate_check`/`repeat_context`)
   con la base madre+hija reales, en vez de mantener un modelo paralelo.
3. **Preservar el gate de grupo**: el instrumento hijo conserva el `relevant` del
   `begin_repeat` y las referencias a variables del padre, para que reglas
   relevant/constraint que cruzan padre↔hija no rompan como `missing_columns`.
4. **Cobertura de todos los paths de ingesta** que pueden traer repeats: Kobo
   single (hecho), Kobo independent-siblings, y el handoff
   monitoreo→procesamiento. SM/archivo: detectar exports ODK multi-hoja y/o
   avisar en vez de descartar en silencio.
5. **Referencias dinámicas**: manejar `jr:choice-name()` en calculates
   (`current_label`), piping `${current_label}` en labels, y `select_one ${var}`
   dinámicos; preservar `current_code`/`current_label` como la identidad del
   roster (dimensión de agrupación de la hija).
6. **Análisis cruzado hija×madre**: consumir `link_key` para un join
   many-to-one (hija→madre) que traiga la caracterización del padre; ofrecer
   además denormalización. Etiquetar el grano (N=instancias vs personas) y
   advertir clustering en la significancia de cruces sobre la hija.
7. **Higiene y downstream**: filtrar variables fantasma de repeat en
   pickers/secciones (`repeat_depth == 0`), suprimir columnas técnicas `^_` en
   export SPSS/base, dashboard y entregables/PDF conscientes de repeats
   (cardinalidad), y consolidar el backfill duplicado
   (`.carga_backfill_missing_expected` vs `_complete_expected_columns`).
8. **Identidad visual de repeat (naranja suave)**: los repeats y sus bases hija
   tienen una **identidad visual propia y transversal**, en naranja suave,
   distinta de las paletas de módulo (es un marcador semántico de estructura
   one-to-many/roster, no un acento de familia). Se define como token(s)
   `--pulso-repeat-*` en `theme.css` (sin hex hardcodeado en CSS de features),
   con variantes light/dark y validadas Windows-safe. La lógica de aplicación es
   deliberada y consistente en TODAS las superficies donde un repeat aparece:
   chip/badge de la base hija en el selector de bases (Carga y Analítica),
   badge de identidad del roster (`current_label`), marca "repetible" en las
   preguntas del repeat en formulario/codebook y en el picker de variables,
   secciones de repeat en dashboard, y el indicador de grano
   (N=instancias vs personas). El naranja significa siempre lo mismo:
   "esto pertenece a una estructura repetida".

## Consecuencias

- **Beneficios**: aprovecha la inversión existente en validación de repeats; un
  único modelo coherente de repeat en todo el pipeline; habilita el análisis PDM
  real (satisfacción por servicio × perfil del respondiente); import robusto para
  instrumentos complejos.
- **Costos/riesgos**: reescribe las llaves recién introducidas (migración de
  `carga_kobo_repeats.R` y sus tests); es un épico multi-unidad que toca muchos
  módulos; el grano de instancia introduce caveats metodológicos
  (ponderación/clustering) que deben señalarse; algunos archivos congelados
  (`router_monitoreo.R`, `reporte_plan_ppt.R`) requieren funcionalidad nueva en
  archivos nuevos que los llamen (no crecerlos).

## Cumplimiento

Se ejecuta por fases; cada fase es una unidad commiteable con su gate de
verificación:

- **Fase 1 — Ingesta canónica**: realinear llaves de la hija a
  `_index`/`_parent_index`/`_submission__id`; preservar gate de grupo; extender
  a independent-siblings y handoff; manejar `jr:choice-name`/`${}`/select
  dinámico; consolidar backfill. Check `rg`: la hija porta `_index`/`_parent_index`
  y NO persiste `_parent_id`/`_repeat_index`. Tests + verificación contra el asset
  real.
- **Fase 2 — Validación reconectada**: ensamblar padre+hija como `data_input`
  multi-tabla; un proyecto Kobo con repeats NO debe producir
  `missing_data_table`/`no_evaluada` para reglas de repeat; `repeat_length` y
  `aggregate_check` se evalúan sobre datos reales (tests).
- **Fase 3 — Analítica/Gráficos**: join hija×madre verificable (test); sin
  variables fantasma en el picker; grano etiquetado.
- **Fase 4 — Entregables/Dashboard/PDF**: sin fuga de `^_`; dashboard reconoce
  bases hija; PDF anota cardinalidad; N correcto en reportes.
- **Fase 5 — Identidad visual de repeat**: token(s) `--pulso-repeat-*` (naranja
  suave) en `theme.css`, sin hex hardcodeado en features (check `rg` sobre CSS de
  features); aplicado de forma consistente en el selector de bases, badge de
  roster (`current_label`), marca "repetible" en formulario/picker, secciones de
  dashboard e indicador de grano; verificado en light/dark y Windows-safe con
  evidencia visual (skill `/revamp-visual` + QA visual).

## Notas

Supersede la convención de llaves interina de `carga_kobo_repeats.R`
(commit del fix inicial de import Kobo, 2026-07-10). Relacionado: ADR 0006
(módulos por dominio), ADR 0017 (base panel analítica). Baseline de auditoría:
sesión 2026-07-10 (Ingesta/Validación/Codificación/Limpieza/Analítica/Gráficos/
Entregables/Dashboard/Monitoreo).
