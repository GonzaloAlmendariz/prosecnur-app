make_consistency_fixture <- function(path_xlsx) {
  survey <- tibble::tibble(
    type = c(
      "begin_group",
      "select_one yesno",
      "integer",
      "text",
      "select_one region_list",
      "select_one color_list",
      "integer",
      "begin_repeat",
      "integer",
      "text",
      "end_repeat",
      "calculate",
      "calculate",
      "end_group"
    ),
    name = c(
      "main_sec",
      "enable",
      "age",
      "ExpOpinion",
      "region",
      "favorite_color",
      "age_check",
      "rep_household",
      "rep_num",
      "rep_text",
      "",
      "total_num",
      "raw_num",
      ""
    ),
    label = c(
      "Main",
      "Enable",
      "Age",
      "Opinion",
      "Region",
      "Favorite color",
      "Age check",
      "Household",
      "Repeat number",
      "Repeat text",
      "",
      "Total num",
      "Raw num",
      ""
    ),
    required = c(
      "",
      "",
      "true()",
      "",
      "",
      "",
      "",
      "",
      "true()",
      "",
      "",
      "",
      "",
      ""
    ),
    relevant = c(
      "",
      "",
      "",
      "${enable} = '1'",
      "",
      "",
      "",
      "${enable} = '1'",
      "",
      "",
      "",
      "",
      "",
      ""
    ),
    constraint = c(
      "",
      "",
      "",
      "",
      "",
      "",
      ". >= 0 and . <= 120",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ),
    calculation = c(
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "sum(${rep_num})",
      "${rep_num}",
      ""
    ),
    choice_filter = c(
      "",
      "",
      "",
      "",
      "",
      "filter_region = ${region}",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ),
    appearance = "",
    hint = "",
    repeat_count = ""
  )

  choices <- tibble::tibble(
    list_name = c(
      "yesno", "yesno",
      "region_list", "region_list",
      "color_list", "color_list"
    ),
    name = c("1", "0", "costa", "sierra", "rojo", "azul"),
    label = c("Si", "No", "Costa", "Sierra", "Rojo", "Azul"),
    filter_region = c("", "", "", "", "costa", "sierra")
  )

  settings <- tibble::tibble(
    form_title = "Auditoria consistencia",
    version = "1.0",
    default_language = "es"
  )

  openxlsx::write.xlsx(
    list(survey = survey, choices = choices, settings = settings),
    file = path_xlsx,
    overwrite = TRUE
  )

  principal <- tibble::tibble(
    enable = c("1", "0", "1"),
    age = c("", "25", "40"),
    ExpOpinion = c("", "", ""),
    region = c("costa", "sierra", "costa"),
    favorite_color = c("azul", "azul", "rojo"),
    age_check = c("130", "25", "40"),
    total_num = c("4", "0", "4"),
    raw_num = c("2", "", "4")
  )

  rep_household <- tibble::tibble(
    `_parent_index` = c(1L, 1L, 3L),
    rep_num = c("2", "3", "4"),
    rep_text = c("a", "b", "c")
  )

  list(
    datos = list(principal = principal, rep_household = rep_household)
  )
}

test_that("generar_plan_limpieza conserva calculate ambiguo y no emite debug fijo", {
  skip_if_not_installed("openxlsx")

  path_xlsx <- tempfile(fileext = ".xlsx")
  fixture <- make_consistency_fixture(path_xlsx)
  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)

  expect_no_message({
    plan <- prosecnur::generar_plan_limpieza(inst)
  })

  expect_true("calc_raw_num_eq" %in% plan$`Nombre de regla`)
  expect_true(all(is.na(plan$`Agreg Var2`[plan$`Nombre de regla` == "calc_raw_num_eq"])))
})

test_that("relevant no genera salto_debe para preguntas no required", {
  skip_if_not_installed("openxlsx")

  path_xlsx <- tempfile(fileext = ".xlsx")
  make_consistency_fixture(path_xlsx)
  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)
  plan <- prosecnur::generar_plan_limpieza(inst)

  expect_false("salto_ExpOpinion_debe" %in% plan$`Nombre de regla`)
  expect_true("salto_ExpOpinion_nodebe" %in% plan$`Nombre de regla`)
})

