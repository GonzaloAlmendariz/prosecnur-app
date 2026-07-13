# ADR 0034 — Override permanente de etiquetas por proyecto (label_overrides)

- Estado: Aceptado
- Fecha: 2026-07-12
- Contexto relacionado: [[0031-script-replicacion-base-analitica]], override de orden ordinal (`orden_categorias.R`)

## Contexto

Algunos instrumentos traen la etiqueta **bilingüe pegada en una sola celda** `label`
del sheet `choices`/`survey` del XLSForm. Caso confirmado: **ACNUR_PDM** trae
`"Sí Yes"`, `"Muy seguro Very safe"`, `"Satisfecho/a Satisfied"`, … en una única
columna `label`. Esto es un **dato de origen**, no una fusión nuestra:
`reporte_instrumento.R` lee **una sola** columna `label` y **no concatena** idiomas.

Consecuencia: toda la cadena de entregables (frecuencias, codebook, cruces,
validación, dashboard, gráficos, exports PPT/Word/XLSX) mostraba etiquetas
bilingües. El **split ES/EN no es automatizable** (no hay delimitador entre
idiomas; a veces el inglés repite palabra del español, ej. `"Seguro Insurance"`),
así que requiere **curación manual**.

La etiqueta bilingüe aparece en **tres lugares** del pipeline (hallazgo verificado):

1. `inst$choices$label` — fuente de `dicc_code_to_label` / `orders_list`.
2. `attr(col, "labels")` — value labels observadas en las filas (fuente real de
   los conteos).
3. `attr(col, "label")` — título de la pregunta.

Los puntos (2) y (3) se derivan en `reporte_data()` **desde** (1) vía
`var_labels`/`dicc_code_to_label`, así que corregir solo `inst$choices` no basta
si los `attr` ya se setearon aparte: hay que re-derivarlos o reescribirlos.

## Decisión

Se agrega un mecanismo **permanente de override de etiquetas por proyecto**,
gemelo del override de orden ordinal por `list_name` (`orden_categorias.R`):
el analista/seed define un mapa curado que **viaja dentro del `.pulso`** y se
aplica **una sola vez en la capa de instrumento**, sin que ningún engine lo
re-aplique.

### Contrato

Estado del proyecto: `s$label_overrides` (persistido en el `.pulso`; forma
jsonlite-friendly):

```
{ values: { <list_name>: { <code>: "etiqueta_es", ... }, ... },
  titles: { <variable_name>: "titulo_es", ... } }
```

- `values` — override de etiquetas de **valor** (opciones), keyed por
  `(list_name, code)`. Como se keya por `list_name`, una etiqueta compartida por
  muchas variables se corrige una vez.
- `titles` — override de **títulos** de pregunta bilingües, keyed por variable.

Endpoints (router delgado `router_label_overrides.R`):
- `GET /api/label-overrides` → `{ ok, label_overrides, n_values, n_titles }`.
- `POST /api/label-overrides` `{ label_overrides }` → persiste y republica el
  override ambiente. `400 E_LABEL_OVERRIDES_FALTANTE` si falta el campo,
  `400 E_LABEL_OVERRIDES_INVALIDAS` si no es objeto.

### Capa de aplicación (una vez)

Se aplica en `.bases_normalize_report_context()` (`helpers_bases.R`), el
**chokepoint** por el que pasa todo instrumento+data del pipeline: lo llama
`reporte_data()` y `.load_rp_sources()` de los entregables. Ahí:

- `.label_overrides_apply_to_instrument(inst)` reescribe (1) `choices$label`
  (+ `choices_raw`), `survey$label`/`var_labels` para títulos, y **re-deriva**
  `dicc_code_to_label`/`dicc_label_to_code`/`orders_list` desde lo reescrito
  (reusa `.bases_clean_report_instrument`).
- `.label_overrides_relabel_data(data, inst)` reescribe (2) `attr(labels)` y (3)
  `attr(label)` de las columnas desde el instrumento ya overrideado.

Como `reporte_instrumento`/`reporte_data` son funciones puras (sin sesión), el
override activo del proyecto se publica en un **env de paquete ambiente**
(`.label_overrides_env`, app mono-usuario → un proyecto activo). Se activa en
`load_pulso()` y `.pulso_rebuild_estudio_runtime_sources()` desde
`s$label_overrides`. La transformación es **id-preserving e idempotente** (solo
reemplaza el texto bilingüe por su español para `(list_name, code)`/variable que
casen), por lo que aplicarla de forma ambiente es seguro y deseado.

### Relación con el override de orden ordinal

Mismo patrón (persistir por proyecto en el `.pulso`, aplicar sobre el
instrumento), pero:
- Orden ordinal se aplica **por-engine** (analítica/gráficos) porque solo reordena
  `orders_list`; el override de etiqueta se aplica **una vez en la capa de
  instrumento** porque debe alcanzar los tres puntos y a todos los consumidores.
- Orden ordinal keya por `list_name` (orden de códigos); etiqueta keya por
  `(list_name, code)` (texto) y por `variable` (título).

## Alternativas descartadas

- **Split automático ES/EN**: descartado; sin delimitador y con solapamientos
  (`"Seguro Insurance"`) no es fiable. Requiere curación manual/import.
- **Override per-base en la config de Analítica** (`datos$value_labels`): ya
  existe pero es per-variable y se aplica solo en el review de Analítica; no
  alcanza codebook/validación/dashboard sin re-aplicar por-engine.

## Consecuencias

- ACNUR_PDM queda **permanentemente en español** al reabrir el proyecto (seed de
  90/90 etiquetas curadas → 99 pares `(list_name, code)` en 18 listas).
- Campos nuevos del workspace deben ir a la persistencia del `.pulso`;
  `label_overrides` se guarda como todo `s_clean` en `state.rds` (no requiere
  whitelist de metadata de base, que es otra lista). Se cuida el round-trip
  jsonlite manteniendo listas nombradas (nunca scalars que colapsen).
- El **código** de dato (`name`) no se traduce: un codebook puede mostrar
  `Yes → Sí` cuando el valor almacenado es el texto `"Yes"`; la **etiqueta** es
  español. Esto es correcto (el override es de etiquetas, no recodifica valores).
