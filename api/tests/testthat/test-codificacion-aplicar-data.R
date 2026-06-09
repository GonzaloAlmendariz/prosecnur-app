test_that("SM adaptation joins by row index and preserves tokenized mothers", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("readxl")

  td <- tempfile("codif_sm_")
  dir.create(td)
  inst_path <- file.path(td, "instrumento.xlsx")
  data_path <- file.path(td, "data.xlsx")
  tpl_path <- file.path(td, "plantilla.xlsx")
  fam_path <- file.path(td, "familias.xlsx")

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "survey")
  openxlsx::writeData(
    wb, "survey",
    data.frame(
      type = "select_multiple lst_p19",
      name = "p19",
      label = "SM",
      stringsAsFactors = FALSE
    )
  )
  openxlsx::addWorksheet(wb, "choices")
  openxlsx::writeData(
    wb, "choices",
      data.frame(
        list_name = "lst_p19",
        name = c("1", "6"),
        label = c("IA", "Otro"),
        stringsAsFactors = FALSE
      )
  )
  openxlsx::saveWorkbook(wb, inst_path, overwrite = TRUE)

  openxlsx::write.xlsx(
    data.frame(
      `_index` = 1:3,
      p19 = c("1 6", "1", ""),
      p19_other = c("cloud", "", ""),
      check.names = FALSE
    ),
    data_path,
    overwrite = TRUE
  )

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "p19")
  openxlsx::writeData(
    wb, "p19",
    data.frame(
      `_index` = c("Indice", "1", "2", "3"),
      `p19/1_recod` = c("Recod", "", "1", ""),
      `p19/6_recod` = c("Recod", "", "", ""),
      `p19/7_recod` = c("Recod", "1", "", ""),
      check.names = FALSE
    )
  )
  openxlsx::saveWorkbook(wb, tpl_path, overwrite = TRUE)

  openxlsx::write.xlsx(
    data.frame(parent = "p19", text_col = "p19_other", stringsAsFactors = FALSE),
    fam_path,
    overwrite = TRUE
  )

  out <- ppra_adaptar_data(
    path_instrumento = inst_path,
    path_datos = data_path,
    path_plantilla = tpl_path,
    sm_vars = "p19",
    path_familias = fam_path
  )

  expect_equal(as.character(out$p19_recod), c("1 7", "1", NA_character_))
})

test_that("blank id columns are not treated as usable join keys", {
  x <- data.frame(`_index` = c(NA, NA), check.names = FALSE)
  y <- data.frame(`_index` = c(NA, NA), check.names = FALSE)

  expect_true(is.na(pick_join_key_pair(x, y)))
})

test_that("respondent_id is preferred over row index for SurveyMonkey joins", {
  x <- data.frame(respondent_id = c("r1", "r2"), `_index` = 1:2, check.names = FALSE)
  y <- data.frame(respondent_id = c("r1", "r2"), `_index` = 2:1, check.names = FALSE)

  expect_equal(pick_join_key_pair(x, y), "respondent_id")
})

test_that("new codification groups with blank labels get an auxiliary fallback label", {
  lookup <- .match_grupos(list(list(
    codigo = "15",
    etiqueta = "",
    origen = "nuevo",
    respuestas = list("universidad hermilio valdizan")
  )))

  expect_equal(unname(lookup$new_codes[["15"]]), "sin etiqueta")
})

test_that("new codification groups avoid reserved code collisions", {
  lookup <- .match_grupos(
    list(
      list(
        codigo = "2",
        etiqueta = "CENTRUM",
        origen = "nuevo",
        respuestas = list("centrum")
      ),
      list(
        codigo = "3",
        etiqueta = "UNI",
        origen = "nuevo",
        respuestas = list("codea uni")
      )
    ),
    reserved_codes = c("1", "2", "3")
  )

  expect_true(exists("centrum", envir = lookup$text_to_code, inherits = FALSE))
  expect_equal(get("centrum", envir = lookup$text_to_code), "4")
  expect_equal(get("codea uni", envir = lookup$text_to_code), "5")
  expect_equal(unname(unlist(lookup$new_codes)), c("CENTRUM", "UNI"))
  expect_equal(names(lookup$new_codes), c("4", "5"))
})

