test_that("una base con correo en un estudio anonimo pide revision", {
  b <- data.frame(
    q1 = c(1, 2, 3),
    correo_del_alumno = c("a@pucp.pe", "b@pucp.pe", ""),
    stringsAsFactors = FALSE
  )
  r <- monitoreo_aulas_identificadores(b, anonimo = TRUE)
  expect_identical(r$status, "review")
  expect_match(r$detail, "se declara de respuestas anonimas")
  expect_match(r$detail, "correo_del_alumno")
  expect_identical(r$columnas, list("correo_del_alumno"))
})

test_that("el mismo hallazgo baja a advertencia si el estudio NO se declara anonimo", {
  # Sigue siendo dato personal en una base que viaja; lo que cambia es que ahi
  # es una decision tomada y no una sorpresa.
  b <- data.frame(q1 = 1:2, celular = c("999", "888"), stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_identificadores(b, anonimo = FALSE)$status, "warning")
  expect_identical(monitoreo_aulas_identificadores(b, anonimo = TRUE)$status, "review")
})

test_that("una columna PII declarada y VACIA no acusa al estudio", {
  # El formulario declara la columna y nadie la llena. Acusar por una cabecera
  # vacia gasta la atencion que este control necesita conservar.
  b <- data.frame(q1 = 1:3, dni = c("", "", ""), stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_identificadores(b, anonimo = TRUE)$status, "ok")
})

test_that("el GPS no cuenta como identificador personal en aulas", {
  # El aula tiene su ubicacion en el plan: la coordenada no señala a nadie.
  b <- data.frame(q1 = 1:2, `_geolocation` = c("-12 -77", "-12 -77"),
                  check.names = FALSE, stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_identificadores(b, anonimo = TRUE)$status, "ok")
})

test_that("sin base es SIN COMPROBAR, no correcto", {
  r <- monitoreo_aulas_identificadores(data.frame(), anonimo = TRUE)
  expect_identical(r$status, "sin_datos")
  expect_match(r$detail, "Todavia no hay base")
})

test_that("no reimplanta la deteccion: hereda el clasificador de PII", {
  # «Nombre del curso» NO es una persona, y esa correccion vive en
  # `pulso_anonimizar.R`. Si este control tuviera su propia lista de patrones,
  # esta base saldria acusada.
  b <- data.frame(q1 = 1:2, `Nombre del curso` = c("Calculo", "Fisica"),
                  check.names = FALSE, stringsAsFactors = FALSE)
  expect_identical(monitoreo_aulas_identificadores(b, anonimo = TRUE)$status, "ok")
})
