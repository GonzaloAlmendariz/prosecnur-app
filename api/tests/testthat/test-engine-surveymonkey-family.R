set_familias_modo_so <- function(path, values, sheet = "familias") {
  fam <- readxl::read_excel(path, sheet = sheet)
  fam_names <- janitor::make_clean_names(names(fam))
  col_modo <- match("modo_so", fam_names)
  col_parent <- match("parent", fam_names)
  if (is.na(col_modo) || is.na(col_parent)) {
    stop("La plantilla de familias no tiene columnas 'modo_so' y 'parent'.")
  }

  wb <- openxlsx::loadWorkbook(path)
  if (is.null(names(values)) || !all(nzchar(names(values)))) {
    rows <- which(tolower(as.character(fam$tipo)) == "select_one")
    for (i in rows) {
      openxlsx::writeData(wb, sheet, x = values[[1]], startCol = col_modo, startRow = i + 1L, colNames = FALSE)
    }
  } else {
    for (nm in names(values)) {
      row_idx <- which(as.character(fam[[col_parent]]) == nm)[1]
      if (is.na(row_idx)) next
      openxlsx::writeData(wb, sheet, x = values[[nm]], startCol = col_modo, startRow = row_idx + 1L, colNames = FALSE)
    }
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}

test_that("familia surveymonkey_ genera XLSForm de referencia y data compatible", {
  path_sav <- tempfile(fileext = ".sav")
  path_xlsx <- tempfile(fileext = ".xlsx")
  path_codif <- tempfile(fileext = ".xlsx")
  path_familias <- tempfile(fileext = ".xlsx")
  path_freq <- tempfile(fileext = ".xlsx")
  path_cross <- tempfile(fileext = ".xlsx")

  on.exit(unlink(c(path_sav, path_xlsx, path_codif, path_familias, path_freq, path_cross)), add = TRUE)

  likert_labs <- c(
    "Totalmente en Desacuerdo" = 1,
    "En Desacuerdo" = 2,
    "De Acuerdo" = 3,
    "Totalmente de Acuerdo" = 4,
    "SIN INF" = 99
  )

  df <- data.frame(
    CollectorNm = c("COL-01", "COL-02", "COL-03"),
    respondent_id = c("r1", "r2", "r3"),
    date_created = c(
      "10/27/2025 07:04:32 PM",
      "10/28/2025 08:10:11 PM",
      "10/29/2025 09:15:55 PM"
    ),
    email_address = c("a@pucp.edu.pe", "b@pucp.edu.pe", "c@pucp.edu.pe"),
    Sexo = c("Femenino", "Masculino", "Femenino"),
    P1 = haven::labelled(c(1, 2, 1), c("Sí" = 1, "No" = 2)),
    P4_1 = haven::labelled(c(1, 2, 4), likert_labs),
    P4_2 = haven::labelled(c(2, 3, 99), likert_labs),
    P5_1 = haven::labelled(c(1, NA, 1), c("Página web" = 1)),
    P5_2 = haven::labelled(c(NA, NA, 1), c("Redes sociales" = 1)),
    P5_3 = haven::labelled(c(NA, 1, NA), c("Otro:" = 1)),
    P5_O = c(NA, "Club de alumnos", NA),
    P6 = haven::labelled(c(1, 3, 2), c("Presencial" = 1, "Virtual" = 2, "Otro:" = 3)),
    P6_O = c(NA, "Mixta", NA),
    Edad_HO = c(20, 21, 22),
    TOTAL = c(10, 20, 30),
    stringsAsFactors = FALSE
  )

  attr(df$P1, "label") <- "¿Desea continuar?"
  attr(df$Sexo, "label") <- "Sexo"
  attr(df$P4_1, "label") <- "La misión está claramente definida"
  attr(df$P4_2, "label") <- "Los canales de difusión son adecuados"
  attr(df$P5_1, "label") <- "¿A través de qué medios se informó?"
  attr(df$P5_2, "label") <- "¿A través de qué medios se informó?"
  attr(df$P5_3, "label") <- "¿A través de qué medios se informó?"
  attr(df$P5_O, "label") <- "Other (please specify)"
  attr(df$P6, "label") <- "Modalidad del servicio"
  attr(df$P6_O, "label") <- "Other (please specify)"
  attr(df$Edad_HO, "label") <- "Edad"
  attr(df$TOTAL, "label") <- "Total"

  haven::write_sav(df, path_sav)

  sm <- surveymonkey_leer(path_sav)

  expect_s3_class(sm, "prosecnur_surveymonkey")
  expect_true(all(c(
    "name_raw", "label", "class", "n_value_labels", "is_labelled",
    "stem", "suffix", "kind_guess", "is_other", "group_guess", "order"
  ) %in% names(sm$vars_tbl)))

  kinds <- stats::setNames(sm$vars_tbl$kind_guess, sm$vars_tbl$name_raw)
  expect_identical(kinds[["respondent_id"]], "metadata")
  expect_identical(kinds[["Sexo"]], "select_one")
  expect_identical(kinds[["P1"]], "select_one")
  expect_identical(kinds[["P4_1"]], "battery_item")
  expect_identical(kinds[["P5_1"]], "select_multiple_dummy")
  expect_identical(kinds[["P5_O"]], "other_text")
  expect_true(sm$vars_tbl$is_auxiliary[sm$vars_tbl$name_raw == "TOTAL"])

  inst_ref <- surveymonkey_xlsform(sm, path = path_xlsx)
  idx_grp_p4 <- which(inst_ref$survey$name == "grp_p4")[1]
  idx_p5_other <- which(inst_ref$survey$name == "p5_other")[1]
  idx_p6_other <- which(inst_ref$survey$name == "p6_other")[1]

  expect_s3_class(inst_ref, "prosecnur_surveymonkey_xlsform")
  expect_true(file.exists(path_xlsx))
  expect_true(all(c("survey", "choices", "settings", "diagnostico") %in% names(inst_ref)))
  expect_true(any(inst_ref$survey$type == "begin_group"))
  expect_true(any(grepl("^select_multiple ", inst_ref$survey$type)))
  expect_true(any(inst_ref$survey$section == "AuxSM"))
  expect_true(any(inst_ref$survey$name == "p6_other"))
  expect_true(any(inst_ref$survey$name == "sexo"))
  expect_true(any(inst_ref$survey$type == "select_one lst_sexo"))
  expect_true(is.na(inst_ref$survey$`label::es`[idx_grp_p4]))
  expect_identical(inst_ref$survey$`label::es`[idx_p5_other], "Otro:")
  expect_identical(inst_ref$survey$`label::es`[idx_p6_other], "Otro:")
  expect_identical(inst_ref$survey$relevant[idx_p5_other], "selected(${p5}, 'other')")
  expect_identical(inst_ref$survey$relevant[idx_p6_other], "selected(${p6}, '3')")
  expect_true("lst_si_no" %in% inst_ref$choices$list_name)
  expect_true("lst_sexo" %in% inst_ref$choices$list_name)
  expect_true("lst_acuerdo_4" %in% inst_ref$choices$list_name)
  expect_true("lst_p6" %in% inst_ref$choices$list_name)
  expect_true("lst_p5" %in% inst_ref$choices$list_name)
  expect_true(all(c("femenino", "masculino") %in% inst_ref$choices$name[inst_ref$choices$list_name == "lst_sexo"]))
  expect_true("99" %in% as.character(inst_ref$choices$name[inst_ref$choices$list_name == "lst_acuerdo_4"]))
  expect_true("other" %in% as.character(inst_ref$choices$name[inst_ref$choices$list_name == "lst_p5"]))
  expect_false("3" %in% as.character(inst_ref$choices$name[inst_ref$choices$list_name == "lst_p5"]))

  rp_inst <- reporte_instrumento(path_xlsx, lang = "es")
  idx_rp_p1 <- which(rp_inst$survey$name == "p1")[1]
  idx_rp_sexo <- which(rp_inst$survey$name == "sexo")[1]
  idx_rp_p4_1 <- which(rp_inst$survey$name == "p4_1")[1]
  idx_rp_p4_2 <- which(rp_inst$survey$name == "p4_2")[1]
  idx_rp_p6 <- which(rp_inst$survey$name == "p6")[1]
  expect_s3_class(rp_inst, "prosecnur_instrumento")
  expect_true("p5" %in% rp_inst$survey$name)
  expect_true("sexo" %in% rp_inst$survey$name)
  expect_true("p1" %in% rp_inst$survey$name)
  expect_identical(
    rp_inst$survey$list_name[idx_rp_sexo],
    "lst_sexo"
  )
  expect_identical(
    rp_inst$survey$list_name[idx_rp_p1],
    "lst_si_no"
  )
  expect_identical(
    rp_inst$survey$list_name[idx_rp_p4_1],
    "lst_acuerdo_4"
  )
  expect_identical(
    rp_inst$survey$list_name[idx_rp_p4_1],
    rp_inst$survey$list_name[idx_rp_p4_2]
  )
  expect_identical(
    rp_inst$survey$list_name[idx_rp_p6],
    "lst_p6"
  )

  dat_ref <- surveymonkey_data(sm)
  expect_equal(nrow(dat_ref), nrow(df))
  expect_true(all(c(
    "p5", "p5/1", "p5/2", "p5/other", "p5_other", "p6_other"
  ) %in% names(dat_ref)))
  expect_equal(dat_ref$sexo, c("femenino", "masculino", "femenino"))
  expect_false(any(c("p5_1", "p5_2", "p5_3", "p5_o", "p6_o") %in% names(dat_ref)))
  expect_equal(dat_ref$p5, c("1", "other", "1 2"))
  expect_equal(as.numeric(dat_ref$p4_2), c(2, 3, 99))
  expect_identical(dat_ref$p6_other[2], "Mixta")
  expect_identical(as.character(dat_ref[["p5/other"]]), as.character(df$P5_3))
  expect_identical(dat_ref$p5_other[2], "Club de alumnos")

  openxlsx::write.xlsx(list(data = dat_ref), file = path_codif, overwrite = TRUE)
  inst_codif <- leer_instrumento_xlsform(path_xlsx)
  dat_codif_obj <- leer_datos(path_codif)
  escribir_plantilla_familias(inst_codif, dat_codif_obj, path = path_familias)
  set_familias_modo_so(path_familias, c(p6 = "padre"))
  familias <- leer_familias_clasificar(
    path = path_familias,
    inst = inst_codif,
    dat = dat_codif_obj,
    verbose = FALSE
  )
  row_p5 <- familias$familias_filtradas[familias$familias_filtradas$parent == "p5", , drop = FALSE]
  row_p6 <- familias$familias_filtradas[familias$familias_filtradas$parent == "p6", , drop = FALSE]
  expect_true(nrow(row_p5) == 1L)
  expect_identical(row_p5$tipo[1], "select_multiple")
  expect_identical(row_p5$other_dummy_col[1], "p5/other")
  expect_identical(row_p5$text_col[1], "p5_other")
  expect_true(nrow(row_p6) == 1L)
  expect_identical(row_p6$tipo[1], "select_one")
  expect_identical(row_p6$text_col[1], "p6_other")

  rp_data <- reporte_data(dat_ref, rp_inst)
  expect_s3_class(rp_data, "prosecnur_reporte_tbl")
  expect_true(all(c("p5.1", "p5.2", "p5.other") %in% names(rp_data)))
  expect_false("p5" %in% names(rp_data))
  expect_false(is.null(attr(rp_data$p1, "labels")))

  expect_no_error(
    reporte_frecuencias(
      data = rp_data,
      instrumento = rp_inst,
      secciones = list(
        Principal = c("p1", "p4_1", "p5")
      ),
      path_xlsx = path_freq
    )
  )
  expect_true(file.exists(path_freq))

  expect_no_error(
    reporte_cruces(
      data = rp_data,
      instrumento = rp_inst,
      SECCIONES = list(
        Principal = c("p4_1", "p4_2")
      ),
      cruces = c("p1"),
      path_xlsx = path_cross
    )
  )
  expect_true(file.exists(path_cross))

  list_name_p4 <- rp_inst$survey$list_name[idx_rp_p4_1]
  orden_p4 <- as.character(rp_inst$choices$name[rp_inst$choices$list_name == list_name_p4])

  recod <- expect_no_error(
    reporte_dimensiones(
      data = rp_data,
      instrumento = rp_inst,
      vars = c("p4_1"),
      orden_por_lista = stats::setNames(list(orden_p4), list_name_p4)
    )
  )
  expect_true("r100_p4_1" %in% names(recod))
})

test_that("surveymonkey_xlsform reconoce satisfaccion_4 y ordena grupos por sufijo", {
  path_sav <- tempfile(fileext = ".sav")
  path_xlsx <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(path_sav, path_xlsx)), add = TRUE)

  sat_labs <- c(
    "Muy insatisfecho" = 1,
    "Insatisfecho" = 2,
    "Satisfecho" = 3,
    "Muy satisfecho" = 4,
    "SIN INF" = 99
  )

  df <- data.frame(
    P8_1 = haven::labelled(c(1, 2), sat_labs),
    P8_2 = haven::labelled(c(2, 3), sat_labs),
    P8_6 = haven::labelled(c(3, 4), sat_labs),
    P8_3 = haven::labelled(c(4, 1), sat_labs),
    P8_4 = haven::labelled(c(1, 99), sat_labs),
    P8_5 = haven::labelled(c(2, 3), sat_labs),
    stringsAsFactors = FALSE
  )

  attr(df$P8_1, "label") <- "Servicio 1"
  attr(df$P8_2, "label") <- "Servicio 2"
  attr(df$P8_6, "label") <- "Servicio 6"
  attr(df$P8_3, "label") <- "Servicio 3"
  attr(df$P8_4, "label") <- "Servicio 4"
  attr(df$P8_5, "label") <- "Servicio 5"

  haven::write_sav(df, path_sav)

  sm <- prosecnur::surveymonkey_leer(path_sav)
  inst_ref <- prosecnur::surveymonkey_xlsform(sm, path = path_xlsx)

  p8_rows <- inst_ref$survey[grepl("^p8_", inst_ref$survey$name), , drop = FALSE]
  expect_identical(p8_rows$name, paste0("p8_", 1:6))
  expect_true(all(p8_rows$type == "select_one lst_satisfaccion_4"))
  expect_true("lst_satisfaccion_4" %in% inst_ref$choices$list_name)
})

