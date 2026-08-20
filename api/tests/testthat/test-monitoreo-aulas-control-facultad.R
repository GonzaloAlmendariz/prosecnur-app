test_that("la facultad del plan llega a la fila de control por su codigo", {
  plan <- list(
    list(operational_code = "CH 1", faculty = "Ciencias"),
    list(operational_code = "CH 2", faculty = "Letras")
  )
  filas <- list(list(operational_code = "CH 2"), list(operational_code = "CH 1"))
  r <- monitoreo_aulas_control_con_facultad(filas, plan)
  expect_identical(vapply(r$filas, function(f) f$faculty, character(1)), c("Letras", "Ciencias"))
  expect_identical(r$cruzadas, 2L)
  expect_identical(r$sin_cruce, 0L)
})

test_that("un codigo que el plan no tiene NO inventa facultad, y se cuenta", {
  # La coincidencia de nombre ya engaño una vez en este perfil: 14 campos que
  # parecian llegar al payload eran homonimos sin conectar. Por eso el cruce
  # devuelve su propio conteo en vez de declararse hecho.
  r <- monitoreo_aulas_control_con_facultad(
    list(list(operational_code = "CH 9"), list(operational_code = "CH 1")),
    list(list(operational_code = "CH 1", faculty = "Ciencias"))
  )
  expect_identical(vapply(r$filas, function(f) f$faculty, character(1)), c("", "Ciencias"))
  expect_identical(r$cruzadas, 1L)
  expect_identical(r$sin_cruce, 1L)
})

test_that("el codigo cruza sin importar mayusculas ni espacios de sobra", {
  r <- monitoreo_aulas_control_con_facultad(
    list(list(operational_code = "  ch 1 ")),
    list(list(operational_code = "CH 1", faculty = "Ciencias"))
  )
  expect_identical(r$filas[[1]]$faculty, "Ciencias")
})

test_that("una unidad del plan sin facultad no pisa a otra que si la tiene", {
  # El plan de este estudio trae reemplazos que comparten codigo con su titular;
  # si el primero llega con la facultad vacia y se guarda igual, el aula queda
  # sin facultad aunque el plan la sepa.
  r <- monitoreo_aulas_control_con_facultad(
    list(list(operational_code = "CH 1")),
    list(
      list(operational_code = "CH 1", faculty = ""),
      list(operational_code = "CH 1", faculty = "Ciencias")
    )
  )
  expect_identical(r$filas[[1]]$faculty, "Ciencias")
  expect_identical(r$cruzadas, 1L)
})

test_that("el plan usa classroom_id cuando no hay operational_code", {
  r <- monitoreo_aulas_control_con_facultad(
    list(list(classroom_id = "A-7")),
    list(list(classroom_id = "A-7", faculty = "Ingeniería"))
  )
  expect_identical(r$filas[[1]]$faculty, "Ingeniería")
})
