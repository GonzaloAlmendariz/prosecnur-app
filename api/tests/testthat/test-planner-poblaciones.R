# Las poblaciones que el Planner proyecta desde las bases del estudio
# (revisión con los proyectos de referencia, 2026-11-01): con el nombre legible
# de la fuente y sin contar un grupo repetido como otra población.

source("setup-load-all.R")

.pp_base <- function(nombre, alias = "", titulo = "", madre = NULL) {
  b <- list(nombre = nombre, source_alias = alias, source_title = titulo)
  if (!is.null(madre)) b$parent_base <- madre
  b
}

test_that("un repeat va con su base madre y la población se llama como la fuente", {
  # Forma de acnur_pdm: la base de Kobo y su grupo repetido.
  s <- list(estudio = list(bases = list(
    pdm_2026_q2 = .pp_base("pdm_2026_q2", titulo = "Post-Distribution Monitoring - Espacios de Protección 2026 Q2"),
    rep_servicios = .pp_base("rep_servicios", madre = "pdm_2026_q2")
  )))
  p <- .planner_poblaciones_proyectadas(s, "telefonico")
  expect_length(p, 1L)
  expect_equal(p[[1]]$id, "principal")
  expect_equal(unlist(p[[1]]$bases), c("pdm_2026_q2", "rep_servicios"))
})

test_that("varias bases principales son varias poblaciones, cada una con su alias y sus repeats", {
  s <- list(estudio = list(bases = list(
    egresados = .pp_base("egresados", alias = "Egresados", titulo = "Acreditación - Encuesta Egresados"),
    empleadores = .pp_base("empleadores", titulo = "Acreditación - Encuesta Empleadores"),
    rep_cursos = .pp_base("rep_cursos", madre = "egresados"),
    base_3 = .pp_base("base_3")
  )))
  p <- .planner_poblaciones_proyectadas(s, "acreditacion")
  expect_equal(vapply(p, `[[`, "", "id"), c("egresados", "empleadores", "base_3"))
  expect_equal(vapply(p, `[[`, "", "etiqueta"), c("Egresados", "Acreditación - Encuesta Empleadores", "base_3"))
  expect_equal(unlist(p[[1]]$bases), c("egresados", "rep_cursos"))
  # El aviso de bases sin perfil cuenta poblaciones posibles, no repeats.
  avisos <- .planner_proyectar_perfiles(s)$avisos
  expect_match(vapply(avisos, `[[`, "", "mensaje"), "tiene 3 bases", all = FALSE)
})