make_codif_inst <- function(survey, choices) {
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
    survey$label_spanish_es <- if ("label::Spanish (ES)" %in% names(survey)) {
      survey[["label::Spanish (ES)"]]
    } else if ("label" %in% names(survey)) {
      survey[["label"]]
    } else {
      survey$name
    }
  }

  if (!"list_norm" %in% names(choices)) {
    choices$list_norm <- tolower(gsub("[^a-z0-9_]", "_", gsub("\\s+", "_", as.character(choices$list_name))))
  }
  if (!"label_spanish_es" %in% names(choices)) {
    choices$label_spanish_es <- if ("label::Spanish (ES)" %in% names(choices)) {
      choices[["label::Spanish (ES)"]]
    } else if ("label" %in% names(choices)) {
      choices[["label"]]
    } else {
      choices$name
    }
  }

  list(
    survey = survey,
    survey_raw = survey,
    choices = choices,
    choices_raw = choices
  )
}

make_codif_dat <- function(df) {
  df <- as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
  clean <- janitor::make_clean_names(names(df))
  list(
    raw = df,
    clean = stats::setNames(df, clean),
    name_map = tibble::tibble(clean = clean, original = names(df))
  )
}

write_codif_inst_xlsx <- function(inst, path) {
  settings <- data.frame(
    form_title = "Instrumento de prueba",
    default_language = "es",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  openxlsx::write.xlsx(
    list(
      survey = inst$survey_raw,
      choices = inst$choices_raw,
      settings = settings
    ),
    file = path,
    overwrite = TRUE
  )
  invisible(path)
}

read_sheet_headers <- function(path, sheet) {
  readxl::read_excel(path, sheet = sheet, n_max = 2, col_names = FALSE)
}

count_workbook_comments <- function(path) {
  exdir <- tempfile("xlsx_comments_")
  dir.create(exdir, recursive = TRUE)
  on.exit(unlink(exdir, recursive = TRUE), add = TRUE)
  utils::unzip(path, exdir = exdir)
  files <- list.files(file.path(exdir, "xl"), pattern = "^comments[0-9]+\\.xml$", full.names = TRUE)
  if (!length(files)) {
    return(list(count = 0L, text = ""))
  }
  txt <- paste(unlist(lapply(files, readLines, warn = FALSE, encoding = "UTF-8")), collapse = "\n")
  matches <- gregexpr("<comment ", txt, fixed = TRUE)[[1]]
  count <- if (identical(matches[1], -1L)) 0L else length(matches)
  list(count = count, text = txt)
}

test_that("recodificacion detecta other por semantica del XLSForm y usa la etiqueta real", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_multiple lst_need", "text"),
      name = c("need", "need_detail"),
      relevant = c(NA, "selected(${need}, '70')"),
      `label::Spanish (ES)` = c("Necesidad principal", "Detalle de necesidad"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_need", "lst_need"),
      name = c("1", "70"),
      `label::Spanish (ES)` = c("Trabajo", "Servicio comunitario"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    `_index` = c(1, 2),
    need = c("1 70", "1"),
    `need/1` = c(1, 1),
    `need/70` = c(1, 0),
    need_detail = c("Red local", NA),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_familias <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_familias), add = TRUE)

  expect_no_warning(
    prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  )
  fam <- leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)

  row_need <- fam$familias_filtradas[fam$familias_filtradas$parent == "need", , drop = FALSE]
  expect_identical(row_need$other_dummy_col[1], "need/70")
  expect_identical(row_need$text_col[1], "need_detail")

  plantilla <- construir_plantilla_desde_familias(inst, dat, fam)
  sheet_need <- plantilla$sheets[["need"]]
  expect_true("Servicio comunitario" %in% names(sheet_need))
  expect_false("Otro, por favor especificar" %in% names(sheet_need))
  expect_identical(sheet_need$Seleccionadas[[1]], "Trabajo; Servicio comunitario")
  expect_identical(sheet_need$Seleccionadas_cod[[1]], "1; 70")
})

