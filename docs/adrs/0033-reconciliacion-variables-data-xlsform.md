# ADR 0033 — Reconciliación de variables data↔XLSForm (variables extra multi-versión)

- Estado: Aceptado
- Fecha: 2026-07-11
- Contrato de revisión por base actualizado: 2026-07-26
- Contexto relacionado: [[0032-handoff-instrumento-siempre-local]]

## Contexto

Kobo, cuando un formulario tuvo múltiples versiones, incluye en el export de datos **todas las variables que existieron alguna vez**, aunque ya no formen parte del XLSForm de la última versión (variables de versiones anteriores que se quitaron). Con el instrumento ahora siempre local (ADR 0032), la data puede traer columnas "extra" que no corresponden al XLSForm vigente: vars de versiones viejas, y columnas-plantilla derivadas de la plataforma (`A1_rec`, `perception_index`, `dim_*`, …). Algunas vienen vacías, otras con datos.

El drop de columnas 100% vacías del export (cambio previo) tapa las extra vacías, pero una extra de versión vieja con datos se colaría igual, y no hay control explícito del usuario sobre qué extra conservar.

## Decisión

Se agrega un paso de **reconciliación** data↔XLSForm. Al traer data (upload manual **o** handoff de Monitoreo) se computa el conjunto de variables **extra sustantivas**:

> columna cuyo **stem resuelto** (dummy `<parent>.<code>` → `<parent>`; group-prefix `Grupo.token` → `token`) **no matchea ninguna** `inst$survey$name` (case-insensitive, incluyendo filas `calculate`/`note`/`select_multiple`), **y** no es metadata Kobo (`_*`, `meta.*`, `formhub`, `__version__`), **y** no es plumbing interno.

Definición robusta a propósito: los `calculate` (`date`, `E1_age_calc`, `time_*`) y los dummies de select_multiple NO son extra (son variables reales del instrumento). Usar el `extra_columns` crudo de `validate_data_xlsform_compatibility` sería incorrecto (ese helper excluye calculates y parents SM de los "esperados").

Las extra quedan **excluidas por defecto** de la BBDD. El usuario decide incluir algunas vía:
- **Popover** al cargar (cuando `n_extra > 0`): lista las extra con % de llenado y badge vacía/con-datos; checkboxes default apagados.
- **Panel revisitable** en Carga para cambiar la decisión después.

La decisión persiste por base en `variables_extra_incluidas` (misma mecánica que `variables_excluidas`). El **include manda sobre el empty-drop**: una extra incluida explícitamente sobrevive aunque esté vacía.

La ausencia en `variables_extra_incluidas` no basta para afirmar que el analista
decidió excluir una variable. Carga conserva además
`variables_extra_revisadas`: una extra queda `pending` hasta que exista una
decisión explícita; al guardar la revisión, las marcadas quedan `include` y las
restantes `exclude`. En proyectos anteriores, una inclusión ya persistida se
considera una decisión válida y las demás variables permanecen pendientes.

En un estudio materializado ambos campos viven en la metadata de cada base y se
reflejan en su configuración analítica. En el contrato legacy de base única se
mantienen en la configuración analítica global. Ambos estados forman parte del
`state.rds` filtrado del `.pulso`; no se agrega una clave superior nueva ni se
persisten caches derivables.

El mapeo de códigos también pertenece al par instrumento-data, no a la sesión
completa. En una base materializada solo se persiste la decisión confirmada:

```r
estudio$bases[[base_nombre]]$choice_code_mapping <- list(
  version = 1L,
  confirmed = TRUE,
  confirmed_at = "...",
  n_questions = 2L,
  maps = list(...)
)
```

El estado pendiente se vuelve a derivar de los archivos de esa base. Las claves
legacy `choice_code_maps_pending` y `choice_code_maps_confirmed` se conservan
para proyectos sin estudio. Una base materializada puede usar ese estado
legacy únicamente cuando existe una sola base primaria y, por tanto, la
correspondencia es inequívoca. Con dos o más bases primarias se ignora el mapa
global y cada base debe confirmarse por separado. Las bases repeat heredan el
procesamiento de su madre y no participan como unidades independientes de
revisión. Reemplazar el XLSForm o la data invalida el mapeo confirmado de esa
base, sin tocar a sus hermanas ni `active_base`.

Contrato:
- `GET /api/analitica/reconciliacion` → `{ extra: [{name, fill_pct, n_fill, kind, incluida}], n_extra, n_incluidas }`.
- `POST /api/analitica/reconciliacion` `{ incluidas: string[] }` → mismo shape; `400 E_RECON_VAR_DESCONOCIDA` si un nombre no es extra real.
- `GET /api/carga/review?base_nombre=<nombre>` → revisión autoritativa de ese
  mismo par instrumento-data: compatibilidad recalculada, estado de mapeo,
  reconciliación con `decision` (`include | exclude | pending`),
  `n_incluidas`, `n_excluidas`, `n_pendientes` y readiness. En single-base
  legacy `base_nombre` puede omitirse y la respuesta devuelve `null`.
- `POST /api/carga/review/reconciliation`
  `{ base_nombre?: string | null, incluidas: string[] }` persiste todas las
  decisiones de la revisión para esa base y devuelve el mismo payload fresco.
  El endpoint no cambia `active_base` ni infiere el scope desde Analítica.
- `POST /api/carga/choice-mapping/confirm`
  `{ base_nombre?: string | null }` confirma el mapeo derivado del mismo par y
  devuelve la revisión fresca. En un estudio con varias bases primarias el
  nombre es obligatorio; una base desconocida se rechaza. En legacy puede
  omitirse.
- `GET /api/carga/review/summary` → resumen derivable de todas las bases
  primarias: `{ bases: [{base_nombre, ready, blockers}], n_bases, n_ready,
  n_blocked, all_ready }`. `all_ready` es falso con cero bases o si una sola
  base está bloqueada. El resumen no se persiste y excluye repeats.

`GET /api/carga/review` incluye el detalle derivado del mapeo cuando está
pendiente para que la decisión siga siendo resoluble después de reabrir el
proyecto. La reapertura normaliza cada base con su propio
`choice_code_mapping`; nunca recorre todas las bases aplicando un mapa global.

Los endpoints históricos de Analítica se conservan por compatibilidad. La
superficie canónica de `Carga > Revisión` usa los endpoints bajo `/api/carga` y
nunca mezcla una base seleccionada en React con otra base activa en sesión.

## Consecuencias

- **Positivo**: control explícito y persistente sobre las variables de versiones viejas; la BBDD del cliente sale limpia por defecto sin perder la opción de conservar una derivada útil (`dim_*`). Aplica igual a los dos caminos de ingesta.
- **Alcance**: la exclusión de extra actúa en el volcado de la BBDD (las extra no son variables del instrumento, así que no aparecen en frecuencias/codebook de todas formas).
- **Costo**: un paso más de decisión al cargar; mitigado con default sensato (todo excluido) y opción de omitir el popover.
- **Readiness**: el estado de una base seleccionada describe solo esa base. El
  avance global usa exclusivamente el resumen de todas las bases primarias y
  muestra cuántas están libres de bloqueos.
- **Relación**: complementa el empty-drop (red de seguridad) y el ADR 0032 (instrumento local, que da el XLSForm canónico contra el cual se reconcilia).
