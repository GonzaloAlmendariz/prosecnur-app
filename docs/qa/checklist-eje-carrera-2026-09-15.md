# Checklist — el eje carrera como capacidad de la app

**Fecha:** 2026-09-15 · **Pedido:** «Todo este mecanismo específico para una
facultad con una serie de carreras lo debería tener también habilitado la app.»

**Decisión de diseño:** [ADR 0085](../adrs/0085-la-carrera-del-estudiante-es-un-eje-declarable.md)
(propuesta). Las dos que tomó Gonzalo el 2026-09-15:

1. El eje es un **ajuste declarado del estudio**, no derivado del marco ni las
   dos dimensiones a la vez.
2. **Las fichas no se reparten por carrera.** El aula es compartida y sigue
   entera; lo que importa es la carrera del estudiante, no la del curso.

**Estado del inventario:** barrido completo hecho. 132 archivos del repo llevan
«facultad» en el nombre (11 en `api/R`, 121 en `frontend/src`); **0** llevan
carrera, programa o escuela.

## Fase 0 — la fontanería, antes que nada

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 1 | Separar el **nombre del eje** de la **columna** en el contrato de metas | `api/R/monitoreo_aulas_metas_diseno.R:19-208` | **pendiente** |
| 2 | Quitar el fallo fuerte estrato≡facultad de la afijación | `api/R/calc_muestra_aulas_afijacion.R:58-59` | **pendiente** |
| 3 | Desacoplar la certificación de «estrato = facultad» | `api/R/calc_muestra_aulas_certificacion.R:58-79` | **pendiente** |
| 4 | Regresión: con el eje en carrera, ninguna meta cae a `NA` en silencio | `api/tests/testthat/` (suite nueva) | **pendiente** |

Sin la fase 0 el resto **degrada en silencio**: la clave publicada sería el
nombre de la carrera y el código la buscaría contra la columna de facultad, que
en un estudio de una facultad es constante. Es el riesgo que el inventario marcó
como el más grave y no se puede dejar para después.

## Fase 1 — el ajuste declarado

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 5 | Campo `eje_operativo` (`facultad` \| `carrera`) en el estudio, default `facultad` | `api/R/calc_muestra_engine.R` + estado del estudio | **pendiente** |
| 6 | Sugerir `carrera` cuando el marco trae una sola facultad, sin imponerlo | Cálculo de muestra · marco | **pendiente** |
| 7 | Control en pantalla, enlazable y reversible | Plan de recolección (o marco) | **pendiente** |
| 8 | El eje lee la carrera del **estudiante**, no la del curso | `mapping$program` a nivel persona | **pendiente** |

## Fase 2 — las superficies que reparten

| # | Indicación | Dónde vive | Estado |
|---|---|---|---|
| 9 | Tarjeta de composición del plan por el eje declarado | `frontend/.../composicionDelPlan.ts`, `ComposicionPorFacultad.tsx` | **pendiente** |
| 10 | Tarjetas del home: contar por el eje, no «1 facultades» | `frontend/.../home/moduleCardModel.ts:455,646` · `api/R/project_overview.R:298` | **pendiente** |
| 11 | Metas, cuotas y brecha de Monitoreo por el eje | `monitoreo_aulas_avance_cuota.R`, `_brecha_facultad.R`, `_ritmo_por_facultad.R` | **pendiente** |
| 12 | Libro operativo agrupado por el eje | `carga_aulas_libro_generar.R:83` + `_avance_facultad.R` | **pendiente** |
| 13 | La ficha declara que el aula es **compartida** y qué carreras la componen | `collection_render_ficha_campo.R` | **pendiente** |
| 14 | El árbol de carpetas del paquete **no cambia** (decisión 2) | `collection_materials_job.R:267` | **no se toca** |

## Lo aprendido que no hay que reinvestigar

- **El dato ya viaja, lo que falta es tratarlo como eje.** `mapping$program`
  reconoce las columnas de carrera (`calc_muestra_aulas.R:258`), la tarjeta de
  categoría «Programa o carrera» existe desde el ADR 0057
  (`calc_muestra_aulas.R:1530`), y el plan guarda `program` por unidad
  (`collection_engine.R:358`, con dato en 2.616 de 2.616 unidades del estudio
  medido).
- **`program` ya está en los defaults de balance y dispersión**
  (`calc_muestra_aulas.R:431-432`), pero **nunca** en `strata_cols`, cuyo default
  es `c("faculty","sex_top_1","size_group")` (línea 430).
- **La guarda del ADR 0082 actúa en tiempo de ejecución**:
  `calc_muestra_aulas_balance_saneo.R:33` descarta por estrato cualquier variable
  con más de 16 niveles. CCSS no cae ahí (6 carreras para 155 aulas), pero un
  estudio de Gestión sí (44 programas para 49 aulas). La guarda se queda.
- **Ya existe un resolver de eje configurable en el repo**, en la familia de
  acreditación: `monitoreo_engine.R:24463,24667,31946` trata
  `carrera`/`programa`/`facultad` como alias de una misma columna de corte. No es
  código reusable tal cual —archivo congelado, otra familia— pero prueba que el
  patrón ya se pensó una vez.
- **`macro_familia` es el gancho natural y hoy está inerte**: se escribe en
  `calc_muestra_engine.R:115-120`, se captura en
  `monitoreo_aulas_universitarias.R:1302` como `study_macro_family`, y **no se
  lee en ningún sitio** para ramificar comportamiento.
- **Los guardas de «una sola facultad» colapsan, no sustituyen.**
  `monitoreo_aulas_report_pdf.R:338` omite la página; `FacultadDecisionBloque.tsx:716`
  no pliega. Con el código tal cual, CCSS cae en todos a la vez.
- **Archivos sin margen de crecimiento** (`agentic/manifest.json:533-554`):
  `calc_muestra_aulas.R` está exactamente en su baseline de 4.723 líneas y
  `CalcMuestraPage.tsx` en 3.928 de 3.930. Todo lo nuevo va en satélites.

## Ítems bloqueados

- **La afijación por carrera no se decide aquí.** Al cliente se le ofrecieron
  metas por nivel curricular; carrera y sexo son referenciales. Cuántas encuestas
  van a cada carrera, y si hay mínimos, es dimensionamiento por estudio y exige
  decisión de Gonzalo antes de tocar la afijación.
- **El riesgo de romper HSVG.** CCSS se crea con la misma `macro_familia`
  (`hsvg_universitario`) que HSVG, así que cualquier default compartido que se
  cambie en `calc_muestra_aulas.R` o `calc_muestra_engine.R:596-599` sin
  diferenciar la forma del estudio arriesga los estudios vigentes. El default de
  `eje_operativo` nace en `facultad` justamente por eso.
