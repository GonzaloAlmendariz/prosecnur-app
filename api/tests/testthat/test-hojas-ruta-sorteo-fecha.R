# La muestra guarda la fecha de su sorteo junto a la semilla y el envío la publica
# (decisión de Gonzalo, 1 nov 2026; Monitoreo la usa en el aviso I4).

H1 <- "2026-11-01T10:00:00Z"; H2 <- "2026-11-02T15:30:00Z"

test_that("un sorteo nuevo lleva la hora de ahora; la misma huella conserva la que tenía", {
  m <- .hre_sample()
  nuevo <- .hojas_ruta_sellar_sorteo(list(), list(sample = m), ahora = H1)
  expect_identical(nuevo$sample$sorteado_en, H1)

  # Guardar otra vez la misma muestra (p. ej. la restauración del warm start) no mueve la fecha,
  # aunque el cliente no la devuelva.
  igual <- .hojas_ruta_sellar_sorteo(nuevo, list(sample = m), ahora = H2)
  expect_identical(igual$sample$sorteado_en, H1)

  # Otra semilla es otro sorteo.
  otra <- .hojas_ruta_sellar_sorteo(nuevo, list(sample = .hre_sample(seed = 99L)), ahora = H2)
  expect_identical(otra$sample$sorteado_en, H2)

  # La fecha no entra en la huella.
  expect_identical(.hojas_ruta_sample_fingerprint(nuevo$sample), .hojas_ruta_sample_fingerprint(m))
})

test_that("una muestra guardada sin fecha se queda sin ella, y unos outputs sin muestra no cambian", {
  m <- .hre_sample()
  legado <- .hojas_ruta_sellar_sorteo(list(sample = m), list(sample = m), ahora = H1)
  expect_null(legado$sample$sorteado_en)
  sin <- list(population = list(ok = TRUE))
  expect_identical(.hojas_ruta_sellar_sorteo(list(), sin, ahora = H1), sin)
})

test_that("guardar la muestra sella la fecha y el envío la publica en envio_meta", {
  sid <- .hre_session(field = NULL)
  on.exit(session_delete(sid), add = TRUE)
  .hojas_ruta_workspace_outputs_update(sid, patch = list(sample = .hre_sample()))
  guardada <- session_get(sid)$hojas_ruta_runs$field$workspace_outputs$sample
  expect_match(guardada$sorteado_en, "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$")

  meta <- hojas_ruta_enviar(sid)$envio_meta
  expect_identical(meta$sorteado_en, guardada$sorteado_en)
  expect_false(meta$desactualizado)

  # Volver a guardar la misma muestra no la desfasa ni le cambia la fecha.
  .hojas_ruta_workspace_outputs_update(sid, patch = list(sample = .hre_sample()))
  run <- session_get(sid)$hojas_ruta_runs$field
  expect_identical(run$workspace_outputs$sample$sorteado_en, guardada$sorteado_en)
  expect_false(hojas_ruta_envio_meta(run)$desactualizado)
})

test_that("un envío hecho antes de sellar fechas publica sorteado_en vacío", {
  sid <- .hre_session()
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(hojas_ruta_enviar(sid)$envio_meta$sorteado_en, "")
})
