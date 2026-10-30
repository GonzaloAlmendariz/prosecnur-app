# Historial de ruteos sin la muestra entera (docs/qa/propuesta-route-history-2026-10-30.md).

.hrh_foto <- function(id = "r1", sample = .hre_sample()) {
  list(id = id, label = paste("Ruteo", id), seed = sample$seed %||% 1L, method = "pps",
       config = list(territorios = list("150101"), excluded_titular_ids = list("x1")), sample = sample)
}

test_that("la instantánea pierde la muestra y conserva su huella, calculada antes de recortar", {
  s <- .hre_sample()
  h <- .hojas_ruta_route_snapshot_normalizar(.hrh_foto(sample = s))
  expect_null(h[["sample"]])
  expect_identical(h$sample_fingerprint, .hojas_ruta_sample_fingerprint(s))
  expect_match(h$sample_fingerprint, "^sha256:[0-9a-f]{64}$")
  expect_identical(h$algoritmo_sorteo, HOJAS_RUTA_ALGORITMO_SORTEO)
  expect_identical(unlist(h$excluded_titular_ids), "x1")
  expect_identical(h$label, "Ruteo r1")
})

test_that("la huella sobrevive al ida y vuelta por JSON y no depende de la llamada", {
  s <- .hre_sample()
  ida <- jsonlite::fromJSON(.hre_json(s), simplifyVector = FALSE)
  expect_identical(.hojas_ruta_sample_fingerprint(ida), .hojas_ruta_sample_fingerprint(s))
  expect_identical(.hojas_ruta_sample_fingerprint(.hre_sample()), .hojas_ruta_sample_fingerprint(.hre_sample()))
})

test_that("una muestra sin firma de algoritmo se registra como v1 (la causa sería el motor)", {
  s <- .hre_sample()
  s$algoritmo_sorteo <- NULL
  h <- .hojas_ruta_route_snapshot_normalizar(.hrh_foto(sample = s))
  expect_identical(h$algoritmo_sorteo, HOJAS_RUTA_ALGORITMO_SORTEO_V1)
  expect_false(identical(h$sample_fingerprint, .hojas_ruta_sample_fingerprint(.hre_sample())))
})

test_that("sin bloques no hay huella, y una huella del cliente sin forma de huella se descarta", {
  vacia <- .hojas_ruta_route_snapshot_normalizar(.hrh_foto(sample = list(blocks = list())))
  expect_true(is.na(vacia$sample_fingerprint))
  expect_null(vacia[["sample"]])
  falsa <- .hojas_ruta_route_snapshot_normalizar(list(id = "r2", sample_fingerprint = "coincide"))
  expect_true(is.na(falsa$sample_fingerprint))
  buena <- .hojas_ruta_sample_fingerprint(.hre_sample())
  expect_identical(.hojas_ruta_route_snapshot_normalizar(list(id = "r3", sample_fingerprint = buena))$sample_fingerprint, buena)
})

test_that("el historial se recorta a 12 al leer y descarta lo que no es instantánea", {
  lista <- c(lapply(1:14, function(i) list(id = paste0("r", i))), list("basura"))
  out <- .hojas_ruta_route_history_normalizar(lista)
  expect_length(out, 12L)
  expect_identical(out[[1]]$id, "r1")
  expect_identical(.hojas_ruta_route_history_normalizar(NULL), list())
})

test_that("al leer se migran las tres ubicaciones, también la corrida no activa, sin marcar el proyecto", {
  sid <- .hre_session(field = .hre_sample(), pilot = .hre_sample(seed = 7L))
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  foto <- .hrh_foto()
  s$hojas_ruta_runs$pilot$ui_state$route_history <- list(foto)
  s$hojas_ruta_runs$field$ui_state$route_history <- list(foto, .hrh_foto("r2"))
  s$hojas_ruta_ui_state$route_history <- list(foto)
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  expect_true(.hojas_ruta_route_history_por_migrar(s))

  .hojas_ruta_ensure_runs(sid)
  s2 <- session_get(sid)
  for (rh in list(s2$hojas_ruta_runs$pilot$ui_state$route_history,
                  s2$hojas_ruta_runs$field$ui_state$route_history,
                  s2$hojas_ruta_ui_state$route_history)) {
    expect_true(length(rh) >= 1L)
    expect_true(all(vapply(rh, function(h) is.null(h[["sample"]]), logical(1))))
    expect_match(rh[[1]]$sample_fingerprint, "^sha256:")
  }
  expect_false(isTRUE(s2$project_dirty))
  expect_false(.hojas_ruta_route_history_por_migrar(s2))
})
