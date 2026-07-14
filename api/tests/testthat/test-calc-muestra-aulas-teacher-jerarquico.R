# Fix del criterio JERÁRQUICO teacher_type de la suite de selección
# (.cm_criterios_eval_teacher). El catálogo y la selección canónica guardan
# claves CHILD (text_key del valor completo, ej. "docente_contratado_contratado"),
# pero el evaluador comparaba solo a nivel GRUPO ("docente_contratado") → nunca
# matcheaba con una selección child-level y excluía TODAS las aulas
# (classroom_included_n=0 aun con selección canónica válida). El fix deriva de
# cada docente del aula AMBAS claves (grupo y child) y matchea contra la
# selección.

# Valores crudos multi-docente reales (el " | " separa docentes de un aula).
.tj_valores <- function() {
  c(
    "DOCENTE CONTRATADO - CONTRATADO",
    "DOCENTE ORDINARIO - PRINCIPAL | DOCENTE ORDINARIO - AUXILIAR",
    "PRE-DOCENTE - JEFE DE PRÁCTICA",
    "DOCENTE EXTRAORDINARIO - VISITANTE | DOCENTE CONTRATADO - CONTRATADO"
  )
}

test_that("selección CHILD-level: aulas con contratado/ordinario PASAN; solo pre/extraordinario NO", {
  crit <- list(
    kind = "hierarchical",
    categories = c("docente_contratado_contratado", "docente_ordinario_principal",
                   "docente_ordinario_asociado", "docente_ordinario_auxiliar"),
    match = "any", mode = "include", exceptions = list()
  )
  res <- .cm_criterios_eval_teacher(.tj_valores(), crit, rep("", 4L))
  # 1: contratado (child) -> pasa. 2: ordinario principal/auxiliar (child) -> pasa.
  # 3: solo pre-docente -> NO pasa. 4: multi-docente con contratado -> pasa.
  expect_identical(res, c(TRUE, TRUE, FALSE, TRUE))
})

test_that("selección GRUPO-level: 'docente_ordinario' matchea por grupo", {
  crit <- list(
    kind = "hierarchical", categories = c("docente_ordinario"),
    match = "any", mode = "include", exceptions = list()
  )
  res <- .cm_criterios_eval_teacher(
    c("DOCENTE ORDINARIO - PRINCIPAL", "DOCENTE CONTRATADO - CONTRATADO"),
    crit, rep("", 2L)
  )
  expect_identical(res, c(TRUE, FALSE))
})

test_that("match='all' child-level: exige que TODAS las categorías seleccionadas estén en el aula", {
  crit <- list(
    kind = "hierarchical",
    categories = c("docente_ordinario_principal", "docente_ordinario_auxiliar"),
    match = "all", mode = "include", exceptions = list()
  )
  res <- .cm_criterios_eval_teacher(
    c("DOCENTE ORDINARIO - PRINCIPAL | DOCENTE ORDINARIO - AUXILIAR",  # ambos -> pasa
      "DOCENTE ORDINARIO - PRINCIPAL"),                                 # falta auxiliar -> no
    crit, rep("", 2L)
  )
  expect_identical(res, c(TRUE, FALSE))
})

test_that("regresión: claves de CONDICIÓN viejas (no son tipos de docente) -> 0 aulas incluidas", {
  # Selección contaminada con las 20 claves de condición de matrícula: ninguna
  # es grupo ni child de un tipo de docente -> 0 incluidos, coherente.
  condicion <- c(
    "regular", "reingresante", "ingresante", "reserva_de_matricula", "egresado",
    "retirado", "traslado_interno", "traslado_externo", "nombrado", "cesante",
    "licencia", "condicionado", "observado", "matricula_extemporanea", "invitado",
    "libre", "oyente", "convalidacion", "reincorporado", "suspendido"
  )
  crit <- list(kind = "hierarchical", categories = condicion,
               match = "any", mode = "include", exceptions = list())
  res <- .cm_criterios_eval_teacher(.tj_valores(), crit, rep("", 4L))
  expect_true(all(!res))
})

test_that("mode='exclude' y aula SIN señal de docente preservan la semántica previa", {
  crit_inc <- list(kind = "hierarchical", categories = c("docente_contratado_contratado"),
                   match = "any", mode = "include", exceptions = list())
  crit_exc <- list(kind = "hierarchical", categories = c("docente_contratado_contratado"),
                   match = "any", mode = "exclude", exceptions = list())
  vals <- c("DOCENTE CONTRATADO - CONTRATADO", "")

  # include: aula sin señal NO pasa (afirmación de pertenencia no confirmable).
  expect_identical(.cm_criterios_eval_teacher(vals, crit_inc, rep("", 2L)), c(TRUE, FALSE))
  # exclude: el aula con contratado se EXCLUYE (!hit); la sin señal pasa.
  expect_identical(.cm_criterios_eval_teacher(vals, crit_exc, rep("", 2L)), c(FALSE, TRUE))
})
