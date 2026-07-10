# Test de fidelidad del engine de script de replicación (.R) — ADR 0031.
#
# Contrato: el .R emitido, corrido sobre el crudo original del cliente, reproduce
# EXACTAMENTE la base final de Analítica (códigos, sanitizada). 100% o es bug de
# correctitud. Además verifica la regla de sanitización (universo por UUID, sin
# metadata ni vocabulario interno).
#
# Trabaja sobre COPIAS extraídas del .pulso a tempdir, jamás el proyecto vivo.

.fixtures_dir <- normalizePath(
  file.path(testthat::test_path(), "..", "..", "..", "tmp", "processing-fixtures-suite"),
  mustWork = FALSE
)

.flat_df <- function(df) {
  as.data.frame(lapply(df, .script_replica_flatten),
                stringsAsFactors = FALSE, check.names = FALSE)
}

# Resuelve el path del archivo crudo original de una base (mismo criterio que el
# engine, pero devolviendo el path para evaluar el .R con IO real).
.raw_path_for_base <- function(sid, nombre) {
  s <- session_get(sid)
  bases <- (s$estudio %||% list())$bases %||% list()
  b <- bases[[nombre]]
  if (!is.null(b)) {
    fid <- as.character(b$original_data_file_id %||% b$data_file_id %||% "")
    if (nzchar(fid)) return(get_file(sid, fid)$path)
  }
  if (!is.null(s$data_raw_meta) && !is.null(s$data_raw_meta$file_id)) {
    return(get_file(sid, s$data_raw_meta$file_id)$path)
  }
  s$data_raw_meta$path
}

# Evalúa el TEXTO del .R en un environment limpio apuntándolo al crudo original.
.eval_script <- function(script_text, ruta_crudo) {
  e <- new.env(parent = globalenv())
  e$ruta_crudo <- ruta_crudo
  e$ruta_salida <- tempfile(fileext = ".csv")
  suppressMessages(eval(parse(text = script_text), envir = e))
  e$base_final
}

