# La fecha de aplicacion sale de la PLATAFORMA, no del parte de campo.
#
# Gonzalo, y no era la primera vez: «lo que contamos son las efectivas en
# plataforma… tienes la informacion de cuando inicia la encuesta, cuando
# finaliza, si es efectiva o no. Lo que se registra en campo es una cosa, pero
# lo que a nosotros nos importa es lo que sale en la plataforma».
#
# Medido sobre el simulacro «campo malo» ANTES del arreglo: `applied_at` vacio
# en los 152 partes y en las 1.424 filas del plan, mientras las 1.595 respuestas
# traian `_submission_time` completo y `collectorID` enlazando 151 aulas. Nueve
# modulos del perfil leen esa fecha —serie de rendimiento, ritmo por facultad,
# pronostico de cierre, corte del estudio— y los cuatro salian en blanco.

test_that("la fecha de un aula es la de su PRIMERA respuesta", {
  # La ultima puede ser un rezagado que contesto por la noche; la primera es
  # cuando se aplico.
  resp <- data.frame(
    `_submission_time` = c("2026-09-08T10:00:00", "2026-09-08T23:40:00", "2026-09-07T09:00:00"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  aulas <- c("A", "A", "B")
  out <- .monitoreo_aulas_fecha_de_plataforma(aulas, resp)
  expect_identical(unname(out[["A"]]), "2026-09-08")
  expect_identical(unname(out[["B"]]), "2026-09-07")
})

test_that("sin columna de tiempo devuelve vacio, no una fecha inventada", {
  resp <- data.frame(algo = c("x", "y"), stringsAsFactors = FALSE)
  expect_length(.monitoreo_aulas_fecha_de_plataforma(c("A", "B"), resp), 0L)
  expect_length(.monitoreo_aulas_fecha_de_plataforma(character(0), NULL), 0L)
})

test_that("descarta lo que no es una fecha ISO en vez de recortarlo", {
  resp <- data.frame(`_submission_time` = c("ayer", "2026-09-09T08:00:00"),
                     check.names = FALSE, stringsAsFactors = FALSE)
  out <- .monitoreo_aulas_fecha_de_plataforma(c("A", "B"), resp)
  expect_false("A" %in% names(out))
  expect_identical(unname(out[["B"]]), "2026-09-09")
})

test_that("cae a `start`/`end` cuando no hay `_submission_time`", {
  resp <- data.frame(end = c("2026-09-10T12:00:00"), stringsAsFactors = FALSE)
  expect_identical(unname(.monitoreo_aulas_fecha_de_plataforma("A", resp)[["A"]]), "2026-09-10")
})

test_that("una respuesta sin aula no puede fabricar una fila", {
  resp <- data.frame(`_submission_time` = c("2026-09-08T10:00:00", "2026-09-08T10:00:00"),
                     check.names = FALSE, stringsAsFactors = FALSE)
  out <- .monitoreo_aulas_fecha_de_plataforma(c("", "A"), resp)
  expect_identical(names(out), "A")
})