test_that("recodificacion acepta other virtual desde columna madre normalizada", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_multiple lst_need", "text"),
      name = c("need", "need_other"),
      relevant = c(NA, "selected(${need}, '70')"),
      `label::Spanish (ES)` = c("Necesidad principal", "Detalle de otra necesidad"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_need", "lst_need"),
      name = c("1", "70"),
      `label::Spanish (ES)` = c("Trabajo", "Other (especificar)"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    need = c("1 70", "1"),
    need_other = c("Red local", NA),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_familias <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_familias), add = TRUE)

  familias <- data.frame(
    use = TRUE,
    q_order = 1L,
    tipo = "select_multiple",
    modo_so = "",
    parent = "need",
    parent_label = "Necesidad principal",
    list_norm = "lst_need",
    parent_col = "need",
    other_dummy_col = "need/70",
    text_col = "need_other",
    check.names = FALSE,
    stringsAsFactors = FALSE
  )
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "familias")
  openxlsx::writeData(wb, "familias", familias)
  openxlsx::saveWorkbook(wb, path_familias, overwrite = TRUE)

  fam <- leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  row_need <- fam$familias_filtradas[fam$familias_filtradas$parent == "need", , drop = FALSE]
  expect_identical(row_need$other_dummy_col[1], "need/70")
  expect_true(row_need$exists_dummy_col[1])

  plantilla <- construir_plantilla_desde_familias(inst, dat, fam)
  sheet_need <- plantilla$sheets[["need"]]
  expect_true("Other (especificar)" %in% names(sheet_need))
  expect_identical(sheet_need$Seleccionadas[[1]], "Trabajo; Other (especificar)")
})