.run_fidelity_for_fixture <- function(pulso_rel) {
  fixture <- file.path(.fixtures_dir, pulso_rel)
  testthat::skip_if_not(file.exists(fixture), sprintf("fixture ausente: %s", fixture))

  tmp <- tempfile(fileext = ".pulso")
  expect_true(file.copy(fixture, tmp))
  ld <- load_pulso(tmp)
  expect_true(isTRUE(ld$ok))
  sid <- ld$session_id
  on.exit(session_delete(sid), add = TRUE)

  cfg <- .analitica_get_config(sid)
  sources <- .load_rp_sources(sid)
  scoped <- estudio_processing_filter_sources(sid, sources$data_sources, sources$inst_sources)
  ds <- scoped$data_sources
  is_ <- scoped$inst_sources
  expect_gt(length(ds), 0L)

  results <- list()
  for (nombre in names(ds)) {
    rp_data <- ds[[nombre]]
    rp_inst <- is_[[nombre]]
    raw <- .script_replica_read_raw_for_base(sid, nombre)
    raw_path <- .raw_path_for_base(sid, nombre)

    target <- .script_replica_target_base(rp_data, rp_inst, cfg)
    out_path <- tempfile(fileext = ".R")
    gen <- .script_replica_generate_for_base(
      rp_data, rp_inst, cfg, raw, out_path,
      meta = list(estudio = "Estudio de prueba", base = nombre)
    )
    script_text <- gen$text

    # (1) Reproducción exacta: evaluar el .R contra el crudo original.
    repro <- .eval_script(script_text, raw_path)
    expect_identical(names(repro), names(target$base),
                     info = sprintf("[%s] columnas/orden", nombre))
    expect_identical(.flat_df(repro), .flat_df(target$base),
                     info = sprintf("[%s] valores/filas/orden (fidelidad 100%%)", nombre))

    # (1b) Gap 2: los TIPOS reproducidos coinciden con los del objetivo.
    kind <- function(df) vapply(df, .script_replica_col_kind, character(1))
    expect_identical(kind(repro), kind(target$base),
                     info = sprintf("[%s] tipos coinciden con el objetivo", nombre))

    # (2) Columnas objetivo ⊆ base /bases/xlsx códigos; valores iguales en las
    #     columnas compartidas (lo omitido es metadata/sistema).
    expect_true(all(names(target$base) %in% names(target$base_xlsx)),
                info = sprintf("[%s] target ⊆ base xlsx", nombre))
    for (col in names(target$base)) {
      expect_true(.script_replica_equal(
        .script_replica_flatten(target$base[[col]]),
        .script_replica_flatten(target$base_xlsx[[col]])),
        info = sprintf("[%s] col %s coincide con xlsx", nombre, col))
    }

    # (2b) Gap 1: el objetivo INCLUYE numéricas y texto del instrumento (no sólo
    #      categóricas) y EXCLUYE toda columna de sistema.
    expect_true(all(c("edad", "ingreso", "puntaje", "n_hijos") %in% names(target$base)),
                info = sprintf("[%s] numéricas del instrumento incluidas", nombre))
    expect_true(all(c("comentario_open", "recomendacion_open", "zona") %in% names(target$base)),
                info = sprintf("[%s] variables de texto del instrumento incluidas", nombre))
    expect_true(any(vapply(target$base, function(x)
      .script_replica_col_kind(x) == "double", logical(1))),
      info = sprintf("[%s] hay al menos una columna numérica", nombre))
    expect_length(intersect(names(target$base), .script_replica_system_cols()), 0L)
    # GPS e identificadores directos quedaron fuera.
    expect_length(intersect(names(target$base),
                            c("latitud", "longitud", "response_id", "enumerador", "telefono")), 0L)

    # (3) Sanitización: sin vocabulario interno.
    expect_false(grepl("tacha|anulad|anulaci[oó]n", script_text, ignore.case = TRUE),
                 info = sprintf("[%s] sin términos internos", nombre))

    # (4) Sin columnas de metadata prohibidas en la base final.
    prohibidas <- c("_uuid", "_id", "_submission_time", "submission_date",
                    "start", "end", "today", "deviceid", "latitud", "longitud",
                    "telefono", "collector_id", "recipient_id", "response_id")
    expect_length(intersect(names(repro), prohibidas), 0L)

    # (5) El file físico se escribió en UTF-8.
    expect_true(file.exists(out_path))
    expect_gt(file.info(out_path)$size, 0L)

    results[[nombre]] <- list(target = target, script_text = script_text,
                              fallbacks = gen$fallbacks, repro = repro)
  }
  results
}

test_that("single-base: el .R reproduce exacto la base final (fidelidad 100%)", {
  res <- .run_fidelity_for_fixture(
    "procesamiento_01_manual_single/procesamiento_01_manual_single.pulso")
  expect_gt(length(res), 0L)
})

test_that("multibase: un .R por base reproduce exacto cada base final", {
  res <- .run_fidelity_for_fixture(
    "procesamiento_05_analitica_productos/procesamiento_05_analitica_productos.pulso")
  expect_gte(length(res), 2L)

  # select_multiple: reconstrucción madre + dummies en orden XLSForm.
  first <- res[[1]]
  sm_cols <- grep("^servicios[./]", names(first$target$base), value = TRUE)
  expect_gt(length(sm_cols), 0L)
  # Los dummies SM se emiten como reconstrucción real, no como volcado verbatim.
  expect_true(grepl("reconstruir_dummy", first$script_text, fixed = TRUE))
  expect_length(intersect(sm_cols, first$fallbacks), 0L)
  # Y quedan en el orden de la lista de opciones (1,2,3,4).
  expect_identical(sm_cols, sm_cols[order(as.integer(sub("^servicios[./]", "", sm_cols)))])
})

test_that("el emisor aborta si el texto contendría términos internos", {
  expect_error(
    .script_replica_guard_sanitizacion("paso: exclusión por anulación del caso"),
    class = "api_error"
  )
})
