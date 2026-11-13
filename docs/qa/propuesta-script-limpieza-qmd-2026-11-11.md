# Propuesta: script de limpieza replicable en Quarto (.qmd)

Tipo: Propuesta de diseño (investigación, sin implementar)
Estado: En curso
Fecha: 2026-11-11
Autoridad: Lectura del código en `main` al 2026-11-11; no reemplaza ADR aceptados

**Pedido** (Gonzalo, 2026-11-11, textual): "en algunos estudios como acnur piden
script de limpieza replicable en qmd, no se como integrar eso con la limpeiza y
validaiocn de prosecnur".

**Qué entrega este documento**: lo que la app ya guarda y genera, qué parte del
camino de la base cargada a la base limpia se puede reproducir con lo guardado,
dos diseños para un `.qmd` generado por la app, una recomendación, tus decisiones del 2026-11-12
(sección 6) y un orden de trabajo por partes. No se tocó código.

---

## 0. Resumen

1. **La app ya genera dos scripts R, y ninguno es un script de limpieza.**
   - El **script de replicación** (ADR 0031, Analítica › Base final,
     `api/R/analitica_script_replica.R`) reproduce la base final de Analítica desde
     el crudo de Kobo. No recorre las decisiones: compara crudo y base final columna
     por columna y elige la receta que reproduce cada una (copiar, recodificar,
     reconstruir la marca de opción múltiple). Lo que no logra explicar lo copia
     como "valores finales por identificador de caso". El resultado es idéntico,
     pero el script no dice qué se corrigió ni por qué.
   - El **script del paquete metodológico** (ADR 0037, Validación › Reglas del
     formulario, `api/R/validacion_methodology_report.R:1896`) reconstruye el
     universo y define una función por regla de validación. Encuentra los casos;
     no aplica ninguna decisión.
2. **Las decisiones de limpieza sí están guardadas como datos**, con tipo de
   acción, variable, casos, parámetros y justificación
   (`api/R/limpieza_decision_engine.R:437-521`), y se aplican en un orden fijo
   (`:961-1240`). Eso es lo que falta convertir en código: hoy solo se exportan
   como tabla en el Excel de decisiones (`:1408-1451`).
3. **Recomendación**: un motor nuevo que escriba el `.qmd` a partir de las
   decisiones (diseño A), con un bloque por paso en el orden en que el motor los
   aplica, en R con `dplyr` sin depender del paquete de la app, y que antes de entregarse
   se ejecute contra el crudo y se compare celda por celda con la base limpia que
   la app promovió. Lo que no tenga receta se declara en un bloque propio, nunca
   en silencio.
4. **Hay una decisión previa tuya**: el criterio vigente desde el 2026-08-15 es
   que al cliente no se le entrega el detalle de las exclusiones ni los motivos
   (`docs/qa/reproducibilidad-decisiones-pendiente-2026-08-15.md:18-32`). Un
   script de limpieza "bloque por decisión" choca con ese criterio si muestra qué
   casos se tocaron y por qué. Lo resolviste el 2026-11-12 con una opción al
   generar el script (sección 6).
5. **Dos defectos del estado actual impiden generar el script en un estudio
   terminado** (sección 1.4): aplicar la codificación borra las decisiones de
   limpieza y su linaje, y la base recibida puede no guardarse en el `.pulso`.
   Se arreglan primero; el orden de trabajo los pone como parte 1.
6. **No hay en el repo ningún ejemplo de lo que pide ACNUR.** Se buscó y no hay
   términos de referencia, entrega anterior ni plantilla (detalle en la sección
   3). Según tu respuesta del 2026-11-12, ACNUR pide el `.qmd` y su HTML.

---

## 1. Cómo guarda hoy la app la limpieza y la validación

### 1.1 Validación: reglas y auditoría

| Pieza | Dónde vive | Qué guarda |
|---|---|---|
| Plan automático del formulario | `estudio$bases[[b]]$validacion$plan_result` (se persiste; lo confirma `docs/qa/reproducibilidad-decisiones-pendiente-2026-08-15.md:124-128`) | Una fila por regla con su expresión |
| Reglas desactivadas | `scope$reglas_desactivadas`, leído en `limpieza_decision_engine.R:923` | Identificadores de reglas del plan que no rigen |
| Criterios propios | `scope$reglas_custom`, compilados con `compile_reglas_custom()` en `limpieza_decision_engine.R:931-932` | Regla con tipo, parámetros, severidad y tratamiento previsto |
| Resultado de la auditoría | `scope$evaluacion` (`resumen`, `datos`, `datos_tablas`, `reglas_meta`) | Por regla, una columna de marca por caso (`limpieza_decision_engine.R:557-581`) |
| Expresión R de cada regla | `api/R/validacion_ast_compiler_r.R` (`ast_to_r()`) | Texto R que devuelve TRUE en el caso inconsistente. Usa funciones auxiliares de la app (`.vd_*`), que el paquete metodológico copia dentro del script (`validacion_methodology_report.R:1826-1856`) |

