# El proyecto sintetico canonico existe para poder MIRAR lo que la interfaz
# dice. El barrido del 2026-08-16 midio que tres decisiones de gobierno no
# tenian un solo caso en ningun corpus, asi que sus superficies estaban
# verificadas solo por tests unitarios y nunca con datos.
#
# Estos tests fijan que el fixture las siga trayendo: un rebuild que las pierda
# devolveria esas superficies a ser inobservables sin que nada avise.

.gobierno_proyecto <- function() {
  p <- file.path("..", "..", "inst", "audit_reference", "prosecnur_audit_reference.pulso")
  if (!file.exists(p)) p <- audit_reference_project_path()
  p
}

.gobierno_sesion <- function() {
  p <- .gobierno_proyecto()
  skip_if_not(file.exists(p), "El .pulso sintetico no esta construido (make audit-reference-build).")
  session_get(load_pulso(p)$session_id)
}

test_that("cada base trae reglas apagadas con su motivo", {
  s <- .gobierno_sesion()
  bases <- s$estudio$bases %||% list()
  expect_gt(length(bases), 0L)

  for (b in bases) {
    v <- b$validacion %||% list()
    etiqueta <- as.character(b$nombre %||% "?")
    expect_gt(length(v$reglas_desactivadas %||% character(0)), 0L, label = etiqueta)

    # El motivo es el punto: una regla apagada sin porque no se distingue de un
    # descuido, y el informe la marca `sin_motivo`.
    rules <- (v$plan_result %||% list())$bundle$rules %||% list()
    filas <- .vmr_reglas_desactivadas(v$reglas_desactivadas, v$reglas_desactivadas_motivo, rules)
    expect_equal(length(filas), length(v$reglas_desactivadas))
    for (fila in filas) {
      expect_false(isTRUE(fila$sin_motivo), label = paste(etiqueta, fila$id))
      expect_true(nzchar(fila$motivo))
      # El nombre humano y no el id crudo: si el id apagado no existiera en el
      # plan, el informe caeria al id y el fixture no probaria nada.
      expect_false(identical(fila$nombre, fila$id), label = paste(etiqueta, fila$id))
    }
  }
})

test_that("cada base trae variables excluidas con su motivo", {
  s <- .gobierno_sesion()
  for (b in s$estudio$bases %||% list()) {
    v <- b$validacion %||% list()
    expect_gt(length(v$variables_excluidas %||% character(0)), 0L)
    filas <- .vmr_variables_excluidas(v$variables_excluidas, v$variables_excluidas_motivo)
    for (fila in filas) {
      expect_false(isTRUE(fila$sin_motivo), label = fila$variable)
      expect_true(nzchar(fila$motivo))
    }
  }
})

test_that("las variables excluidas no son las que tocan las reglas apagadas", {
  # El control del fixture: si coincidieran, las dos listas del informe dirian
  # lo mismo y una regla apagada sobre una variable ya excluida es redundante.
  # Seria un caso degenerado que aparenta cobertura sin darla.
  s <- .gobierno_sesion()
  for (b in s$estudio$bases %||% list()) {
    v <- b$validacion %||% list()
    rules <- (v$plan_result %||% list())$bundle$rules %||% list()
    apagadas <- Filter(function(r) as.character(r$id %||% "") %in% v$reglas_desactivadas, rules)
    tocadas <- unique(unlist(lapply(apagadas, function(r) as.character(r$primary_var %||% character(0)))))
    expect_length(intersect(tocadas, v$variables_excluidas), 0L)
  }
})

test_that("Recopiladores trae un deployment preparado que cubre todo el plan", {
  s <- .gobierno_sesion()
  d <- s$collection_state$deployment
  expect_true(is.list(d))
  expect_equal(d$status, "prepared")
  expect_gt(length(d$bindings %||% list()), 0L)
  # Una cobertura incompleta habria hecho fallar `prepare`, asi que esto fija
  # que el fixture no degrado a un deployment a medias.
  expect_equal(as.integer(d$coverage$units_missing_access), 0L)
  expect_equal(
    as.integer(d$coverage$units_with_access),
    as.integer(d$coverage$units_total)
  )
})

test_that("el deployment no guarda secretos ni se declara capaz de escribir", {
  # ADR 0005: los secretos viven fuera del .pulso, y este fixture se versiona.
  s <- .gobierno_sesion()
  d <- s$collection_state$deployment
  for (prohibido in c("token", "access_token", "api_key", "password", "secret")) {
    expect_null(d$target[[prohibido]])
  }
  expect_false(isTRUE(d$capabilities$remote_write$observed))
})

test_that("la bitacora trae entradas de mas de un tono", {
  s <- .gobierno_sesion()
  entradas <- s$diseno_estudio_bitacora %||% list()
  expect_gte(length(entradas), 3L)
  tonos <- unique(vapply(entradas, function(e) as.character(e$tone %||% ""), character(1)))
  expect_gt(length(tonos), 1L)
  # `nota` es el fallback cuando el tono no se reconoce: si TODAS cayeran ahi,
  # el fixture no cubriria los tonos que dice cubrir.
  expect_false(identical(tonos, "nota"))
  for (e in entradas) {
    expect_true(nzchar(as.character(e$title %||% "")))
    expect_true(nzchar(as.character(e$body %||% "")))
  }
})
