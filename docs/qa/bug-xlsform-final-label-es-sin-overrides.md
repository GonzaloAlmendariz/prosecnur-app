# El XLSForm final ignora los overrides de etiqueta en `label::es`

Tipo: Registro de defecto
Estado: Vigente
Fecha: 2026-08-14
Autoridad: Evidencia de la ejecución que documenta; no reemplaza contratos ejecutables ni ADR aceptados


**Encontrado**: 14 de agosto de 2026, preparando la entrega ACRD ING.
**Estado**: REPARADO el 14 de agosto de 2026. Causa raíz confirmada y cubierta
por `api/tests/testthat/test-analitica-label-overrides-xlsform.R`.

## Qué pasa

Cuando un proyecto declara overrides de etiqueta en la config de Analítica
—`datos.value_labels` para categorías y `datos.variable_labels` para preguntas—,
el XLSForm final que exporta `/api/analitica/codebook` los aplica a la columna
`label` pero **no a `label::es`**.

Como un XLSForm usa `label::es` para el idioma español, el instrumento entregado
sale **contradiciéndose consigo mismo** y con la base de datos.

```
lst_p12_recod  14  label::es = 'Otra institución'   ← el valor viejo
                   label     = 'Otros'              ← el override
```

La base de datos, la tabla de frecuencias y el libro de códigos sí toman el
override. Solo el XLSForm final queda atrás.

## Cómo reproducirlo

1. Abrir un proyecto con codificación aplicada.
2. `POST /api/analitica/config` con
   `config.datos.value_labels = {"p12_recod": {"14": "Otros"}}`.
3. `POST /api/analitica/codebook` y abrir el `xlsform_final` que devuelve.
4. En la hoja `choices`, la fila de `lst_p12_recod` / `14` tiene `label = "Otros"`
   y `label::es` con el valor anterior.

## Dónde vive

