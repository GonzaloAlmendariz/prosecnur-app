# Tests de teacher_type_top (ADR 0035): etiqueta de MAYOR JERARQUÍA docente por
# curso-horario. Un CH multi-docente cataloga con una sola clave canónica según
# un orden configurable (o el default académico). Es SOLO etiqueta: no toca la
# inclusión "al menos uno" (match:any) ni el teacher_type concatenado.
#
# Lógica en calc_muestra_aulas_teacher_top.R + su call-site en
# .cm_criterios_stats_por_aula / calc_muestra_aulas_aplicar_criterios.

# Bloque de un CH con uno o varios docentes (una fila por docente/estudiante).
# Los tipos de docente vienen en formato jerárquico "GRUPO - detalle" para que
# .cm_aulas_text_key produzca las claves canónicas del catálogo.
.tt_bloque <- function(aula, sids, docentes) {
  n <- length(sids)
  data.frame(
    student_id = sids,
    aula_id = aula,
    curso_id = paste0("C_", aula),
    curso = paste("Curso", aula),
    horario = "H1",
    facultad = "FAC1",
    programa = "P1",
    sexo = rep(c("F", "M"), length.out = n),
    edad = 20,
    condicion = "regular",
    nivel = "1",
    modalidad = "presencial",
    tipo_docente = rep(docentes, length.out = n),
    stringsAsFactors = FALSE
  )
}

# CH multi-docente {ORDINARIO PRINCIPAL, CONTRATADO, JEFE DE PRÁCTICA} + un CH
# de un solo docente. require_stable_teacher activo para que la INCLUSIÓN sea una
# decisión real que podamos verificar estable entre órdenes.
.tt_base <- function() {
  rbind(
    .tt_bloque("A1", c("s1", "s2", "s3"), c(
      "DOCENTE ORDINARIO - PRINCIPAL",
      "DOCENTE CONTRATADO - CONTRATADO",
      "PRE DOCENTE - JEFE DE PRÁCTICA"
    )),
    .tt_bloque("A2", c("s4", "s5"), "DOCENTE CONTRATADO - CONTRATADO")
  )
}

.tt_frame <- function(orden = NULL) {
  calc_muestra_aulas_construir(
    base_madre = .tt_base(),
    config = list(
      filters = list(min_eligible_per_class = 1L, require_stable_teacher = TRUE),
      teacher_type_orden = orden
    )
  )
}

test_that("default: teacher_type_top del CH multi-docente es el ordinario principal", {
  af <- .tt_frame()$aula_frame
  expect_identical(af$classroom_id, c("A1", "A2"))
  # El conjunto concatenado NO cambia: se preservan los 3 tipos únicos.
  expect_identical(
    af$teacher_type[[1]],
    "DOCENTE ORDINARIO - PRINCIPAL | DOCENTE CONTRATADO - CONTRATADO | PRE DOCENTE - JEFE DE PRÁCTICA"
  )
  # Etiqueta de mayor jerarquía (default): ordinario principal manda.
  expect_identical(af$teacher_type_top[[1]], "docente_ordinario_principal")
})

test_that("orden configurable: contratado primero cambia solo la etiqueta, no la inclusión", {
  orden <- list(
    "docente_contratado_contratado",
    "docente_ordinario_principal",
    "pre_docente_jefe_de_practica"
  )
  frame_default <- .tt_frame()
  frame_contratado <- .tt_frame(orden)
  af_default <- frame_default$aula_frame
  af_contratado <- frame_contratado$aula_frame

  # La ETIQUETA cambia con el orden.
  expect_identical(af_default$teacher_type_top[[1]], "docente_ordinario_principal")
  expect_identical(af_contratado$teacher_type_top[[1]], "docente_contratado_contratado")

  # La INCLUSIÓN (al menos uno) y el conteo incluido NO cambian: teacher_type_top
  # es solo etiqueta.
  expect_identical(af_default$included, af_contratado$included)
  expect_true(all(af_default$included))
  incl_default <- frame_default$audit$value[frame_default$audit$metric == "classroom_included_n"]
  incl_contratado <- frame_contratado$audit$value[frame_contratado$audit$metric == "classroom_included_n"]
  expect_identical(incl_default, incl_contratado)

  # El conjunto concatenado tampoco cambia entre órdenes.
  expect_identical(af_default$teacher_type, af_contratado$teacher_type)
})

