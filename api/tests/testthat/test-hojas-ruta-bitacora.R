# Bitácora de decisiones de Hojas de ruta (U17).

test_that("una entrada valida la acción y el resumen", {
  e <- hojas_ruta_bitacora_entrada("sorteo", "Sorteo PPS", list(semilla = 2017L), fase = "field", ahora = as.POSIXct("2026-10-29 10:00:00", tz = "UTC"), id = 3L)
  expect_identical(e$id, 3L)
  expect_identical(e$accion, "sorteo")
  expect_match(e$fecha, "^2026-10-29T")
  expect_error(hojas_ruta_bitacora_entrada("inventada", "x"), class = "api_error")
  expect_error(hojas_ruta_bitacora_entrada("nota", "   "), class = "api_error")
})

test_that("registrar agrega con id creciente, marca el proyecto y se lee la más reciente primero", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  # Sólo un proyecto con ruta se marca como modificado (.mark_project_dirty).
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  .session_env[[sid]] <- s
  hojas_ruta_bitacora_registrar(sid, "tamano_calculado", "N = 1.200", fase = "field")
  hojas_ruta_bitacora_registrar(sid, "decision_cobertura", "Se acepta: Chorrillos pierde 12 %", list(distrito = "150108"), fase = "pilot")
  b <- hojas_ruta_bitacora_leer(sid)
  expect_identical(vapply(b, `[[`, integer(1), "id"), c(2L, 1L))
  expect_length(hojas_ruta_bitacora_leer(sid, "pilot"), 1)
  expect_true(isTRUE(session_get(sid)$project_dirty))
})

test_that("la bitácora sobrevive a guardar y abrir el proyecto (viaja en state.rds)", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_bitacora_registrar(sid, "nota", "Supervisión pide evitar el cerro", fase = "field")
  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  expect_true(build_pulso(sid, tmp, project_name = "Bitácora U17")$ok)
  res <- load_pulso(tmp)
  on.exit(session_delete(res$session_id), add = TRUE)
  b <- hojas_ruta_bitacora_leer(res$session_id)
  expect_length(b, 1)
  expect_identical(b[[1]]$resumen, "Supervisión pide evitar el cerro")
})

test_that("la bitácora tiene tope y conserva las más recientes", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$hojas_ruta_bitacora <- lapply(seq_len(HOJAS_RUTA_BITACORA_MAX), function(i) list(id = i, accion = "nota", resumen = "x", fase = "field"))
  .session_env[[sid]] <- s
  hojas_ruta_bitacora_registrar(sid, "nota", "la última")
  b <- session_get(sid)$hojas_ruta_bitacora
  expect_length(b, HOJAS_RUTA_BITACORA_MAX)
  expect_identical(b[[length(b)]]$resumen, "la última")
  expect_identical(b[[1]]$id, 2L)
})

test_that("HTTP: se lee y desde la interfaz sólo se anotan decisiones de cobertura y notas", {
  pr <- mount_hojas_ruta_bitacora(plumber::pr())
  eps <- unlist(pr$endpoints, recursive = FALSE)
  ep <- function(verbo) Find(function(e) identical(e$verbs, verbo), eps)
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  req <- function(body = NULL) {
    r <- list(HTTP_X_PULSO_SESSION = sid)
    if (!is.null(body)) r$bodyRaw <- charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE, null = "null")))
    r
  }
  ok <- ep("POST")$getFunc()(req = req(list(accion = "decision_cobertura", resumen = "Se redefine la población objetivo")), res = plumber:::PlumberResponse$new())
  expect_true(ok$ok)
  no <- ep("POST")$getFunc()(req = req(list(accion = "sorteo", resumen = "x")), res = plumber:::PlumberResponse$new())
  expect_identical(no$error$code %||% no$code %||% "", "E_BAD_REQUEST")
  lista <- ep("GET")$getFunc()(req = req(), res = plumber:::PlumberResponse$new())
  expect_length(lista$entradas, 1)
})
