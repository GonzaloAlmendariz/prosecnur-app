# Checklist — `respondent_id` en los entregables y decimales de Frecuencias

Tipo: Checklist de pedido con varias indicaciones
Estado: En curso
Fecha: 2026-08-14
Autoridad: Registro de alcance del pedido; el comportamiento vigente lo fijan `reconciliacion_variables.R`, `xlsx_theme.R` y `test-analitica-identificadores-caso.R`

**Abierto**: 2026-08-14 · **Origen**: revisión de
`ACRD CONTA/Conta 14-08 equivalencias.pulso` — «no encuentro respondent_id, no
sale en Analítica en la BBDD, Libro de códigos (Excel y PDF) y Tabla de
frecuencias de dos decimales» · **Estado**: los siete ítems hechos y verificados
sobre las cuatro bases reales. Queda un hallazgo bloqueado, ajeno a lo pedido.

## De dónde sale esto

El dato existe. `respondent_id` es la **columna 2** de las cuatro bases del
estudio, tanto en los `.sav` crudos de SurveyMonkey como en la data adaptada:

```
CollectorNm · respondent_id · collector_id · date_created · date_modified ·
ip_address · email_address · first_name · last_name · custom_1 · q0001 …
```

No llega a los entregables. Y no por una causa, sino por **tres barreras
independientes** que hay que levantar por separado — arreglar una no destapa las
otras.

### Barrera 1 — la reconciliación solo conoce metadata de Kobo

`.reconciliacion_is_kobo_metadata()` (`reconciliacion_variables.R:36`) reconoce
`^_`, `meta.`, `formhub` y `xform`. Una columna que no está en el XLSForm y no
matchea eso es «variable extra sustantiva» y **se excluye del volcado por
defecto** (`.reconciliacion_export_plan`). SurveyMonkey no entrega su metadata
con esos nombres: `respondent_id` cae, y con él toda la metadata SM.

Ninguna plataforma declara su metadata en el XLSForm. La regla no está mal
escrita: está escrita para un solo proveedor.

### Barrera 2 — el libro de códigos solo mira el instrumento

`.analitica_filter_data()` (`router_analitica.R:1991`) recorta a
`.analitica_allowed_vars()`, que devuelve **solo** las categóricas y numéricas
declaradas del catálogo del XLSForm. `respondent_id` no puede aparecer aunque se
marque como incluida en la reconciliación: son dos filtros en serie.

### Barrera 3 — los dos motores de codebook saltan lo que no tiene códigos

`.write_codebook_from_df()` (`reporte_codebook.R:198`) arma `vars_to_write` solo
con las que traen `attr(,"labels")` o entrada en `ord`, y hace `next` si no hay
códigos. `.codebook_pdf_build_blocks()` (`reporte_codebook_pdf.R:326`) aplica la
misma regla. Un identificador de texto no tiene tabla de códigos que documentar,
así que se cae en los dos formatos por igual.

### Frecuencias: es formato, no dato

La columna de porcentaje usa `numFmt = "0.0%"` (`reporte_frecuencias.R:1071` y
estilos hermanos) — **un** decimal. La celda guarda la proporción exacta (0–1) y
Excel la formatea, así que pasar a `"0.00%"` no gana ni pierde precisión: solo
la muestra.

## Checklist

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | `respondent_id` y `collector_id` se reconocen como identificador de caso de plataforma y sobreviven por defecto en la BBDD | `reconciliacion_variables.R` | **hecho** |
| 2 | El resto de la metadata SM (incluida la PII) sigue excluida por defecto y disponible vía el popover | `reconciliacion_variables.R` | **hecho** |
| 3 | ~~El identificador llega al libro de códigos XLSX~~ | — | **descartado** — ver abajo |
| 4 | ~~Ídem PDF~~ | — | **descartado** — ver abajo |
| 5 | La columna % de Frecuencias se muestra con dos decimales | `xlsx_theme.R` (contexto `freq`) | **hecho** |
| 6 | Tests de las tres barreras y del formato | `test-analitica-identificadores-caso.R` | **hecho** — 34 asserts |
| 7 | Verificado sobre el proyecto real, las cuatro bases | `Conta 14-08 equivalencias.pulso` | **hecho** |

## Lo que quedó hecho y su evidencia

**Ítems 1 y 2.** `.reconciliacion_is_platform_case_id()` reconoce
`respondent_id`, `collector_id` y `response_id`, y la reconciliación los salta
igual que a la metadata de Kobo: se conservan siempre y no entran al cubo. El
alcance se cortó ahí a propósito — medido sobre `administrativos`, las que
siguen siendo extra reconciliables son `CollectorNm`, `date_created`,
`date_modified`, `custom_1`, `first_name`, `last_name`, `email_address`,
`ip_address`, y las cuatro últimas siguen fuera del volcado por defecto.

**Ítems 3 y 4: DESCARTADOS.** Se llegaron a implementar y se revirtieron por
decisión de Gonzalo (2026-08-14):

> al libro de códigos llegan solo los select one y multiple

