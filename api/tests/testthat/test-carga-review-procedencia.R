# L11 del GOAL de validación extrínseca: el aviso de versiones se adelanta a
# Carga. En Validación la base ya está armada; en Carga todavía se puede parar
# el campo y hacer que actualicen el formulario antes de seguir encuestando.

source("setup-load-all.R")

.rev_base <- function(versiones) {
  data.frame(
    `_uuid` = sprintf("u%02d", seq_along(versiones)),
    `_submission_time` = sprintf("2026-08-%02dT10:00:00", seq_along(versiones)),
    `__version__` = versiones,
    stringsAsFactors = FALSE, check.names = FALSE
  )
}

test_that("no avisa cuando la base viene de una sola versión", {
  # Control: si avisara igual, el aviso no distinguiría una base sana.
  expect_null(.carga_review_procedencia(.rev_base(rep("vA", 8))))
})

test_that("no avisa cuando la base no registra versión", {
  d <- data.frame(`_uuid` = c("u1", "u2"), p1 = c("a", "b"),
                  stringsAsFactors = FALSE, check.names = FALSE)
  expect_null(.carga_review_procedencia(d))
})

test_that("avisa con el conteo y la versión vigente cuando conviven dos", {
  av <- .carga_review_procedencia(.rev_base(c(rep("vNueva", 7), rep("vVieja", 3))))
  expect_false(is.null(av))
  expect_identical(av$n_versiones, 2L)
  expect_identical(av$n_casos_afectados, 3L)
  expect_identical(av$version_vigente, "vNueva")
  expect_true(grepl("3 de 10 casos", av$mensaje, fixed = TRUE))
})

test_that("Carga y Validación no pueden decir cosas distintas de la misma base", {
  # Las dos superficies consumen el mismo detector. Si divergieran, el analista
  # vería un aviso en una pantalla y otro número en la siguiente.
  d <- .rev_base(c(rep("vNueva", 7), rep("vVieja", 3)))
  aviso <- .carga_review_procedencia(d)
  semilla <- reglas_semilla_procedencia(d)[[1]]

  expect_identical(aviso$version_vigente, unlist(semilla$params$valores))
  expect_identical(aviso$n_casos_afectados, semilla$semilla$n_casos_afectados)
  expect_identical(aviso$columna, semilla$semilla$columna)
})

test_that("el aviso no bloquea la carga", {
  # Es una advertencia sobre cómo se recolectó, no un impedimento: la base con
  # dos versiones es perfectamente cargable, solo hay que saberlo.
  av <- .carga_review_procedencia(.rev_base(c(rep("vNueva", 7), rep("vVieja", 3))))
  expect_false("ready" %in% names(av))
  expect_false("bloquea" %in% names(av))
})