test_that("recodificacion no sugiere other si no hay vinculo semantico claro", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_multiple lst_need", "text"),
      name = c("need", "free_note"),
      relevant = c(NA, "${otra} = '70'"),
      `label::Spanish (ES)` = c("Necesidad principal", "Detalle libre"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_need", "lst_need"),
      name = c("1", "70"),
      `label::Spanish (ES)` = c("Trabajo", "Servicio comunitario"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    need = c("70", "1"),
    `need/70` = c(1, 0),
    free_note = c("texto", NA),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_familias <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_familias), add = TRUE)

  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  sugeridas <- readxl::read_excel(path_familias, sheet = "familias")
  row_need <- sugeridas[sugeridas$parent == "need", , drop = FALSE]
  expect_true(is.na(row_need$text_col[1]) || row_need$text_col[1] == "")
  expect_true(is.na(row_need$other_dummy_col[1]) || row_need$other_dummy_col[1] == "")

  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  diag_need <- fam$diagnostico_clasificacion[fam$diagnostico_clasificacion$parent == "need", , drop = FALSE]
  expect_identical(diag_need$estado_clasificacion[1], "excluida")
  expect_match(diag_need$motivo_clasificacion[1], "text_col no existe", fixed = TRUE)
})

test_that("recodificacion resuelve select_one con codigo no literal", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_one lst_mode", "text"),
      name = c("mode", "mode_detail"),
      relevant = c(NA, "${mode} = 96"),
      `label::Spanish (ES)` = c("Modo", "Detalle modo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_mode", "lst_mode"),
      name = c("1", "96"),
      `label::Spanish (ES)` = c("Presencial", "Canal alternativo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    mode = c("96", "1"),
    mode_detail = c("Mixto", NA),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_familias <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_familias), add = TRUE)

  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  set_familias_modo_so(path_familias, c(mode = "padre"))
  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  row_mode <- fam$familias_filtradas[fam$familias_filtradas$parent == "mode", , drop = FALSE]
  expect_identical(row_mode$tipo[1], "select_one")
  expect_identical(row_mode$text_col[1], "mode_detail")
})

test_that("recodificacion repeat-aware replica la deteccion semantica y no inventa columna generica", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("begin_repeat", "select_multiple lst_need", "text", "end_repeat"),
      name = c("hh", "need", "need_detail", "hh_end"),
      relevant = c(NA, NA, "selected(${need}, '70')", NA),
      `label::Spanish (ES)` = c(NA, "Necesidad principal", "Detalle de necesidad", NA),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_need", "lst_need"),
      name = c("1", "70"),
      `label::Spanish (ES)` = c("Trabajo", "Servicio comunitario"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  tabs <- list(
    main = make_codif_dat(data.frame(`_uuid` = character(), `_index` = integer(), check.names = FALSE)),
    hh = make_codif_dat(data.frame(
      `_uuid` = c("u1", "u2"),
      `_index` = c(1, 2),
      need = c("1 70", "1"),
      `need/1` = c(1, 1),
      `need/70` = c(1, 0),
      need_detail = c("Red local", NA),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ))
  )
  path_familias <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_familias), add = TRUE)

  prosecnur::escribir_plantilla_familias_repeat(inst, tabs, path = path_familias, verbose = FALSE)
  fam <- prosecnur::leer_familias_clasificar_repeat(path_familias, inst, tabs, verbose = FALSE)
  row_need <- fam$familias_filtradas[fam$familias_filtradas$parent == "need", , drop = FALSE]
  expect_identical(row_need$hoja_datos[1], "hh")
  expect_identical(row_need$other_dummy_col[1], "need/70")
  expect_identical(row_need$text_col[1], "need_detail")

  plantilla <- prosecnur::construir_plantilla_desde_familias_repeat(inst, tabs, fam)
  sheet_need <- plantilla$sheets[["need"]]
  expect_true("Servicio comunitario" %in% names(sheet_need))
  expect_false("Otro, por favor especificar" %in% names(sheet_need))
  expect_identical(sheet_need$Seleccionadas[[1]], "Trabajo; Servicio comunitario")
  expect_identical(sheet_need$Seleccionadas_cod[[1]], "1; 70")
})

test_that("construir_plantilla_desde_familias_repeat no crea columna generica desde text_col solo", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("begin_repeat", "select_multiple lst_need", "text", "end_repeat"),
      name = c("hh", "need", "need_detail", "hh_end"),
      relevant = c(NA, NA, "selected(${need}, '70')", NA),
      `label::Spanish (ES)` = c(NA, "Necesidad principal", "Detalle de necesidad", NA),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_need", "lst_need"),
      name = c("1", "70"),
      `label::Spanish (ES)` = c("Trabajo", "Servicio comunitario"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  tabs <- list(
    hh = make_codif_dat(data.frame(
      `_uuid` = c("u1", "u2"),
      `_index` = c(1, 2),
      need = c("1 70", "1"),
      need_detail = c("Red local", NA),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ))
  )
  fam <- list(
    select_one = tibble::tibble(),
    select_multiple = tibble::tibble(
      section = "hh",
      hoja_datos = "hh",
      use = TRUE,
      q_order = 2L,
      tipo = "select_multiple",
      parent = "need",
      parent_label = "Necesidad principal",
      list_norm = "lst_need",
      parent_col = "need",
      other_dummy_col = "",
      text_col = "need_detail"
    ),
    text = tibble::tibble(),
    integer = tibble::tibble(),
    adopciones = tibble::tibble(),
    choices_usadas = NULL
  )

  plantilla <- prosecnur::construir_plantilla_desde_familias_repeat(inst, tabs, fam)
  sheet_need <- plantilla$sheets[["need"]]
  expect_false("Otro, por favor especificar" %in% names(sheet_need))
})

