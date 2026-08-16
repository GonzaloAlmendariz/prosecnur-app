# Vara V5 del GOAL de UI: una decisión metodológica deliberada tiene dónde
# vivir.
#
# Apagar una regla de validación cambia lo que se revisa. Se guardaba como un
# id suelto en un vector: sin motivo y sin fecha. Quien abriera el proyecto
# después vería un control apagado y no podría distinguir «el constraint del
# formulario estaba mal para esta población» de «alguien lo apagó para que el
# tablero saliera limpio».
#
# Y el informe metodológico —que sustenta la entrega— listaba esas reglas sin
# poder justificarlas. Es el mismo hueco que el ADR 0078 nombró para
# Codificación, en otro módulo.

test_that("el informe nombra cada regla apagada y su motivo", {
  reglas <- list(list(id = "R1", nombre = "Edad en rango"))
  out <- prosecnurapp:::.vmr_reglas_desactivadas(
    ids = c("R1", "R2"),
    motivos = list(R1 = list(motivo = "el constraint del formulario excluía a mayores de 80",
                             decidido_en = "2026-08-15T10:00:00Z")),
    rules = reglas
  )
  expect_length(out, 2L)

  r1 <- Filter(function(x) x$id == "R1", out)[[1]]
  expect_equal(r1$nombre, "Edad en rango")
  expect_true(grepl("mayores de 80", r1$motivo, fixed = TRUE))
  expect_false(r1$sin_motivo)
  expect_true(nzchar(r1$decidido_en))
})

test_that("una regla apagada antes de que el motivo existiera se declara sin motivo", {
  # El control: inventar un motivo sería peor que no tenerlo. Los `.pulso`
  # abiertos antes de este cambio traen el id y nada más.
  out <- prosecnurapp:::.vmr_reglas_desactivadas(ids = "R9", motivos = list(), rules = list())
  expect_length(out, 1L)
  expect_true(out[[1]]$sin_motivo)
  expect_equal(out[[1]]$motivo, "")
  # Sin nombre en el inventario, el id es el mejor identificador disponible.
  expect_equal(out[[1]]$nombre, "R9")
})

test_that("sin reglas apagadas no hay lista", {
  expect_length(prosecnurapp:::.vmr_reglas_desactivadas(character(0), list()), 0L)
  expect_length(prosecnurapp:::.vmr_reglas_desactivadas(NULL, NULL), 0L)
})

test_that("no duplica una regla apagada dos veces", {
  out <- prosecnurapp:::.vmr_reglas_desactivadas(c("R1", "R1"), list(), list())
  expect_length(out, 1L)
})

test_that("el modelo del informe lleva la lista con motivos", {
  # Si el modelo dejara de calcularla, el informe volvería a listar ids pelados
  # sin que ninguna prueba de la función pura se entere.
  src <- readLines("../../R/validacion_methodology_report.R", warn = FALSE)
  expect_true(any(grepl("reglas_desactivadas = .vmr_reglas_desactivadas(disabled_ids, disabled_motivos, rules)",
                        src, fixed = TRUE)))
  expect_true(any(grepl("disabled_motivos <- scope$reglas_desactivadas_motivo", src, fixed = TRUE)))
})

test_that("el endpoint exige motivo al desactivar y no al reactivar", {
  # El motivo es el punto: un toggle sin porqué deja el mismo hueco que había.
  router <- readLines("../../R/router_validacion.R", warn = FALSE)
  bloque <- paste(router, collapse = "\n")
  expect_true(grepl("E_REGLA_MOTIVO_REQUERIDO", bloque, fixed = TRUE))
  # Reactivar limpia el motivo en vez de conservar uno que ya no aplica.
  expect_true(grepl("motivos[[id_regla]] <- NULL", bloque, fixed = TRUE))
})

test_that("una variable dejada fuera también lleva su motivo", {
  # Hermana de la regla apagada: excluir una variable silencia todas sus
  # reglas de una vez, así que el informe necesita el mismo porqué.
  out <- prosecnurapp:::.vmr_variables_excluidas(
    c("telefono", "gps_inicio"),
    list(telefono = list(motivo = "es metadato de contacto, no dato del estudio",
                         decidido_en = "2026-08-15T11:00:00Z"))
  )
  expect_length(out, 2L)
  tel <- Filter(function(x) x$variable == "telefono", out)[[1]]
  expect_true(grepl("metadato", tel$motivo, fixed = TRUE))
  expect_false(tel$sin_motivo)
  gps <- Filter(function(x) x$variable == "gps_inicio", out)[[1]]
  expect_true(gps$sin_motivo)
})

test_that("el endpoint exige motivo sólo para las variables que se agregan", {
  # El control: pedirlo también para las que ya estaban rompería cualquier
  # guardado de un proyecto anterior, y pedirlo al reponer sería absurdo.
  router <- paste(readLines("../../R/router_validacion.R", warn = FALSE), collapse = "\n")
  expect_true(grepl("E_VARIABLE_MOTIVO_REQUERIDO", router, fixed = TRUE))
  expect_true(grepl("nuevas <- setdiff(vars, ya_excluidas)", router, fixed = TRUE))
  expect_true(grepl("for (v in setdiff(ya_excluidas, vars)) motivos[[v]] <- NULL", router, fixed = TRUE))
})
