# P6: el plan de campo y la Hoja del día de Material salen de la foto enviada, no de la
# muestra viva de Hojas de ruta.

.mtpl_code <- function(expr) tryCatch({ force(expr); NA_character_ }, api_error = function(e) e$code)

.mtpl_sesion <- function(env = parent.frame()) {
  local_mocked_bindings(.mcamp_territorial_habilitada = function() TRUE, .env = env)
  sid <- .hre_session()
  hojas_ruta_enviar(sid)
  collection_campaign_create(sid, "territorial", "UMP Lima")
  sid
}

test_that("el plan se arma con las UMP de la foto aunque la muestra viva cambie después", {
  sid <- .mtpl_sesion(); on.exit(session_delete(sid), add = TRUE)
  foto <- .mcamp_territorial_envio(session_get(sid), "field")
  p1 <- collection_territorial_plan(sid, supuestos = list(encuestadores = 1, visitas_por_jornada = 10000))
  expect_identical(p1$fuente, "envio")
  expect_false(p1$stale)
  ids_foto <- vapply(.hojas_ruta_envio_rows(foto$sample$blocks), function(b) .hojas_ruta_envio_chr(b$id_manzana), "")
  ids_plan <- unlist(lapply(p1$jornadas, function(j) unlist(j$rutas)))
  expect_setequal(ids_plan, ids_foto)
  # La muestra viva cambia (re-sorteo): el plan de Material sigue siendo el de la foto y avisa.
  s <- session_get(sid); s$hojas_ruta_runs$field$workspace_outputs$sample <- .hre_sample(viviendas = 7L); .session_env[[sid]] <- s
  p2 <- collection_territorial_plan(sid, supuestos = list(encuestadores = 1, visitas_por_jornada = 10000))
  expect_true(p2$stale)
  expect_setequal(unlist(lapply(p2$jornadas, function(j) unlist(j$rutas))), ids_foto)
  expect_identical(p2$sample_fingerprint, foto$sample_fingerprint)
})

test_that("la Hoja del día sale de la foto; una jornada inexistente es 404", {
  sid <- .mtpl_sesion(); on.exit(session_delete(sid), add = TRUE)
  r <- collection_territorial_hoja_dia(sid, jornada = "j01", supuestos = list(visitas_por_jornada = 10000))
  expect_identical(r$jornada, "J01")
  expect_identical(r$fuente, "envio")
  expect_true(file.exists(session_get(sid)$files[[r$file_id]]$path))
  expect_identical(.mtpl_code(collection_territorial_hoja_dia(sid, jornada = "J99")), "E_NOT_FOUND")
  expect_identical(.mtpl_code(collection_territorial_hoja_dia(sid, jornada = "")), "E_BAD_REQUEST")
})

test_that("HTTP: plan sobre la foto", {
  sid <- .mtpl_sesion(); on.exit(session_delete(sid), add = TRUE)
  pr <- mount_recopiladores(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "POST", "/api/recopiladores/campaigns/territorial/plan",
                 body = .hre_json(list(id = "territorial.principal", supuestos = list(encuestadores = 2))))
  expect_identical(r$status, 200L)
  expect_identical(r$body$fuente, "envio")
})