test_that("generar_plan_limpieza tipa comparaciones numericas en relevantes", {
  survey <- tibble::tibble(
    type = c("begin_repeat", "calculate", "select_one marital", "end_repeat"),
    name = c("S1", "HH07", "HH08", ""),
    label = c("S1", "Edad", "Estado civil", ""),
    relevant = c("", "", "${HH07}>=18", ""),
    required = c("", "", "true()", ""),
    constraint = c("", "", "", ""),
    calculation = c("", "today() - 18", "", ""),
    appearance = "",
    hint = "",
    repeat_count = ""
  )

  choices <- tibble::tibble(
    list_name = "marital",
    name = c("1", "2"),
    label = c("Casado", "Soltero")
  )

  settings <- tibble::tibble(
    form_title = "Relevant numerico",
    version = "1.0",
    default_language = "es"
  )

  path_xlsx <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(
    list(survey = survey, choices = choices, settings = settings),
    file = path_xlsx,
    overwrite = TRUE
  )

  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)
  plan <- prosecnur::generar_plan_limpieza(inst)
  row_rel <- dplyr::filter(plan, .data$`Nombre de regla` == "salto_HH08_debe")

  expect_equal(nrow(row_rel), 1L)
  expect_match(row_rel$Procesamiento[[1]], "as\\.numeric\\(HH07\\) >= 18")
})

test_that("generar_plan_limpieza prioriza ventana de campo sobre today() en interviewdate", {
  survey <- tibble::tibble(
    type = "date",
    name = "interviewdate",
    label = "Fecha entrevista",
    relevant = "",
    required = "true()",
    constraint = ". = today()",
    calculation = "once(today())",
    appearance = "",
    hint = "",
    repeat_count = ""
  )

  choices <- tibble::tibble()
  settings <- tibble::tibble(
    form_title = "Ventana fecha",
    version = "1.0",
    default_language = "es"
  )

  path_xlsx <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(
    list(survey = survey, choices = choices, settings = settings),
    file = path_xlsx,
    overwrite = TRUE
  )

  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)
  plan <- prosecnur::generar_plan_limpieza(
    inst,
    incluir = list(
      required = TRUE,
      other = TRUE,
      relevant = TRUE,
      constraint = TRUE,
      calculate = TRUE,
      choice_filter = TRUE,
      repeat_min1 = FALSE,
      tiempo_ventana = TRUE
    ),
    rango_fecha = "2025-10-04 - 2025-10-11",
    campo_fecha = "interviewdate"
  )

  expect_false("cons_interviewdate_form" %in% plan$`Nombre de regla`)
  expect_true("cons_interviewdate_ventana_fecha" %in% plan$`Nombre de regla`)
})

test_that("eq_chr_na compara texto de forma estable entre numeros, blancos y espacios", {
  expect_true(prosecnur::eq_chr_na(1, "1 "))
  expect_true(prosecnur::eq_chr_na(NA, ""))
  expect_true(prosecnur::eq_chr_na("abc", " abc "))
})

test_that("calculate tipo concat indice no dispara falsos positivos por espacios", {
  survey <- tibble::tibble(
    type = c("integer", "integer", "calculate"),
    name = c("personId", "age", "adult18"),
    label = c("Person id", "Edad", "Adult id"),
    relevant = "",
    required = c("", "", ""),
    constraint = c("", "", ""),
    calculation = c("", "", "if(${age}>18,concat(${personId},' '),'')"),
    choice_filter = "",
    appearance = "",
    hint = "",
    repeat_count = ""
  )

  settings <- tibble::tibble(
    form_title = "Concat calculate",
    version = "1.0",
    default_language = "es"
  )

  path_xlsx <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(
    list(survey = survey, choices = tibble::tibble(), settings = settings),
    file = path_xlsx,
    overwrite = TRUE
  )

  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)
  plan <- prosecnur::generar_plan_limpieza(inst)
  datos <- tibble::tibble(
    personId = c(1, 2, 3),
    age = c(20, 18, 25),
    adult18 = c(1, NA, 3)
  )

  ev <- prosecnur::evaluar_consistencia(datos, plan)
  row_calc <- dplyr::filter(ev$resumen, .data$nombre_regla == "calc_adult18_eq")

  expect_equal(nrow(row_calc), 1L)
  expect_identical(row_calc$estado_dinamico[[1]], "correcta")
  expect_equal(row_calc$n_inconsistencias[[1]], 0)
})