test_that("leer_familias_clasificar exige modo_so para select_one", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_one lst_mode", "text"),
      name = c("mode", "mode_detail"),
      relevant = c(NA, "${mode} = '96'"),
      `label::Spanish (ES)` = c("Modo principal", "Detalle modo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_mode", "lst_mode"),
      name = c("1", "96"),
      `label::Spanish (ES)` = c("Presencial", "Canal alternativo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    mode = c("96", "1"),
    mode_detail = c("Mixto", NA),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_familias <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_familias), add = TRUE)

  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)

  expect_error(
    prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE),
    regexp = "modo_so.*padre.*hijo",
    perl = TRUE
  )
})

test_that("exportar plantilla codificacion separa select_one e integer con bloque auxiliar", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_one lst_mode", "text", "select_multiple lst_need", "text", "integer"),
      name = c("mode", "mode_detail", "need", "need_detail", "age"),
      relevant = c(NA, "${mode} = '96'", NA, "selected(${need}, '70')", NA),
      `label::Spanish (ES)` = c("Modo principal", "Detalle modo", "Necesidad principal", "Detalle de necesidad", "Edad"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_mode", "lst_mode", "lst_need", "lst_need"),
      name = c("1", "96", "1", "70"),
      `label::Spanish (ES)` = c("Presencial", "Canal alternativo", "Trabajo", "Servicio comunitario"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    `_index` = c(1, 2),
    mode = c("96", "1"),
    mode_detail = c("Mixto", NA),
    need = c("1 70", "1"),
    `need/1` = c(1, 1),
    `need/70` = c(1, 0),
    need_detail = c("Red local", NA),
    age = c(35, 29),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_familias <- tempfile(fileext = ".xlsx")
  path_tpl <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(path_familias, path_tpl)), add = TRUE)

  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  set_familias_modo_so(path_familias, c(mode = "padre"))
  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  plantilla <- prosecnur::construir_plantilla_desde_familias(inst, dat, fam)
  prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  instr <- readxl::read_excel(path_tpl, sheet = "INSTRUCCIONES", col_names = FALSE)
  instr_lines <- as.character(unlist(instr, use.names = FALSE))
  instr_lines <- instr_lines[!is.na(instr_lines) & nzchar(instr_lines)]
  expect_true(any(grepl("modo padre", instr_lines, ignore.case = TRUE)))
  expect_true(any(grepl("nuevo_codigo y nueva_etiqueta", instr_lines, fixed = TRUE)))
  expect_true(any(grepl("integer", instr_lines, ignore.case = TRUE)))

  hdr_mode <- read_sheet_headers(path_tpl, "mode")
  expect_true("mode" %in% as.character(hdr_mode[1, ]))
  expect_true("mode_label" %in% as.character(hdr_mode[1, ]))
  expect_true("mode_recod" %in% as.character(hdr_mode[1, ]))
  expect_false("mode_detail_recod" %in% as.character(hdr_mode[1, ]))
  expect_true("nuevo_codigo" %in% as.character(hdr_mode[1, ]))
  expect_true("nueva_etiqueta" %in% as.character(hdr_mode[1, ]))
  expect_true("Código final de la variable" %in% as.character(hdr_mode[2, ]))
  expect_true("Detalle modo (referencia)" %in% as.character(hdr_mode[2, ]))

  hdr_age <- read_sheet_headers(path_tpl, "age")
  expect_true("age_recod" %in% as.character(hdr_age[1, ]))
  expect_true("nuevo_codigo" %in% as.character(hdr_age[1, ]))
  expect_true("nueva_etiqueta" %in% as.character(hdr_age[1, ]))
  expect_true("Código final" %in% as.character(hdr_age[2, ]))

  need_sheet <- readxl::read_excel(path_tpl, sheet = "need", col_names = FALSE)
  need_vals <- as.character(unlist(need_sheet, use.names = FALSE))
  expect_true("need/ejemplo_recod" %in% need_vals)
  expect_true("Ejemplo: etiqueta visible" %in% need_vals)
  expect_true("1" %in% need_vals)
  expect_true("0" %in% need_vals)

  cmts <- count_workbook_comments(path_tpl)
  expect_match(cmts$text, "bloque auxiliar", ignore.case = TRUE)
  expect_match(cmts$text, "nuevas categorías", ignore.case = TRUE)
  expect_match(cmts$text, "select_multiple", ignore.case = TRUE)
  expect_match(cmts$text, "no se adapta", ignore.case = TRUE)
  expect_match(cmts$text, "La posición de la nueva columna no es obligatoria", fixed = TRUE)
  expect_match(cmts$text, "fila 1 = need/&lt;nuevo_codigo&gt;_recod", fixed = TRUE)
})

test_that("ppra_adaptar_data usa el bloque auxiliar para integer", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("integer"),
      name = c("age"),
      `label::Spanish (ES)` = c("Edad"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = character(0),
      name = character(0),
      `label::Spanish (ES)` = character(0),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    `_index` = c(1, 2),
    age = c(35, 29),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_inst <- tempfile(fileext = ".xlsx")
  path_data <- tempfile(fileext = ".xlsx")
  path_familias <- tempfile(fileext = ".xlsx")
  path_tpl <- tempfile(fileext = ".xlsx")
  path_out <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(path_inst, path_data, path_familias, path_tpl, path_out)), add = TRUE)

  write_codif_inst_xlsx(inst, path_inst)
  openxlsx::write.xlsx(list(data = dat$raw), file = path_data, overwrite = TRUE)
  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  expect_s3_class(fam$integer, "data.frame")
  expect_identical(fam$integer$parent[[1]], "age")
  plantilla <- prosecnur::construir_plantilla_desde_familias(inst, dat, fam)
  prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  wb <- openxlsx::loadWorkbook(path_tpl)
  hdr_age <- read_sheet_headers(path_tpl, "age")
  col_age <- which(as.character(hdr_age[1, ]) == "age_recod")
  col_new_code <- which(as.character(hdr_age[1, ]) == "nuevo_codigo")
  col_new_label <- which(as.character(hdr_age[1, ]) == "nueva_etiqueta")
  openxlsx::writeData(wb, "age", x = c("1", "2"), startCol = col_age, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "age", x = c("1", "2"), startCol = col_new_code, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "age", x = c("Adulto", "Mayor"), startCol = col_new_label, startRow = 3, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path_tpl, overwrite = TRUE)

  prosecnur::ppra_adaptar_data(
    path_instrumento = path_inst,
    path_datos = path_data,
    path_plantilla = path_tpl,
    int_vars = "age",
    out_path = path_out
  )

  out <- readxl::read_excel(path_out, sheet = "data")
  expect_identical(as.character(out$age_recod), c("1", "2"))
  expect_false("age_recod_label" %in% names(out))
})

