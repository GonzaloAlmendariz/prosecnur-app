test_that("tablas multibase generan hoja global y hojas por llave", {
  skip_if_not_installed("openxlsx")

  write_xls <- function(path, survey, choices) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "survey")
    openxlsx::writeData(wb, "survey", survey)
    openxlsx::addWorksheet(wb, "choices")
    openxlsx::writeData(wb, "choices", choices)
    openxlsx::addWorksheet(wb, "settings")
    openxlsx::writeData(wb, "settings", data.frame(form_title = "test", stringsAsFactors = FALSE))
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  write_data <- function(path, df) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "datos")
    openxlsx::writeData(wb, "datos", df)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  upload_path <- function(sid, path, kind, name = basename(path)) {
    save_upload(sid, kind, name, readBin(path, "raw", n = file.info(path)$size))
  }

  sid <- session_create()
  dir <- tempdir()
  xls <- file.path(dir, "analitica_multibase_form.xlsx")
  dat <- file.path(dir, "analitica_multibase_data.xlsx")

  survey <- data.frame(
    type = c("text", "begin_group", "select_one yesno", "select_one empresa_mx", "text", "select_one empresa_pe", "text", "end_group"),
    name = c("pais", "sec", "p1", "p10_mexico", "p10_mexico_other", "p10_peru", "p10_peru_other", NA),
    label = c("pais", "Seccion A", "Pregunta comun final", "Empresa Mexico", "Otro", "Empresa Peru", "Otro", NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("yesno", "yesno", "empresa_mx", "empresa_mx", "empresa_pe", "empresa_pe"),
    name = c("1", "2", "1", "2", "1", "2"),
    label = c("Si", "No", "A", "B", "C", "D"),
    stringsAsFactors = FALSE
  )
  data <- data.frame(
    pais = c("Mexico", "Mexico", "Peru"),
    p1 = c("1", "2", "1"),
    p10_mexico = c("1", "2", NA),
    p10_mexico_other = c(NA, NA, NA),
    p10_peru = c(NA, NA, "2"),
    p10_peru_other = c(NA, NA, NA),
    stringsAsFactors = FALSE
  )
  write_xls(xls, survey, choices)
  write_data(dat, data)
  xmeta <- upload_path(sid, xls, "xlsform")
  dmeta <- upload_path(sid, dat, "data")
  inst <- reporte_instrumento(xmeta$path)
  rp_data <- reporte_data(data, instrumento = inst)

  estudio_add_base(
    sid,
    nombre = "base_integrada_test",
    xlsform_file_id = xmeta$file_id,
    data_file_id = dmeta$file_id,
    data_ext = "xlsx",
    rp_data = rp_data,
    rp_inst = inst,
    n_filas = 3L,
    n_columnas = ncol(data)
  )
  s <- session_get(sid)
  s$estudio$bases$base_integrada_test$multi_integrated <- list(
    version = 1L,
    origin_key_name = "pais",
    origins = list(
      list(id = "mx", key_value = "Mexico", label = "Mexico"),
      list(id = "pe", key_value = "Peru", label = "Peru")
    ),
    variant_map = list(
      list(origin_id = "mx", origin_key = "Mexico", from = "p10", to = "p10_mexico"),
      list(origin_id = "pe", origin_key = "Peru", from = "p10", to = "p10_peru")
    ),
    label_overrides_by_key = list(
      Mexico = list(p1 = "Pregunta en Mexico"),
      Peru = list(p1 = "Pregunta en Peru")
    )
  )
  .session_env[[sid]] <- s

  cfg <- .analitica_default_config()
  cfg$multibase$global$incluir_porcentajes <- FALSE
  cfg$multibase$origenes$incluir_porcentajes <- FALSE
  cfg$frecuencias$orden <- "original"

  info <- .analitica_multibase_info(sid, cfg)
  expect_true(info$available)
  expect_equal(info$origin_key_name, "pais")
  sources <- .load_rp_sources(sid)
  key_row <- sources$inst_sources$base_integrada_test$survey[
    as.character(sources$inst_sources$base_integrada_test$survey$name) == "pais",
    ,
    drop = FALSE
  ]
  expect_equal(key_row$type[[1]], "select_one")
  expect_equal(key_row$list_name[[1]], "pais_opciones")
  expect_equal(
    unname(sources$inst_sources$base_integrada_test$dicc_code_to_label$pais_opciones),
    c("Mexico", "Peru")
  )

  out <- tempfile(fileext = ".xlsx")
  .analitica_multibase_export(sid, out, cfg)
  sheets <- openxlsx::getSheetNames(out)
  expect_true(all(c("Global", "Mexico", "Peru") %in% sheets))

  global <- as.matrix(openxlsx::read.xlsx(out, sheet = "Global", colNames = FALSE))
  mexico <- as.matrix(openxlsx::read.xlsx(out, sheet = "Mexico", colNames = FALSE))
  peru <- as.matrix(openxlsx::read.xlsx(out, sheet = "Peru", colNames = FALSE))
  text_global <- paste(global, collapse = " ")
  text_mx <- paste(mexico, collapse = " ")
  text_pe <- paste(peru, collapse = " ")

  expect_lt(which(as.character(global[, 1]) == "pais")[1], which(as.character(global[, 1]) == "Pregunta comun final")[1])
  key_row <- which(as.character(global[, 1]) == "pais")[1]
  expect_equal(sum(!is.na(global[key_row + 1L, ]) & nzchar(as.character(global[key_row + 1L, ]))), 1L)
  expect_true(all(c("Mexico", "Peru", "Total") %in% as.character(global[(key_row + 2L):(key_row + 5L), 1])))
  expect_true(grepl("Pregunta comun final", text_global, fixed = TRUE))
  expect_false(any(as.character(global) == "Opciones", na.rm = TRUE))
  expect_false(grepl("Empresa Mexico", text_global, fixed = TRUE))
  expect_false(grepl("Empresa Peru", text_global, fixed = TRUE))
  total_rows <- which(as.character(global[, 1]) == "Total")
  expect_true(any(apply(global[total_rows, , drop = FALSE], 1, function(row) {
    all(c("3", "2", "1") %in% as.character(row))
  })))
  expect_true(grepl("Pregunta en Mexico", text_mx, fixed = TRUE))
  expect_true(grepl("Pregunta en Peru", text_pe, fixed = TRUE))
  expect_true(grepl("Empresa Mexico", text_mx, fixed = TRUE))
  expect_false(grepl("Empresa Peru", text_mx, fixed = TRUE))
  expect_true(grepl("Empresa Peru", text_pe, fixed = TRUE))
  expect_false(grepl("Empresa Mexico", text_pe, fixed = TRUE))
  expect_false(any(as.character(global) == "%", na.rm = TRUE))
  expect_false(any(as.character(mexico) == "%", na.rm = TRUE))
})
