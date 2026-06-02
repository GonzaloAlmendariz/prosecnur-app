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
    label = c("pais", "Seccion A", "Pregunta guia Mexico", "Empresa Mexico", "Otro", "Empresa Peru", "Otro", NA),
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
      list(id = "mx", key_value = "Mexico", label = "Encuesta a representantes directivos de empresas certificadas en igualdad de genero en Mexico"),
      list(id = "pe", key_value = "Peru", label = "Encuesta a representantes directivos de empresas certificadas en igualdad de genero en Peru")
    ),
    variant_map = list(
      list(origin_id = "mx", origin_key = "Mexico", from = "p10", to = "p10_mexico"),
      list(origin_id = "pe", origin_key = "Peru", from = "p10", to = "p10_peru")
    ),
    label_overrides_standard = list(p1 = "Pregunta estandar final"),
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
  expect_false(any(grepl("Encuesta a representantes", sheets, fixed = TRUE)))

  global <- as.matrix(openxlsx::read.xlsx(out, sheet = "Global", colNames = FALSE))
  mexico <- as.matrix(openxlsx::read.xlsx(out, sheet = "Mexico", colNames = FALSE))
  peru <- as.matrix(openxlsx::read.xlsx(out, sheet = "Peru", colNames = FALSE))
  text_global <- paste(global, collapse = " ")
  text_mx <- paste(mexico, collapse = " ")
  text_pe <- paste(peru, collapse = " ")
  is_blank_cell <- function(x) is.na(x) || !nzchar(trimws(as.character(x)))

  expect_lt(which(as.character(global[, 1]) == "pais")[1], which(as.character(global[, 1]) == "Pregunta estandar final")[1])
  key_row <- which(as.character(global[, 1]) == "pais")[1]
  expect_equal(sum(!is.na(global[key_row + 1L, ]) & nzchar(as.character(global[key_row + 1L, ]))), 1L)
  expect_true(all(c("Mexico", "Peru", "Total") %in% as.character(global[(key_row + 2L):(key_row + 5L), 1])))
  expect_true(is_blank_cell(global[key_row + 1L, 1]))
  expect_true(grepl("Pregunta estandar final", text_global, fixed = TRUE))
  expect_false(grepl("Pregunta guia Mexico", text_global, fixed = TRUE))
  q_row <- which(as.character(global[, 1]) == "Pregunta estandar final")[1]
  expect_true(is_blank_cell(global[q_row + 2L, 1]))
  expect_true(any(as.character(global) == "N", na.rm = TRUE))
  expect_false(any(as.character(global) == "n", na.rm = TRUE))
  expect_false(grepl("Encuesta a representantes", text_global, fixed = TRUE))
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