El paquete metodológico distingue cuatro tipos de evidencia por regla:
`exact_r`, `specialized_runtime`, `source_odk` y `not_executed` (ADR 0037). Solo
las `exact_r` tienen una expresión R ejecutable fuera de la app; las demás se
escriben como comentario (`validacion_methodology_report.R:1912-1938`).

### 1.2 Limpieza: decisiones caso por caso

Cada decisión es una lista con estos campos, validados en
`.limpieza_validate_decision()` (`limpieza_decision_engine.R:437-521`):

| Campo | Valores |
|---|---|
| `source_id`, `source_type` | La regla que la originó (`instrument_rule` o `custom_rule`; las propias empiezan con `RC_`) |
| `scope` | `rule`, `case_subset`, `variable`, `cell_subset` |
| `action_type` | `ignore_rule`, `exclude_cases`, `replace_value`, `normalize_value`, `impute_value`, `complete_select_multiple_hierarchy`, `set_value`, `recode_map`, `nullify_fields`, `adjust_select_multiple` |
| `target_case_ids` | Identificadores de caso; puede ir vacío (ver abajo) |
| `target_variable` | Obligatoria en las acciones que escriben sobre una variable |
| `action_params` | Valor nuevo, mapa de recodificación, método de imputación, jerarquía o códigos a agregar y quitar |
| `rationale` | Justificación; obligatoria cuando la decisión está "lista" (`:475-477`) |
| `status` | `draft` o `ready`; solo `ready` se aplica |

Se guardan en `scope$limpieza_draft`. Las que quedaron sin ancla al recargar el
formulario pasan a `scope$limpieza_preservadas` y vuelven solo cuando su regla
reaparece (`:284-323`).

**Orden de aplicación** (`.limpieza_apply_decisions_to_data()`, `:961-1240`):

1. Se identifica cada caso con `_uuid` u otra llave conocida; si no hay, con su
   número de fila (`:351-373`).
2. Primero se excluyen todos los casos de las decisiones `exclude_cases`
   (`:993-1011`).
3. Después se aplican las demás decisiones una por una, en el orden de la lista
   (`:1023-1221`).
4. `ignore_rule` no cambia datos: retira la regla del plan con que se vuelve a
   auditar (`:943-949`).

**Al cerrar** (`limpieza_finalize()`, `:1453-1548`), la app escribe la base
limpia en XLSX con las columnas del origen (`limpieza_cierre_base.R:15-23`), la
**promueve** a base vigente y anota el linaje "recibidas 103, quedan 101"
(`:115-162`), y escribe la revisión HTML y el Excel de decisiones. Desde ahí todo
lo de aguas abajo se invalida y se recalcula sobre la base promovida.

### 1.3 Qué queda en el `.pulso`

El `.pulso` guarda la sesión completa salvo lo que `.pulso_strip_caches()`
retira como derivable (`api/R/project_pulso.R:2588-2597`, lista en `:508-539` y
`:629-646`). El censo de cada clave y si se persiste está en
`api/R/session_schema.R:280-469`.

| Concepto | Campo en `state.rds` | Viaja |
|---|---|---|
| Plan, criterios propios, reglas desactivadas, auditoría | `estudio$bases[[b]]$validacion` (`plan_result`, `reglas_custom`, `reglas_desactivadas`, `evaluacion`) | Sí; solo se retira `explorador_cache` (`project_pulso.R:514-521`) |
| Decisiones de limpieza | `validacion$limpieza_draft` y `limpieza_preservadas` | Sí |
| Resultado del cierre | `validacion$limpieza_preview` (incluye la base final entera en `data_final`) y `limpieza_artifacts` | Sí (`limpieza_decision_engine.R:1535-1536`) |
| Linaje de la base limpia | `estudio$bases[[b]]$limpieza` (archivo de origen, archivo vigente, N antes y después) | Sí, como dato |
| Universo de Carga | `estudio$bases[[b]]$universe_filter` (variable, valores reales y de prueba, correcciones, reglas de exclusión) (`carga_universe_filter.R:5-17`) | Sí |
| Depuración hecha fuera de la app | `estudio$bases[[b]]$origen_externo`: identificadores retirados y variables retiradas; es una declaración, no filtra la data (`carga_origen_externo.R:304-328`) | Sí |
| Variables calculadas y columnas anexadas | `variables_calculadas`, `columnas_anexadas` (con sus valores copiados en la meta, `carga_columnas_anexadas.R:84-97`) | Sí; se recalculan al abrir (`project_pulso.R:839-881`) |
| Codificación de abiertas | `codif_por_base[[b]]` (`grupos_recod`, `respuestas_recod`, familias, marcadas) | Sí; se retiran `inst` y `data` (`project_pulso.R:508-513`) |
| Ponderación | `analitica_config$ponderacion` o la de cada base (`ponderacion_analitica.R:10-17`) | Sí; el peso se calcula al reportar, no se guarda en la base |

