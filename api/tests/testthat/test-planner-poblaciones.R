# El Planner no siembra poblaciones desde las bases del estudio (ADR 0123 §7:
# va primero y no lee Procesamiento). Las poblaciones las declara el analista;
# la deducción del modo no las necesita.

source("setup-load-all.R")

test_that("con bases y sin perfil declarado, el Planner no propone poblaciones ni avisa", {
  # Forma de acrconta_mazo: varias bases y ningún perfil.
  s <- list(estudio = list(bases = list(
    egresados = list(nombre = "egresados", source_alias = "Egresados"),
    empleadores = list(nombre = "empleadores"),
    rep_cursos = list(nombre = "rep_cursos", parent_base = "egresados")
  )))
  expect_length(.planner_deducir_perfiles(s), 0L)
})

test_that("la deducción del modo no trae poblaciones de Monitoreo ni de las bases", {
  s <- list(
    monitoreo_config = list(monitoreo_profile = list(family = "acreditacion", route_selected = TRUE,
                                                     units = list(list(id = "egr", label = "Egresados"),
                                                                  list(id = "doc", label = "Docentes")))),
    estudio = list(bases = list(b1 = list(nombre = "b1"), b2 = list(nombre = "b2")))
  )
  perfiles <- .planner_deducir_perfiles(s)
  expect_equal(perfiles[[1]]$tipo, "acreditacion")
  expect_equal(vapply(perfiles[[1]]$poblaciones, `[[`, "", "id"), "principal")
  expect_length(unlist(perfiles[[1]]$poblaciones[[1]]$bases), 0L)
})
