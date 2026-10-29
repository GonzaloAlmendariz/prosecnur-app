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

test_that("una entrada idéntica a la última no se repite, y el router está registrado en la app", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_bitacora_registrar(sid, "tamano_calculado", "N = 1.200", fase = "field")
  hojas_ruta_bitacora_registrar(sid, "tamano_calculado", "N = 1.200", fase = "field")
  hojas_ruta_bitacora_registrar(sid, "tamano_calculado", "N = 1.208", fase = "field")
  expect_length(hojas_ruta_bitacora_leer(sid), 2)
  expect_true(grepl("mount_hojas_ruta_bitacora(pr)", paste(deparse(body(build_plumber_app)), collapse = " "), fixed = TRUE))
  # Un fallo al anotar no tumba al llamador.
  expect_null(.hojas_ruta_bitacora_intentar(sid, "inventada", "x"))
})

test_that("deduplica contra la última de la misma acción y fase, aunque se intercalen otras", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_bitacora_registrar(sid, "poblacion_calculada", "Población: 100", fase = "field")
  hojas_ruta_bitacora_registrar(sid, "tamano_calculado", "N = 1.200", fase = "field")
  hojas_ruta_bitacora_registrar(sid, "poblacion_calculada", "Población: 100", fase = "field")
  expect_length(session_get(sid)$hojas_ruta_bitacora, 2)
  hojas_ruta_bitacora_registrar(sid, "poblacion_calculada", "Población: 100", fase = "pilot")
  expect_length(session_get(sid)$hojas_ruta_bitacora, 3)
})

test_that("una restauración o una piloto bloqueada no anotan ni ensucian el proyecto", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$project_path <- tempfile(fileext = ".pulso")
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  .hojas_ruta_bitacora_intentar(sid, "sorteo", "Sorteo", origen = "restauracion")
  expect_length(session_get(sid)$hojas_ruta_bitacora %||% list(), 0)
  s <- session_get(sid)
  s$hojas_ruta_active_phase <- "pilot"
  s$hojas_ruta_runs <- list(pilot = list(locked = TRUE))
  .session_env[[sid]] <- s
  .hojas_ruta_bitacora_intentar(sid, "tamano_calculado", "N = 1.200")
  expect_length(session_get(sid)$hojas_ruta_bitacora %||% list(), 0)
  expect_false(isTRUE(session_get(sid)$project_dirty))
  s$hojas_ruta_runs$pilot$locked <- FALSE
  .session_env[[sid]] <- s
  .hojas_ruta_bitacora_intentar(sid, "tamano_calculado", "N = 1.200")
  expect_length(session_get(sid)$hojas_ruta_bitacora, 1)
})

test_that("el detalle del marco resume la decisión sin polígonos, y el margen ausente se lee", {
  me <- list(declarado = TRUE, minimo_viviendas = 10L, areas_excluidas = list(list(motivo = "inseguridad", anillos = list(list(c(1, 2), c(3, 4))))))
  d <- hojas_ruta_bitacora_detalle_marco(me)
  expect_identical(d$areas_excluidas, 1L)
  expect_identical(d$motivos, list("inseguridad"))
  expect_false(any(grepl("anillos", names(unlist(d)))))
  expect_identical(.hojas_ruta_bitacora_margen(NA), "sin estimar")
  expect_identical(.hojas_ruta_bitacora_margen(0.028), "±2.8 %")
  expect_true("campo_desde_piloto" %in% HOJAS_RUTA_BITACORA_ACCIONES)
})

test_that("HTTP: una decisión con el marco entero guarda sólo su resumen", {
  pr <- mount_hojas_ruta_bitacora(plumber::pr())
  post <- Find(function(e) identical(e$verbs, "POST"), unlist(pr$endpoints, recursive = FALSE))
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  body <- list(accion = "decision_cobertura", resumen = "Se acepta", detalle = list(
    decision = "aceptar",
    marco_elegible = list(declarado = TRUE, minimo_viviendas = 5L, areas_excluidas = list(list(motivo = "inaccesible", anillos = list(list(c(1, 2))))))
  ))
  r <- list(HTTP_X_PULSO_SESSION = sid, bodyRaw = charToRaw(enc2utf8(jsonlite::toJSON(body, auto_unbox = TRUE))))
  post$getFunc()(req = r, res = plumber:::PlumberResponse$new())
  d <- session_get(sid)$hojas_ruta_bitacora[[1]]$detalle
  expect_identical(d$marco_elegible$areas_excluidas, 1L)
  expect_false(any(grepl("anillos", names(unlist(d)))))
  expect_identical(d$decision, "aceptar")
})

test_that("el anonimizador retira el texto libre y el gate de PII lo escanea", {
  estado <- list(hojas_ruta_bitacora = list(
    list(id = 1L, accion = "nota", resumen = "Llamar a Rosa al 987654321", detalle = list(quien = "Rosa")),
    list(id = 2L, accion = "decision_cobertura", resumen = "Se acepta: lo dijo jperez@pucp.edu.pe", detalle = list(decision = "aceptar", extra = "x")),
    list(id = 3L, accion = "sorteo", resumen = "Sorteo pps con semilla 2017", detalle = list(seed = 2017L))
  ))
  textos <- hojas_ruta_bitacora_textos(estado)
  expect_identical(nrow(textos), 3L)
  a <- hojas_ruta_bitacora_anonimizar(estado)$hojas_ruta_bitacora
  expect_false(any(grepl("Rosa|987654321|jperez", vapply(a, `[[`, character(1), "resumen"))))
  expect_identical(names(a[[1]]$detalle), character(0))
  expect_identical(a[[2]]$detalle, list(decision = "aceptar"))
  expect_identical(a[[3]]$resumen, "Sorteo pps con semilla 2017")
  expect_identical(hojas_ruta_bitacora_anonimizar(list(x = 1)), list(x = 1))
})