**Archivos de datos.** Cada fase escribe su base como archivo y mueve el puntero
`data_file_id`: el universo de Carga (`carga_universe_filter.R:453-461`), la
limpieza (`limpieza_decision_engine.R:153`) y la codificación
(`router_codificacion.R:1991-2011`). En `files/` del `.pulso` entran solo los
archivos que alguien referencia (`.pulso_collect_input_fids()`,
`project_pulso.R:1991-2040`): el `data_file_id` vigente, `original_data_file_id`
y los dos del universo de Carga.

### 1.4 Dos hallazgos que afectan al script

**A. Aplicar la codificación borra las decisiones de limpieza.** La pestaña
Aplicar de Codificación registra la base codificada y la pone como data de la
base con `estudio_replace_base_files()` (`router_codificacion.R:2001-2012`).
Esa función, cuando cambia la data, borra el linaje de la limpieza
(`session_store.R:1218`, `meta$limpieza <- NULL`) y vacía el workspace de
Validación sin conservar nada, porque `conservar_exclusiones` vale `FALSE`
cuando cambió la data (`session_store.R:1236-1237` y `:1133-1149`). La base
codificada sí trae las exclusiones y correcciones aplicadas, pero las decisiones
que las explican desaparecen. Como el orden normal del módulo es Validación y
después Codificación, en un estudio terminado lo habitual es que ya no queden
decisiones. Lo confirma el proyecto de referencia `acnur_acg`, que está
codificado: su `state.rds` tiene el plan, ninguna decisión, ningún linaje y
`limpieza_artifacts` vacío. El mismo efecto deja sin la ficha "recibidas,
excluidas, incluidas" al informe metodológico, que la toma del linaje (GOAL de
reproducibilidad, L1).

**B. La base cruda puede no viajar en el `.pulso`.** El archivo del que salió la
limpieza queda en `limpieza$source_data_file_id`, pero esa clave no está en la
lista de archivos que se guardan (`project_pulso.R:1991-2040` no menciona
`limpieza`). Solo se salva si coincide con `original_data_file_id` o con los
archivos del universo de Carga. Y `original_data_file_id` no se fija al crear la
base; lo fija `estudio_preserve_original_base_files()`
(`session_store.R:1258-1277`) justo antes de codificar, cuando la data vigente
ya es la base limpia: el "original" pasa a ser la base limpia, no la recibida.
Eso es intencional: para Codificación, "original" significa "la base vigente
antes de codificar" (`codificacion_fuente_actual.R:9-13`), y no se cambia. La
base recibida se busca en el linaje. El script de replicación de Analítica toma
su crudo de `original_data_file_id` (`analitica_script_replica.R:663-695`), así
que en un estudio con limpieza promovida y codificado lee la base limpia como
si fuera el crudo; queda anotado como pendiente aparte.

Los dos son requisitos del script de limpieza: sin decisiones no hay qué
escribir, y sin crudo no hay contra qué comprobar.

---

## 2. Qué se puede reproducir solo con lo guardado

"Reproducible" quiere decir aquí: con lo que hay en `state.rds` y en `files/` se
puede escribir código que, sobre la base recibida, dé la misma base limpia.

