# «Enviar a Material» (ADR 0118 §3, F1): foto de la muestra con huella en el run
# de la fase, tomada del servidor; persiste en el .pulso y no sale por HTTP.

test_that("la huella es estable, ignora avisos y tipos del ida y vuelta, y cambia con la identidad", {
  base <- .hre_sample()
  fp <- .hojas_ruta_sample_fingerprint(base)
  expect_match(fp, "^sha256:[0-9a-f]{64}$")

  # El GET inserta avisos v1 y el cliente devuelve números como double.
  con_avisos <- base
  con_avisos$alerts <- list(list(level = "warning", code = "W_SAMPLE_DRAWN_WITH_V1", message = "x"))
  con_avisos$blocks[[1]]$lat <- -12.05
  ida_vuelta <- jsonlite::fromJSON(.hre_json(con_avisos), simplifyVector = FALSE)
  expect_identical(.hojas_ruta_sample_fingerprint(ida_vuelta), fp)

  # Sin firma = v1, igual que tras hojas_ruta_sorteo_aviso_v1.
  sin_firma <- base; sin_firma$algoritmo_sorteo <- NULL
  con_v1 <- base; con_v1$algoritmo_sorteo <- HOJAS_RUTA_ALGORITMO_SORTEO_V1
  expect_identical(.hojas_ruta_sample_fingerprint(sin_firma), .hojas_ruta_sample_fingerprint(con_v1))

  expect_false(identical(.hojas_ruta_sample_fingerprint(.hre_sample(viviendas = 121L)), fp))
  expect_false(identical(.hojas_ruta_sample_fingerprint(.hre_sample(seed = 99L)), fp))
  expect_false(identical(.hojas_ruta_sample_fingerprint(.hre_sample(prefijo = "1501020010")), fp))
  expect_true(is.na(.hojas_ruta_sample_fingerprint(NULL)))
  expect_true(is.na(.hojas_ruta_sample_fingerprint(list(blocks = list()))))
})

