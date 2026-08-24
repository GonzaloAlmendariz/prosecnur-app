# La config de aulas se lee con acceso EXACTO, no con el `$` que adivina.
#
# Desde 6172e406 el payload de estado ya no viaja con `aulas_universitarias$plan`
# (333 KB medidos sobre 196 aulas): el router lo reemplaza por `plan_rows`, un
# entero (router_monitoreo.R, .monitoreo_state_payload). Cuando el cliente
# devuelve esa config tal cual —es lo que hace chooseMode al declarar el modo en
# la superficie mode-choice—, `config$plan` en el normalizador hace PARTIAL
# MATCHING y pesca `plan_rows`: un escalar 0 llega a `.monitoreo_aulas_df()`,
# que lanza stop() crudo «El insumo 'plan' debe ser una tabla o lista de
# filas.» y el POST /api/monitoreo/config responde 500 E_INTERNAL. Elegir un
# modo en /monitoreo revienta la pantalla de entrada del modulo.
#
# La reparacion es leer con `config[["plan"]]` (acceso exacto) en las lecturas
# de config del area; estos tests fijan el contrato: una clave hermana con el
# mismo prefijo NUNCA puede suplantar a la ausente.

test_that("plan_rows presente y plan ausente normaliza al plan default, no revienta", {
  # La forma minima del defecto: la clave que el router SI manda desde 6172e406.
  cfg <- monitoreo_aulas_normalize_config(list(plan_rows = 0L))

  # Sin plan declarado, el default es la lista vacia (monitoreo_aulas_default_config).
  expect_identical(cfg$plan, list())
  expect_identical(cfg$schema, "monitoreo_aulas_universitarias_v1")
})

test_that("el alias agenda sigue mandando aunque plan_rows viaje al lado", {
  # El mismo partial matching tapaba el alias: con `plan_rows` presente,
  # `config$plan` devolvia 0 y la cadena `%||%` nunca llegaba a `agenda`.
  cfg <- monitoreo_aulas_normalize_config(list(
    agenda = list(list(classroom_id = "A-101", label = "Aula 101", eligible_n = 30)),
    plan_rows = 0L
  ))

  expect_length(cfg$plan, 1L)
  expect_identical(cfg$plan[[1]]$classroom_id, "A-101")
})

test_that("con la clave exacta presente, plan_rows no interfiere (control)", {
  # El control del arreglo: el acceso exacto no puede perder el caso sano.
  cfg <- monitoreo_aulas_normalize_config(list(
    plan = list(list(classroom_id = "A-101", eligible_n = 30)),
    plan_rows = 1L
  ))
  expect_length(cfg$plan, 1L)
})

test_that("la config de estado devuelta por el cliente pasa entera por el normalizador", {
  # Round-trip fiel del defecto: el payload que arma .monitoreo_state_payload
  # (plan fuera, plan_rows dentro), serializado como lo hace plumber
  # (serializer_unboxed_json) y parseado como .monitoreo_parse_body
  # (fromJSON simplifyVector = FALSE). Es exactamente lo que chooseMode
  # reenvia al POST /api/monitoreo/config al declarar el modo.
  cfg0 <- monitoreo_normalize_config(
    list(monitoreo_profile = list(family = "aulas_universitarias")),
    data.frame()
  )
  au <- cfg0$aulas_universitarias
  au$plan_rows <- as.integer(length(au$plan %||% list()))
  au$plan <- NULL
  cfg0$aulas_universitarias <- au

  wire <- jsonlite::toJSON(cfg0, auto_unbox = TRUE, na = "null")
  parsed <- jsonlite::fromJSON(wire, simplifyVector = FALSE)
  # La condicion del defecto: plan_rows escalar y NINGUNA clave plan.
  expect_false("plan" %in% names(parsed$aulas_universitarias))
  expect_identical(parsed$aulas_universitarias$plan_rows, 0L)

  cfg <- .monitoreo_request_config(parsed, list(), data.frame())

  expect_identical(cfg$monitoreo_profile$family, "aulas_universitarias")
  expect_identical(cfg$aulas_universitarias[["plan"]], list())
})
