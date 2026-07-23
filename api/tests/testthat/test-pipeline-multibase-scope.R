library(testthat)

.pipeline_scope_write_pair <- function(dir, stem, marker) {
  inst_path <- file.path(dir, paste0(stem, "_form.xlsx"))
  data_path <- file.path(dir, paste0(stem, "_data.xlsx"))

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", data.frame(
    type = "text",
    name = "source_marker",
    label = "Source marker",
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(
    list_name = character(0),
    name = character(0),
    label = character(0),
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "settings")
  openxlsx::writeData(wb, "settings", data.frame(
    form_title = stem,
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, inst_path, overwrite = TRUE)
  openxlsx::write.xlsx(
    list(data = data.frame(source_marker = marker, stringsAsFactors = FALSE)),
    file = data_path,
    overwrite = TRUE
  )

  list(inst = inst_path, data = data_path)
}

.pipeline_scope_upload <- function(sid, path, kind) {
  save_upload(
    sid,
    kind,
    basename(path),
    readBin(path, "raw", n = file.info(path)$size)
  )
}

.pipeline_scope_inst <- function() {
  list(
    survey = data.frame(
      type = "text",
      name = "source_marker",
      label = "Source marker",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame()
  )
}

.pipeline_scope_siblings_fixture <- function() {
  sid <- session_create()
  dir <- tempfile("pipeline_scope_")
  dir.create(dir, recursive = TRUE)

  original_a <- .pipeline_scope_write_pair(dir, "original_a", "original_a")
  adapted_a <- .pipeline_scope_write_pair(dir, "adapted_a", "adapted_a")
  original_b <- .pipeline_scope_write_pair(dir, "original_b", "original_b")

  original_a_inst <- .pipeline_scope_upload(sid, original_a$inst, "xlsform")
  original_a_data <- .pipeline_scope_upload(sid, original_a$data, "data")
  adapted_a_inst <- .pipeline_scope_upload(sid, adapted_a$inst, "xlsform")
  adapted_a_data <- .pipeline_scope_upload(sid, adapted_a$data, "data")
  original_b_inst <- .pipeline_scope_upload(sid, original_b$inst, "xlsform")
  original_b_data <- .pipeline_scope_upload(sid, original_b$data, "data")

  s <- session_get(sid)
  s$files[[adapted_a_inst$file_id]]$kind <- "instrumento_adaptado"
  s$files[[adapted_a_data$file_id]]$kind <- "data_adaptada"
  .session_env[[sid]] <- s

  estudio_add_base(
    sid, "a", adapted_a_inst$file_id, adapted_a_data$file_id, "xlsx",
    data.frame(source_marker = "adapted_a"), .pipeline_scope_inst(),
    extra_meta = list(
      original_xlsform_file_id = original_a_inst$file_id,
      original_data_file_id = original_a_data$file_id
    )
  )
  estudio_add_base(
    sid, "b", original_b_inst$file_id, original_b_data$file_id, "xlsx",
    data.frame(source_marker = "original_b"), .pipeline_scope_inst()
  )

  s <- session_get(sid)
  s$estudio$processing_mode <- "independent_siblings"
  s$estudio$active_base <- "a"
  s$codif_source_active <- "a"
  s$analitica_config <- .analitica_default_config()
  s$analitica_config$fuente_preferida <- "adaptados"
  .session_env[[sid]] <- s

  sid
}

test_that("independent_siblings prepara solo la fuente adaptada de la base activa", {
  skip_if_not_installed("openxlsx")

  sid <- .pipeline_scope_siblings_fixture()
  on.exit(session_delete(sid), add = TRUE)
  s <- session_get(sid)

  resolved <- .analitica_source_pairs(sid, s$analitica_config)
  prepared <- .analitica_prepare_context(sid, s$analitica_config)

  expect_identical(
    list(
      source_pairs = list(
        fuente = resolved$fuente,
        bases = names(resolved$pairs),
        kinds = c(resolved$pairs$a$xls$kind, resolved$pairs$a$data$kind)
      ),
      prepare = list(
        fuente = prepared$fuente,
        bases = names(prepared$data_sources),
        marker = as.character(prepared$rp_data$source_marker)
      )
    ),
    list(
      source_pairs = list(
        fuente = "adaptados",
        bases = "a",
        kinds = c("instrumento_adaptado", "data_adaptada")
      ),
      prepare = list(
        fuente = "adaptados",
        bases = "a",
        marker = "adapted_a"
      )
    )
  )
})

test_that("invalidar la activa impide reutilizar el cache analitico singular", {
  skip_if_not_installed("openxlsx")

  sid <- .pipeline_scope_siblings_fixture()
  on.exit(session_delete(sid), add = TRUE)

  s <- session_get(sid)
  s$analitica_config$fuente_preferida <- "originales"
  .session_env[[sid]] <- s

  s <- session_get(sid)
  s$analitica_rp_data <- data.frame(source_marker = "STALE_A")
  s$analitica_rp_inst <- .pipeline_scope_inst()
  s$analitica_fuente <- .analitica_source_cache_key(sid, "originales")
  invalidated <- .invalidate_processing_state(s, "a")
  cache_survived <- !is.null(invalidated$analitica_rp_data) ||
    !is.null(invalidated$analitica_rp_inst)
  fuente_survived <- !is.null(invalidated$analitica_fuente)
  .session_env[[sid]] <- invalidated

  loaded <- .load_rp_data(sid)

  expect_identical(
    list(
      loaded_marker = as.character(loaded$rp_data$source_marker),
      cache_survived = cache_survived,
      fuente_survived = fuente_survived
    ),
    list(
      loaded_marker = "original_a",
      cache_survived = FALSE,
      fuente_survived = FALSE
    )
  )
})

test_that("cfg efectiva decide la fuente sobre el scope de la hermana activa", {
  skip_if_not_installed("openxlsx")

  sid <- .pipeline_scope_siblings_fixture()
  on.exit(session_delete(sid), add = TRUE)
  cfg <- session_get(sid)$analitica_config

  prepared <- .analitica_prepare_context(sid, cfg)
  effective_cfg <- .analitica_cfg_with_effective_source(sid, cfg)

  expect_identical(
    list(
      prepare_source = prepared$fuente,
      cfg_helper_source = effective_cfg$fuente_preferida,
      scoped_bases = names(prepared$data_sources)
    ),
    list(
      prepare_source = "adaptados",
      cfg_helper_source = "adaptados",
      scoped_bases = "a"
    )
  )
})

test_that("Validacion Explorar sin base explicita usa la base activa", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  estudio_add_base(
    sid, "a", "xls-a", "data-a", "xlsx",
    data.frame(source_marker = "a"), .pipeline_scope_inst()
  )
  estudio_add_base(
    sid, "b", "xls-b", "data-b", "xlsx",
    data.frame(source_marker = "b"), .pipeline_scope_inst()
  )
  estudio_active_base_set(sid, "b")

  resolved <- .resolve_explorar_data(sid, base_nombre = NULL, fuente = "raw")

  expect_identical(
    list(
      effective_base = resolved$effective_base,
      marker = as.character(resolved$data$source_marker)
    ),
    list(effective_base = "b", marker = "b")
  )
})

test_that("invalidar una base limpia su pipeline, preserva su catálogo de codificación y no toca a su hermana", {
  # `marker` representa una DEFINICIÓN del catálogo de codificación (grupos_recod,
  # familias, marcadas…): trabajo del usuario que se PRESERVA al invalidar. Solo
  # el estado aplicado/cache (aplicado/inst/data) se limpia. Ver
  # .codif_strip_applied_state (fix del borrado de codificación al aplicar en
  # multibase).
  state <- list(
    estudio = list(bases = list(
      a = list(validacion = list(plan_result = data.frame(rule = "a"))),
      b = list(validacion = list(plan_result = data.frame(rule = "b")))
    )),
    codif_por_base = list(
      a = list(aplicado = TRUE, marker = "codif-a"),
      b = list(aplicado = TRUE, marker = "codif-b")
    ),
    analitica_rp_data_sources = list(
      a = data.frame(marker = "cache-a"),
      b = data.frame(marker = "cache-b")
    ),
    analitica_rp_inst_sources = list(
      a = list(marker = "inst-a"),
      b = list(marker = "inst-b")
    ),
    analitica_status_por_base = list(
      a = list(analitica_prep_ok = TRUE, analitica_frecuencias_ok = TRUE),
      b = list(analitica_prep_ok = TRUE, analitica_frecuencias_ok = TRUE)
    )
  )

  invalidated <- .invalidate_processing_state(state, "a")

  expect_identical(
    list(
      a_limpia = c(
        codif_definicion = identical(invalidated$codif_por_base$a$marker, "codif-a"),
        codif_aplicado = is.null(invalidated$codif_por_base$a$aplicado),
        data_cache = is.null(invalidated$analitica_rp_data_sources$a),
        inst_cache = is.null(invalidated$analitica_rp_inst_sources$a),
        status = is.null(invalidated$analitica_status_por_base$a),
        validacion = is.null(invalidated$estudio$bases$a$validacion$plan_result)
      ),
      b_preservada = c(
        codif = identical(invalidated$codif_por_base$b, state$codif_por_base$b),
        data_cache = identical(
          invalidated$analitica_rp_data_sources$b,
          state$analitica_rp_data_sources$b
        ),
        inst_cache = identical(
          invalidated$analitica_rp_inst_sources$b,
          state$analitica_rp_inst_sources$b
        ),
        status = identical(
          invalidated$analitica_status_por_base$b,
          state$analitica_status_por_base$b
        ),
        validacion = identical(
          invalidated$estudio$bases$b$validacion,
          state$estudio$bases$b$validacion
        )
      )
    ),
    list(
      a_limpia = c(
        codif_definicion = TRUE,
        codif_aplicado = TRUE,
        data_cache = TRUE,
        inst_cache = TRUE,
        status = TRUE,
        validacion = TRUE
      ),
      b_preservada = c(
        codif = TRUE,
        data_cache = TRUE,
        inst_cache = TRUE,
        status = TRUE,
        validacion = TRUE
      )
    )
  )
})