| Paso | Reproducible con lo guardado | Por qué |
|---|---|---|
| Universo de Carga (pruebas, correcciones, reglas de exclusión) | Sí | Se guarda como configuración y el paquete metodológico ya lo escribe en R (`.vmr_universe_formula()`, `validacion_methodology_report.R:753`) |
| Reglas de validación `exact_r` | Sí | Texto R del compilador más las funciones auxiliares que se copian al script |
| Reglas con runtime especial, expresión ODK o no ejecutadas | No como código | ADR 0037 prohíbe presentarlas como R ejecutado; quedan como texto. No cambian datos: solo encuentran casos |
| Exclusiones con casos explícitos | Sí | Lista de identificadores en `target_case_ids` |
| Decisiones sin casos explícitos ("todos los que marcó la regla") | Sí, si se escribe la lista resuelta al cerrar | El motor toma los casos del último resultado de la auditoría (`limpieza_decision_engine.R:954-959`). La expresión de la regla solo sirve si es `exact_r` y la base no cambió |
| Correcciones, recodificaciones, anulaciones, ajustes de opción múltiple | Sí | Variable, casos y parámetros están en la decisión |
| Imputación por mediana o moda | Sí | El script la calcula igual que el motor, sobre la base en ese punto del orden |
| Casos sin `_uuid` ni otra llave | Frágil | El motor los identifica por número de fila (`:351-373`); el script solo es fiel si el crudo conserva el mismo orden |
| Depuración hecha fuera de la app | Parcial | Se conservan los identificadores retirados (`origen_externo`), no el procedimiento. El script puede repetir la exclusión, no explicarla |
| Reemplazo de respuestas o de la base entera | No | Solo queda el puntero al archivo nuevo; el diff se devuelve a la pantalla y no se guarda (`carga_reemplazar_respuestas.R:134-139`) |
| Reparación automática de columnas al abrir | No | `.pulso_repair_parent_recod_columns()` reescribe el archivo de data y deja solo una firma (`project_pulso.R:1410-1491`) |
| Variables traídas de fuera (columnas anexadas, "ya viene codificada") | Como valores | Se guardan los valores, no cómo se calcularon |
| Codificación de abiertas | Sí, como tabla | La matriz texto a código está guardada; el criterio de codificar es humano, pero su resultado es una tabla reproducible |
| Variables calculadas | Sí | Se guardan como fórmula y se recalculan al abrir (`base_variables_calculadas.R:110-123`) |
| Pesos | Sí | Se guardan como configuración; el algoritmo vive en `ponderacion_engine.R` |
| Decisiones después de aplicar la codificación | No, hoy | Se borran (hallazgo A) |

No se encontró edición manual de celdas ni importación de un Excel de
correcciones: se buscó `celda`, `cell_edit`, `contentEditable` y endpoints de
edición de base en `api/R` y `frontend/src`. Las correcciones puntuales existen
solo como decisiones `set_value` y `replace_value`, o como correcciones del
universo de Carga, y las dos quedan registradas.

Ninguno de los dos proyectos de referencia de ACNUR tiene decisiones de
limpieza (`acnur_acg`: 0, por el hallazgo A; `acnur_pdm`: 0, nunca se cerró la
limpieza). Para probar el script hará falta un fixture sintético con los diez
tipos de acción, y un proyecto real con base limpia promovida, como el
`ACNUR_V3_final.pulso` que se usó en el GOAL de reproducibilidad (103
recibidas, 101 entregadas), que no está en el repo y no debe entrar.

---

## 3. Qué espera ACNUR: lo que hay en el repo

**No hay ningún ejemplo.** Se buscó en `docs/` (incluidos `qa/` y `adrs/`),
`api/inst/`, `api/inst/reference_projects/acnur_pdm`, `acnur_acg`, y los skills
`estudio-real` y `entregables-oficina`, con los términos: script de limpieza,
replicable, reproducible, `.qmd`, `.Rmd`, `.sps`, sintaxis, syntax, do-file,
cleaning log, log de limpieza, bitácora de limpieza, data cleaning script. Lo
único que aparece:

- ADR 0031, que en su contexto dice que "PULSO PUCP, ACNUR, universidades" piden
  un `.R` para replicar la base final desde el crudo de Kobo
  (`docs/adrs/0031-script-replicacion-base-analitica.md:9-15`).
- La fila del plan de Procesamiento que anota este pedido
  (`docs/qa/plan-revamp-procesamiento-2026-11-10.md:544`).
- Los dos proyectos de referencia de ACNUR tienen solo el `.pulso` anonimizado y
  su manifiesto (`reference-project.json`); ninguno trae documentación de
  entrega. `acnur_pdm` declara cobertura de validación pero no de codificación
  ni analítica; `acnur_acg` es el único que recorre todo hasta Analítica.

Por fuera del repo, en el sector humanitario es habitual que un "script de
limpieza" vaya acompañado de un registro de cambios con una fila por celda
corregida (identificador del caso, variable, valor anterior, valor nuevo,
motivo) y otra por caso eliminado. **Eso es una costumbre del sector, no algo
que ACNUR haya pedido a Pulso**; no se encontró ningún documento que lo
confirme. Según tu respuesta del 2026-11-12 (sección 6), el pedido es el
`.qmd` y su HTML; un registro de cambios aparte no se pidió.

