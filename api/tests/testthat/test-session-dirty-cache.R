# AD3 (checklist calc-muestra patrón aulas 2026-09-24): escribir una caché que
# el save descarta no es una edición del proyecto. El Explorador guardaba
# `calc_muestra_explorador_cache` con session_set y el proyecto quedaba «sin
# guardar» con sólo mirarlo. La exención sale del censo (session_schema.R),
# no de una lista paralela.

.sdc_sesion_limpia <- function() {
  sid <- session_create()
  s <- session_get(sid)
  s$project_path <- file.path(s$dir, "proyecto.pulso")
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  sid
}

test_that("una caché cache_stripped no marca el proyecto como sin guardar", {
  sid <- .sdc_sesion_limpia()
  on.exit(session_delete(sid), add = TRUE)

  session_set(sid, "calc_muestra_explorador_cache", list(col = list(n = 3L)))
  expect_false(isTRUE(session_get(sid)$project_dirty))
  expect_identical(
    session_get(sid)$calc_muestra_explorador_cache,
    list(col = list(n = 3L))
  )

  session_set_many(sid, list(graficos_preview_cache = list(), hojas_ruta_ok = TRUE))
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("una clave persistible sigue marcando dirty, sola o junto a una caché", {
  sid <- .sdc_sesion_limpia()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "calc_muestra_aulas_config", list(n_aulas = 3L))
  expect_true(isTRUE(session_get(sid)$project_dirty))

  sid2 <- .sdc_sesion_limpia()
  on.exit(session_delete(sid2), add = TRUE)
  session_set_many(sid2, list(
    calc_muestra_explorador_cache = list(),
    calc_muestra_aulas_config = list(n_aulas = 3L)
  ))
  expect_true(isTRUE(session_get(sid2)$project_dirty))
})

test_that("las cachés de strip condicional siguen marcando dirty", {
  # En un proyecto legacy single-base `rp_data` y compañía SÍ viajan en el
  # .pulso: eximirlas perdería ediciones al cerrar sin guardar.
  exentas <- .session_schema_claves_sin_dirty()
  condicionales <- c(
    "rp_data", "rp_inst", "rp_data_sources", "rp_inst_sources",
    "data_xlsform_compatibility", "analitica_prep_ok",
    "analitica_multibase_available", "analitica_rp_data", "analitica_rp_inst",
    "analitica_rp_data_sources", "analitica_rp_inst_sources"
  )
  expect_length(intersect(exentas, condicionales), 0L)
  expect_true("calc_muestra_explorador_cache" %in% exentas)

  sid <- .sdc_sesion_limpia()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "rp_data", data.frame(x = 1))
  expect_true(isTRUE(session_get(sid)$project_dirty))
})

test_that("toda clave exenta de dirty la resetea el save", {
  # Si una clave exenta dejara de strippearse, viajaría en el .pulso sin que
  # el proyecto pidiera guardarla.
  strip <- .session_schema_claves_strip()
  reseteadas <- strip$clave[strip$reset]
  expect_length(setdiff(.session_schema_claves_sin_dirty(), reseteadas), 0L)
})
