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

## Consolidación metodológica y de entregables (2026-07-13)

La implementación posterior cierra las brechas de grano e inferencia que
quedaban en las fases 2–4:

1. Una base hija se reconoce por su **contrato relacional**, no por el proveedor:
   `parent_base` + `repeat_group` + `_parent_index` → `_index`. Kobo sigue siendo
   el productor principal, pero Validación acepta cualquier hija que cumpla el
   contrato. Una base con el blob presente y cero instancias también se registra;
   así `repeat_count > 0` frente a cero filas produce una inconsistencia real en
   vez de degradar silenciosamente a tabla ausente.
2. La evaluación de `repeat_count` usa una gramática cerrada: literal numérico,
   `count(${repeat})`, `count-selected(${var})`, referencia exacta `${var}` y los
   agregadores ya soportados `coalesce`, `min` y `max`. Una expresión más compleja
   no se aproxima extrayendo su primera variable: queda sin meta (`NA`) hasta que
   exista un evaluador XPath explícito.
3. En una hija repeat, la ponderación se calcula una sola vez sobre la madre, a
   grano persona, y el peso se propaga a todas sus instancias por la llave
   relacional. Nunca se recalibran targets sobre filas del roster.
4. Los cruces categóricos usan varianza sandwich agrupada por persona y ajuste de
   Bonferroni. Se requieren al menos 8 personas/cluster para mostrar letras; con
   menos clusters o sin llave se conservan los descriptivos y se omite la
   inferencia con una explicación explícita. Los cruces de dimensiones/medias
   repeat también omiten Welch y letras hasta contar con un contraste de medias
   cluster-robust; las bases no-repeat conservan el motor histórico.
5. Frecuencias y codebook de la hija excluyen variables heredadas de la madre y
   organizan las preguntas nativas por `current_label`/servicio. Gráficos, PPT y
   Word consumen el mismo par hija×madre enriquecido, los pesos a nivel persona y
   el metadato de grano. El Dashboard mantiene soporte estructural: filtra
   fantasmas en la madre y admite variables top-level de la hija, pero no se
   convierte en un segundo motor de joins analíticos.

### Carga manual XLS/XLSX multihoja

La carga manual reconoce el mismo contrato relacional cuando las respuestas
vienen en un libro Excel multihoja. Después de registrar la madre, solo se
catalogan hojas cuyo nombre coincide **exactamente** con un `begin_repeat` del
XLSForm. Cada hoja válida se materializa como hija con
`source_kind = "xlsx_repeat"`, `parent_base`, `repeat_group` y sus llaves. Se
acepta `_parent_index` → `_index` como vínculo principal y
`_submission__id` → `_id` como fallback; hojas extra o sin vínculo se ignoran.

La operación es idempotente: una fuente sin cambios no reescribe derivados ni
duplica bases; al reemplazar el libro madre se actualiza la hija existente. Al
abrir un `.pulso` anterior, el loader repara en memoria las hijas faltantes a
partir del Excel ya contenido en el proyecto, marca el estado como pendiente de
guardar y nunca modifica el insumo original.

Además, los mapas de códigos distinguen una recodificación real de una identidad
de transporte. Prefijos técnicos de dummies (`C1`, `Clegal`) y ceros iniciales
numéricos equivalentes no generan confirmación cuando el código final no cambia.
El boundary de Carga repite este filtro para impedir que estados antiguos o
payloads externos reactiven falsos pendientes.

### Límite deliberado: repeats anidados

Los `begin_repeat` anidados requieren una decisión y una unidad separada: la
base del repeat interior debe ser hija de la base del repeat inmediato,
`_parent_index` debe apuntar al `_index` de esa instancia exterior y la
validación debe ensamblar el árbol de forma recursiva. No se aplana el repeat
interior ni se enlaza directamente a la raíz porque ambas opciones pierden la
cardinalidad por nivel. Esta consolidación no cambia el esquema `.pulso` ni crea
esa jerarquía recursiva; un repeat anidado sin blob top-level continúa reportado
como capacidad pendiente, no como soporte parcial silencioso.

### Exploración condicionada por la identidad del roster

En Validación, el inventario de una base hija expone un `repeat_context`
opcional. `current_code` es la identidad estable de cada instancia y
`current_label` es solo su presentación. La etiqueta canónica se resuelve desde
la lista de opciones de la variable conductora referenciada por el cálculo de
`current_code`; los códigos observados que no estén en el catálogo se conservan
con su etiqueta observada, y las filas sin código se contabilizan en un bucket
explícito en vez de desaparecer.

Cada opción reporta por separado `n_instancias` y `n_personas`. El primer valor
es el denominador natural del roster; el segundo cuenta llaves padre distintas
y no puede inferirse sumando servicios, porque una persona puede tener varias
instancias. Por variable, el inventario distingue identidad, preguntas
compartidas y preguntas condicionales. La aplicabilidad condicional se deriva
del AST del `relevant` sobre `current_code`: ese subconjunto gobierna en qué
servicios se muestra la variable. El `relevant` completo se evalúa por fila y
gobierna la elegibilidad y los faltantes; así, un follow-up inelegible no se
cuenta como nulo. Los conteos separan aplicables, válidos y nulos por servicio.
La ausencia observada de respuestas nunca basta para declarar que una variable
no aplica.

Este contrato se limita al explorador de Validación: sus vistas existentes
reutilizan el filtro `current_code` y no se crea un motor analítico paralelo.
Los cruces e inferencia siguen bajo las reglas de grano y clustering de
Analítica descritas arriba.

## Notas

Supersede la convención de llaves interina de `carga_kobo_repeats.R`
(commit del fix inicial de import Kobo, 2026-07-10). Relacionado: ADR 0006
(módulos por dominio), ADR 0017 (base panel analítica). Baseline de auditoría:
sesión 2026-07-10 (Ingesta/Validación/Codificación/Limpieza/Analítica/Gráficos/
Entregables/Dashboard/Monitoreo).
