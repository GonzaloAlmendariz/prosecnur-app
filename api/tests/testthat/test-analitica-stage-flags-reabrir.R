# Las marcas de Analítica de un estudio multibase con config GLOBAL sobreviven
# al reabrir (formato-dashboard-2026-11-04, «Las dimensiones no sobreviven al
# reabrir»).
#
# Con la config global, `.analitica_scoped_base()` es "" y
# `POST /api/analitica/dimensiones/build` sólo escribe el espejo global
# `analitica_dim_ok`. La entrada por base de la activa la había sembrado una
# apertura anterior (captura «sólo si falta») con FALSE, y al reabrir
# `.estudio_apply_stage_flags()` la reproyectaba sobre el espejo: el tablero
# decía «Dimensiones pendientes» con `rp_dim` (426 filas) dentro del `.pulso`.

.sfr_sesion_catalogo <- function() {
  path <- file.path(catalogo_recetario_dir(), "recetario_catalogo.pulso")
  stopifnot(file.exists(path))   # versionado: si falta, es un error y no un salto
  suppressMessages(load_pulso(path))$session_id
}

# Estado de una copia que se abrió ANTES de construir dimensiones: la captura
# de esa apertura dejó FALSE en la entrada por base de la activa.
.sfr_sembrar_apertura_previa <- function(sid, key = "analitica_dim_ok", value = FALSE) {
  s <- session_get(sid)
  activa <- estudio_active_base(sid)
  s$analitica_status_por_base[[activa]][[key]] <- value
  s[[key]] <- value
  .session_env[[sid]] <- s
  activa
}

.sfr_reabrir <- function(sid) {
  dest <- tempfile(fileext = ".pulso")
  suppressMessages(build_pulso(sid, dest))
  on.exit(unlink(dest), add = TRUE)
  suppressMessages(load_pulso(dest))$session_id
}

test_that("multibase con config global: construir dimensiones y reabrir deja analitica_dim_ok en TRUE", {
  sid <- .sfr_sesion_catalogo()
  on.exit(session_delete(sid), add = TRUE)
  expect_gt(length(session_get(sid)$estudio$bases), 1L)
  expect_false(.analitica_config_es_por_base(sid))
  expect_identical(.analitica_scoped_base(sid), "")

  activa <- .sfr_sembrar_apertura_previa(sid)
  # Lo que hace la ruta de build tras construir.
  .analitica_status_set(sid, "analitica_dim_ok", TRUE)
  expect_true(session_get(sid)$analitica_dim_ok)

  sid2 <- .sfr_reabrir(sid)
  on.exit(session_delete(sid2), add = TRUE)
  s2 <- session_get(sid2)
  expect_identical(estudio_active_base(sid2), activa)
  expect_false(is.null(s2$rp_dim))
  expect_true(isTRUE(s2$analitica_dim_ok))
  # La entrada por base queda alineada con el espejo, no con la foto vieja.
  expect_true(isTRUE(s2$analitica_status_por_base[[activa]]$analitica_dim_ok))
})

test_that("multibase con config global: una invalidación del espejo no resucita con la foto por base", {
  sid <- .sfr_sesion_catalogo()
  on.exit(session_delete(sid), add = TRUE)
  # Foto vieja en TRUE y una invalidación que sólo toca el espejo (como hacen
  # `.limpieza_invalidate_downstream()` y el cambio de config de Codificación).
  activa <- .sfr_sembrar_apertura_previa(sid, "analitica_cruces_ok", TRUE)
  session_set(sid, "analitica_cruces_ok", FALSE)

  sid2 <- .sfr_reabrir(sid)
  on.exit(session_delete(sid2), add = TRUE)
  s2 <- session_get(sid2)
  expect_false(isTRUE(s2$analitica_cruces_ok))
  expect_false(isTRUE(s2$analitica_status_por_base[[activa]]$analitica_cruces_ok))
})

test_that("las marcas que .pulso_strip_caches() apaga siguen saliendo de la entrada por base", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(
    processing_mode = "multibase",
    active_base = "a",
    bases = list(a = list(nombre = "a"), b = list(nombre = "b"))
  )
  s$analitica_status_por_base <- list(a = list(analitica_prep_ok = TRUE))
  s$analitica_prep_ok <- FALSE      # marcador del strip, no un hecho
  s$analitica_dim_ok <- TRUE
  s$project_dirty <- FALSE
  .session_env[[sid]] <- s
  expect_false(.analitica_config_es_por_base(sid))

  expect_true(.pulso_restore_active_stage_flags_after_load(sid))
  restored <- session_get(sid)
  expect_true(restored$analitica_prep_ok)
  expect_true(restored$analitica_dim_ok)
  expect_false(restored$project_dirty)
})

test_that("la lista de marcas que el guardado apaga coincide con lo que hace .pulso_strip_caches()", {
  s <- list(estudio = list(bases = list(a = list(), b = list())))
  for (key in .ESTUDIO_ANALITICA_STATUS_KEYS) s[[key]] <- TRUE
  stripped <- .pulso_strip_caches(s)
  apagadas <- .ESTUDIO_ANALITICA_STATUS_KEYS[vapply(
    .ESTUDIO_ANALITICA_STATUS_KEYS,
    function(key) !isTRUE(stripped[[key]]),
    logical(1)
  )]
  expect_setequal(apagadas, .ESTUDIO_ANALITICA_STATUS_KEYS_APAGADAS_AL_GUARDAR)
})

test_that("con config por base la entrada por base sigue mandando al reabrir", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)
  s$estudio <- list(
    processing_mode = "independent_siblings",
    active_base = "a",
    bases = list(a = list(nombre = "a"), b = list(nombre = "b"))
  )
  s$analitica_status_por_base <- list(a = list(analitica_dim_ok = FALSE))
  s$analitica_dim_ok <- TRUE        # espejo de la hermana que estaba activa
  .session_env[[sid]] <- s
  expect_true(.analitica_config_es_por_base(sid))

  .pulso_restore_active_stage_flags_after_load(sid)
  expect_false(session_get(sid)$analitica_dim_ok)
})
