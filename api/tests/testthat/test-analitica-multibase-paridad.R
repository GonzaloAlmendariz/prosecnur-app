.paridad_write_xlsform <- function(path, survey, choices) {
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(wb, "survey", survey)
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(wb, "choices", choices)
  openxlsx::addWorksheet(wb, "settings")
  openxlsx::writeData(wb, "settings", data.frame(form_title = "Paridad", stringsAsFactors = FALSE))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.paridad_write_data <- function(path, data) {
  openxlsx::write.xlsx(list(data = data), file = path, overwrite = TRUE)
}

.paridad_upload <- function(sid, path, kind, name = basename(path)) {
  save_upload(sid, kind, name, readBin(path, "raw", n = file.info(path)$size))
}

.paridad_make_session <- function() {
  sid <- session_create()
  dir <- tempfile("paridad_multibase_")
  dir.create(dir, recursive = TRUE)

  survey_orig <- data.frame(
    type = c("select_one origen_list", "select_one cat_list", "select_multiple sm_list", "select_one acuerdo"),
    name = c("origen", "p_cat", "p_sm", "p_eval"),
    label = c("Origen", "Pregunta categoria", "Pregunta multiple", "Evaluacion"),
    list_name = c("origen_list", "cat_list", "sm_list", "acuerdo"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices_orig <- data.frame(
    list_name = c(
      "origen_list", "origen_list",
      "cat_list", "cat_list",
      "sm_list", "sm_list",
      "acuerdo", "acuerdo", "acuerdo"
    ),
    name = c("A", "B", "a", "b", "x", "y", "1", "2", "3"),
    label = c("A", "B", "Categoria A", "Categoria B", "X", "Y", "Bajo", "Medio", "Alto"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data_orig <- data.frame(
    origen = c("A", "A", "B", "B"),
    p_cat = c("a", "b", "a", "b"),
    p_sm = c("x y", "x", "y", "x y"),
    p_eval = c("1", "2", "3", "2"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  survey_cod <- rbind(
    survey_orig,
    data.frame(
      type = "select_one cat_recod_list",
      name = "p_cat_recod",
      label = "Pregunta categoria recodificada",
      list_name = "cat_recod_list",
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  choices_cod <- rbind(
    choices_orig,
    data.frame(
      list_name = "cat_recod_list",
      name = c("a", "b", "c"),
      label = c("Categoria A", "Categoria B", "Categoria C"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  data_cod <- data_orig
  data_cod$p_cat_recod <- c("a", "c", "a", "c")

  xls_orig <- file.path(dir, "paridad_original_form.xlsx")
  dat_orig <- file.path(dir, "paridad_original_data.xlsx")
  xls_cod <- file.path(dir, "paridad_codificada_form.xlsx")
  dat_cod <- file.path(dir, "paridad_codificada_data.xlsx")
  .paridad_write_xlsform(xls_orig, survey_orig, choices_orig)
  .paridad_write_data(dat_orig, data_orig)
  .paridad_write_xlsform(xls_cod, survey_cod, choices_cod)
  .paridad_write_data(dat_cod, data_cod)

  xorig <- .paridad_upload(sid, xls_orig, "xlsform")
  dorig <- .paridad_upload(sid, dat_orig, "data")
  xcod <- .paridad_upload(sid, xls_cod, "xlsform")
  dcod <- .paridad_upload(sid, dat_cod, "data")

  s <- session_get(sid)
  s$files[[xcod$file_id]]$kind <- "instrumento_adaptado"
  s$files[[dcod$file_id]]$kind <- "data_adaptada"
  .session_env[[sid]] <- s

  inst_cod <- reporte_instrumento(xcod$path)
  rp_cod <- reporte_data(data_cod, instrumento = inst_cod)
  estudio_add_base(
    sid,
    nombre = "base_integrada",
    xlsform_file_id = xcod$file_id,
    data_file_id = dcod$file_id,
    data_ext = "xlsx",
    rp_data = rp_cod,
    rp_inst = inst_cod,
    n_filas = nrow(data_cod),
    n_columnas = ncol(data_cod)
  )

  s <- session_get(sid)
  s$estudio$bases$base_integrada$original_xlsform_file_id <- xorig$file_id
  s$estudio$bases$base_integrada$original_data_file_id <- dorig$file_id
  s$estudio$bases$base_integrada$multi_integrated <- list(
    version = 1L,
    origin_key_name = "origen",
    origins = list(
      list(id = "a", key_value = "A", label = "A"),
      list(id = "b", key_value = "B", label = "B")
    )
  )
  s$codif_aplicado <- TRUE
  s$codif_inst_adaptado_fid <- xcod$file_id
  s$codif_data_adaptada_fid <- dcod$file_id
  s$analitica_config <- .analitica_default_config()
  s$analitica_config$fuente_preferida <- "adaptados"
  .session_env[[sid]] <- s

  list(sid = sid, dir = dir, data_cod = data_cod)
}

.paridad_use_fuente <- function(sid, fuente) {
  s <- session_get(sid)
  cfg <- s$analitica_config %||% .analitica_default_config()
  cfg$fuente_preferida <- fuente
  s$analitica_config <- cfg
  s$analitica_prep_ok <- FALSE
  s$analitica_rp_data <- NULL
  s$analitica_rp_inst <- NULL
  s$analitica_rp_data_sources <- list()
  s$analitica_rp_inst_sources <- list()
  s$analitica_multibase_available <- FALSE
  .session_env[[sid]] <- s
  invisible(cfg)
}

.paridad_source_workbook <- function(rp_data, rp_inst, path) {
  survey_names <- as.character((rp_inst$survey %||% data.frame())$name %||% character(0))
  n <- max(length(names(rp_data)), length(survey_names))
  df <- data.frame(
    data_col = c(names(rp_data), rep(NA_character_, n - length(names(rp_data)))),
    survey_name = c(survey_names, rep(NA_character_, n - length(survey_names))),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  openxlsx::write.xlsx(list(source = df), path, overwrite = TRUE)
}

.paridad_workbook_text <- function(path, sheet = NULL) {
  if (is.null(sheet)) sheet <- openxlsx::getSheetNames(path)[1]
  paste(as.character(as.matrix(openxlsx::read.xlsx(path, sheet = sheet, colNames = FALSE))), collapse = " ")
}

.paridad_num <- function(x) {
  x_chr <- trimws(as.character(x))
  out <- suppressWarnings(as.numeric(x_chr))
  pct <- is.na(out) & grepl("%$", x_chr)
  if (any(pct)) out[pct] <- suppressWarnings(as.numeric(sub("%$", "", x_chr[pct]))) / 100
  out
}

.paridad_first_stats <- function(row) {
  nums <- .paridad_num(row[-1])
  nums <- nums[!is.na(nums)]
  c(n = nums[1] %||% NA_real_, pct = nums[2] %||% NA_real_)
}

.paridad_extract_stats <- function(path, sheet, label, rows) {
  mat <- as.matrix(openxlsx::read.xlsx(path, sheet = sheet, colNames = FALSE))
  first <- trimws(as.character(mat[, 1]))
  start <- which(first == label)[1]
  if (is.na(start)) stop("No se encontro la tabla: ", label)
  out <- lapply(rows, function(row_label) {
    idx <- start - 1L + which(first[start:nrow(mat)] == row_label)[1]
    if (is.na(idx)) return(c(n = NA_real_, pct = NA_real_))
    .paridad_first_stats(mat[idx, ])
  })
  names(out) <- rows
  do.call(rbind, out)
}

test_that("alternar Original y Codificada reconstruye reportes multibase sobre la fuente correcta", {
  skip_if_not_installed("openxlsx")

  ctx <- .paridad_make_session()
  sid <- ctx$sid
  on.exit(session_delete(sid), add = TRUE)

  expect <- list(
    originales = FALSE,
    adaptados = TRUE,
    originales = FALSE
  )

  for (fuente in names(expect)) {
    .paridad_use_fuente(sid, fuente)
    result <- run_report_multibase(
      sid = sid,
      base_filename = paste0("fuente_", fuente),
      ext = "xlsx",
      kind_single = "paridad_fuente",
      kind_multi = "paridad_fuente_zip",
      fn = function(rp_data, rp_inst, out_path) .paridad_source_workbook(rp_data, rp_inst, out_path)
    )
    text <- .paridad_workbook_text(result$bases[[1]]$path)
    if (isTRUE(expect[[fuente]])) {
      expect_true(grepl("p_cat_recod", text, fixed = TRUE))
    } else {
      expect_false(grepl("p_cat_recod", text, fixed = TRUE))
    }
  }
})

test_that("reportes fuera de tablas multibase consumen la fuente codificada integrada", {
  skip_if_not_installed("openxlsx")

  ctx <- .paridad_make_session()
  sid <- ctx$sid
  on.exit(session_delete(sid), add = TRUE)
  .paridad_use_fuente(sid, "adaptados")

  prep <- .analitica_prepare_and_cache(sid)
  expect_equal(prep$fuente, "adaptados")
  sources <- .load_rp_sources(sid)
  data <- sources$data_sources$base_integrada
  inst <- sources$inst_sources$base_integrada
  expect_true("p_cat_recod" %in% names(data))
  expect_true("p_cat_recod" %in% as.character(inst$survey$name))

  out_codebook <- tempfile(fileext = ".xlsx")
  reporte_codebook(data, path_xlsx = out_codebook)
  expect_true(grepl("p_cat_recod", .paridad_workbook_text(out_codebook), fixed = TRUE))

  out_freq <- tempfile(fileext = ".xlsx")
  reporte_frecuencias(
    data = data,
    instrumento = inst,
    secciones = list(General = c("p_cat_recod", "p_sm", "p_eval")),
    path_xlsx = out_freq,
    orden = "original",
    mostrar_todo = TRUE
  )
  freq_text <- .paridad_workbook_text(out_freq)
  expect_true(grepl("Pregunta categoria (Recodificada)", freq_text, fixed = TRUE))
  expect_true(grepl("Categoria C", freq_text, fixed = TRUE))

  out_cruces <- tempfile(fileext = ".xlsx")
  reporte_cruces(
    data = data,
    instrumento = inst,
    SECCIONES = list(General = "p_eval"),
    cruces = "p_cat_recod",
    path_xlsx = out_cruces,
    show_sig = FALSE,
    aplicar_semaforo = FALSE
  )
  expect_true(file.exists(out_cruces))
  expect_gt(file.info(out_cruces)$size, 0)

  metadata <- .bases_metadata_preview(data, inst)
  metadata_names <- vapply(metadata, function(x) as.character(x$name %||% ""), character(1))
  expect_true("p_cat_recod" %in% metadata_names)

  cfg <- .analitica_get_config(sid)
  data_export <- .analitica_export_source_files(sid, role = "data", cfg = cfg)
  inst_export <- .analitica_export_source_files(sid, role = "instrumento", cfg = cfg)
  expect_equal(data_export$fuente, "adaptados")
  expect_equal(inst_export$fuente, "adaptados")
  expect_equal(get_file(sid, data_export$file_id)$kind, "bases_data_codificada")
  expect_equal(get_file(sid, inst_export$file_id)$kind, "bases_instrumento_codificado")

  dim_cfg <- .dimensiones_default_config()
  dim_cfg$vars_recodificar <- list("p_eval")
  dim_cfg$subindices <- list(list(nombre = "calidad", etiqueta = "Calidad", vars = list("r100_p_eval")))
  dim_out <- .dimensiones_construir(data, inst, dim_cfg)
  expect_true("r100_p_eval" %in% dim_out$vars_r100)
  expect_true("sub_calidad" %in% dim_out$vars_sub)
})

test_that("golden unibase y multibase integrada coinciden en categoria, N y porcentaje", {
  skip_if_not_installed("openxlsx")

  ctx <- .paridad_make_session()
  sid <- ctx$sid
  on.exit(session_delete(sid), add = TRUE)
  .paridad_use_fuente(sid, "adaptados")

  sources <- .load_rp_sources(sid)
  data <- sources$data_sources$base_integrada
  inst <- sources$inst_sources$base_integrada

  out_uni <- tempfile(fileext = ".xlsx")
  reporte_frecuencias(
    data = data,
    instrumento = inst,
    secciones = list(General = "p_cat_recod"),
    path_xlsx = out_uni,
    orden = "original",
    mostrar_todo = TRUE
  )

  cfg <- .analitica_default_config()
  cfg$frecuencias$orden <- "original"
  cfg$frecuencias$mostrar_todo <- TRUE
  cfg$multibase$global$incluir_porcentajes <- TRUE
  cfg$multibase$origenes$incluir_porcentajes <- TRUE
  meta <- list(multi_integrated = list(
    origin_key_name = "origen",
    origins = list(
      list(key_value = "A", label = "A"),
      list(key_value = "B", label = "B")
    )
  ))
  out_mb <- tempfile(fileext = ".xlsx")
  .analitica_multibase_export_data(data, inst, cfg = cfg, meta = meta, path_xlsx = out_mb)

  rows <- c("Categoria A", "Categoria B", "Categoria C", "Total")
  uni <- .paridad_extract_stats(
    out_uni,
    sheet = openxlsx::getSheetNames(out_uni)[1],
    label = "Pregunta categoria (Recodificada)",
    rows = rows
  )
  mb <- .paridad_extract_stats(
    out_mb,
    sheet = "Global",
    label = "Pregunta categoria (Recodificada)",
    rows = rows
  )

  expect_equal(unname(uni[, "n"]), c(2, 0, 2, 4), tolerance = 1e-8)
  expect_equal(unname(mb[, "n"]), unname(uni[, "n"]), tolerance = 1e-8)
  expect_equal(unname(mb[, "pct"]), unname(uni[, "pct"]), tolerance = 1e-8)
})

.paridad_make_codif_inst <- function(survey, choices) {
  survey <- as.data.frame(survey, stringsAsFactors = FALSE, check.names = FALSE)
  choices <- as.data.frame(choices, stringsAsFactors = FALSE, check.names = FALSE)
  if (!"q_order" %in% names(survey)) survey$q_order <- seq_len(nrow(survey))
  if (!"type_base" %in% names(survey)) survey$type_base <- sub("\\s.*$", "", as.character(survey$type))
  if (!"list_name" %in% names(survey)) {
    survey$list_name <- ifelse(
      grepl("^select_(one|multiple)\\b", survey$type),
      trimws(sub("^\\S+\\s+", "", as.character(survey$type))),
      NA_character_
    )
  }
  survey$list_norm <- tolower(gsub("[^a-z0-9_]", "_", gsub("\\s+", "_", as.character(survey$list_name))))
  if (!"label_spanish_es" %in% names(survey)) {
    survey$label_spanish_es <- if ("label::Spanish (ES)" %in% names(survey)) survey[["label::Spanish (ES)"]] else survey$name
  }
  if (!"list_norm" %in% names(choices)) {
    choices$list_norm <- tolower(gsub("[^a-z0-9_]", "_", gsub("\\s+", "_", as.character(choices$list_name))))
  }
  if (!"label_spanish_es" %in% names(choices)) {
    choices$label_spanish_es <- if ("label::Spanish (ES)" %in% names(choices)) choices[["label::Spanish (ES)"]] else choices$name
  }
  list(survey = survey, survey_raw = survey, choices = choices, choices_raw = choices)
}

.paridad_make_codif_dat <- function(df) {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  clean <- janitor::make_clean_names(names(df))
  list(raw = df, clean = stats::setNames(df, clean), name_map = tibble::tibble(clean = clean, original = names(df)))
}

.paridad_write_codif_inst <- function(inst, path) {
  openxlsx::write.xlsx(
    list(
      survey = inst$survey_raw,
      choices = inst$choices_raw,
      settings = data.frame(form_title = "Codificacion multibase", default_language = "es", stringsAsFactors = FALSE)
    ),
    file = path,
    overwrite = TRUE
  )
}

.paridad_set_modo_so <- function(path, values, sheet = "familias") {
  fam <- readxl::read_excel(path, sheet = sheet)
  fam_names <- janitor::make_clean_names(names(fam))
  col_modo <- match("modo_so", fam_names)
  col_parent <- match("parent", fam_names)
  wb <- openxlsx::loadWorkbook(path)
  for (nm in names(values)) {
    row_idx <- which(as.character(fam[[col_parent]]) == nm)[1]
    if (is.na(row_idx)) next
    openxlsx::writeData(wb, sheet, x = values[[nm]], startCol = col_modo, startRow = row_idx + 1L, colNames = FALSE)
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
}

.paridad_headers <- function(path, sheet) {
  readxl::read_excel(path, sheet = sheet, n_max = 2, col_names = FALSE)
}

.paridad_write_recode <- function(wb, path_tpl, sheet, target, values, aux_code = NULL, aux_label = NULL) {
  hdr <- .paridad_headers(path_tpl, sheet)
  col_target <- match(target, as.character(hdr[1, ]))
  expect_false(is.na(col_target), info = paste("Falta columna", target, "en", sheet))
  openxlsx::writeData(wb, sheet, x = values, startCol = col_target, startRow = 3, colNames = FALSE)
  if (!is.null(aux_code)) {
    col_code <- match("nuevo_codigo", as.character(hdr[1, ]))
    col_label <- match("nueva_etiqueta", as.character(hdr[1, ]))
    expect_false(is.na(col_code))
    expect_false(is.na(col_label))
    openxlsx::writeData(wb, sheet, x = aux_code, startCol = col_code, startRow = 3, colNames = FALSE)
    openxlsx::writeData(wb, sheet, x = aux_label, startCol = col_label, startRow = 3, colNames = FALSE)
  }
}

test_that("Fase 3 completa sobre multibase nueva produce columnas y etiquetas esperadas", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  inst <- .paridad_make_codif_inst(
    survey = data.frame(
      type = c("select_one lst_origen", "select_one lst_mx", "text", "select_one lst_pe", "text", "text", "integer"),
      name = c("origen", "p10_mexico", "p10_mexico_other", "p10_peru", "p10_peru_other", "p_text", "edad"),
      relevant = c(NA, "${origen} = 'mx'", "${p10_mexico} = '96'", "${origen} = 'pe'", "${p10_peru} = '96'", NA, NA),
      `label::Spanish (ES)` = c("Origen", "Empresa Mexico", "Otro Mexico", "Empresa Peru", "Otro Peru", "Texto abierto", "Edad"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_origen", "lst_origen", "lst_mx", "lst_mx", "lst_pe", "lst_pe"),
      name = c("mx", "pe", "1", "96", "1", "96"),
      `label::Spanish (ES)` = c("Mexico", "Peru", "Empresa A", "Otro", "Empresa B", "Otro"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- .paridad_make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2", "u3"),
    `_index` = c(1, 2, 3),
    origen = c("mx", "pe", "mx"),
    p10_mexico = c("96", NA, "1"),
    p10_mexico_other = c("Banco nuevo", NA, NA),
    p10_peru = c(NA, "96", NA),
    p10_peru_other = c(NA, "Ministerio nuevo", NA),
    p_text = c("abierta uno", "abierta dos", ""),
    edad = c(22, 44, 29),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))

  path_inst <- tempfile(fileext = ".xlsx")
  path_data <- tempfile(fileext = ".xlsx")
  path_familias <- tempfile(fileext = ".xlsx")
  path_tpl <- tempfile(fileext = ".xlsx")
  path_out_data <- tempfile(fileext = ".xlsx")
  path_out_inst <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(path_inst, path_data, path_familias, path_tpl, path_out_data, path_out_inst)), add = TRUE)

  .paridad_write_codif_inst(inst, path_inst)
  openxlsx::write.xlsx(list(data = dat$raw), file = path_data, overwrite = TRUE)
  escribir_plantilla_familias(inst, dat, path = path_familias)
  .paridad_set_modo_so(path_familias, c(p10_mexico = "padre", p10_peru = "hijo"))
  fam <- leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  plantilla <- construir_plantilla_desde_familias(inst, dat, fam)
  exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  wb <- openxlsx::loadWorkbook(path_tpl)
  .paridad_write_recode(
    wb, path_tpl, "p10_mexico", "p10_mexico_recod",
    values = c("3", NA, NA),
    aux_code = c("3", NA, NA),
    aux_label = c("Empresa Mexico nueva", NA, NA)
  )
  .paridad_write_recode(
    wb, path_tpl, "p10_peru", "p10_peru_other_recod",
    values = c(NA, "7", NA),
    aux_code = c(NA, "7", NA),
    aux_label = c(NA, "Empresa Peru nueva", NA)
  )
  .paridad_write_recode(
    wb, path_tpl, "p_text", "p_text_recod",
    values = c("t1", "t2", NA),
    aux_code = c("t1", "t2", NA),
    aux_label = c("Texto tipo 1", "Texto tipo 2", NA)
  )
  .paridad_write_recode(
    wb, path_tpl, "edad", "edad_recod",
    values = c("joven", "adulto", "joven"),
    aux_code = c("joven", "adulto", NA),
    aux_label = c("Joven", "Adulto", NA)
  )
  openxlsx::saveWorkbook(wb, path_tpl, overwrite = TRUE)

  ppra_adaptar_data(
    path_instrumento = path_inst,
    path_datos = path_data,
    path_plantilla = path_tpl,
    so_parent_vars = "p10_mexico",
    so_child_vars = "p10_peru",
    text_vars = "p_text",
    int_vars = "edad",
    path_familias = path_familias,
    out_path = path_out_data
  )
  out <- readxl::read_excel(path_out_data, sheet = "data")
  expect_true(all(c("p10_mexico_recod", "p10_peru_other_recod", "p_text_recod", "edad_recod") %in% names(out)))
  expect_identical(as.character(out$p10_mexico_recod[[1]]), "3")
  expect_identical(as.character(out$p10_peru_other_recod[[2]]), "7")
  expect_identical(as.character(out$p_text_recod[[1]]), "t1")
  expect_identical(as.character(out$edad_recod[[2]]), "adulto")

  ppra_adaptar_instrumento(
    path_instrumento_in = path_inst,
    path_data_adaptada = path_out_data,
    path_instrumento_out = path_out_inst,
    path_plantilla = path_tpl,
    so_parent_vars = "p10_mexico",
    so_child_vars = "p10_peru",
    text_vars = "p_text",
    integer_vars = "edad"
  )
  survey_out <- readxl::read_excel(path_out_inst, sheet = "survey")
  choices_out <- readxl::read_excel(path_out_inst, sheet = "choices")
  label_col <- names(choices_out)[tolower(names(choices_out)) %in% c("label::spanish (es)", "label_spanish_es", "label")][1]

  expect_true(all(c("p10_mexico_recod", "p10_peru_other_recod", "p_text_recod", "edad_recod") %in% survey_out$name))
  expect_true("Empresa Mexico nueva" %in% as.character(choices_out[[label_col]]))
  expect_true("Empresa Peru nueva" %in% as.character(choices_out[[label_col]]))
  expect_true("Texto tipo 1" %in% as.character(choices_out[[label_col]]))
  expect_true("Adulto" %in% as.character(choices_out[[label_col]]))

  roles <- .amb_recod_roles_from_draft(list(rows = list(
    list(tipo = "select_one", modo_so = "padre", parent = "p10_mexico", parent_col = "p10_mexico", text_col = "p10_mexico_other"),
    list(tipo = "select_one", modo_so = "hijo", parent = "p10_peru", parent_col = "p10_peru", text_col = "p10_peru_other"),
    list(tipo = "text", parent = "p_text", parent_col = "p_text", text_col = ""),
    list(tipo = "integer", parent = "edad", parent_col = "edad", text_col = "")
  )))
  expect_equal(roles$target, c("p10_mexico_recod", "p10_peru_other_recod", "p_text_recod", "edad_recod"))
})