test_that("CH de un solo docente: teacher_type_top es ese docente", {
  af <- .tt_frame()$aula_frame
  # A2 tiene un único tipo → su propia clave canónica, sea cual sea el orden.
  expect_identical(af$teacher_type_top[[2]], "docente_contratado_contratado")

  orden <- list("pre_docente_jefe_de_practica", "docente_ordinario_principal")
  af2 <- .tt_frame(orden)$aula_frame
  expect_identical(af2$teacher_type_top[[2]], "docente_contratado_contratado")
})

test_that("helpers de ranking: default, prefijo de grupo, desconocidos al fondo y empate por primera vista", {
  def <- .cm_criterios_teacher_orden_default()
  expect_true("docente_ordinario_principal" %in% def)

  # Rank exacto y por prefijo de grupo.
  expect_identical(.cm_criterios_teacher_rank("docente_ordinario_principal", def), 1)
  # "docente_contratado_contratado" cae en el grupo "docente_contratado".
  rank_contratado <- .cm_criterios_teacher_rank("docente_contratado_contratado", def)
  rank_ordinario <- .cm_criterios_teacher_rank("docente_ordinario_principal", def)
  expect_true(rank_ordinario < rank_contratado)
  # Clave desconocida → Inf (al fondo).
  expect_identical(.cm_criterios_teacher_rank("otro_tipo_raro", def), Inf)

  # top de un CH: mayor jerarquía por el orden dado.
  vals <- c("PRE DOCENTE - JEFE DE PRÁCTICA", "DOCENTE ORDINARIO - PRINCIPAL")
  expect_identical(.cm_criterios_teacher_top(vals, def), "docente_ordinario_principal")

  # Todos desconocidos → empate a Inf → primera vista.
  desc <- c("TIPO RARO A", "TIPO RARO B")
  expect_identical(.cm_criterios_teacher_top(desc, def), "tipo_raro_a")

  # Sin señal → "".
  expect_identical(.cm_criterios_teacher_top(character(0), def), "")
  expect_identical(.cm_criterios_teacher_top(c("", ""), def), "")

  # Path del catálogo: el valor llega YA concatenado con "|" (un solo string con
  # el conjunto del CH). Debe separarse antes de canonizar, no colapsar el set
  # entero en una clave falsa (regresión observada sobre HST_UNSA2).
  set_str <- "PRE-DOCENTE - JEFE DE PRÁCTICA | DOCENTE CONTRATADO - CONTRATADO | DOCENTE ORDINARIO - ASOCIADO"
  expect_identical(.cm_criterios_teacher_top(set_str, def), "docente_ordinario_asociado")
  # Con contratado priorizado, el mismo set concatenado resuelve a contratado.
  orden_c <- c("docente_contratado_contratado", "docente_ordinario_asociado")
  expect_identical(.cm_criterios_teacher_top(set_str, orden_c), "docente_contratado_contratado")
})

test_that("normalización del orden: vacío cae al default; labels crudos colapsan a clave; sin duplicados", {
  expect_identical(.cm_criterios_normalize_teacher_orden(NULL), .cm_criterios_teacher_orden_default())
  expect_identical(.cm_criterios_normalize_teacher_orden(list()), .cm_criterios_teacher_orden_default())

  # Labels crudos y claves ya canónicas colapsan a la misma clave.
  norm <- .cm_criterios_normalize_teacher_orden(list(
    "DOCENTE CONTRATADO - CONTRATADO", "docente_ordinario_principal", "docente_ordinario_principal"
  ))
  expect_identical(norm, c("docente_contratado_contratado", "docente_ordinario_principal"))

  # La config normalizada del motor expone el orden efectivo.
  cfg <- calc_muestra_aulas_normalize_config(list(
    teacher_type_orden = list("docente_contratado_contratado")
  ))
  expect_identical(cfg$teacher_type_orden, "docente_contratado_contratado")
  cfg_def <- calc_muestra_aulas_normalize_config(list())
  expect_identical(cfg_def$teacher_type_orden, .cm_criterios_teacher_orden_default())
})