test_that("calculate jr choice name usa etiquetas y no codigos", {
  survey <- tibble::tibble(
    type = c("select_one light03", "calculate"),
    name = c("LIGHT03", "electricity_source"),
    label = c("Fuente", "Fuente etiqueta"),
    relevant = "",
    required = c("", ""),
    constraint = c("", ""),
    calculation = c("", "jr:choice-name(${LIGHT03}, '${LIGHT03}')"),
    choice_filter = "",
    appearance = "",
    hint = "",
    repeat_count = ""
  )

  choices <- tibble::tibble(
    list_name = c("light03", "light03"),
    name = c("1", "2"),
    label = c("Red publica", "Minirred")
  )

  settings <- tibble::tibble(
    form_title = "Choice label calculate",
    version = "1.0",
    default_language = "es"
  )

  path_xlsx <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(
    list(survey = survey, choices = choices, settings = settings),
    file = path_xlsx,
    overwrite = TRUE
  )

  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)
  plan <- prosecnur::generar_plan_limpieza(inst)
  row_calc <- dplyr::filter(plan, .data$`Nombre de regla` == "calc_electricity_source_eq")

  expect_equal(nrow(row_calc), 1L)
  expect_match(row_calc$Procesamiento[[1]], "choice_label_map\\(")

  datos <- tibble::tibble(
    LIGHT03 = c("1", "2"),
    electricity_source = c("Red publica", "Minirred")
  )

  ev <- prosecnur::evaluar_consistencia(datos, plan)
  row_res <- dplyr::filter(ev$resumen, .data$nombre_regla == "calc_electricity_source_eq")

  expect_equal(nrow(row_res), 1L)
  expect_identical(row_res$estado_dinamico[[1]], "correcta")
  expect_equal(row_res$n_inconsistencias[[1]], 0)
})

test_that("required hereda gate de grupo padre cuando el grupo hijo no lo tiene", {
  survey <- tibble::tibble(
    type = c(
      "select_one yesno",
      "begin_group",
      "begin_group",
      "text",
      "end_group",
      "end_group"
    ),
    name = c("enable", "grp_parent", "grp_child", "REG03", "", ""),
    label = c("Enable", "Parent", "Child", "Documento", "", ""),
    relevant = c("", "${enable} = '1'", "", "", "", ""),
    required = c("", "", "", "true()", "", ""),
    constraint = c("", "", "", "", "", ""),
    calculation = c("", "", "", "", "", ""),
    choice_filter = "",
    appearance = "",
    hint = "",
    repeat_count = ""
  )

  choices <- tibble::tibble(
    list_name = c("yesno", "yesno"),
    name = c("1", "0"),
    label = c("Si", "No")
  )

  settings <- tibble::tibble(
    form_title = "Nested gate",
    version = "1.0",
    default_language = "es"
  )

  path_xlsx <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(
    list(survey = survey, choices = choices, settings = settings),
    file = path_xlsx,
    overwrite = TRUE
  )

  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)
  plan <- prosecnur::generar_plan_limpieza(inst)
  row_req <- dplyr::filter(plan, .data$`Nombre de regla` == "req_REG03_req")

  expect_equal(nrow(row_req), 1L)
  expect_match(row_req$Procesamiento[[1]], "enable")

  datos <- tibble::tibble(
    enable = c("0", "1", "1"),
    REG03 = c(NA, NA, "ok")
  )

  ev <- prosecnur::evaluar_consistencia(datos, plan)
  row_res <- dplyr::filter(ev$resumen, .data$nombre_regla == "req_REG03_req")

  expect_equal(nrow(row_res), 1L)
  expect_identical(row_res$estado_dinamico[[1]], "correcta")
  expect_equal(row_res$n_inconsistencias[[1]], 1)
})

