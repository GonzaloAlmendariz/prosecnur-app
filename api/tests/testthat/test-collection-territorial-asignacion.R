# Asignación UMP → encuestador de la campaña territorial (decisión I3, «la de Monitoreo»).
# La lista es el enumerator_roster de Monitoreo; Material guarda sólo id_manzana → código.

.mta_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)
.mta_status <- function(expr) tryCatch({ force(expr); NA_integer_ }, api_error = function(e) as.integer(e$status))

.mta_roster <- function(sid, code_format = "PXXX") {
  s <- session_get(sid)
  s$monitoreo_config$territorial$enumerator_roster <- list(
    code_format = code_format,
    assignments = list(
      list(codigo_pulso = "P844", nombre = "Encuestador Ejemplo Uno", dni = "40000001"),
      list(codigo_pulso = "P930", nombre = "Encuestadora Ejémplo Dos", dni = "40000002")
    )
  )
  .session_env[[sid]] <- s
  invisible(sid)
}

.mta_campana <- function(env = parent.frame()) {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE, .env = env)
  sid <- .hre_session()
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP Lima")
  .mta_roster(sid)
  s <- session_get(sid); s$project_dirty <- FALSE; s$project_dirty_reasons <- NULL; .session_env[[sid]] <- s
  sid
}

T1 <- "150101001001"; T2 <- "150101001002"; R1 <- "150101001009"

test_that("GET: lectura pura, equipo de Monitoreo sin DNI y asignación vacía", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  antes <- session_get(sid)
  r <- collection_territorial_asignacion_get(sid)
  expect_identical(session_get(sid), antes)
  expect_identical(r$fase, "field")
  expect_identical(vapply(r$equipo, `[[`, "", "codigo"), c("P844", "P930"))
  expect_identical(sort(unique(unlist(lapply(r$equipo, names)))), c("codigo", "nombre"))
  expect_false(grepl("40000001", jsonlite::toJSON(r, auto_unbox = TRUE)))
  expect_length(r$asignacion, 0L)
  expect_identical(r$asignacion_revision, 0L)
  expect_false(r$sin_fuente)
  expect_false(r$stale)
  expect_false(r$desactualizada)
})

test_that("PUT: guarda limpio, el reemplazo hereda del titular y marca el proyecto", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_territorial_asignacion_put(sid, asignacion = list(
    list(id_manzana = T1, codigo = " p844 "), list(id_manzana = T2, codigo = "930"), list(id_manzana = R1, codigo = "")
  ), expected_revision = 0L)
  expect_identical(r$asignacion_revision, 1L)
  por_id <- stats::setNames(r$asignacion, vapply(r$asignacion, `[[`, "", "id_manzana"))
  expect_identical(por_id[[T1]]$codigo, "P844")
  expect_identical(por_id[[T2]]$codigo, "P930")
  expect_identical(por_id[[R1]]$codigo, "P844")
  expect_identical(por_id[[R1]]$origen, "heredada")
  expect_identical(por_id[[R1]]$label, "R 1")
  expect_identical(r$descartadas, 0L)
  expect_true(isTRUE(session_get(sid)$project_dirty))
  guardada <- session_get(sid)$material_territorial_asignacion
  expect_identical(guardada$schema, "material_territorial_asignacion/v1")
  expect_length(guardada$asignacion, 2L)  # la herencia no se materializa
  expect_identical(guardada$sample_fingerprint, session_get(sid)$hojas_ruta_runs$field$envio$sample_fingerprint)

  # Un código propio en el reemplazo gana a la herencia.
  r2 <- collection_territorial_asignacion_put(sid, asignacion = list(
    list(id_manzana = T1, codigo = "P844"), list(id_manzana = R1, codigo = "P930")
  ), expected_revision = 1L)
  por_id <- stats::setNames(r2$asignacion, vapply(r2$asignacion, `[[`, "", "id_manzana"))
  expect_identical(por_id[[R1]]$codigo, "P930")
  expect_identical(por_id[[R1]]$origen, "explicita")
  expect_null(por_id[[T2]])
})

test_that("PUT: rechaza UMP fuera de la foto, códigos fuera del equipo y revisión desfasada", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  expect_identical(.mta_code(collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = "999", codigo = "P844")))),
                   "E_COLLECTION_TERRITORIAL_ASIGNACION_INVALIDA")
  expect_identical(.mta_status(collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P111")))), 422L)
  expect_null(session_get(sid)$material_territorial_asignacion)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844")))
  expect_identical(.mta_code(collection_territorial_asignacion_put(sid, asignacion = list(), expected_revision = 0L)),
                   "E_COLLECTION_TERRITORIAL_ASIGNACION_STALE")
  expect_identical(.mta_code(collection_territorial_asignacion_get(sid, "territorial.otra")), "E_COLLECTION_CAMPAIGN_NOT_FOUND")
})

