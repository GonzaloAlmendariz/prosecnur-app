# El envío por cuotas a Material (ADR 0125 §2, hojas_ruta_envio_cuotas.R): zonas con su N y su cuota por celda,
# con huella propia, sin sorteo de manzanas. Usa el marco INEI empaquetado: sin red.

.hrc_session <- function(territorios = list("150103", "150132"), n = 200L) {
  sid <- .hre_session(field = NULL)
  s <- session_get(sid)
  s$hojas_ruta_runs$field$config <- hojas_ruta_integrada_normalize_config(list(territorios = territorios, n_objetivo = n))
  .session_env[[sid]] <- s
  sid
}

test_that("las zonas salen de las celdas: una por distrito, con su N y sus cuotas ordenadas", {
  cells <- data.frame(
    territorio = c("Ate", "Ate", "Ate", "Comas"), ubigeo = c("150103", "150103", "150103", "150110"),
    rango_id = c("r2", "r1", "r1", "r1"), rango_edad = c("30-44", "18-29", "18-29", "18-29"),
    sexo = c("Mujer", "Mujer", "Hombre", "Mujer"), cuota = c(4L, 6L, 5L, 3L), stringsAsFactors = FALSE
  )
  z <- .hojas_ruta_zonas_de_cuotas(cells, list(list(ubigeo = "150103", distrito = "ATE")))
  expect_length(z, 2L)
  expect_identical(z[[1]]$id_zona, "150103")
  expect_identical(z[[1]]$nombre, "ATE")
  expect_identical(z[[1]]$n, 15L)
  expect_identical(vapply(z[[1]]$cuotas, `[[`, "", "sexo"), c("Hombre", "Mujer", "Mujer"))
  # El orden de los rangos es el de la matriz (r2 aparece primero en estas celdas).
  expect_identical(vapply(z[[1]]$cuotas, `[[`, "", "rango_id"), c("r1", "r2", "r1"))
  # Sin nombre en el catálogo, el de la celda.
  expect_identical(z[[2]]$nombre, "Comas")
  expect_length(.hojas_ruta_zonas_de_cuotas(cells[0, ], list()), 0L)
})

test_that("enviar por cuotas guarda la foto con huella; cambiar el N la deja desactualizada", {
  sid <- .hrc_session()
  on.exit(session_delete(sid), add = TRUE)
  r <- hojas_ruta_enviar_cuotas(sid)
  expect_true(r$ok)
  expect_identical(r$envio_meta$kind, "cuotas")
  expect_identical(r$envio_meta$n_zonas, 2L)
  expect_gt(r$envio_meta$n_entrevistas, 0L)
  expect_false(r$envio_meta$desactualizado)
  envio <- session_get(sid)$hojas_ruta_runs$field[["envio"]]
  expect_identical(envio$kind, "cuotas")
  expect_match(envio$sample_fingerprint, "^sha256:[0-9a-f]{64}$")
  expect_true(all(vapply(envio$zonas, function(z) length(z$cuotas) > 0L, logical(1))))
  # La foto no viaja por HTTP; los metadatos sí.
  expect_null(.hojas_ruta_runs_publicos(session_get(sid)$hojas_ruta_runs)$field[["envio"]])  # [[ ]]: $envio pesca envio_meta
  # Otra N: otras cuotas, otra huella.
  s <- session_get(sid)
  s$hojas_ruta_runs$field$config$n_objetivo <- 400L
  .session_env[[sid]] <- s
  expect_true(hojas_ruta_envio_meta(session_get(sid)$hojas_ruta_runs$field)$desactualizado)
})

test_that("sin distritos no hay envío por cuotas; el envío por UMP dice su tipo", {
  sid <- .hrc_session(territorios = list())
  on.exit(session_delete(sid), add = TRUE)
  expect_identical(.hre_code(hojas_ruta_enviar_cuotas(sid)), "E_HOJAS_RUTA_ENVIO_SIN_CUOTAS")
  ump <- .hre_session()
  on.exit(session_delete(ump), add = TRUE)
  expect_identical(hojas_ruta_enviar(ump)$envio_meta$kind, "ump")
})

test_that("HTTP: POST /envio con kind = cuotas, y un kind desconocido es 422", {
  sid <- .hrc_session()
  on.exit(session_delete(sid), add = TRUE)
  pr <- mount_hojas_ruta_envio(plumber::pr() |> plumber::pr_set_serializer(.api_serializer()))
  r <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/envio", .hre_json(list(kind = "cuotas")))
  expect_identical(r$status, 200L)
  expect_identical(r$body$envio_meta$kind, "cuotas")
  mal <- .hre_call(pr, sid, "POST", "/api/hojas-ruta/envio", .hre_json(list(kind = "otro")))
  expect_identical(mal$status, 422L)
})

test_that("normalizar el run conserva el envío por cuotas con sus zonas (no lo descarta por no traer bloques)", {
  sid <- .hrc_session()
  on.exit(session_delete(sid), add = TRUE)
  hojas_ruta_enviar_cuotas(sid)
  crudo <- session_get(sid)$hojas_ruta_runs$field
  run <- .hojas_ruta_run_normalize(crudo, "field")
  expect_identical(sort(names(run[["envio"]])), sort(.HOJAS_RUTA_ENVIO_CUOTAS_KEYS))
  expect_identical(run[["envio"]]$sample_fingerprint, crudo[["envio"]]$sample_fingerprint)
  expect_length(run[["envio"]]$zonas, 2L)
})