test_that("ppra_adaptar_data e instrumento resuelven select_one modo padre con bloque auxiliar", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_one lst_mode", "text"),
      name = c("mode", "mode_detail"),
      relevant = c(NA, "${mode} = '96'"),
      `label::Spanish (ES)` = c("Modo principal", "Detalle modo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_mode", "lst_mode"),
      name = c("1", "96"),
      `label::Spanish (ES)` = c("Presencial", "Canal alternativo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    `_index` = c(1, 2),
    mode = c("96", "1"),
    mode_detail = c("Mixto", NA),
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

  write_codif_inst_xlsx(inst, path_inst)
  openxlsx::write.xlsx(list(data = dat$raw), file = path_data, overwrite = TRUE)
  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  set_familias_modo_so(path_familias, c(mode = "padre"))
  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  plantilla <- prosecnur::construir_plantilla_desde_familias(inst, dat, fam)
  prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  wb <- openxlsx::loadWorkbook(path_tpl)
  hdr_mode <- read_sheet_headers(path_tpl, "mode")
  col_mode_recod <- which(as.character(hdr_mode[1, ]) == "mode_recod")
  col_new_code <- which(as.character(hdr_mode[1, ]) == "nuevo_codigo")
  col_new_label <- which(as.character(hdr_mode[1, ]) == "nueva_etiqueta")
  openxlsx::writeData(wb, "mode", x = "3", startCol = col_mode_recod, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "mode", x = "3", startCol = col_new_code, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "mode", x = "Canal mixto", startCol = col_new_label, startRow = 3, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path_tpl, overwrite = TRUE)

  prosecnur::ppra_adaptar_data(
    path_instrumento = path_inst,
    path_datos = path_data,
    path_plantilla = path_tpl,
    so_parent_vars = "mode",
    out_path = path_out_data
  )

  out <- readxl::read_excel(path_out_data, sheet = "data")
  expect_identical(as.character(out$mode_recod[[1]]), "3")
  expect_false("mode_recod_label" %in% names(out))

  prosecnur::ppra_adaptar_instrumento(
    path_instrumento_in = path_inst,
    path_data_adaptada = path_out_data,
    path_instrumento_out = path_out_inst,
    path_plantilla = path_tpl,
    so_parent_vars = "mode"
  )

  choices_out <- readxl::read_excel(path_out_inst, sheet = "choices")
  lst_mode_recod <- choices_out[choices_out$list_name == "lst_mode_recod", , drop = FALSE]
  label_col <- names(choices_out)[match(TRUE, tolower(names(choices_out)) %in% c(
    "label::spanish (es)", "label::spanish(es)", "label::spanish_es",
    "label_spanish_es", "label::spanish", "label", "label::es"
  ))]
  expect_true("3" %in% as.character(lst_mode_recod$name))
  expect_identical(
    as.character(lst_mode_recod[[label_col]][match("3", as.character(lst_mode_recod$name))]),
    "Canal mixto"
  )
})