test_that("foto desactualizada: el GET lo dice y el PUT no asigna; sin envío, sin_fuente y 409", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844")))
  s <- session_get(sid)
  s$hojas_ruta_runs$field$workspace_outputs$sample <- .hre_sample(viviendas = 7L)
  .session_env[[sid]] <- s
  expect_true(collection_territorial_asignacion_get(sid)$stale)
  expect_identical(.mta_code(collection_territorial_asignacion_put(sid, asignacion = list())),
                   "E_COLLECTION_TERRITORIAL_DESACTUALIZADA")

  s <- session_get(sid)
  s$hojas_ruta_runs$field <- .hojas_ruta_run_normalize(list(pilot_exclusion_mode = "ignore"), "field")
  .session_env[[sid]] <- s
  g <- collection_territorial_asignacion_get(sid)
  expect_true(g$sin_fuente)
  expect_length(g$asignacion, 0L)
  expect_identical(g$huerfanas, 1L)
  expect_identical(.mta_code(collection_territorial_asignacion_put(sid, asignacion = list())), "E_COLLECTION_TERRITORIAL_SIN_FUENTE")
})

test_that("reenvío con otra muestra: lo guardado queda huérfano, desactualizado y se descarta al guardar", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844"), list(id_manzana = T2, codigo = "P930")))
  s <- session_get(sid)
  s$hojas_ruta_runs$field$workspace_outputs$sample <- .hre_sample(prefijo = "1501770010")
  .session_env[[sid]] <- s
  hojas_ruta_enviar(sid)
  g <- collection_territorial_asignacion_get(sid)
  expect_true(g$desactualizada)
  expect_identical(g$huerfanas, 2L)
  expect_length(g$asignacion, 0L)
  r <- collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = "150177001001", codigo = "P930")))
  expect_identical(r$descartadas, 2L)
  expect_false(r$desactualizada)
  expect_identical(r$huerfanas, 0L)
})

test_that("normalizador: clave ajena, sin schema o de otra campaña se lee vacía; código que salió del equipo se reporta", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid); s$material_territorial_asignacion <- list(asignacion = list(list(id_manzana = T1, codigo = "P844"))); .session_env[[sid]] <- s
  expect_length(collection_territorial_asignacion_get(sid)$asignacion, 0L)
  s$material_territorial_asignacion <- list(schema = "material_territorial_asignacion/v1", campaign_id = "territorial.principal",
                                            fase = "pilot", revision = 3L, asignacion = list(list(id_manzana = T1, codigo = "P844")))
  .session_env[[sid]] <- s
  expect_identical(collection_territorial_asignacion_get(sid)$asignacion_revision, 0L)
  collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "P844")))
  s <- session_get(sid); s$monitoreo_config$territorial$enumerator_roster$assignments[[1]] <- NULL; .session_env[[sid]] <- s
  expect_identical(collection_territorial_asignacion_get(sid)$codigos_fuera_del_equipo, list("P844"))
})

test_that("lista de Monitoreo por DNI: no se expone nadie ni un DNI, y no se asigna", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  .mta_roster(sid, code_format = "DNI")
  s <- session_get(sid)
  s$monitoreo_config$territorial$enumerator_roster$assignments <- list(
    list(codigo_pulso = "40000001", nombre = "Encuestador Ejemplo Uno", dni = "40000001"))
  .session_env[[sid]] <- s
  g <- collection_territorial_asignacion_get(sid)
  expect_identical(g$code_format, "DNI")
  expect_length(g$equipo, 0L)
  expect_false(grepl("40000001", jsonlite::toJSON(g, auto_unbox = TRUE)))
  expect_identical(.mta_code(collection_territorial_asignacion_put(sid, asignacion = list(list(id_manzana = T1, codigo = "40000001")))),
                   "E_COLLECTION_TERRITORIAL_ASIGNACION_INVALIDA")
})

test_that("HTTP: GET y PUT de la asignación", {
  sid <- .mta_campana(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  g <- .hre_call(pr, sid, "GET", "/api/recopiladores/campaigns/territorial/asignacion", query = "id=territorial.principal")
  expect_identical(g$status, 200L)
  expect_length(g$body$equipo, 2L)
  p <- .hre_call(pr, sid, "PUT", "/api/recopiladores/campaigns/territorial/asignacion",
                 body = .hre_json(list(id = "territorial.principal", expected_revision = 0L,
                                       asignacion = list(list(id_manzana = T1, codigo = "P844")))))
  expect_identical(p$status, 200L)
  expect_identical(p$body$asignacion_revision, 1L)
  expect_length(p$body$asignacion, 2L)
  mal <- .hre_call(pr, sid, "PUT", "/api/recopiladores/campaigns/territorial/asignacion",
                   body = .hre_json(list(id = "territorial.principal", asignacion = list(list(id_manzana = T1, codigo = "X")))))
  expect_identical(mal$status, 422L)
})

test_that("la asignación territorial toma el equipo del padrón de Monitoreo: activos con código, nunca un DNI", {
  local_mocked_bindings(monitoreo_equipo_padron = function(s) list(familia = "territorial", code_format = "PXXX", origen = "lista_de_codigos",
    personas = list(list(codigo = "P101", nombre = "Uno", rol = "encuestador", activo = TRUE),
                    list(codigo = "P102", nombre = "Baja", rol = "encuestador", activo = FALSE))))
  eq <- .mta_equipo(list())
  expect_identical(vapply(eq$equipo, `[[`, "", "codigo"), "P101")
  expect_identical(eq$origen, "monitoreo")
  local_mocked_bindings(monitoreo_equipo_padron = function(s) list(familia = "territorial", code_format = "DNI", origen = "lista_de_codigos", personas = list()))
  expect_identical(.mta_equipo(list())$code_format, "DNI")
  expect_length(.mta_equipo(list())$equipo, 0L)
})
