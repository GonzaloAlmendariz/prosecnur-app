# El XLSForm final ignora los overrides de etiqueta en `label::es`

Tipo: Defecto documentado sin reparar
Estado: En curso
Fecha: 2026-08-14
Autoridad: Descripción del síntoma y su alcance; la causa raíz no está confirmada y la app sigue con el defecto

**Encontrado**: 14 de agosto de 2026, preparando la entrega ACRD ING.
Se sorteó en el entregable, no en la app.

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

**No está confirmada la causa raíz.** Lo verificado es el síntoma, su alcance y
que el export prefiere `choices_raw`.

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

Eso arregla el archivo entregado. **La app sigue con el defecto.**

## Al arreglarlo

Un test de regresión sobre `.analitica_apply_label_overrides()` que declare un
override y compruebe que llega tanto a `label` como a `label::es` de las variantes
raw. La función tiene dos llamantes —Analítica y Gráficos— y existe justamente
para que una etiqueta curada no valga distinto en cada uno; el test debería cubrir
esa promesa también para el XLSForm final.