---

## 4. Diseños

Los dos diseños comparten la forma del `.qmd`: un documento que se puede abrir
en RStudio y correr bloque por bloque, o renderizar con Quarto a HTML. Cada
bloque de código va precedido de un párrafo que dice qué hace y con qué
criterio. Los bloques siguen el orden real del motor:

| Bloque | Contenido | Sale de |
|---|---|---|
| 0 | Parámetros: ruta del crudo, ruta de salida, ruta opcional de la base entregada | Se escribe fijo |
| 1 | Lectura del crudo exportado de la plataforma, con la llave de caso | `analitica_script_replica.R:376-392` (`leer_crudo`) |
| 2 | Universo: filtro de encuestas de prueba, correcciones y reglas de exclusión de Carga | `.vmr_universe_formula()` y `.vmr_universe_formula_ids()` en `validacion_methodology_report.R:753` y `:717` |
| 3 | Reglas de validación: una función por regla `exact_r` y una tabla de conteos | `validation_methodology_report_r()` en `validacion_methodology_report.R:1896` |
| 4 | Exclusiones de casos | Decisiones `exclude_cases` |
| 5 | Correcciones de valores, una por decisión, en el orden de la lista | Decisiones sobre variables |
| 6 | Pasos sin receta | Ver sección 2 |
| 7 | Comprobación: N, columnas y comparación celda por celda con la base entregada si se indicó su ruta | Nuevo |
| 8 | Escritura de la base limpia | Nuevo |

Lo que cambia entre diseños es **cómo se escribe el bloque 5** y **qué necesita
quien lo ejecuta**.

### Diseño A: código autónomo escrito desde las decisiones

El motor nuevo traduce cada decisión lista a unas pocas líneas de R con `dplyr`
(decidido el 2026-11-12; ejemplo ilustrativo, con identificadores acortados).
En el `.qmd`, la justificación de la decisión va como párrafo antes del bloque
de código cuando así se eligió (ver sección 6):

```r
# Regla de origen: rango de edad (P3_edad entre 18 y 99)
casos <- c("3f2a...", "9be1...")
base <- base |>
  mutate(P3_edad = if_else(`_uuid` %in% casos & P3_edad == 190, 19, P3_edad))
```

| Acción | Código emitido |
|---|---|
| `exclude_cases` | `base <- base \|> filter(!.data[[llave]] %in% casos)` |
| `replace_value`, `normalize_value` | Asignación con filtro por casos y, si hay, por valor anterior (`:1166-1193`) |
| `set_value` | Asignación del valor fijo en los casos (`:1117-1138`) |
| `recode_map` | `recodificar(x, desde, hacia)` sobre los casos (`:1140-1164`) |
| `nullify_fields` | Asignación de `NA` en una o varias variables (`:1082-1110`) |
| `impute_value` | Mediana, moda o valor fijo **calculado en el script** sobre la base en ese punto, igual que el motor (`:1196-1220`) |
| `complete_select_multiple_hierarchy`, `adjust_select_multiple` | Una función auxiliar emitida una vez que reescribe la madre y sus marcas 0/1 a la vez (invariante de `limpieza_transform_engine.R`) |
| `ignore_rule` | Solo comentario: la regla no se cuenta en el bloque 7 |

**Casos de una decisión**: si la decisión trae `target_case_ids`, se escriben
esos. Si va vacía, el motor toma "todos los casos que marcó la regla" del último
resultado de la auditoría (`.limpieza_target_case_ids()`, `:954-959`). Para el
script hay dos opciones: escribir la expresión de la regla (solo si es
`exact_r`) o escribir la lista de casos tal como quedó resuelta al cerrar. La
lista es la única que siempre reproduce lo mismo; la expresión documenta mejor
el criterio. Propuesta: lista de casos siempre, y la expresión de la regla como
comentario cuando exista.

- **Qué necesita quien lo ejecuta**: R con `dplyr`, y `readxl` si el crudo es
  `.xlsx`. Quarto solo si quiere volver a renderizar el HTML; el `.qmd` se puede
  correr bloque por bloque sin Quarto, y el HTML ya va renderizado en la entrega.
