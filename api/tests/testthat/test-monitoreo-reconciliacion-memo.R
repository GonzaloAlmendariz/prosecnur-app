# Memo de la reconciliación de acreditación + llave de texto memoizada
# (monitoreo_reconciliacion_memo.R, unidades 5.1a/5.1b del plan de perf).
#
# El invariante duro de la ola es PARIDAD: mismas cifras, mismo payload. El
# riesgo de un memo no es que falle sino que acierte de más (números viejos que
# parecen frescos), así que aquí se prueba tanto el ahorro (3 builds → 1) como
# que la clave discrimina datos y decisiones manuales del profile.

# Réplica literal del pipeline histórico de .monitoreo_text_key, tal como vivía
# en monitoreo_engine.R antes de 5.1b. Es el oráculo del test de paridad.
.mrm_text_key_historico <- function(x) {
  x <- trimws(tolower(as.character(x %||% "")))
  x[is.na(x)] <- ""
  x <- iconv(x, to = "ASCII//TRANSLIT", sub = "")
  x <- gsub("[`'´’]", "", x)
  x <- gsub("\\s+", " ", x)
  x
}

# Datos mínimos con universo + respuestas: sin filas de base el rollup se
# devuelve vacío antes de tocar la reconciliación y el contador no mediría nada.
.mrm_data <- function(codigos = c("U1", "U2")) {
  n <- length(codigos)
  data.frame(
    CodPulso = c(codigos, rep("", n)),
    cv_id = c(rep("", n), codigos),
    response_id = c(rep("", n), paste0("R", seq_len(n))),
    response_status = c(rep("", n), rep(c("completed", "partial"), length.out = n)),
    date_modified = c(rep("", n), paste0("2026-06-0", seq_len(n), "T10:00:00+00:00")),
    .source_role = c(rep("universo", n), rep("respuestas", n)),
    .source_label = c(rep("Universo Egresados", n), rep("SurveyMonkey Egresados", n)),
    dim_actor = rep("Egresados", 2L * n),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.mrm_cfg <- function(data) {
  monitoreo_normalize_config(list(
    monitoreo_profile = list(
      family = "acreditacion",
      units = list(list(id = "Egresados", label = "Egresados", actor = "Egresados")),
      key_rules = list(
        universe_fields = c("CodPulso"),
        response_fields = c("cv_id"),
        automatic_detection = FALSE
      )
    )
  ), data)
}

# Desactiva el memo anulando la clave (sin clave no hay lookup ni store): es
# exactamente el camino previo a 5.1a y sirve de "antes" en los goldens.
.mrm_sin_memo <- function(expr) {
  env <- environment(.monitoreo_reconciliacion_memo_key)
  original <- get(".monitoreo_reconciliacion_memo_key", envir = env)
  was_locked <- bindingIsLocked(".monitoreo_reconciliacion_memo_key", env)
  if (was_locked) unlockBinding(".monitoreo_reconciliacion_memo_key", env)
  assign(".monitoreo_reconciliacion_memo_key", function(...) "", envir = env)
  on.exit({
    assign(".monitoreo_reconciliacion_memo_key", original, envir = env)
    if (was_locked) lockBinding(".monitoreo_reconciliacion_memo_key", env)
  }, add = TRUE)
  force(expr)
}

# Quita los timestamps de generación en cualquier nivel: cada llamada a
# monitoreo_acreditacion_reportes() estampa el suyo y no es parte del invariante.
.mrm_sin_generated_at <- function(x) {
  if (!is.list(x)) return(x)
  x$generated_at <- NULL
  lapply(x, .mrm_sin_generated_at)
}

test_that("text_key memoizada es identica al pipeline historico, elemento a elemento", {
  .monitoreo_text_key_memo_reset()
  casos <- list(
    NULL,
    character(0),
    "",
    NA,
    NA_character_,
    c(NA, "", "Hola"),
    "  Múltiples   espacios \t y  tabs ",
    "ÁÉÍÓÚ üñÑ çÇ ÀÈâê",
    "don't `mezclar´ comillas’",
    c(a = "Nombre", b = "  APELLIDO  "),
    factor(c("Sí", "No", "Sí")),
    c(1.5, NA, 3L),
    TRUE,
    "salto\nde línea",
    strrep("x", 600),
    c("repetido", "repetido", "otro", "repetido", NA, ""),
    "María-José O'Connor  (Prácticas) — año 2026"
  )
  for (i in seq_along(casos)) {
    esperado <- .mrm_text_key_historico(casos[[i]])
    # Dos pasadas: la primera puebla el memo (misses), la segunda sirve hits.
    expect_identical(.monitoreo_text_key(casos[[i]]), esperado, label = sprintf("caso %d (miss)", i))
    expect_identical(.monitoreo_text_key(casos[[i]]), esperado, label = sprintf("caso %d (hit)", i))
  }
})

test_that("text_key no confunde strings distintos que colapsan a la misma llave", {
  .monitoreo_text_key_memo_reset()
  # "Ávila" y "avila" producen la MISMA salida desde entradas distintas: el
  # memo debe guardar por entrada, no por salida.
  expect_identical(.monitoreo_text_key("Ávila"), "avila")
  expect_identical(.monitoreo_text_key("avila"), "avila")
  expect_identical(.monitoreo_text_key("  AVILA  "), "avila")
})

test_that("un ciclo advance_summary + queries_summary reconcilia EXACTAMENTE una vez", {
  datos <- .mrm_data()
  cfg <- .mrm_cfg(datos)

  # Premisa roja (el estado previo a 5.1a): sin memo, el mismo ciclo paga la
  # reconciliación tres veces — case_rollup del modelo, controles detectados
  # de publicación y el scope de consultas.
  monitoreo_reconciliacion_memo_reset()
  .mrm_sin_memo({
    monitoreo_acreditacion_reportes(datos, cfg, report_scope = "advance_summary")
    monitoreo_acreditacion_reportes(datos, cfg, report_scope = "queries_summary")
  })
  expect_equal(monitoreo_reconciliacion_build_count(), 3L)

  # Con el memo: una sola reconciliación para todo el ciclo.
  monitoreo_reconciliacion_memo_reset()
  monitoreo_acreditacion_reportes(datos, cfg, report_scope = "advance_summary")
  monitoreo_acreditacion_reportes(datos, cfg, report_scope = "queries_summary")
  expect_equal(monitoreo_reconciliacion_build_count(), 1L)
})

test_that("golden: el payload con memo es identico al payload sin memo", {
  datos <- .mrm_data(c("U1", "U2", "U3"))
  cfg <- .mrm_cfg(datos)

  monitoreo_reconciliacion_memo_reset()
  antes_avance <- .mrm_sin_memo(monitoreo_acreditacion_reportes(datos, cfg, report_scope = "advance_summary"))
  antes_consultas <- .mrm_sin_memo(monitoreo_acreditacion_reportes(datos, cfg, report_scope = "queries_summary"))

  monitoreo_reconciliacion_memo_reset()
  despues_avance <- monitoreo_acreditacion_reportes(datos, cfg, report_scope = "advance_summary")
  despues_consultas <- monitoreo_acreditacion_reportes(datos, cfg, report_scope = "queries_summary")

  expect_identical(
    .mrm_sin_generated_at(despues_avance),
    .mrm_sin_generated_at(antes_avance)
  )
  expect_identical(
    .mrm_sin_generated_at(despues_consultas),
    .mrm_sin_generated_at(antes_consultas)
  )
  # Y el payload de consultas trae reconciliación real, no un esqueleto vacío.
  expect_gt(length(despues_consultas$internal_queries$cases %||% list()), 0L)
})

test_that("cambiar los datos invalida el memo", {
  monitoreo_reconciliacion_memo_reset()
  datos_a <- .mrm_data()
  cfg <- .mrm_cfg(datos_a)
  profile <- cfg$monitoreo_profile
  .monitoreo_acreditacion_internal_queries(datos_a, profile)
  expect_equal(monitoreo_reconciliacion_build_count(), 1L)

  datos_b <- datos_a
  datos_b$response_status[[4L]] <- "completed"
  # Mismas dimensiones y nombres: un fingerprint barato NO distinguiría estos
  # dos cortes; la clave por contenido sí debe hacerlo.
  .monitoreo_acreditacion_internal_queries(datos_b, profile)
  expect_equal(monitoreo_reconciliacion_build_count(), 2L)
})

test_that("una decision manual nueva en el profile invalida el memo", {
  monitoreo_reconciliacion_memo_reset()
  datos <- .mrm_data()
  cfg <- .mrm_cfg(datos)
  profile <- cfg$monitoreo_profile
  base <- .monitoreo_acreditacion_internal_queries(datos, profile)
  expect_equal(monitoreo_reconciliacion_build_count(), 1L)

  # R1 es la respuesta "completed" que cruza sola con U1: mantenerla excluida
  # por decisión manual cambia el avance, así que el resultado DEBE diferir.
  profile_manual <- profile
  profile_manual$reconciliation_decisions <- list(
    manual_case_reconciliations = list(
      list(response_id = "R1", action = "keep_excluded")
    )
  )
  con_manual <- .monitoreo_acreditacion_internal_queries(datos, profile_manual)
  expect_equal(monitoreo_reconciliacion_build_count(), 2L)
  expect_false(identical(base, con_manual))
})

test_that("el rollup con internal_queries en mano no pasa por el memo", {
  monitoreo_reconciliacion_memo_reset()
  datos <- .mrm_data()
  cfg <- .mrm_cfg(datos)
  profile <- cfg$monitoreo_profile
  queries <- .monitoreo_acreditacion_internal_queries(datos, profile)
  expect_equal(monitoreo_reconciliacion_build_count(), 1L)

  directo <- .monitoreo_acreditacion_case_rollup_df(datos, profile, internal_queries = queries)
  memoizado <- .monitoreo_acreditacion_case_rollup_df(datos, profile)
  expect_identical(directo, memoizado)
  # Ninguna de las dos llamadas debió reconciliar de nuevo.
  expect_equal(monitoreo_reconciliacion_build_count(), 1L)
})

test_that("el memo no crece sin freno", {
  monitoreo_reconciliacion_memo_reset()
  profile <- .mrm_cfg(.mrm_data())$monitoreo_profile
  for (codigo in c("A1", "B1", "C1", "D1")) {
    .monitoreo_acreditacion_internal_queries(.mrm_data(c(codigo, "Z9")), profile)
  }
  entradas <- ls(envir = .monitoreo_reconciliacion_memo, all.names = TRUE)
  expect_lte(length(entradas), .MONITOREO_RECONCILIACION_MEMO_LIMIT)
  monitoreo_reconciliacion_memo_reset()
})
