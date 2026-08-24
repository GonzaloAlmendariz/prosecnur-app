# El XLSForm final exportado no es un XLSForm

Tipo: Registro de defecto
Estado: Vigente
Fecha: 2026-08-14
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


**Encontrado**: 14 de agosto de 2026, reparando el bug de `label::es`
(`bug-xlsform-final-label-es-sin-overrides.md`, sección «Lo que este bug deja
pendiente»). Se dejó deliberadamente fuera de aquella unidad.
**Estado**: REPARADO el 14 de agosto de 2026. Cubierto por
`api/tests/testthat/test-analitica-xlsform-final-forma.R`.

## Qué pasa

El `xlsform_final` que exporta `/api/analitica/codebook` sale con el `type`
partido en dos: la pregunta pierde su lista de opciones y aparece una columna
`list_name` aparte, más un `measure_sugerida` al lado.

```
type        name  list_name  measure_sugerida
select_one  p12   lst_p12    nominal            ← lo que salía
select_one lst_p12   p12                        ← lo que un XLSForm necesita
```

Eso no es un XLSForm válido: quien reimporte el instrumento entregado pierde el
vínculo pregunta→lista de opciones. El mismo `separate` parte también
`"begin group"` en `begin` + `group`, así que la estructura de grupos del
formulario se iba con lo mismo.

## Causa raíz

La misma que la del bug hermano de `label::es`: **`reporte_instrumento()` no
devuelve `survey_raw`**. Deja la hoja cruda del XLSForm en `survey` y le añade
columnas derivadas ([reporte_instrumento.R:236](../../api/R/reporte_instrumento.R#L236)):

```r
survey <- tidyr::separate(survey, col = "type", into = c("type", "list_name"),
                          sep = " ", fill = "right")
```

y más abajo `measure_sugerida`. `.analitica_write_final_xlsform()` exporta
`survey_raw %||% survey`, así que con `survey_raw` nulo emite esa hoja derivada
tal cual.

Verificado sobre un XLSForm de dos filas antes de tocar nada: la hoja `survey`
del archivo exportado salía con `type = "select_one"`, una columna `list_name` y
una columna `measure_sugerida`.

## La reparación

Al exportar, `.analitica_xlsform_survey_export()`
([router_analitica.R](../../api/R/router_analitica.R)) vuelve a pegar la lista al
`type` y poda las columnas internas del pipeline. El plegado es condicional: solo
toca filas cuyo `type` quedó sin su segundo token, así que una fila que ya trae
el `type` entero (las que añaden los parches posteriores al separate) no se
duplica la lista, y el export es idempotente.

Las internas se listan en un solo sitio, `.ANALITICA_XLSFORM_COLS_INTERNAS`:
`measure_sugerida` y los auxiliares de `leer_instrumento_xlsform()`
(`q_order`, `type_base`, `list_norm`, `choice_code`, `label_spanish_es`).
`list_name` se poda solo del `survey` — en el `choices` es columna real del
XLSForm.

El camino en que el instrumento **sí** trae `survey_raw` (el lector de la
codificación, que guarda la hoja leída tal cual) no cambia: esa hoja no tiene
`list_name`, su `type` nunca se partió y el plegado no encuentra nada que hacer.

## Regresión

`api/tests/testthat/test-analitica-xlsform-final-forma.R` — escribe un XLSForm de
origen a disco, lo pasa por `reporte_instrumento()` (el productor real del
defecto), exporta y relee el archivo. Comprueba el `type` recompuesto en
select_one, select_multiple y `begin/end group`; que el `survey` no arrastre
`list_name` ni `measure_sugerida` y el `choices` sí conserve su `list_name`; que
el archivo exportado **se reimporte** con el vínculo pregunta→lista intacto y que
reexportarlo dé lo mismo; que el instrumento con `survey_raw` salga sin tocar; la
fila con el `type` ya entero; y un survey vacío o sin `list_name`.

Verificado rojo sin el fix (10 fallas) y verde con él (21 asserts).
