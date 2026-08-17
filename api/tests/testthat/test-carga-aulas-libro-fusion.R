test_that("la fusion conserva lo que el libro no sabe escribir", {
  # El caso medido: releer el libro dejaba las cuotas sexo x facultad en CERO
  # celdas porque el libro no lleva la composicion muestral. Es el control
  # invertido: sin la fusion, `sex_top_1` sale vacio.
  previo <- list(list(
    operational_code = "CH 1", faculty = "Derecho", stratum = "Derecho",
    sex_top_1 = "F", sex_top_1_n = 22, sex_top_2 = "M", sex_top_2_n = 18,
    eligible_n = 40, sample_status = "en_reserva"
  ))
  nuevo <- list(list(
    operational_code = "CH 1", faculty = "Derecho",
    sample_status = "agendada", contact_medium = "correo",
    sex_top_1 = "", sex_top_1_n = 0, sex_top_2 = "", sex_top_2_n = 0
  ))
  res <- aulas_libro_fusionar_plan(previo, nuevo)
  expect_equal(res$actualizadas, 1L)
  expect_equal(res$plan[[1]]$sex_top_1, "F")
  expect_equal(res$plan[[1]]$sex_top_1_n, 22)
  expect_equal(res$plan[[1]]$eligible_n, 40)
  # Y lo que el libro SI sabe manda.
  expect_equal(res$plan[[1]]$sample_status, "agendada")
  expect_equal(res$plan[[1]]$contact_medium, "correo")
})

test_that("un aula que el libro no menciona se conserva y se cuenta", {
  # El libro es un registro de campo, no la fuente de la muestra: su ausencia
  # significa que alguien borro la fila, no que el aula ya no exista.
  previo <- list(
    list(operational_code = "CH 1", faculty = "Derecho"),
    list(operational_code = "CH 2", faculty = "Letras")
  )
  res <- aulas_libro_fusionar_plan(previo, list(list(operational_code = "CH 1", notes = "ok")))
  expect_length(res$plan, 2)
  expect_equal(res$intactas, 1L)
  expect_equal(res$plan[[2]]$faculty, "Letras")
})

test_that("un aula nueva del libro entra en vez de descartarse", {
  previo <- list(list(operational_code = "CH 1"))
  res <- aulas_libro_fusionar_plan(previo, list(
    list(operational_code = "CH 1"),
    list(operational_code = "CH 99", faculty = "Arte")
  ))
  expect_equal(res$nuevas, 1L)
  expect_length(res$plan, 2)
  expect_equal(res$plan[[2]]$operational_code, "CH 99")
})

test_that("el cero del libro SI pisa: es un dato, no una ausencia", {
  # `respuestas = 0` es lo que el parte dice, y tratarlo como vacio impediria
  # corregir un conteo a la baja desde el libro.
  previo <- list(list(operational_code = "CH 1", effective_surveys = 12))
  res <- aulas_libro_fusionar_plan(previo, list(list(operational_code = "CH 1", effective_surveys = 0)))
  expect_equal(res$plan[[1]]$effective_surveys, 0)
})

test_that("sin plan previo la fusion no inventa nada", {
  nuevo <- list(list(operational_code = "CH 1", faculty = "Derecho"))
  res <- aulas_libro_fusionar_plan(list(), nuevo)
  expect_equal(res$plan, nuevo)
  expect_equal(res$nuevas, 1L)
})

test_that("empareja por classroom_id cuando no hay codigo operativo", {
  previo <- list(list(classroom_id = "A-1", sex_top_1 = "F"))
  res <- aulas_libro_fusionar_plan(previo, list(list(classroom_id = "A-1", sample_status = "agendada")))
  expect_equal(res$actualizadas, 1L)
  expect_equal(res$plan[[1]]$sex_top_1, "F")
  expect_length(res$plan, 1)
})