Y es la regla correcta. El libro de códigos documenta **escalas de códigos**; un
identificador de caso es texto único por respuesta, sin escala que documentar.
Meterlo ahí convierte un documento de códigos en un inventario de columnas — y
abre la puerta a que mañana entren las abiertas, las fechas y las numéricas por
el mismo argumento.

Lo que se revirtió: `analitica_codebook_identificadores.R` (borrado) y su llamada
en `analitica_codebook_export.R`. La BBDD y el libro de códigos **no** documentan
el mismo conjunto de columnas, y no tienen por qué: son entregables distintos con
preguntas distintas.

Lo que quedó de esa vuelta: un test que fija la regla, que hasta ahora vivía solo
implícita en el código. Cubre los **dos** filtros que la garantizan, porque el
segundo es fácil de saltarse sin querer —basta adjuntar un `attr(,"labels")`
sintético para que el motor dibuje el bloque, que es exactamente lo que hacía la
versión descartada—.

**Ítem 5.** El cambio vive en el contexto `freq` de `pulso_xlsx_styles()`, que es
donde `write_one_freq` toma `freq_body_pct`, `freq_total_pct` y `zebra_pct`. Los
estilos de porcentaje se **comparten entre contextos**, así que tocar el
`body_pct` de arriba habría movido también Cruces, el panel y las tablas
multibase. Comprobado: `freq` imprime `0.00%` en sus cuatro estilos y `cruces`
sigue en `0.0%`.

**Ítem 7.** Sobre las cuatro bases del `.pulso` real (15, 52, 172 y 178 casos):
`respondent_id` sobrevive en la BBDD y la PII queda fuera, en las cuatro.

**Gate.** Las 25 suites de `analitica|reconcil|codebook|frecuencia|cruces|xlsx`
con `test_dir` —como lo corre el CI— en verde, sin fallos, antes y después de la
reversión. El test aporta 20 asserts. `sync-agentic-os --audit` marca solo
`calc_muestra_aulas.R`, que ya excedía su línea base en HEAD y no está en este
diff.

**Sin riesgo para la config ya persistida.** En el `.pulso` real, docentes tiene
`variables_extra_incluidas = ["respondent_id"]`. Ese valor queda **inerte**, no
roto: `.reconciliacion_export_plan()` hace `intersect` contra las extra reales, y
el diálogo del front arma la lista que envía desde el GET, así que no puede
reenviar un nombre reclasificado y disparar la validación defensiva del POST.

## Alcance decidido (2026-08-14, Gonzalo)

**Solo los identificadores.** `respondent_id` y `collector_id` pasan a tratarse
como `_uuid`/`_id` de Kobo: son la llave con la que el cliente cruza la BBDD
contra su propio registro.

`CollectorNm`, `date_created`, `date_modified` y `custom_1` **siguen siendo
extra reconciliables** — se incluyen desde el popover si el estudio las
necesita. `first_name`, `last_name`, `email_address` e `ip_address` son PII
directa y **no viajan al cliente sin decisión explícita**: esa decisión no la
toma un default.

## Hallazgo aparte — la reconciliación multibase usa la config de una sola base

No es lo que se pidió arreglar, pero se midió en este proyecto y explica por qué
el escape manual tampoco funcionó.

En el `.pulso` real, la base **docentes** ya tiene
`variables_extra_incluidas = ["respondent_id"]`: Gonzalo encontró el popover y lo
marcó. Las otras tres no. Y aun así docentes tampoco la exporta, porque:

- `.analitica_get_config(sid)` (`router_analitica.R:2333`) devuelve la config de
  la **base activa** — aquí `administrativos`, según el manifest.
- `/bases/xlsx` lee ese `cfg` **una vez, fuera** de la closure, y
  `run_report_multibase()` corre la misma closure para las cuatro bases
  (`helpers_multibase.R:152`).

O sea: la decisión de reconciliación se **persiste** por base y se **aplica** con
la de la base activa a todas. Marcar una variable en docentes no hace nada si
estás parado en administrativos, y marcarla en administrativos la incluye en las
cuatro. Con el ítem 1 hecho el síntoma desaparece para `respondent_id`, pero el
desajuste sigue vivo para cualquier otra variable extra.

**Bloqueado**: exige decidir si el export multibase resuelve la config por base
(coherente con la persistencia) o si la reconciliación pasa a ser una decisión
de estudio y no de base. Es una decisión de contrato, no un fix.

## Lo aprendido que no hay que reinvestigar

- **El `.pulso` no guarda la data.** `state.rds` trae la config y los punteros;
  las bases viven en `files/` como los `.sav` originales y los `.xlsx` de data
  adaptada. Para auditar columnas se leen esos archivos, no el estado.
- **`.analitica_base_internal_cols()` no es el culpable.** Ese strip (tags de
  fuente, `dim_*`, derivadas kobo) conserva explícitamente la metadata legítima
  y nunca tocó `respondent_id`. El filtro que la bota es el de reconciliación,
  que corre después.
- **El codebook XLSX y el PDF comparten criterio pero no código**: cada uno tiene
  su propio armado de bloques. Un cambio en uno no se propaga al otro, y el
  contrato de `analitica_codebook_export.R` promete que ambos documentan
  exactamente las mismas variables.