`.analitica_apply_label_overrides()` en
[api/R/router_analitica.R:2546](../../api/R/router_analitica.R#L2546) es el único
cuerpo que aplica los overrides, y tiene dos llamantes (Analítica y Gráficos).

Escribe sobre cuatro sitios: `attr(data[[var]], "label")`, `inst$var_labels`,
`inst$survey` / `inst$choices`, y los `*_raw`. Para los `_raw` hace:

```r
lab_cols <- grep("^label", tolower(names(inst$survey_raw)), value = TRUE)
for (col in lab_cols) inst$survey_raw[[col]][raw_i] <- label
```

`.analitica_write_final_xlsform()`
([router_analitica.R:2999](../../api/R/router_analitica.R#L2999)) exporta
`rp_inst$choices_raw %||% rp_inst$choices`, es decir **prefiere la variante raw**,
que es justo la que no recibió el override.

## Lo comprobado

Leyendo un instrumento adaptado del proyecto:

```
names(survey_raw)  : type | name | label::es | required | relevant | … | section
names(choices_raw) : list_name | name | label::es
grep("^label", tolower(names(choices_raw)), value = TRUE)  →  label::es
```

El `grep` **sí resuelve `label::es`**, así que la ruta de escritura existe y el
nombre de columna no es el problema. Pero el archivo exportado trae `label::es`
sin tocar y además una columna `label` que en ese `choices_raw` no existe — señal
de que el objeto que llega al export no es el que se inspeccionó, y de que el
override entra por `inst$choices` y no por la variante raw.

## Causa raíz (confirmada al repararlo)

La sospecha del párrafo anterior era la buena: **el objeto que llega al export no
tiene `choices_raw`**. `reporte_instrumento()` no devuelve `survey_raw` /
`choices_raw`: deja las hojas crudas del XLSForm en `survey` / `choices` y les
AÑADE una columna `label` derivada del idioma elegido
([reporte_instrumento.R:249](../../api/R/reporte_instrumento.R#L249)). O sea el
instrumento canónico del pipeline tiene `choices` = `list_name | name |
label::es | label`, y `choices_raw` vale `NULL`.

Con eso, las dos mitades del defecto encajan:

1. `.analitica_apply_label_overrides()` escribía la columna canónica `label` y
   nada más en `survey` / `choices`. Las ramas que sí barrían **todas** las
   columnas `label*` eran las de `survey_raw` / `choices_raw` — código muerto en
   este camino, porque esos objetos son `NULL`.
2. `.analitica_write_final_xlsform()` hace `choices_raw %||% choices`: con
   `choices_raw` nulo exporta `choices`, que trae el override en `label` y la
   etiqueta vieja en `label::es`.

Eso explica también la columna `label` «que no existía»: no venía del XLSForm de
origen sino del propio `reporte_instrumento()`.

Reproducido en limpio con un XLSForm de dos filas y `label::es`, antes de tocar
nada:

```
== choices_raw NULL? TRUE   survey_raw NULL? TRUE
== names(inst$choices): list_name | name | label::es | label
      list_name name        label::es       label
1 lst_p12_recod    1      Universidad Universidad
2 lst_p12_recod   14 Otra institución       Otros     ← la contradicción
```

## La reparación

Un helper compartido, `.bases_set_label_cols()`
([helpers_bases.R](../../api/R/helpers_bases.R)), escribe la etiqueta curada en
**todas** las columnas `label*` de la fila (`label`, `label::es`,
`label::English`, …). Una etiqueta curada es una decisión de análisis, no una
traducción, así que manda sobre todas las variantes de esa fila. Lo usan las
cuatro hojas (`survey`, `survey_raw`, `choices`, `choices_raw`), con lo que la
asimetría que causó el bug desaparece y da igual cuál de las dos prefiera el
export.

El **mismo defecto de clase** estaba en el otro mecanismo de override, el
permanente por proyecto (`label_overrides.R`, el que resuelve las etiquetas
bilingües de ACNUR): también escribía solo `choices$label` / `survey$label`.
Verificado que se manifestaba igual y reparado con el mismo helper.

## Alcance

Afecta a cualquier proyecto que use overrides de etiqueta, no solo a este. En la
entrega ACRD ING eran 104 etiquetas en nueve carreras: las cuatro variantes de la
categoría residual («Otro», «Otra institución», «Otra institución nacional»,
«Other (especificar)») y la etiqueta de variable de `p19_other`.

## Cómo se sorteó en la entrega

Post-proceso sobre los nueve instrumentos: copiar `label` sobre `label::es` en
`survey` y `choices`. Antes se comprobó que **las dos columnas solo difieren en
las filas que tocan los overrides** (1 en survey y 11 en choices por carrera), así
que la copia no pisa nada más.

Eso arregló el archivo entregado. La app quedó reparada después, en esta misma
tanda; el post-proceso ya no hace falta para entregas nuevas.

## Regresión

`api/tests/testthat/test-analitica-label-overrides-xlsform.R` — declara un
override de opción y otro de pregunta y comprueba que llegan a `label` y a
`label::es` en el instrumento canónico (sin `*_raw`), en las variantes raw
cuando existen, y en el XLSForm final ya exportado y releído desde disco. Cubre
además que las filas sin override no se tocan, la idempotencia y un choices sin
columnas de etiqueta. Verificado rojo sin el fix (4 fallas) y verde con él.

El gemelo del override permanente vive en `test-label-overrides.R`
(«el override reescribe `label::es` además de `label`»), rojo sin el fix
(2 fallas).

## Lo que este bug deja pendiente

El XLSForm final exportado desde el instrumento canónico arrastra columnas
internas del pipeline y pierde la lista en el `type`: sale
`type = "select_one"` con una columna `list_name` aparte y un `measure_sugerida`
al lado, en vez del `type = "select_one lst_p12_recod"` que un XLSForm necesita.
Es visible en el mismo archivo, es de la misma función de export y **no se tocó
aquí**: no es lo que se reportó y merece su propia unidad.
