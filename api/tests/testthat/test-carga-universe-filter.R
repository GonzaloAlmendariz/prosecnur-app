.cuf_test_write_xlsx <- function(df, sheet = "datos") {
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, sheet)
  openxlsx::writeData(wb, sheet, df)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.cuf_test_inst <- function(vars) {
  survey <- data.frame(
    type = rep("text", length(vars)), name = vars, label = vars,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", data.frame(list_name = character(), name = character(), label = character()))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  path
}

.cuf_test_session <- function(with_child = TRUE, submission_links = FALSE) {
  sid <- session_create()
  parent <- data.frame(
    `_index` = c("p1", "p2", "p3", "p4"),
    testreal = c("real", "test", NA, "otro"), value = 1:4,
    stringsAsFactors = FALSE, check.names = FALSE
  )
  if (isTRUE(submission_links)) names(parent)[names(parent) == "_index"] <- "_id"
  p_data_path <- .cuf_test_write_xlsx(parent)
  p_inst_path <- .cuf_test_inst(c("testreal", "value"))
  p_data <- save_upload(sid, "data", "parent.xlsx", readBin(p_data_path, "raw", file.info(p_data_path)$size))
  p_inst <- save_upload(sid, "xlsform", "parent_form.xlsx", readBin(p_inst_path, "raw", file.info(p_inst_path)$size))
  rp_inst <- reporte_instrumento(p_inst$path)
  estudio_ensure(sid)
  estudio_add_base(sid, "parent", p_inst$file_id, p_data$file_id, "xlsx",
                   reporte_data(parent, instrumento = rp_inst), rp_inst,
                   nrow(parent), ncol(parent))

  child_source <- NULL
  if (isTRUE(with_child)) {
    child <- if (isTRUE(submission_links)) {
      data.frame(
        `_index` = 1:4, `_submission__id` = c("p1", "p1", "p2", "p3"),
        item = letters[1:4], stringsAsFactors = FALSE, check.names = FALSE
      )
    } else {
      data.frame(
        `_index` = 1:4, `_parent_index` = c("p1", "p1", "p2", "p3"),
        item = letters[1:4], stringsAsFactors = FALSE, check.names = FALSE
      )
    }
    c_data_path <- .cuf_test_write_xlsx(child)
    c_inst_path <- .cuf_test_inst("item")
    c_data <- save_upload(sid, "data", "child.xlsx", readBin(c_data_path, "raw", file.info(c_data_path)$size))
    c_inst <- save_upload(sid, "xlsform", "child_form.xlsx", readBin(c_inst_path, "raw", file.info(c_inst_path)$size))
    child_inst <- reporte_instrumento(c_inst$path)
    estudio_add_base(sid, "rep", c_inst$file_id, c_data$file_id, "xlsx",
                     reporte_data(child, instrumento = child_inst), child_inst,
                     nrow(child), ncol(child), extra_meta = list(
                       parent_base = "parent", repeat_group = "rep",
                       link_key = if (isTRUE(submission_links)) "_submission__id" else "_parent_index",
                       parent_index_key = if (isTRUE(submission_links)) "_id" else "_index"
                     ))
    child_source <- c_data$file_id
  }
  list(sid = sid, parent_source = p_data$file_id, child_source = child_source)
}

.cuf_enabled <- function() list(
  version = 1L, enabled = TRUE, variable = "testreal",
  real_values = list("real"), test_values = list("test"),
  missing_policy = "exclude", unassigned_policy = "unclassified"
)

test_that("config exige valores disjuntos y preview produce resumen disjunto", {
  expect_error(normalize_carga_universe_filter(list(
    enabled = TRUE, variable = "x", real_values = list("real"), test_values = list("real")
  )), class = "api_error")
  setup <- .cuf_test_session(FALSE)
  on.exit(session_delete(setup$sid), add = TRUE)
  preview <- carga_universe_filter_preview(setup$sid, "parent", .cuf_enabled())
  expect_equal(preview$summary, list(
    total = 4L, included = 1L, excluded_test = 1L, excluded_unclassified = 2L
  ))
  expect_error(carga_universe_filter_preview(setup$sid, "parent", within(.cuf_enabled(), {
    real_values <- list("inexistente")
  })), class = "api_error")
})

test_that("preview admite seleccion real vacia para descubrir valores", {
  setup <- .cuf_test_session(FALSE)
  on.exit(session_delete(setup$sid), add = TRUE)
  cfg <- .cuf_enabled()
  cfg$real_values <- list()

  preview <- carga_universe_filter_preview(setup$sid, "parent", cfg)
  expect_equal(preview$summary, list(
    total = 4L, included = 0L, excluded_test = 1L, excluded_unclassified = 3L
  ))
  expect_true(length(preview$variable_inventory) > 0L)
  expect_equal(vapply(preview$observed_values, `[[`, character(1), "value"),
               c("", "otro", "real", "test"))
  expect_error(carga_universe_filter_apply(setup$sid, "parent", cfg), class = "api_error")
})

test_that("apply materializa padre+hija, conserva fuentes y disable restaura", {
  setup <- .cuf_test_session(TRUE)
  on.exit(session_delete(setup$sid), add = TRUE)
  applied <- carga_universe_filter_apply(setup$sid, "parent", .cuf_enabled())
  expect_true(applied$config$enabled)
  expect_equal(applied$summary$included, 1L)

  s <- session_get(setup$sid)
  parent <- s$estudio$bases$parent
  child <- s$estudio$bases$rep
  expect_equal(parent$universe_filter$source_data_file_id, setup$parent_source)
  expect_false(identical(parent$data_file_id, setup$parent_source))
  expect_equal(child$universe_filter$mode, "inherited")
  expect_equal(child$universe_filter$inherited_from, "parent")
  child_get <- carga_universe_filter_get(setup$sid, "rep")
  expect_true(child_get$read_only)
  expect_equal(child_get$config$real_values, list("real"))
  expect_equal(nrow(.cuf_file_df(s, parent$data_file_id)$data), 1L)
  expect_equal(nrow(.cuf_file_df(s, child$data_file_id)$data), 2L)
  expect_equal(nrow(.cuf_file_df(s, setup$parent_source)$data), 4L)
  expect_equal(nrow(.cuf_file_df(s, setup$child_source)$data), 4L)

  disabled <- .cuf_enabled()
  disabled$enabled <- FALSE
  carga_universe_filter_apply(setup$sid, "parent", disabled)
  restored <- session_get(setup$sid)
  expect_equal(restored$estudio$bases$parent$data_file_id, setup$parent_source)
  expect_equal(restored$estudio$bases$rep$data_file_id, setup$child_source)
  expect_false(restored$estudio$bases$parent$universe_filter$enabled)
})

test_that("repeat enlazado por submission id hereda el universo", {
  setup <- .cuf_test_session(TRUE, submission_links = TRUE)
  on.exit(session_delete(setup$sid), add = TRUE)
  carga_universe_filter_apply(setup$sid, "parent", .cuf_enabled())
  s <- session_get(setup$sid)
  expect_equal(nrow(.cuf_file_df(s, s$estudio$bases$rep$data_file_id)$data), 2L)
})

test_that("refresh reaplica el filtro sobre las nuevas fuentes padre y repeat", {
  setup <- .cuf_test_session(TRUE)
  on.exit(session_delete(setup$sid), add = TRUE)
  carga_universe_filter_apply(setup$sid, "parent", .cuf_enabled())

  parent_new <- data.frame(
    `_index` = c("n1", "n2", "n3"), testreal = c("real", "real", "test"),
    value = 1:3, stringsAsFactors = FALSE, check.names = FALSE
  )
  child_new <- data.frame(
    `_index` = 1:4, `_parent_index` = c("n1", "n2", "n3", "n3"),
    item = letters[1:4], stringsAsFactors = FALSE, check.names = FALSE
  )
  p_path <- .cuf_test_write_xlsx(parent_new)
  c_path <- .cuf_test_write_xlsx(child_new)
  p_meta <- save_upload(setup$sid, "data", "parent_refresh.xlsx",
                        readBin(p_path, "raw", file.info(p_path)$size))
  c_meta <- save_upload(setup$sid, "data", "child_refresh.xlsx",
                        readBin(c_path, "raw", file.info(c_path)$size))
  s <- session_get(setup$sid)
  s$estudio$bases$parent$data_file_id <- p_meta$file_id
  s$estudio$bases$rep$data_file_id <- c_meta$file_id
  .session_env[[setup$sid]] <- s

  expect_true(carga_universe_filter_reapply(setup$sid, "parent", p_meta$file_id))
  refreshed <- session_get(setup$sid)
  p_uf <- refreshed$estudio$bases$parent$universe_filter
  c_uf <- refreshed$estudio$bases$rep$universe_filter
  expect_equal(p_uf$source_data_file_id, p_meta$file_id)
  expect_equal(c_uf$source_data_file_id, c_meta$file_id)
  expect_equal(nrow(.cuf_file_df(refreshed, p_uf$effective_data_file_id)$data), 2L)
  expect_equal(nrow(.cuf_file_df(refreshed, c_uf$effective_data_file_id)$data), 2L)
})

test_that("repeat sin contrato bloquea de forma fail-closed", {
  setup <- .cuf_test_session(TRUE)
  on.exit(session_delete(setup$sid), add = TRUE)
  s <- session_get(setup$sid)
  s$estudio$bases$rep$link_key <- "ausente"
  .session_env[[setup$sid]] <- s
  before <- s$estudio$bases$parent$data_file_id
  expect_error(carga_universe_filter_apply(setup$sid, "parent", .cuf_enabled()), class = "api_error")
  expect_equal(session_get(setup$sid)$estudio$bases$parent$data_file_id, before)
})

test_that("el filtro queda aislado por base", {
  setup <- .cuf_test_session(FALSE)
  on.exit(session_delete(setup$sid), add = TRUE)
  s <- session_get(setup$sid)
  parent <- s$estudio$bases$parent
  estudio_add_base(
    setup$sid, "other", parent$xlsform_file_id, parent$data_file_id, parent$data_ext,
    s$rp_data_sources$parent, s$rp_inst_sources$parent, parent$n_filas, parent$n_columnas
  )
  other_before <- session_get(setup$sid)$estudio$bases$other$data_file_id

  carga_universe_filter_apply(setup$sid, "parent", .cuf_enabled())
  after <- session_get(setup$sid)
  expect_equal(after$estudio$bases$other$data_file_id, other_before)
  expect_null(after$estudio$bases$other$universe_filter)
})

test_that("Codificacion y Analitica originales prefieren universo efectivo", {
  setup <- .cuf_test_session(FALSE)
  on.exit(session_delete(setup$sid), add = TRUE)
  carga_universe_filter_apply(setup$sid, "parent", .cuf_enabled())
  s <- session_get(setup$sid)
  s$estudio$bases$parent$original_data_file_id <- setup$parent_source
  s$codif_source_active <- "parent"
  .session_env[[setup$sid]] <- s
  effective <- s$estudio$bases$parent$universe_filter$effective_data_file_id
  expect_equal(.codif_base_file_meta(setup$sid, "data", prefer_original = TRUE)$file_id, effective)
  pair <- .analitica_pair_for_base(session_get(setup$sid),
                                   session_get(setup$sid)$estudio$bases$parent,
                                   "originales", "parent")
  expect_equal(pair$data$file_id, effective)
})

test_that("universe_filter source+effective hacen round-trip .pulso", {
  setup <- .cuf_test_session(FALSE)
  on.exit(session_delete(setup$sid), add = TRUE)
  carga_universe_filter_apply(setup$sid, "parent", .cuf_enabled())
  path <- tempfile(fileext = ".pulso")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  build_pulso(setup$sid, path, "Universe filter")
  loaded <- load_pulso(path)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  s <- session_get(loaded$session_id)
  uf <- s$estudio$bases$parent$universe_filter
  expect_true(uf$enabled)
  expect_equal(uf$audit$included, 1L)
  expect_true(all(c(uf$source_data_file_id, uf$effective_data_file_id) %in% names(s$files)))
  expect_equal(nrow(.cuf_file_df(s, uf$source_data_file_id)$data), 4L)
  expect_equal(nrow(.cuf_file_df(s, uf$effective_data_file_id)$data), 1L)
})

test_that("preparacion corrige registros, filtra pruebas y excluye rechazos por fila", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  parent <- data.frame(
    `_index` = sprintf("p%03d", seq_len(430)),
    Pulso_code = sprintf("PDM%04d", seq_len(430)),
    testreal = rep("real", 430),
    Consent = rep("Yes", 430),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  parent$testreal[1:3] <- "test"
  parent$Pulso_code[1:3] <- c("123456", "PDM1114", "PDM1153")
  parent$Consent[4:6] <- "No"
  # El mismo codigo puede tener una respuesta aceptada: la exclusion se aplica
  # a la fila por Consent, no a todas las filas que compartan Pulso_code.
  parent$Pulso_code[c(4, 7)] <- "PDM1429"

  child <- data.frame(
    `_index` = seq_len(668),
    `_parent_index` = c("p001", rep("p007", 667)),
    item = sprintf("r%03d", seq_len(668)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  parent_path <- .cuf_test_write_xlsx(parent)
  parent_inst_path <- .cuf_test_inst(c("Pulso_code", "testreal", "Consent"))
  parent_file <- save_upload(
    sid, "data", "parent_430.xlsx",
    readBin(parent_path, "raw", file.info(parent_path)$size)
  )
  parent_inst_file <- save_upload(
    sid, "xlsform", "parent_form.xlsx",
    readBin(parent_inst_path, "raw", file.info(parent_inst_path)$size)
  )
  parent_inst <- reporte_instrumento(parent_inst_file$path)
  estudio_ensure(sid)
  estudio_add_base(
    sid, "parent", parent_inst_file$file_id, parent_file$file_id, "xlsx",
    reporte_data(parent, instrumento = parent_inst), parent_inst,
    nrow(parent), ncol(parent)
  )

  child_path <- .cuf_test_write_xlsx(child)
  child_inst_path <- .cuf_test_inst("item")
  child_file <- save_upload(
    sid, "data", "repeat_668.xlsx",
    readBin(child_path, "raw", file.info(child_path)$size)
  )
  child_inst_file <- save_upload(
    sid, "xlsform", "repeat_form.xlsx",
    readBin(child_inst_path, "raw", file.info(child_inst_path)$size)
  )
  child_inst <- reporte_instrumento(child_inst_file$path)
  estudio_add_base(
    sid, "repeat", child_inst_file$file_id, child_file$file_id, "xlsx",
    reporte_data(child, instrumento = child_inst), child_inst,
    nrow(child), ncol(child), extra_meta = list(
      parent_base = "parent", repeat_group = "repeat",
      link_key = "_parent_index", parent_index_key = "_index"
    )
  )

  config <- c(.cuf_enabled(), list(
    corrections = list(list(
      id = "tests_confirmados_como_reales",
      key_variable = "Pulso_code",
      key_values = list("PDM1114", "PDM1153"),
      variable = "testreal",
      from_values = list("test"),
      to_value = "real",
      reason = "Entrevistas reales registradas inicialmente como prueba"
    )),
    exclusion_rules = list(list(
      id = "rechazo_consentimiento",
      variable = "Consent",
      values = list("No"),
      reason = "La persona rechazo participar"
    ))
  ))

  applied <- carga_universe_filter_apply(sid, "parent", config)
  expect_equal(applied$summary$total, 430L)
  expect_equal(applied$summary$corrected, 2L)
  expect_equal(applied$summary$correction_changes, 2L)
  expect_equal(applied$summary$excluded_test, 1L)
  expect_equal(applied$summary$excluded_rules, 3L)
  expect_equal(applied$summary$included, 426L)
  expect_equal(applied$summary$corrections[[1]]$affected, 2L)
  expect_equal(applied$summary$exclusion_rules[[1]]$excluded, 3L)

  s <- session_get(sid)
  parent_effective <- .cuf_file_df(s, s$estudio$bases$parent$data_file_id)$data
  repeat_effective <- .cuf_file_df(s, s$estudio$bases[["repeat"]]$data_file_id)$data
  parent_source <- .cuf_file_df(s, parent_file$file_id)$data
  expect_equal(nrow(parent_effective), 426L)
  expect_equal(nrow(repeat_effective), 667L)
  expect_equal(nrow(parent_source), 430L)
  expect_equal(parent_source$testreal[parent_source$Pulso_code == "PDM1114"], "test")
  expect_equal(parent_effective$testreal[parent_effective$Pulso_code == "PDM1114"], "real")
  expect_equal(sum(parent_effective$Pulso_code == "PDM1429"), 1L)
  expect_equal(parent_effective$Consent[parent_effective$Pulso_code == "PDM1429"], "Yes")

  exposed <- carga_universe_filter_get(sid, "parent")
  expect_equal(
    exposed$config$corrections[[1]]$key_values,
    list("PDM1114", "PDM1153")
  )
  expect_equal(exposed$config$exclusion_rules[[1]]$values, list("No"))

  project_path <- tempfile(fileext = ".pulso")
  on.exit(unlink(project_path, force = TRUE), add = TRUE)
  build_pulso(sid, project_path, "Preparacion persistente")
  loaded <- load_pulso(project_path)
  on.exit(session_delete(loaded$session_id), add = TRUE)
  loaded_session <- session_get(loaded$session_id)
  loaded_filter <- loaded_session$estudio$bases$parent$universe_filter
  expect_equal(loaded_filter$audit$corrected, 2L)
  expect_equal(loaded_filter$audit$excluded_rules, 3L)
  expect_equal(loaded_filter$corrections[[1]]$to_value, "real")
  expect_equal(
    nrow(.cuf_file_df(loaded_session, loaded_filter$effective_data_file_id)$data),
    426L
  )
  repeat_filter <- loaded_session$estudio$bases[["repeat"]]$universe_filter
  expect_equal(
    nrow(.cuf_file_df(loaded_session, repeat_filter$effective_data_file_id)$data),
    667L
  )
})
