# El caso real: acrconta_mazo tiene tres bases y `egresados` no produjo ni PPT
# ni Word, mientras el escalar `graficos_ppt_ok` decia TRUE por la base activa.

test_that("nombra las bases que no produjeron ningun entregable", {
  statuses <- list(
    docentes    = list(graficos_ppt_ok = TRUE,  graficos_word_ok = FALSE),
    estudiantes = list(graficos_ppt_ok = TRUE,  graficos_word_ok = FALSE),
    egresados   = list(graficos_ppt_ok = FALSE, graficos_word_ok = FALSE)
  )
  expect_equal(
    graficos_bases_sin_mazo(c("docentes", "estudiantes", "egresados"), statuses),
    "egresados"
  )
})

test_that("PPT o Word alcanzan: el criterio es el mismo que usa la UI", {
  # El riel de etapas da Graficos por hecho con `ppt_ok || word_ok`. Si aca se
  # exigieran los dos, una base con Word y sin PPT saldria pendiente y el riel
  # la daria por lista: dos superficies contradiciendose.
  statuses <- list(solo_word = list(graficos_ppt_ok = FALSE, graficos_word_ok = TRUE))
  expect_equal(graficos_bases_sin_mazo("solo_word", statuses), character(0))
})

test_that("una base sin entrada de estado esta pendiente, no conforme", {
  # Es el caso de una base recien agregada: nunca se genero nada para ella.
  expect_equal(graficos_bases_sin_mazo(c("a", "b"), list()), c("a", "b"))
  expect_equal(graficos_bases_sin_mazo("a", list(a = "no es una lista")), "a")
})

test_that("un estado residual de una base borrada no se reporta", {
  # El control: `graficos_status_por_base` sobrevive al borrado de una base.
  # Nombrar una base que ya no existe mandaria a buscar algo inencontrable.
  statuses <- list(vieja = list(graficos_ppt_ok = FALSE, graficos_word_ok = FALSE))
  expect_equal(graficos_bases_sin_mazo("actual", statuses), "actual")
  expect_false("vieja" %in% graficos_bases_sin_mazo("actual", statuses))
})

test_that("sin bases no hay nada pendiente", {
  expect_equal(graficos_bases_sin_mazo(NULL), character(0))
  expect_equal(graficos_bases_sin_mazo(c("", "  ")), character(0))
})