test_that("codificacion resolves adopted text groups to their owner variable", {
  rows <- list(
    list(tipo = "select_one", modo_so = "padre", parent = "p12", parent_col = "p12", text_col = "p12_other"),
    list(tipo = "text", parent = "p12_other", parent_col = "p12_other", text_col = "p12_other"),
    list(tipo = "text", parent = "p21", parent_col = "p21", text_col = "p21")
  )

  idx <- .codif_group_row_indexes(rows)

  expect_equal(.codif_group_owner_row("p12_other", idx)$parent, "p12")
  expect_equal(.codif_group_owner_row("p21", idx)$parent, "p21")
})

test_that("adaptation variable filter keeps parent when groups are stored by text_col", {
  split_select_one <- data.frame(
    parent = "p12",
    parent_col = "p12",
    text_col = "p12_other",
    modo_so = "padre",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  expect_equal(
    .codif_vars_from_split(split_select_one, group_keys = "p12_other", modo = "padre"),
    "p12"
  )
})

test_that("codificacion usa etiquetas reales de choices aunque label generico venga vacio", {
  inst <- list(
    choices = data.frame(
      list_name = c("Empresa Mexico", "Empresa Mexico"),
      list_norm = c("empresa_mexico", "empresa_mexico"),
      name = c("1", "2"),
      label = c("", ""),
      label_spanish_es = c("Instituto para la Proteccion al Ahorro Bancario", "Comision Nacional del Agua"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  lookup <- .choices_lookup(inst, "empresa_mexico")
  expect_equal(unname(lookup["1"]), "Instituto para la Proteccion al Ahorro Bancario")
  expect_equal(unname(lookup["2"]), "Comision Nacional del Agua")

  opciones <- .opciones_sm("p10_mexico", "empresa_mexico", inst, data.frame(p10_mexico = c("1", "2")))
  expect_equal(opciones[[1]]$label, "Instituto para la Proteccion al Ahorro Bancario")
  expect_equal(opciones[[2]]$label, "Comision Nacional del Agua")
})

test_that("codificacion rehidrata etiquetas de preguntas desde el XLSForm integrado", {
  inst <- list(
    survey = data.frame(
      type = c("select_one lst_p4", "select_one lst_p13"),
      name = c("p4", "p13"),
      label = c("p4", "p13"),
      `label::es` = c("Orientacion sexual", "Tipo de cargo actual"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    survey_raw = data.frame(
      type = c("select_one lst_p4", "select_one lst_p13"),
      name = c("p4", "p13"),
      label = c("p4", "p13"),
      `label::es` = c("Orientacion sexual", "Tipo de cargo actual"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  expect_equal(.codif_var_label(inst, "p4", "p4"), "Orientacion sexual")
  expect_equal(.codif_var_label(inst, "p13", ""), "Tipo de cargo actual")
})

test_that("modo hijo legacy sin recod autonoma vuelve a codificar variable original", {
  sid <- session_create()
  draft <- list(rows = list(list(
    use = TRUE,
    tipo = "select_one",
    modo_so = "hijo",
    parent = "p10_mexico",
    parent_col = "",
    text_col = "p10_mexico_other"
  )))
  data_df <- data.frame(
    p10_mexico = c("1", "2"),
    p10_mexico_other = c("", "Sistema de Gestion"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- .codif_normalize_legacy_select_one_modes(sid, draft, data_df)

  expect_equal(out$rows[[1]]$modo_so, "padre")
  expect_equal(out$rows[[1]]$parent_col, "p10_mexico")
  expect_equal(out$rows[[1]]$modo_so_migrated_reason, "legacy_default_without_child_recod")
})

test_that("modo hijo explicito o con recod autonoma no se migra", {
  sid <- session_create()
  data_df <- data.frame(
    p10_mexico = "1",
    p10_mexico_other = "Sistema de Gestion",
    p10_mexico_other_recod = "6",
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  explicit <- list(rows = list(list(
    use = TRUE,
    tipo = "select_one",
    modo_so = "hijo",
    modo_so_explicit = TRUE,
    parent = "p10_mexico",
    parent_col = "",
    text_col = "p10_mexico_other"
  )))
  materialized <- list(rows = list(list(
    use = TRUE,
    tipo = "select_one",
    modo_so = "hijo",
    parent = "p10_mexico",
    parent_col = "",
    text_col = "p10_mexico_other"
  )))

  expect_equal(.codif_normalize_legacy_select_one_modes(sid, explicit, data_df)$rows[[1]]$modo_so, "hijo")
  expect_equal(.codif_normalize_legacy_select_one_modes(sid, materialized, data_df)$rows[[1]]$modo_so, "hijo")
})