test_that("evaluar_consistencia no infiere agregacion implicita y diagnostica la regla", {
  skip_if_not_installed("openxlsx")

  path_xlsx <- tempfile(fileext = ".xlsx")
  fixture <- make_consistency_fixture(path_xlsx)
  inst <- prosecnur::leer_xlsform_limpieza(path_xlsx, verbose = FALSE)
  plan <- prosecnur::generar_plan_limpieza(inst)

  ev <- prosecnur::evaluar_consistencia(fixture$datos, plan)

  row_raw <- dplyr::filter(ev$resumen, .data$nombre_regla == "calc_raw_num_eq")
  expect_equal(nrow(row_raw), 1L)
  expect_identical(row_raw$estado_dinamico[[1]], "ambigua")
  expect_identical(row_raw$issue_code[[1]], "cross_table_ambiguous")
  expect_true(is.na(row_raw$n_inconsistencias[[1]]))

  row_sum <- dplyr::filter(ev$resumen, .data$nombre_regla == "calc_total_num_eq")
  expect_equal(nrow(row_sum), 1L)
  expect_identical(row_sum$estado_dinamico[[1]], "correcta")
  expect_equal(row_sum$n_inconsistencias[[1]], 1)
})

test_that("evaluar_consistencia alinea repeats por _index real y no por posicion", {
  plan <- tibble::tibble(
    ID = "T_001",
    Tabla = "(principal)",
    Sección = "",
    Categoría = "Valores calculados",
    Tipo = "calculate",
    `Nombre de regla` = "calc_total_num_eq",
    Objetivo = "Total coincide con suma del repeat",
    `Variable 1` = "total_num",
    `Variable 1 - Etiqueta` = "Total",
    `Variable 2` = "rep_num",
    `Variable 2 - Etiqueta` = "Repeat num",
    `Variable 3` = NA_character_,
    `Variable 3 - Etiqueta` = NA_character_,
    Procesamiento = "calc_total_num_eq <- !eq_num_na(total_num, sum(rep_num))",
    `Hoja base` = "(principal)",
    `Hoja Var1` = "(principal)",
    `Hoja Var2` = "rep_household",
    `Hoja Var3` = NA_character_,
    `Agreg Var2` = NA_character_,
    `Agreg Var3` = NA_character_
  )

  datos <- list(
    principal = tibble::tibble(
      `_index` = c(8L, 17L, 18L),
      total_num = c("5", NA, "4")
    ),
    rep_household = tibble::tibble(
      `_parent_index` = c(8L, 8L, 18L),
      rep_num = c("2", "3", "4")
    )
  )

  ev <- prosecnur::evaluar_consistencia(datos, plan)
  row_sum <- dplyr::filter(ev$resumen, .data$nombre_regla == "calc_total_num_eq")

  expect_equal(nrow(row_sum), 1L)
  expect_identical(row_sum$estado_dinamico[[1]], "correcta")
  expect_equal(row_sum$n_inconsistencias[[1]], 0)
  expect_true(all(ev$datos$calc_total_num_eq %in% c(FALSE, NA)))
})

test_that("evaluar_consistencia resuelve nombres estandarizados entre plan y repeats", {
  plan <- tibble::tibble(
    ID = "T_002",
    Tabla = "(principal)",
    Sección = "",
    Categoría = "Valores calculados",
    Tipo = "calculate",
    `Nombre de regla` = "calc_nochild2less_eq",
    Objetivo = "Conteo de menores de 2 coincide",
    `Variable 1` = "nochild2less",
    `Variable 1 - Etiqueta` = "Menores de 2",
    `Variable 2` = "childLess2",
    `Variable 2 - Etiqueta` = "Marcador repeat",
    `Variable 3` = NA_character_,
    `Variable 3 - Etiqueta` = NA_character_,
    Procesamiento = "calc_nochild2less_eq <- !eq_num_na(nochild2less, sum(childLess2))",
    `Hoja base` = "(principal)",
    `Hoja Var1` = "(principal)",
    `Hoja Var2` = "rep_household",
    `Hoja Var3` = NA_character_,
    `Agreg Var2` = NA_character_,
    `Agreg Var3` = NA_character_
  )

  datos <- list(
    principal = tibble::tibble(
      `_index` = c(17L, 23L),
      nochild2less = c("1", "2")
    ),
    rep_household = tibble::tibble(
      `_parent_index` = c(17L, 17L, 23L, 23L, 23L),
      childless2 = c("0", "1", "1", "1", "0")
    )
  )

  ev <- prosecnur::evaluar_consistencia(datos, plan)
  row_calc <- dplyr::filter(ev$resumen, .data$nombre_regla == "calc_nochild2less_eq")

  expect_equal(nrow(row_calc), 1L)
  expect_identical(row_calc$estado_dinamico[[1]], "correcta")
  expect_equal(row_calc$n_inconsistencias[[1]], 0)
})