test_that("el envío copia la muestra del servidor (no la del cuerpo), marca el proyecto y no cambia de fase", {
  sid <- .hre_session(pilot = .hre_sample(prefijo = "1501990010"))
  on.exit(session_delete(sid), add = TRUE)
  pr <- mount_hojas_ruta_envio(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  falsa <- .hre_sample(prefijo = "9999990010")
  r <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/envio", .hre_json(list(sample = falsa, sample_fingerprint = "sha256:x")))
  expect_identical(r$status, 200L, info = substr(r$raw, 1, 400))
  expect_identical(r$body$fase, "field")
  expect_identical(r$body$envio_meta$n_titulares, 2L)
  expect_identical(r$body$envio_meta$n_reemplazos, 1L)
  expect_false(r$body$envio_meta$desactualizado)

  s <- session_get(sid)
  envio <- s$hojas_ruta_runs$field$envio
  expect_identical(envio$sample, s$hojas_ruta_runs$field$workspace_outputs$sample)
  expect_identical(envio$sample_fingerprint, .hojas_ruta_sample_fingerprint(.hre_sample()))
  expect_identical(envio$config, hojas_ruta_integrada_normalize_config(s$hojas_ruta_runs$field$config))
  expect_match(envio$enviado_at, "^\\d{4}-\\d{2}-\\d{2}T")
  expect_true(isTRUE(s$project_dirty))
  expect_identical(s$hojas_ruta_active_phase, "field")
  expect_null(s$hojas_ruta_runs$pilot$envio)
})

test_that("sin muestra es 409; una fase que no existe es 422", {
  sid <- .hre_session(field = NULL)
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(.hre_code(hojas_ruta_enviar(sid)), "E_HOJAS_RUTA_ENVIO_SIN_MUESTRA")
  expect_identical(.hre_status(hojas_ruta_enviar(sid)), 409L)
  # Piloto pedido sin piloto en el proyecto: no hay muestra que enviar.
  expect_identical(.hre_code(hojas_ruta_enviar(sid, "pilot")), "E_HOJAS_RUTA_ENVIO_SIN_MUESTRA")
  expect_identical(.hre_code(hojas_ruta_enviar(sid, "ensayo")), "E_HOJAS_RUTA_ENVIO_FASE")
  expect_identical(.hre_status(hojas_ruta_enviar(sid, "ensayo")), 422L)
  expect_false(isTRUE(session_get(sid)$project_dirty))
})

test_that("el piloto bloqueado se puede enviar y guardar su workspace no borra el envío", {
  piloto <- .hre_sample(prefijo = "1501990010")
  sid <- .hre_session(pilot = piloto)
  on.exit(session_delete(sid), add = TRUE)
  out <- hojas_ruta_enviar(sid, "piloto")
  expect_identical(out$fase, "pilot")
  s <- session_get(sid)
  expect_true(isTRUE(s$hojas_ruta_runs$pilot$locked))
  expect_identical(s$hojas_ruta_runs$pilot$envio$sample_fingerprint, .hojas_ruta_sample_fingerprint(piloto))
  expect_identical(s$hojas_ruta_active_phase, "field")
  # Guardar el piloto (bloqueado) pasa por save_run: no edita la muestra ni pierde la foto.
  .hojas_ruta_save_run(sid, "pilot", workspace_outputs = list(sample = .hre_sample()), ui_state = list(active_stage = "muestra"))
  run <- session_get(sid)$hojas_ruta_runs$pilot
  expect_identical(run$workspace_outputs$sample, piloto)
  expect_false(is.null(run$envio))
  expect_false(hojas_ruta_envio_meta(run)$desactualizado)
})

test_that("la foto queda desactualizada si cambia la muestra, no si sólo cambian los avisos", {
  sid <- .hre_session()
  on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_enviar(sid)
  con_avisos <- .hre_sample()
  con_avisos$alerts <- list(list(level = "warning", code = "W_X", message = "aviso"))
  .hojas_ruta_save_run(sid, "field", workspace_outputs = list(sample = con_avisos))
  expect_false(hojas_ruta_envio_meta(session_get(sid)$hojas_ruta_runs$field)$desactualizado)
  .hojas_ruta_save_run(sid, "field", workspace_outputs = list(sample = .hre_sample(viviendas = 300L)))
  meta <- hojas_ruta_envio_meta(session_get(sid)$hojas_ruta_runs$field)
  expect_true(meta$desactualizado)
  # La foto sigue siendo la enviada.
  expect_identical(session_get(sid)$hojas_ruta_runs$field$envio$sample$blocks[[1]]$viviendas, 120L)
  # Sin muestra viva también es desactualizado.
  .hojas_ruta_save_run(sid, "field", workspace_outputs = list())
  expect_true(hojas_ruta_envio_meta(session_get(sid)$hojas_ruta_runs$field)$desactualizado)
})

test_that("normalizar el run conserva el envío y descarta uno sin forma", {
  envio <- list(sample = .hre_sample(), config = list(), sample_fingerprint = .hojas_ruta_sample_fingerprint(.hre_sample()),
                enviado_at = "2026-10-29T10:00:00Z", n_titulares = 2L, n_reemplazos = 1L)
  run <- .hojas_ruta_run_normalize(list(workspace_outputs = list(sample = .hre_sample()), envio = envio), "field")
  expect_identical(run$envio$sample_fingerprint, envio$sample_fingerprint)
  expect_identical(run$envio$enviado_at, "2026-10-29T10:00:00Z")
  expect_identical(sort(names(run$envio)), sort(.HOJAS_RUTA_ENVIO_KEYS))
  # Huella ausente o inválida se recalcula del servidor.
  sin_huella <- envio; sin_huella$sample_fingerprint <- "manipulada"
  expect_identical(.hojas_ruta_envio_normalize(sin_huella)$sample_fingerprint, envio$sample_fingerprint)
  expect_null(.hojas_ruta_run_normalize(list(envio = list(sample = list(blocks = list()))), "field")$envio)
  expect_null(.hojas_ruta_run_normalize(list(envio = "x"), "field")$envio)
  expect_null(.hojas_ruta_run_normalize(list(), "field")$envio)
})

test_that("el envío sobrevive a guardar y abrir el proyecto (viaja en state.rds)", {
  sid <- .hre_session()
  on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_enviar(sid)
  fp <- session_get(sid)$hojas_ruta_runs$field$envio$sample_fingerprint
  tmp <- tempfile(fileext = ".pulso")
  on.exit(unlink(tmp, force = TRUE), add = TRUE)
  expect_true(build_pulso(sid, tmp, project_name = "Envío ADR 0118")$ok)
  res <- load_pulso(tmp)
  on.exit(session_delete(res$session_id), add = TRUE)
  run <- .hojas_ruta_active_run(res$session_id, "field")$run
  expect_identical(run$envio$sample_fingerprint, fp)
  meta <- hojas_ruta_envio_meta(run)
  expect_false(meta$desactualizado)
  expect_identical(meta$n_titulares, 2L)
})

test_that("state y workspace no sacan la foto por HTTP; publican envio_meta", {
  sid <- .hre_session()
  on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_enviar(sid)
  p <- .hojas_ruta_state_payload(sid)
  expect_null(p$runs$field[["envio"]])
  expect_false(is.null(p$runs$field$envio_meta))
  expect_identical(p$envio_meta$sample_fingerprint, session_get(sid)$hojas_ruta_runs$field$envio$sample_fingerprint)
  expect_false(p$envio_meta$desactualizado)

  pr <- mount_hojas_ruta(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  st <- .hre_call(pr, sid, "GET", "/api/hojas-ruta/state")
  expect_identical(st$status, 200L, info = substr(st$raw, 1, 400))
  expect_null(st$body$runs$field[["envio"]])
  expect_identical(st$body$envio_meta$n_titulares, 2L)
  ws <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/workspace", .hre_json(list(ui_state = list(active_stage = "seleccion"))))
  expect_identical(ws$status, 200L, info = substr(ws$raw, 1, 400))
  expect_null(ws$body$runs$field[["envio"]])
  expect_false(is.null(ws$body$runs$field$envio_meta))
  # El workspace no borró la foto del servidor.
  expect_false(is.null(session_get(sid)$hojas_ruta_runs$field$envio))
})

test_that("una muestra sorteada con el reparto v1 no se envía a Material (checklist F13)", {
  v1 <- .hre_sample()
  v1$algoritmo_sorteo <- NULL
  v1$alerts <- list(list(level = "warn", code = "W_SAMPLE_DRAWN_WITH_V1", message = "ATE: …"))
  sid <- .hre_session(field = v1)
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(.hre_code(hojas_ruta_enviar(sid)), "E_HOJAS_RUTA_ENVIO_SORTEO_V1")
  expect_identical(.hre_status(hojas_ruta_enviar(sid)), 409L)
  expect_null(session_get(sid)$hojas_ruta_runs$field$envio)
  expect_false(isTRUE(session_get(sid)$project_dirty))
})
