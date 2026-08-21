# Las facultades excluidas del marco tienen que sobrevivir al guardado.
#
# Medido en el recorrido del usuario nuevo: se excluye una facultad, la pantalla
# confirma «1 facultad excluida del marco», se guarda el proyecto… y el `.pulso`
# vuelve con la lista vacia. El autosave del estudio si envia el cambio (2 s de
# debounce, verificado en el payload de /marco/construir), pero el normalizador
# del workspace no contemplaba esta clave y la descartaba en silencio: la
# septima aparicion documentada de la familia lista-cerrada en este modulo.
#
# Medido tambien el alcance: de las 20 claves que el front envia en
# `aulas_config`, esta era la UNICA que no sobrevivia.

test_that("una facultad excluida sobrevive a la normalizacion del workspace", {
  cfg <- list(excluded_faculties = list("PSICOLOGÍA", "DERECHO"))
  norm <- .cm_normalize_workspace_aulas_config(cfg)

  expect_true("excluded_faculties" %in% names(norm))
  expect_identical(as.character(unlist(norm$excluded_faculties)), c("PSICOLOGÍA", "DERECHO"))
})

test_that("sin exclusiones declaradas queda una lista vacia, no NULL", {
  norm <- .cm_normalize_workspace_aulas_config(list())

  expect_true("excluded_faculties" %in% names(norm))
  expect_length(norm$excluded_faculties, 0L)
})

test_that("los nombres vacios no ensucian la lista", {
  norm <- .cm_normalize_workspace_aulas_config(list(excluded_faculties = list("PSICOLOGÍA", "", "  ")))

  expect_identical(as.character(unlist(norm$excluded_faculties)), "PSICOLOGÍA")
})