test_that("Analitica descarta caches incompatibles con el XLSForm activo", {
  inst <- list(
    survey = data.frame(
      type = c("text", "text"),
      name = c("p1", "p2"),
      label = c("P1", "P2"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame()
  )
  data <- data.frame(p1 = "a", stringsAsFactors = FALSE, check.names = FALSE)
  attr(data, "xlsform_normalized") <- TRUE
  attr(data, "xlsform_compatibility") <- structure(
    list(ok = FALSE, missing_columns = "p2"),
    class = "pulso_data_xlsform_compatibility"
  )

  expect_false(.analitica_context_usable(data, inst))

  attr(data, "xlsform_compatibility") <- NULL
  expect_false(.analitica_context_usable(data, inst))

  data$p2 <- "b"
  attr(data, "xlsform_compatibility") <- validate_data_xlsform_compatibility(data, inst)
  expect_true(.analitica_context_usable(data, inst))

  inst_sm <- list(
    survey = data.frame(
      type = "select_multiple p22_list",
      name = "p22",
      label = "Multiple",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame()
  )
  data_sm <- data.frame(
    `p22/a` = c(1, 0),
    `p22/b` = c(0, 1),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  attr(data_sm, "xlsform_compatibility") <- structure(
    list(ok = FALSE, missing_columns = "p22"),
    class = "pulso_data_xlsform_compatibility"
  )
  expect_true(.analitica_context_usable(data_sm, inst_sm))
  names(data_sm) <- c("p22.1", "p22.2")
  expect_true(.analitica_context_usable(data_sm, inst_sm))
})

test_that("Analitica reconstruye fuentes al alternar original/codificada", {
  skip_if_not_installed("openxlsx")

  write_xls <- function(path, survey, choices = data.frame()) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "survey")
    openxlsx::writeData(wb, "survey", survey)
    openxlsx::addWorksheet(wb, "choices")
    openxlsx::writeData(wb, "choices", choices)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  write_data <- function(path, df) {
    wb <- openxlsx::createWorkbook()
    openxlsx::addWorksheet(wb, "data")
    openxlsx::writeData(wb, "data", df)
    openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  }
  upload_path <- function(sid, path, kind, name = basename(path)) {
    save_upload(sid, kind, name, readBin(path, "raw", n = file.info(path)$size))
  }

  sid <- session_create()
  on.exit(session_delete(sid))
  dir <- tempdir()
  xls_orig <- file.path(dir, "switch_original_form.xlsx")
  dat_orig <- file.path(dir, "switch_original_data.xlsx")
  xls_cod <- file.path(dir, "switch_codificada_form.xlsx")
  dat_cod <- file.path(dir, "switch_codificada_data.xlsx")

  survey_orig <- data.frame(
    type = "text",
    name = "p1",
    label = "Pregunta original",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  survey_cod <- data.frame(
    type = c("text", "text"),
    name = c("p1", "p1_recod"),
    label = c("Pregunta original", "Pregunta recodificada"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  data_orig <- data.frame(p1 = c("a", "b"), stringsAsFactors = FALSE, check.names = FALSE)
  data_cod <- data.frame(p1 = c("a", "b"), p1_recod = c("A", "B"), stringsAsFactors = FALSE, check.names = FALSE)
  write_xls(xls_orig, survey_orig)
  write_xls(xls_cod, survey_cod)
  write_data(dat_orig, data_orig)
  write_data(dat_cod, data_cod)

  xorig <- upload_path(sid, xls_orig, "xlsform")
  dorig <- upload_path(sid, dat_orig, "data")
  xcod <- upload_path(sid, xls_cod, "xlsform")
  dcod <- upload_path(sid, dat_cod, "data")
  s_tmp <- session_get(sid)
  s_tmp$files[[xcod$file_id]]$kind <- "instrumento_adaptado"
  s_tmp$files[[dcod$file_id]]$kind <- "data_adaptada"
  .session_env[[sid]] <- s_tmp
  inst_cod <- reporte_instrumento(path = xcod$path)
  rp_cod <- reporte_data(data_cod, instrumento = inst_cod)

  estudio_add_base(
    sid,
    nombre = "base_switch",
    xlsform_file_id = xcod$file_id,
    data_file_id = dcod$file_id,
    data_ext = "xlsx",
    rp_data = rp_cod,
    rp_inst = inst_cod,
    n_filas = nrow(data_cod),
    n_columnas = ncol(data_cod)
  )
  s <- session_get(sid)
  s$estudio$bases$base_switch$original_xlsform_file_id <- xorig$file_id
  s$estudio$bases$base_switch$original_data_file_id <- dorig$file_id
  s$codif_aplicado <- TRUE
  s$codif_inst_adaptado_fid <- xcod$file_id
  s$codif_data_adaptada_fid <- dcod$file_id
  s$analitica_fuente <- "adaptados"
  s$analitica_config <- .analitica_default_config()
  s$analitica_config$fuente_preferida <- "originales"
  s$analitica_prep_ok <- FALSE
  .session_env[[sid]] <- s

  sources_orig <- .load_rp_sources(sid)
  expect_equal(names(sources_orig$data_sources$base_switch), "p1")
  expect_equal(
    as.character(sources_orig$inst_sources$base_switch$survey$name),
    "p1"
  )

  s <- session_get(sid)
  s$analitica_config$fuente_preferida <- "adaptados"
  s$analitica_prep_ok <- FALSE
  .session_env[[sid]] <- s
  sources_cod <- .load_rp_sources(sid)
  expect_true("p1_recod" %in% names(sources_cod$data_sources$base_switch))
  expect_true("p1_recod" %in% as.character(sources_cod$inst_sources$base_switch$survey$name))
})

test_that("tablas multibase usan base de casos en total de select_multiple", {
  skip_if_not_installed("openxlsx")

  data <- data.frame(
    pais = c("Mexico", "Mexico", "Peru"),
    p22 = c("a;b", "a;c", "b;c"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  survey <- data.frame(
    type = c("select_one", "select_multiple"),
    name = c("pais", "p22"),
    label = c("pais", "Pregunta multiple"),
    list_name = c("pais_list", "p22_list"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c("pais_list", "pais_list", "p22_list", "p22_list", "p22_list"),
    name = c("Mexico", "Peru", "a", "b", "c"),
    label = c("Mexico", "Peru", "A", "B", "C"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  inst <- list(
    survey = survey,
    choices = choices,
    orders_list = list(
      pais = list(names = c("Mexico", "Peru"), labels = c("Mexico", "Peru"), label = "pais"),
      p22 = list(names = c("a", "b", "c"), labels = c("A", "B", "C"), label = "Pregunta multiple")
    )
  )

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Global")
  .prepare_frecuencias_sheet(wb, "Global")
  .amb_write_global_cat(
    wb, "Global",
    data = data,
    var = "p22",
    key_name = "pais",
    key_values = list(
      list(value = "Mexico", label = "Mexico"),
      list(value = "Peru", label = "Peru")
    ),
    dic_vars = .amb_dic_vars(inst),
    survey = inst$survey,
    orders_list = .amb_orders_list(inst),
    incluir_porcentajes = TRUE
  )

  out <- tempfile(fileext = ".xlsx")
  openxlsx::saveWorkbook(wb, out, overwrite = TRUE)
  tab <- as.matrix(openxlsx::read.xlsx(out, sheet = "Global", colNames = FALSE))
  total_row <- which(as.character(tab[, 1]) == "Total")[1]

  # Los porcentajes de SM son por casos validos; el total debe mostrar esa
  # misma base, no la suma de menciones A+B+C.
  expect_equal(as.character(tab[total_row, 2]), "3")
  expect_equal(as.character(tab[total_row, 4]), "2")
  expect_equal(as.character(tab[total_row, 6]), "1")
  expect_equal(as.numeric(tab[total_row, 3]), 1)
  expect_equal(as.numeric(tab[total_row, 5]), 1)
  expect_equal(as.numeric(tab[total_row, 7]), 1)
})

test_that("tablas multibase muestran variables recodificadas cuando el nombre base no existe", {
  skip_if_not_installed("openxlsx")

  data <- data.frame(
    pais = c("Mexico", "Peru"),
    p10_mexico_recod = c("si", NA_character_),
    p10_peru_recod = c(NA_character_, "si"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  inst <- list(
    survey = data.frame(
      type = c(
        "select_one pais_opciones",
        "select_one recod_mexico_lista",
        "select_one recod_peru_lista"
      ),
      name = c("pais", "p10_mexico_recod", "p10_peru_recod"),
      label = c("pais", "Pregunta Mexico", "Pregunta Peru"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c(
        "pais_opciones", "pais_opciones",
        "recod_mexico_lista", "recod_mexico_lista",
        "recod_peru_lista", "recod_peru_lista"
      ),
      name = c("Mexico", "Peru", "si", "no", "si", "no"),
      label = c("Mexico", "Peru", "Sí", "No", "Sí", "No"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  meta <- list(
    multi_integrated = list(
      origin_key_name = "pais",
      origins = list(
        list(id = "mx", key_value = "Mexico", label = "Mexico"),
        list(id = "pe", key_value = "Peru", label = "Peru")
      ),
      variant_map = list(
        list(origin_id = "mx", origin_key = "Mexico", from = "p10", to = "p10_mexico"),
        list(origin_id = "pe", origin_key = "Peru", from = "p10", to = "p10_peru")
      )
    )
  )

  cfg <- .analitica_default_config()
  cfg$multibase$global$incluir_porcentajes <- FALSE
  cfg$multibase$origenes$incluir_porcentajes <- FALSE
  cfg$frecuencias$orden <- "original"

  out <- tempfile(fileext = ".xlsx")
  .analitica_multibase_export_data(
    data = data,
    inst = inst,
    cfg = cfg,
    meta = meta,
    path_xlsx = out
  )
  global <- as.matrix(openxlsx::read.xlsx(out, sheet = "Global", colNames = FALSE))
  labels <- as.character(global[, 1])
  expect_true(any(trimws(labels) == "Pregunta Mexico (Recodificada)", na.rm = TRUE))
  expect_true(any(trimws(labels) == "Pregunta Peru (Recodificada)", na.rm = TRUE))
})

test_that("analitica_filter_sections sustituye por _recod cuando la variable original no es elegible", {
  inst <- list(
    survey = data.frame(
      type = c(
        "integer",
        "select_one lst_p2_recod",
        "select_one lst_p12",
        "text",
        "select_one lst_p12_other_recod",
        "select_one lst_p13",
        "text",
        "select_one lst_p13_other_recod"
      ),
      name = c(
        "p2",
        "p2_recod",
        "p12",
        "p12_other",
        "p12_other_recod",
        "p13",
        "p13_other",
        "p13_other_recod"
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  secs_in <- list(
    "Sec1" = c("p2", "p12_other", "p13_other")
  )
  secs_out <- .analitica_filter_sections(secs_in, inst, numericas = character(0), excluidas = character(0))
  expect_equal(as.character(secs_out[["Sec1"]]), c("p2_recod", "p12_other_recod", "p13_other_recod"))
})

test_that("no mezcla _other_recod con padre cuando el padre no es select_one/select_multiple", {
  data <- data.frame(
    edad = c(1, 2, NA),
    edad_other = c("x", "y", NA),
    edad_other_recod = c("A", NA, NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  survey <- data.frame(
    type = c("integer", "text", "text"),
    name = c("edad", "edad_other", "edad_other_recod"),
    label = c(
      "Edad",
      "Especifique",
      "Especifique"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  inst <- list(survey = survey)

  expect_equal(.amb_multibase_resolve_var("edad_other", data, character(0), inst = inst), "edad_other_recod")
  expect_equal(.amb_multibase_resolve_var("edad_other_recod", data, character(0), inst = inst), "edad_other_recod")
  expect_true(identical(.amb_merge_other_recod(data, "edad_other", inst = inst), data))
  expect_true(identical(.amb_merge_other_recod(data, "edad_other_recod", inst = inst), data))
})

test_that("p12_recod absorbe p12_other_recod cuando el padre tiene recodificación", {
  data <- data.frame(
    p12 = c("a", "b"),
    p12_recod = c("A", "B"),
    p12_other = c(NA, "detalle"),
    p12_other_recod = c(NA, "C"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  survey <- data.frame(
    type = c(
      "select_one lst_p12",
      "select_one lst_p12_recod",
      "text",
      "select_one lst_p12_other_recod"
    ),
    name = c(
      "p12",
      "p12_recod",
      "p12_other",
      "p12_other_recod"
    ),
    label = c(
      "P12",
      "P12 recodificada",
      "Otro (especifique):",
      "Otro (especifique):"
    ),
    list_name = c(
      "lst_p12", "lst_p12_recod", NA, "lst_p12_other_recod"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  inst <- list(survey = survey)
  roles <- .amb_recod_roles_from_draft(list(rows = list(
    list(tipo = "select_one", modo_so = "padre", parent = "p12", parent_col = "p12", text_col = "p12_other")
  )))

  expect_equal(.amb_multibase_resolve_var("p12_other", data, character(0), inst = inst, recod_roles = roles), "p12_recod")
  expect_equal(.amb_multibase_resolve_var("p12_other_recod", data, character(0), inst = inst, recod_roles = roles), "p12_recod")
  merged <- .amb_merge_other_recod(data, "p12_other_recod", inst = inst, recod_roles = roles)
  expect_true("C" %in% na.omit(as.character(merged[["p12_recod"]])))
})

test_that("titulos de recodificadas usan fraseo original y sufijo estandar", {
  dic_vars <- data.frame(
    name = c("p12", "p12_recod", "p12_other", "p12_other_recod"),
    label = c(
      "¿En qué área trabaja principalmente?",
      "Área recodificada",
      "Otro (especifique):",
      "Otro recodificada"
    ),
    stringsAsFactors = FALSE
  )
  data <- data.frame(
    p12 = "1",
    p12_recod = "2",
    p12_other = "texto",
    p12_other_recod = "3",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  expect_equal(
    titulo_var("p12_recod", dic_vars = dic_vars, df = data),
    "¿En qué área trabaja principalmente? (Recodificada)"
  )
  expect_equal(
    label_variable("p12_recod", dic_vars = dic_vars, data = data),
    "¿En qué área trabaja principalmente? (Recodificada)"
  )
  expect_equal(
    titulo_var("p12_other_recod", dic_vars = dic_vars, df = data),
    "Otro (especifique): (Recodificada)"
  )
})

test_that("modo hijo conserva var_other_recod como variable autonoma", {
  data <- data.frame(
    p13 = c("1", "2", NA),
    p13_other = c(NA, "detalle", NA),
    p13_other_recod = c(NA, "3", NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  inst <- list(survey = data.frame(
    type = c("select_one lst_p13", "text", "select_one lst_p13_other_recod"),
    name = c("p13", "p13_other", "p13_other_recod"),
    label = c("P13", "Especifique", "Motivo P13 recodificado"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  ))
  roles <- .amb_recod_roles_from_draft(list(rows = list(
    list(tipo = "select_one", modo_so = "hijo", parent = "p13", parent_col = "p13", text_col = "p13_other")
  )))

  expect_equal(.amb_multibase_resolve_var("p13_other", data, character(0), inst = inst, recod_roles = roles), "p13_other_recod")
  expect_equal(.amb_multibase_resolve_var("p13_other_recod", data, character(0), inst = inst, recod_roles = roles), "p13_other_recod")
  expect_true(identical(.amb_merge_other_recod(data, "p13_other_recod", inst = inst, recod_roles = roles), data))
})

test_that("tablas multibase respetan roles de codificacion y categorias del paso 3", {
  skip_if_not_installed("openxlsx")

  data <- data.frame(
    origen = c("Mexico", "Mexico", "Peru", "Peru"),
    p12 = c("a", "b", NA, "b"),
    p12_recod = c("a", "b", NA, "b"),
    p12_other = c(NA, "detalle", NA, NA),
    p12_other_recod = c(NA, "c", NA, NA),
    p13 = c("1", "2", "2", NA),
    p13_other = c(NA, NA, "motivo", NA),
    p13_other_recod = c(NA, NA, "3", NA),
    p22 = c("1 2", "1", "2", NA),
    p22_other = c("texto nuevo", NA, "otro nuevo", NA),
    p22_recod = c("1 3", "1", "2 3", NA),
    p_text = c("abierta a", "", "abierta b", NA),
    p_text_recod = c("ta", NA, "tb", NA),
    edad = c(18, 44, 21, NA),
    edad_recod = c("joven", "adulto", "joven", NA),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  survey <- data.frame(
    type = c(
      "select_one lst_origen",
      "select_one lst_p12",
      "select_one lst_p12_recod",
      "text",
      "select_one lst_p12_other_recod",
      "select_one lst_p13",
      "text",
      "select_one lst_p13_other_recod",
      "select_multiple lst_p22",
      "text",
      "select_multiple lst_p22_recod",
      "text",
      "select_one lst_p_text_recod",
      "integer",
      "select_one lst_edad_recod"
    ),
    name = c(
      "origen",
      "p12",
      "p12_recod",
      "p12_other",
      "p12_other_recod",
      "p13",
      "p13_other",
      "p13_other_recod",
      "p22",
      "p22_other",
      "p22_recod",
      "p_text",
      "p_text_recod",
      "edad",
      "edad_recod"
    ),
    label = c(
      "Origen",
      "P12",
      "P12 recodificada",
      "Otro (especifique):",
      "Otro (especifique):",
      "P13",
      "Especifique:",
      "Motivo P13 recodificado",
      "P22 multiple",
      "Otro P22",
      "P22 multiple recodificada",
      "Texto abierto",
      "Texto recodificado",
      "Edad",
      "Edad recodificada"
    ),
    list_name = c(
      "lst_origen", "lst_p12", "lst_p12_recod", NA, "lst_p12_other_recod",
      "lst_p13", NA, "lst_p13_other_recod", "lst_p22", NA,
      "lst_p22_recod", NA, "lst_p_text_recod", NA, "lst_edad_recod"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  choices <- data.frame(
    list_name = c(
      "lst_origen", "lst_origen",
      "lst_p12", "lst_p12", "lst_p12", "lst_p12_recod", "lst_p12_recod", "lst_p12_recod", "lst_p12_other_recod",
      "lst_p13", "lst_p13", "lst_p13", "lst_p13_other_recod",
      "lst_p22", "lst_p22", "lst_p22_recod", "lst_p22_recod", "lst_p22_recod",
      "lst_p_text_recod", "lst_p_text_recod",
      "lst_edad_recod", "lst_edad_recod"
    ),
    name = c(
      "Mexico", "Peru",
      "a", "b", "c", "a", "b", "c", "c",
      "1", "2", "3", "3",
      "1", "2", "1", "2", "3",
      "ta", "tb",
      "joven", "adulto"
    ),
    label = c(
      "Mexico", "Peru",
      "A", "B", "C", "A", "B", "Categoria nueva padre", "Categoria nueva padre",
      "1", "2", "3", "Motivo nuevo",
      "Opcion 1", "Otro", "Opcion 1", "Otro", "Categoria nueva SM",
      "Texto A", "Texto B",
      "Joven", "Adulto"
    ),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  inst <- list(
    survey = survey,
    choices = choices
  )
  cfg <- .analitica_default_config()
  cfg$multibase$global$incluir_porcentajes <- FALSE
  cfg$multibase$origenes$incluir_porcentajes <- FALSE
  cfg$frecuencias$orden <- "original"
  meta <- list(
    multi_integrated = list(
      origin_key_name = "origen",
      origins = list(
        list(key_value = "Mexico", label = "Mexico"),
        list(key_value = "Peru", label = "Peru")
      )
    )
  )
  roles <- .amb_recod_roles_from_draft(list(rows = list(
    list(tipo = "select_one", modo_so = "padre", parent = "p12", parent_col = "p12", text_col = "p12_other"),
    list(tipo = "select_one", modo_so = "hijo", parent = "p13", parent_col = "p13", text_col = "p13_other"),
    list(tipo = "select_multiple", parent = "p22", parent_col = "p22", text_col = "p22_other"),
    list(tipo = "text", parent = "p_text", parent_col = "p_text", text_col = ""),
    list(tipo = "integer", parent = "edad", parent_col = "edad", text_col = "")
  )))

  out <- tempfile(fileext = ".xlsx")
  .analitica_multibase_export_data(
    data = data,
    inst = inst,
    cfg = cfg,
    meta = meta,
    path_xlsx = out,
    recod_roles = roles
  )
  global <- as.matrix(openxlsx::read.xlsx(out, sheet = "Global", colNames = FALSE))
  mexico <- as.matrix(openxlsx::read.xlsx(out, sheet = "Mexico", colNames = FALSE))
  peru <- as.matrix(openxlsx::read.xlsx(out, sheet = "Peru", colNames = FALSE))
  global_labels <- trimws(as.character(global[, 1]))
  global_text <- paste(global, collapse = " ")
  mexico_text <- paste(mexico, collapse = " ")
  peru_text <- paste(peru, collapse = " ")
  expect_true(any(global_labels == "P12 (Recodificada)", na.rm = TRUE))
  expect_true(any(global_labels == "P13", na.rm = TRUE))
  expect_true(any(global_labels == "Especifique: (Recodificada)", na.rm = TRUE))
  expect_true(any(global_labels == "P22 multiple (Recodificada)", na.rm = TRUE))
  expect_true(any(global_labels == "Texto abierto (Recodificada)", na.rm = TRUE))
  expect_true(any(global_labels == "Edad (Recodificada)", na.rm = TRUE))
  expect_false(grepl("Otro \\(especifique\\):", global_text))
  expect_false(grepl("Otro \\(especifique\\):", mexico_text))
  expect_false(grepl("Otro \\(especifique\\):", peru_text))
  expect_true(grepl("Categoria nueva padre", global_text, fixed = TRUE))
  expect_true(grepl("Categoria nueva SM", global_text, fixed = TRUE))
  expect_true(grepl("Categoria nueva SM", mexico_text, fixed = TRUE))
  expect_true(grepl("Categoria nueva SM", peru_text, fixed = TRUE))

  p22_row <- which(global_labels == "P22 multiple (Recodificada)")[1]
  total_after_p22 <- p22_row + which(trimws(as.character(global[(p22_row + 1):nrow(global), 1])) == "Total")[1]
  expect_true(all(c("3", "2", "1") %in% as.character(global[total_after_p22, ])))
})
