# ADR 0033 — Reconciliación de variables data↔XLSForm (variables extra multi-versión)

- Estado: Aceptado
- Fecha: 2026-07-11
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

Contrato:
- `GET /api/analitica/reconciliacion` → `{ extra: [{name, fill_pct, n_fill, kind, incluida}], n_extra, n_incluidas }`.
- `POST /api/analitica/reconciliacion` `{ incluidas: string[] }` → mismo shape; `400 E_RECON_VAR_DESCONOCIDA` si un nombre no es extra real.

## Consecuencias

- **Positivo**: control explícito y persistente sobre las variables de versiones viejas; la BBDD del cliente sale limpia por defecto sin perder la opción de conservar una derivada útil (`dim_*`). Aplica igual a los dos caminos de ingesta.
- **Alcance**: la exclusión de extra actúa en el volcado de la BBDD (las extra no son variables del instrumento, así que no aparecen en frecuencias/codebook de todas formas).
- **Costo**: un paso más de decisión al cargar; mitigado con default sensato (todo excluido) y opción de omitir el popover.
- **Relación**: complementa el empty-drop (red de seguridad) y el ADR 0032 (instrumento local, que da el XLSForm canónico contra el cual se reconcilia).