- **Cómo se comprueba al generarlo**: el motor extrae el código del `.qmd`
  (`knitr::purl()`), lo ejecuta en un entorno limpio contra la base recibida (el
  archivo anterior a la primera fase: el de origen del universo de Carga o, si no
  hubo, el de origen de la limpieza; hoy el script de replicación lo busca en
  `original_data_file_id`, `analitica_script_replica.R:663-695`, que no siempre
  es la base recibida, ver hallazgo B) y
  compara el resultado con la base limpia promovida, columna por columna y con
  tolerancia cero, con la misma función que ya usa el script de replicación
  (`.script_replica_equal()`, `:47-55`). Si una columna no coincide, pasa al
  bloque de pasos sin receta, el `.qmd` lo declara y la app muestra un aviso
  que nombra la columna (P5, decidido).
- **Qué pasa con lo no reproducible**: va al bloque 6, como tabla de valores por
  identificador de caso (la misma técnica "verbatim" del script de replicación,
  `:338-339`), con un párrafo que dice cuántas celdas son y de qué fase vienen.

**A favor**: se lee como una metodología; quien revisa ve cada paso y su
criterio; no depende de la app ni de su versión; reutiliza dos generadores que
ya funcionan.
**En contra**: hay que mantener dos implementaciones de cada acción (el motor y
su traducción a texto). Se controla con la comprobación al generar y con un test
por tipo de acción que compare ambas salidas: una acción nueva sin traducción
pone el test en rojo.

### Diseño B: el `.qmd` llama al paquete de la app

El `.qmd` instala o carga `prosecnurapp` en una versión fija y le pasa las
decisiones exportadas en un JSON que acompaña al script:

```r
decisiones <- jsonlite::read_json("decisiones_limpieza.json")
base <- prosecnurapp::limpieza_aplicar(crudo, decisiones)
```

- **Qué necesita quien lo ejecuta**: instalar `prosecnurapp` desde el repo
  público en la versión exacta del estudio, con todas sus dependencias (Plumber,
  `sf`, `officer`, `flextable`, entre otras de `api/DESCRIPTION:19-69`). Las
  funciones que hoy aplican las decisiones son internas (empiezan con punto), así
  que habría que exportar una función pública y mantenerla estable (ADR 0070).
- **Cómo se comprueba**: es el mismo código que usa la app, así que la igualdad
  está garantizada mientras la versión sea la misma; basta un test que corra el
  `.qmd` contra un proyecto de referencia.
- **Qué pasa con lo no reproducible**: igual que en A, como tabla de valores.

**A favor**: una sola implementación; el `.qmd` es corto.
**En contra**: el cliente no ve la lógica de limpieza, solo una llamada a una
función; la instalación es pesada y frágil fuera de macOS; ata el entregable a
una versión de la app; y el JSON con las decisiones expone todo el detalle
interno (motivos, criterios), lo que contradice el criterio del 2026-08-15 salvo
que se filtre.

### Recomendación

**Diseño A**, por tres razones: es lo que un revisor de ACNUR puede leer y
auditar sin instalar nada nuestro; ya hay dos generadores en el repo que
resuelven las partes difíciles (lectura del crudo, universo, funciones de las
reglas, comprobación por construcción); y deja en nuestras manos qué nivel de
detalle sale, que se resolvió con una opción al generar (P2, sección 6).

El script de replicación de Analítica (ADR 0031) se mantiene como está: su
pregunta es "¿llego a la misma base final?", no "¿qué se limpió?". El `.qmd`
cubre de la base recibida a la base limpia, y no más (P3, decidido).

---

## 5. Dónde viviría en la app

- **Sección y pestaña**: Validación › Cierre (pestaña `cierre`, que hoy es
  `limpieza` y el ADR 0142 renombra; `docs/adrs/0142-mapa-de-pestanas-de-procesamiento.md:28`).
  El plan de Procesamiento ya pone en Cierre "los archivos del cierre y el
  paquete metodológico" (`docs/qa/plan-revamp-procesamiento-2026-11-10.md:165`).
  El script va junto a la base limpia, la revisión HTML y el Excel de decisiones,
  que son los tres archivos que hoy deja el cierre
  (`limpieza_decision_engine.R:1528-1532`). Hoy la pestaña está declarada en
  `frontend/src/lib/navegacion/catalogos/procesamiento.ts:126`.
- **Cuándo se genera**: a pedido, como job, después de cerrar la base. No en
  cada cierre: la comprobación ejecuta el script contra el crudo y cuesta lo que
  cuesta leer la base dos veces.
- **Motor nuevo**: `api/R/limpieza_script_qmd.R`, con la traducción de
  decisiones a bloques, el armado del `.qmd` y la comprobación. Reutiliza por
  nombre `leer_crudo` y `.script_replica_equal()` de `analitica_script_replica.R`
  y `.vmr_universe_formula()` y la sección de reglas de
  `validacion_methodology_report.R`; no los copia.