test_that("ppra_adaptar_data e instrumento preservan labels de codigos nuevos en select_multiple", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_multiple lst_need", "text"),
      name = c("need", "need_detail"),
      relevant = c(NA, "selected(${need}, '70')"),
      `label::Spanish (ES)` = c("Necesidad principal", "Detalle necesidad"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_need", "lst_need"),
      name = c("1", "70"),
      `label::Spanish (ES)` = c("Trabajo", "Servicio comunitario"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    `_index` = c(1, 2),
    need = c("1 70", "1"),
    `need/1` = c(1, 1),
    `need/70` = c(1, 0),
    need_detail = c("Red local", NA),
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

  write_codif_inst_xlsx(inst, path_inst)
  openxlsx::write.xlsx(list(data = dat$raw), file = path_data, overwrite = TRUE)
  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  plantilla <- prosecnur::construir_plantilla_desde_familias(inst, dat, fam)
  prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  wb <- openxlsx::loadWorkbook(path_tpl)
  hdr_need <- read_sheet_headers(path_tpl, "need")
  col_new <- ncol(hdr_need) + 1L
  openxlsx::writeData(wb, "need", x = "need/99_recod", startCol = col_new, startRow = 1, colNames = FALSE)
  openxlsx::writeData(wb, "need", x = "Apoyo digital", startCol = col_new, startRow = 2, colNames = FALSE)
  openxlsx::writeData(wb, "need", x = "1", startCol = col_new, startRow = 3, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path_tpl, overwrite = TRUE)

  prosecnur::ppra_adaptar_data(
    path_instrumento = path_inst,
    path_datos = path_data,
    path_plantilla = path_tpl,
    sm_vars = "need",
    out_path = path_out_data
  )

  out <- readxl::read_excel(path_out_data, sheet = "data")
  expect_true("need_recod" %in% names(out))
  expect_false("need_recod_label" %in% names(out))
  expect_match(as.character(out$need_recod[[1]]), "(^|\\s)99(\\s|$)", perl = TRUE)

  prosecnur::ppra_adaptar_instrumento(
    path_instrumento_in = path_inst,
    path_data_adaptada = path_out_data,
    path_instrumento_out = path_out_inst,
    path_plantilla = path_tpl,
    sm_vars = "need"
  )

  choices_out <- readxl::read_excel(path_out_inst, sheet = "choices")
  lst_need_recod <- choices_out[choices_out$list_name == "lst_need_recod", , drop = FALSE]
  label_col <- names(choices_out)[match(TRUE, tolower(names(choices_out)) %in% c(
    "label::spanish (es)", "label::spanish(es)", "label::spanish_es",
    "label_spanish_es", "label::spanish", "label", "label::es"
  ))]
  expect_true("99" %in% as.character(lst_need_recod$name))
  expect_identical(
    as.character(lst_need_recod[[label_col]][match("99", as.character(lst_need_recod$name))]),
    "Apoyo digital"
  )
})

test_that("ppra_adaptar_data e instrumento resuelven select_one modo hijo con bloque auxiliar", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_one lst_mode", "text"),
      name = c("mode", "mode_detail"),
      relevant = c(NA, "${mode} = '96'"),
      `label::Spanish (ES)` = c("Modo principal", "Detalle modo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_mode", "lst_mode"),
      name = c("1", "96"),
      `label::Spanish (ES)` = c("Presencial", "Canal alternativo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    `_index` = c(1, 2),
    mode = c("96", "1"),
    mode_detail = c("Mixto", NA),
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

  write_codif_inst_xlsx(inst, path_inst)
  openxlsx::write.xlsx(list(data = dat$raw), file = path_data, overwrite = TRUE)
  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  set_familias_modo_so(path_familias, c(mode = "hijo"))
  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  plantilla <- prosecnur::construir_plantilla_desde_familias(inst, dat, fam)
  prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  hdr_mode <- read_sheet_headers(path_tpl, "mode")
  expect_false("mode_recod" %in% as.character(hdr_mode[1, ]))
  expect_true("mode_detail_recod" %in% as.character(hdr_mode[1, ]))

  wb <- openxlsx::loadWorkbook(path_tpl)
  col_child_recod <- which(as.character(hdr_mode[1, ]) == "mode_detail_recod")
  col_new_code <- which(as.character(hdr_mode[1, ]) == "nuevo_codigo")
  col_new_label <- which(as.character(hdr_mode[1, ]) == "nueva_etiqueta")
  openxlsx::writeData(wb, "mode", x = "7", startCol = col_child_recod, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "mode", x = "7", startCol = col_new_code, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "mode", x = "Canal mixto extendido", startCol = col_new_label, startRow = 3, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path_tpl, overwrite = TRUE)

  prosecnur::ppra_adaptar_data(
    path_instrumento = path_inst,
    path_datos = path_data,
    path_plantilla = path_tpl,
    so_child_vars = "mode",
    path_familias = path_familias,
    out_path = path_out_data
  )

  out <- readxl::read_excel(path_out_data, sheet = "data")
  expect_false("mode_recod" %in% names(out))
  expect_identical(as.character(out$mode_detail_recod[[1]]), "7")
  expect_false("mode_detail_recod_label" %in% names(out))

  prosecnur::ppra_adaptar_instrumento(
    path_instrumento_in = path_inst,
    path_data_adaptada = path_out_data,
    path_instrumento_out = path_out_inst,
    path_plantilla = path_tpl,
    so_child_vars = "mode"
  )

  survey_out <- readxl::read_excel(path_out_inst, sheet = "survey")
  choices_out <- readxl::read_excel(path_out_inst, sheet = "choices")
  expect_true("mode_detail_recod" %in% survey_out$name)
  expect_true(any(grepl("select_one lst_mode_detail_recod", survey_out$type, fixed = TRUE)))
  expect_true("lst_mode_detail_recod" %in% choices_out$list_name)
})

test_that("ppra_adaptar_data devuelve un error claro si el bloque auxiliar tiene etiquetas inconsistentes", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("select_one lst_mode", "text"),
      name = c("mode", "mode_detail"),
      relevant = c(NA, "${mode} = '96'"),
      `label::Spanish (ES)` = c("Modo principal", "Detalle modo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_mode", "lst_mode"),
      name = c("1", "96"),
      `label::Spanish (ES)` = c("Presencial", "Canal alternativo"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  dat <- make_codif_dat(data.frame(
    `_uuid` = c("u1", "u2"),
    `_index` = c(1, 2),
    mode = c("96", "1"),
    mode_detail = c("Mixto", NA),
    check.names = FALSE,
    stringsAsFactors = FALSE
  ))
  path_inst <- tempfile(fileext = ".xlsx")
  path_data <- tempfile(fileext = ".xlsx")
  path_familias <- tempfile(fileext = ".xlsx")
  path_tpl <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(path_inst, path_data, path_familias, path_tpl)), add = TRUE)

  write_codif_inst_xlsx(inst, path_inst)
  openxlsx::write.xlsx(list(data = dat$raw), file = path_data, overwrite = TRUE)
  prosecnur::escribir_plantilla_familias(inst, dat, path = path_familias)
  set_familias_modo_so(path_familias, c(mode = "padre"))
  fam <- prosecnur::leer_familias_clasificar(path_familias, inst, dat, verbose = FALSE)
  plantilla <- prosecnur::construir_plantilla_desde_familias(inst, dat, fam)
  prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  wb <- openxlsx::loadWorkbook(path_tpl)
  hdr_mode <- read_sheet_headers(path_tpl, "mode")
  col_mode_recod <- which(as.character(hdr_mode[1, ]) == "mode_recod")
  col_new_code <- which(as.character(hdr_mode[1, ]) == "nuevo_codigo")
  col_new_label <- which(as.character(hdr_mode[1, ]) == "nueva_etiqueta")
  openxlsx::writeData(wb, "mode", x = c("3", "3"), startCol = col_mode_recod, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "mode", x = c("3", "3"), startCol = col_new_code, startRow = 3, colNames = FALSE)
  openxlsx::writeData(wb, "mode", x = c("Canal mixto", "Canal C"), startCol = col_new_label, startRow = 3, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path_tpl, overwrite = TRUE)

  expect_error(
    prosecnur::ppra_adaptar_data(
      path_instrumento = path_inst,
      path_datos = path_data,
      path_plantilla = path_tpl,
      so_parent_vars = "mode"
    ),
    regexp = "código nuevo '3'.*más de una etiqueta declarada.*bloque auxiliar",
    perl = TRUE
  )
})

