# El criterio de «respuesta valida» fallaba de tres formas distintas y ninguna
# se anunciaba. Medido antes de repararlo, sobre 4 respuestas:
#
#   `_status` = submitted_via_web ....... 0 de 4   (Kobo lo manda SIEMPRE)
#   `validation_status` = ..._approved .. 0 de 4   (su propio vocabulario fuera)
#   `estado` = «completa» ............... 0 de 4   (la lista solo tenia ingles)
#   `_validation_status` ................ 4 de 4   (no lo encontraba: fallo abierto)
#
# El primero es el grave: bastaba sincronizar un export completo de Kobo para
# que el avance del estudio entero cayera a CERO en silencio.

plan_minimo <- function() list(list(
  operational_code = "CH 1", classroom_id = "CH 1", label = "Curso",
  faculty = "Derecho", sample_role = "titular",
  eligible_n = 30, expected_valid = 30, operational_status = "agendada"
))

con_columna <- function(nombre, valores) {
  d <- data.frame(collectorID = rep("CH 1", length(valores)), stringsAsFactors = FALSE)
  d[[nombre]] <- valores
  d
}

test_that("`_status` de Kobo no decide si una respuesta vale", {
  # Dice COMO llego el formulario, no si la respuesta sirve. Tomarlo por estado
  # de validacion ponia el avance en cero.
  d <- con_columna("_status", rep("submitted_via_web", 4))
  expect_equal(sum(.monitoreo_aulas_valid_response(d, list())), 4L)
})

test_that("se reconoce `_validation_status` y su vocabulario", {
  d <- con_columna("_validation_status", c(rep("validation_status_approved", 3), "", ""))
  expect_equal(sum(.monitoreo_aulas_valid_response(d, list())), 3L)
})

test_that("un estudio con su columna en espanol cuenta", {
  d <- con_columna("estado", c(rep("completa", 3), "incompleta", "incompleta"))
  expect_equal(sum(.monitoreo_aulas_valid_response(d, list())), 3L)
})

test_that("el criterio sigue diciendo que NO cuando toca", {
  # Control invertido: si ampliar el vocabulario hubiera dejado pasar todo, este
  # aserto seguiria en verde por la razon equivocada.
  d <- con_columna("estado", rep("incompleta", 4))
  expect_equal(sum(.monitoreo_aulas_valid_response(d, list())), 0L)
})

test_that("la lista por defecto sale de la constante, no de una copia", {
  # La lista viajaba por DOS sitios y el normalizador siempre rellena desde el
  # default de la config, asi que ampliar solo el otro no cambiaba nada. Es la
  # cadena de whitelists que ya mordio en Graficos.
  cfg <- monitoreo_aulas_default_config()
  expect_setequal(
    as.character(unlist(cfg$source_mapping$valid_statuses)),
    MONITOREO_AULAS_ESTADOS_VALIDOS
  )
})

test_that("el tablero DICE que criterio aplico", {
  fila <- function(d) {
    dd <- monitoreo_aulas_dashboard(plan_minimo(), d, list(enabled = TRUE))
    Filter(function(r) identical(r$check, "valid_response_criterion"), dd$validation)[[1]]
  }
  # Sin columna cuenta todo, y eso es una decision que conviene tomar a
  # sabiendas: se marca `review`, no `ok`.
  sin <- fila(data.frame(collectorID = rep("CH 1", 5), stringsAsFactors = FALSE))
  expect_equal(sin$status, "review")
  expect_match(sin$detail, "no trae columna de estado")

  con <- fila(con_columna("estado", c(rep("completa", 3), "incompleta", "incompleta")))
  expect_equal(con$status, "ok")
  expect_match(con$detail, "3 de 5")
})

test_that("una columna declarada que la base no trae se avisa, no se ignora", {
  # Un error de tipeo en la config pasaba por criterio deliberado.
  cfg <- list(enabled = TRUE, source_mapping = list(status_var = "no_existe"))
  d <- con_columna("estado", rep("completa", 4))
  crit <- monitoreo_aulas_criterio_validez(d, cfg)
  expect_equal(crit$modo, "declarada_ausente")
  expect_match(monitoreo_aulas_criterio_texto(crit), "no la trae")
})