- **Endpoint nuevo**: `POST /api/validacion/v2/limpieza/script-qmd`, que lanza el
  job, en un router propio (`api/R/router_limpieza_script.R`, montado en
  `plumber_app.R`). Va aparte porque `router_validacion.R` tiene cambios sin
  commitear de otra sesión.
- **Registro del entregable**: kind nuevo en
  `api/R/entregables_catalogo.R:102-109`, por ejemplo
  `validacion_limpieza_script|Script de limpieza|pr|1|1`, registrado con
  `entregable_registrar_job()` (`entregables_registro.R:269`) como hace el paquete
  metodológico (`validacion_metodologia_entrega.R:13-25`). Con multibase, un
  `.qmd` por base dentro de un ZIP, como `run_report_multibase()`
  (`api/R/helpers_multibase.R:167`).
- **Frontend**: una función en `frontend/src/api/validacion.ts` y la entrada en
  el kit de entregables de Cierre. Espera al rediseño de Validación (fase P6 del
  plan de Procesamiento),
  que está bloqueado por los archivos sin commitear de otra sesión.
- **Render a HTML**: parte de la entrega (P1, decidido: `.qmd` y su HTML). La
  app ya renderiza Quarto en otros motores (`reporte_muestra_territorial.R:95-112`,
  `reporte_manuales.R:87`), pero `quarto` está en `Suggests`
  (`api/DESCRIPTION:76-78`) y el instalador no garantiza el binario. Propuesta:
  el entregable es un ZIP con el `.qmd` y el HTML; si la máquina no tiene Quarto,
  se entrega solo el `.qmd` y el aviso lo dice con la causa. Renderizar ejecuta
  el script, así que el HTML también sirve como segunda comprobación.
- **Justificaciones en la pantalla de decisión**: como la justificación de cada
  decisión puede terminar en el script que lee el cliente, el panel donde se
  escribe lo avisa en una línea, por ejemplo "La justificación encabeza este
  cambio en el script de limpieza.", y ofrece en cada decisión la opción de
  incluirla en el script o solo aplicar el cambio.
- **ADR**: sí, uno nuevo (sería el 0145). Fija cuatro cosas que hoy no tienen
  dueño: que las decisiones de limpieza son también una receta que se exporta
  como código; el contrato de igualdad con la base promovida; el nivel de
  detalle que sale al cliente, que modifica o confirma el criterio del
  2026-08-15 y la regla de sanitización del ADR 0031; y dos cambios al contrato
  del `.pulso` (las decisiones sobreviven a la codificación y la base recibida
  se guarda), que tocan `session_store.R` y `project_pulso.R`.

---

## 6. Decisiones de Gonzalo (2026-11-12)

Las siete preguntas se respondieron en la sesión del 2026-11-12. Donde la
respuesta deja algo por precisar, se anota como lectura mía.

| | Pregunta | Respuesta |
|---|---|---|
| P1 | ¿Qué pidió ACNUR? | El `.qmd` y su HTML renderizado. No hay términos de referencia en el repo; la respuesta viene de Gonzalo |
| P2 | ¿Cuánto detalle sale al cliente? | Una opción al generar el script: encendida, cada bloque muestra su regla, sus casos y su justificación. Además, en todos los estudios cada decisión puede llevar su justificación como párrafo del script o solo aplicarse |
| P2, precisión | ¿La justificación del script es un texto aparte? | No: es el mismo texto de la justificación de la decisión. La pantalla donde se escribe tiene que avisar que ese texto introduce el cambio en el script, con una frase profesional y sobria |
| P3 | ¿Hasta qué base llega? | Hasta la base limpia |
| P4 | ¿Estilo de R? | `dplyr` |
| P5 | ¿Qué hace la app si la comprobación encuentra una diferencia? | Entrega el script con esa columna en el bloque de pasos sin receta y avisa |
| P6 | ¿Idioma? | Español |
| P7 | ¿Qué pasa con las decisiones al aplicar la codificación? | Se conservan cuando la base codificada sale de la base limpia vigente |

**Lo que cambia en la regla del 2026-08-15.** Esa regla decía que al cliente no
se le entregan casos ni motivos. Con P2 deja de ser la regla general y pasa a
ser el comportamiento con la opción apagada. El ADR nuevo lo tiene que decir
expresamente y citar `docs/qa/reproducibilidad-decisiones-pendiente-2026-08-15.md`
y la regla de sanitización del ADR 0031, que siguen rigiendo para el script de
replicación de Analítica.