test_that("ppra_adaptar_instrumento reutiliza listas iguales para integer", {
  inst <- make_codif_inst(
    survey = data.frame(
      type = c("integer", "integer"),
      name = c("age", "score"),
      `label::Spanish (ES)` = c("Edad", "Puntaje"),
      check.names = FALSE,
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = character(0),
      name = character(0),
      `label::Spanish (ES)` = character(0),
      check.names = FALSE,
      stringsAsFactors = FALSE
    )
  )
  data_adapt <- data.frame(
    age = c(35, 40),
    age_recod = c("1", "2"),
    age_recod_label = c("Adulto", "Mayor"),
    score = c(10, 20),
    score_recod = c("2", "1"),
    score_recod_label = c("Mayor", "Adulto"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  path_inst <- tempfile(fileext = ".xlsx")
  path_out_inst <- tempfile(fileext = ".xlsx")
  on.exit(unlink(c(path_inst, path_out_inst)), add = TRUE)

  write_codif_inst_xlsx(inst, path_inst)
  prosecnur::ppra_adaptar_instrumento(
    path_instrumento_in = path_inst,
    path_data_adaptada = data_adapt,
    path_instrumento_out = path_out_inst,
    integer_vars = c("age", "score")
  )

  survey_out <- readxl::read_excel(path_out_inst, sheet = "survey")
  choices_out <- readxl::read_excel(path_out_inst, sheet = "choices")
  type_age <- survey_out$type[match("age_recod", survey_out$name)]
  type_score <- survey_out$type[match("score_recod", survey_out$name)]
  expect_identical(type_age, "select_one lst_age_recod")
  expect_identical(type_score, "select_one lst_age_recod")
  expect_identical(unique(choices_out$list_name), "lst_age_recod")
})

test_that("codificacion adapta preguntas text independientes", {
  td <- tempfile("text_recode_")
  dir.create(td)
  on.exit(unlink(td, recursive = TRUE, force = TRUE), add = TRUE)

  path_inst <- file.path(td, "inst.xlsx")
  wb_inst <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb_inst, "survey")
  openxlsx::addWorksheet(wb_inst, "choices")
  openxlsx::addWorksheet(wb_inst, "settings")
  openxlsx::writeData(
    wb_inst, "survey",
    data.frame(type = "text", name = "p1", label = "Institucion", stringsAsFactors = FALSE)
  )
  openxlsx::writeData(
    wb_inst, "choices",
    data.frame(list_name = character(), name = character(), label = character(), stringsAsFactors = FALSE)
  )
  openxlsx::writeData(
    wb_inst, "settings",
    data.frame(form_title = "t", form_id = "t", stringsAsFactors = FALSE)
  )
  openxlsx::saveWorkbook(wb_inst, path_inst, overwrite = TRUE)

  path_data <- file.path(td, "data.xlsx")
  dat_raw <- data.frame(uuid = c("a", "b"), p1 = c("Uba", "Otra"), stringsAsFactors = FALSE)
  names(dat_raw)[1] <- "_uuid"
  openxlsx::write.xlsx(dat_raw, path_data)

  inst <- leer_instrumento_xlsform(path_inst)
  dat <- list(raw = readxl::read_excel(path_data))

  path_fam <- file.path(td, "familias.xlsx")
  fam <- data.frame(
    use = TRUE,
    tipo = "text",
    modo_so = "",
    parent = "p1",
    parent_label = "Institucion",
    q_order = 1,
    list_norm = "",
    parent_col = "p1",
    other_dummy_col = "",
    text_col = "",
    stringsAsFactors = FALSE
  )
  wb_fam <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb_fam, "familias")
  openxlsx::writeData(wb_fam, "familias", fam)
  openxlsx::saveWorkbook(wb_fam, path_fam, overwrite = TRUE)

  split <- leer_familias_clasificar(path_fam, inst = inst, dat = dat, verbose = FALSE)
  expect_equal(nrow(split$text), 1L)

  plantilla <- construir_plantilla_desde_familias(inst = inst, dat = dat, split = split)
  path_tpl <- file.path(td, "plantilla.xlsx")
  exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = path_tpl, inst = inst)

  wb_tpl <- openxlsx::loadWorkbook(path_tpl)
  grupos <- list(list(
    codigo = "1",
    etiqueta = "Universidad de Buenos Aires",
    origen = "nuevo",
    respuestas = list("Uba")
  ))
  expect_true(.patch_text_sheet(wb_tpl, "p1", "p1_recod", "p1", grupos, dat$raw))
  openxlsx::saveWorkbook(wb_tpl, path_tpl, overwrite = TRUE)

  path_data_out <- file.path(td, "data_adaptada.xlsx")
  ppra_adaptar_data(
    path_instrumento = path_inst,
    path_datos = path_data,
    path_plantilla = path_tpl,
    text_vars = "p1",
    out_path = path_data_out,
    path_familias = path_fam
  )
  data_out <- readxl::read_excel(path_data_out)
  expect_true("p1_recod" %in% names(data_out))
  expect_identical(as.character(data_out$p1_recod[1]), "1")

  path_inst_out <- file.path(td, "inst_adaptado.xlsx")
  ppra_adaptar_instrumento(
    path_instrumento_in = path_inst,
    path_data_adaptada = path_data_out,
    path_instrumento_out = path_inst_out,
    text_vars = "p1",
    path_plantilla = path_tpl
  )
  survey_out <- readxl::read_excel(path_inst_out, sheet = "survey")
  choices_out <- readxl::read_excel(path_inst_out, sheet = "choices")
  expect_true("p1_recod" %in% as.character(survey_out$name))
  expect_true("lst_p1_recod" %in% as.character(choices_out$list_name))
})

test_that("reporte_cruces excluye categorias tambien en la variable de cruce", {
  path_cross <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path_cross), add = TRUE)

  dat <- data.frame(
    v_cat = c("1", "1", "2", "2"),
    v_num = c(10, 20, 30, 40),
    estr = c("1", "99", "1", "99"),
    stringsAsFactors = FALSE
  )

  attr(dat$v_cat, "label") <- "Variable categorica"
  attr(dat$v_cat, "labels") <- stats::setNames(c("Si", "No"), c("1", "2"))
  attr(dat$v_num, "label") <- "Variable numerica"
  attr(dat$estr, "label") <- "Estrato"
  attr(dat$estr, "labels") <- stats::setNames(
    c("Grupo A", "Valor perdido por el sistema"),
    c("1", "99")
  )

  inst <- list(
    survey = data.frame(
      name = c("v_cat", "v_num", "estr"),
      label = c("Variable categorica", "Variable numerica", "Estrato"),
      type = c("select_one si_no", "integer", "select_one estrato"),
      stringsAsFactors = FALSE
    ),
    orders_list = list(
      v_cat = list(
        names = c("1", "2"),
        labels = c("Si", "No"),
        label = "Variable categorica"
      ),
      estr = list(
        names = c("1", "99"),
        labels = c("Grupo A", "Valor perdido por el sistema"),
        label = "Estrato"
      )
    )
  )

  expect_no_error(
    prosecnur::reporte_cruces(
      data = dat,
      instrumento = inst,
      SECCIONES = list(Principal = c("v_cat", "v_num")),
      cruces = c("estr"),
      path_xlsx = path_cross,
      opciones_excluir = c("Valor perdido por el sistema"),
      numericas = c("v_num"),
      show_sig = FALSE
    )
  )

  expect_true(file.exists(path_cross))

  wb_vals <- openxlsx::read.xlsx(path_cross, sheet = 1, colNames = FALSE)
  wb_chr <- as.character(unlist(wb_vals, use.names = FALSE))
  wb_chr <- wb_chr[!is.na(wb_chr)]

  expect_false(any(wb_chr == "Valor perdido por el sistema"))
})