test_that("evaluar_consistencia no marca ambiguo cuando principal y hoja real son aliases", {
  plan <- tibble::tibble(
    ID = "T_003",
    Tabla = "S1",
    Sección = "S1",
    Categoría = "Saltos de preguntas",
    Tipo = "select_one",
    `Nombre de regla` = "salto_HH08_debe",
    Objetivo = "HH08 debe responderse si enable esta activo",
    `Variable 1` = "HH08",
    `Variable 1 - Etiqueta` = "Estado civil",
    `Variable 2` = "enable",
    `Variable 2 - Etiqueta` = "Enable",
    `Variable 3` = NA_character_,
    `Variable 3 - Etiqueta` = NA_character_,
    Procesamiento = "salto_HH08_debe <- ( (enable == '1') & (is.na(HH08) | trimws(HH08) == '') )",
    `Hoja base` = "S1",
    `Hoja Var1` = "S1",
    `Hoja Var2` = "(principal)",
    `Hoja Var3` = NA_character_,
    `Agreg Var2` = NA_character_,
    `Agreg Var3` = NA_character_
  )

  main_df <- tibble::tibble(
    `_index` = c(8L, 17L),
    enable = c("1", "0")
  )

  datos <- list(
    data = list(
      `RMS 2025 Perú - Q4` = main_df,
      S1 = tibble::tibble(
        `_index` = c(1L, 2L),
        `_parent_index` = c(8L, 17L),
        HH08 = c(NA, NA)
      )
    )
  )

  ev <- prosecnur::evaluar_consistencia(datos, plan, hoja_principal = "RMS 2025 Perú - Q4")
  row_res <- dplyr::filter(ev$resumen, .data$nombre_regla == "salto_HH08_debe")

  expect_equal(nrow(row_res), 1L)
  expect_identical(row_res$estado_dinamico[[1]], "correcta")
  expect_equal(row_res$n_inconsistencias[[1]], 1)
})

test_that("auditar_consistencia_corpus devuelve matriz, hallazgos y exporta artefactos", {
  skip_if_not_installed("openxlsx")

  path_xlsx <- tempfile(fileext = ".xlsx")
  fixture <- make_consistency_fixture(path_xlsx)
  export_dir <- tempfile(pattern = "auditoria_consistencia_")
  dir.create(export_dir, recursive = TRUE, showWarnings = FALSE)

  corpus <- tibble::tibble(
    instrumento_id = "demo",
    path_xlsform = path_xlsx,
    datos = list(fixture$datos),
    hoja_principal = list(NULL)
  )

  res <- prosecnur::auditar_consistencia_corpus(
    corpus = corpus,
    sample_n = 3,
    export_dir = export_dir
  )

  expect_named(
    res,
    c("resumen_corpus", "matriz_reglas", "hallazgos", "casos_muestra", "benchmarks", "artifacts")
  )
  expect_true(file.exists(res$artifacts$markdown))
  expect_true(file.exists(res$artifacts$xlsx))

  row_raw <- dplyr::filter(res$matriz_reglas, .data$nombre_regla == "calc_raw_num_eq")
  expect_equal(nrow(row_raw), 1L)
  expect_identical(row_raw$estado_estatico[[1]], "ambigua")
  expect_identical(row_raw$issue_code[[1]], "cross_table_ambiguous")

  expect_true("cons_favorite_color_cf_region" %in% res$matriz_reglas$nombre_regla)
  expect_true(nrow(res$hallazgos) >= 1L)
})