**Por precisar (lectura mía, a confirmar al escribir el ADR):**

- Con la opción del estudio apagada, ¿se omiten también los párrafos de las
  decisiones marcadas "incluir en el script"? Leo que sí: la opción del estudio
  manda, y la marca por decisión solo elige dentro de lo que la opción deja
  salir.
- Hoy la justificación es obligatoria para marcar una decisión como lista
  (`limpieza_decision_engine.R:475-477`). Leo que sigue siéndolo, y que "solo
  aplicarlos" significa que no se publica en el script, no que se pueda dejar
  vacía.
- Frase del aviso propuesta: "La justificación encabeza este cambio en el
  script de limpieza." Se valida con la pantalla del rediseño de Validación.

## 7. Orden de trabajo

Cada parte se commitea sola y deja la app funcionando.

| Parte | Qué | Pruebas | Depende de |
|---|---|---|---|
| 0 | ADR 0145 en Propuesto con las decisiones de la sección 6 y las tres precisiones pendientes | No aplica | Nada |
| 1a | Las decisiones de limpieza y su linaje sobreviven a la codificación: cuando la data nueva desciende de la vigente (Aplicar de Codificación), `estudio_replace_base_files()` no borra `meta$limpieza` ni vacía las decisiones | Test en `test-limpieza-*.R`: cerrar la limpieza, aplicar la codificación y comprobar que siguen el linaje y las decisiones; el mismo test sin el arreglo tiene que fallar | 0 |
| 1b | La base recibida viaja en el `.pulso`: `limpieza$source_data_file_id` entra en `.pulso_collect_input_fids()` | Test de ida y vuelta: crear base, cerrar la limpieza, guardar, reabrir y revertir la promoción | 0 |
| 2 | Motor: traducción de cada `action_type` a código `dplyr` y armado del `.qmd` sin comprobación (`api/R/limpieza_script_qmd.R`) | `test-limpieza-script-qmd.R`: por cada uno de los diez tipos de acción, la base que da el código emitido es igual a la de `.limpieza_apply_decisions_to_data()` sobre un fixture sintético; un tipo de acción sin traducción pone el test en rojo | 1 |
| 3 | Bloques de universo y de reglas, reutilizando las funciones del paquete metodológico | Mismo archivo: universo con filtro de pruebas, con depuración y con ambos encadenados (los tres escenarios de `goal-reproducibilidad-entrega-2026-08-15.md`, V3) | 2 |
| 4 | Comprobación al generar, bloque de pasos sin receta y aviso cuando una columna cae ahí | Caso verde y caso rojo: se borra una decisión del texto emitido y la comprobación tiene que detectarlo y nombrar la columna | 2 |
| 4b | Detalle hacia el cliente: opción del estudio al generar y marca por decisión "incluir la justificación en el script" (campo nuevo en la decisión, con valor por defecto para las decisiones ya guardadas) | Con la opción apagada, ni casos ni justificaciones en el `.qmd` (grep sobre el texto emitido); encendida, solo las justificaciones marcadas | 4 |
| 4c | Render a HTML con Quarto dentro del job y ZIP con `.qmd` y HTML; sin Quarto, solo `.qmd` y aviso con la causa | Test con y sin el binario de Quarto disponible | 4 |
| 5 | Job, router propio, kind en el catálogo y registro del entregable | `test-entregables-catalogo.R`, test del endpoint, contratos transversales con `make gate-area AREA=limpieza` | 4 |
| 6 | Verificación sobre proyectos de referencia: `acnur_acg` (pipeline completo) y `acnur_pdm` (repeats y filtro de universo); render del `.qmd` con Quarto y lectura del HTML | `make reference-project-run REFERENCE_PROJECT=acnur_acg`; comparación de N e identificadores; lectura del HTML renderizado entero; grep de identificadores y justificaciones con la opción apagada y encendida | 5 |
| 7 | Botón en Validación › Cierre, opción de detalle al generar, y en el panel de decisión la marca por decisión y el aviso de que la justificación encabeza el cambio en el script | `make gate-front AREA=validacion`, captura a 1440x1000 y 1024x600 | 5 y el rediseño de Validación (fase P6 del plan de Procesamiento) |

Las partes 0 a 6 no tocan `router_validacion.R` ni `frontend/src/features/validacion/`,
así que pueden avanzar mientras la otra sesión cierra sus cambios de Validación.
Las partes 1a y 1b arreglan defectos que existen aunque el script no se haga
(el informe metodológico también pierde su ficha de conteos al codificar), y
convienen aunque se postergue el `.qmd`.
