test_that("normalize_data_for_xlsform reconstruye select_multiple SurveyMonkey por label", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_act", "select_one lst_grid", "text"),
      name = c("q0027", "q0013_1", "q0027_other"),
      list_name = c("lst_act", "lst_grid", NA),
      label = c("Actividades", "Item 1", "Otro"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c(rep("lst_act", 3), rep("lst_grid", 2)),
      name = c("1", "2", "other", "1", "2"),
      label = c("Emprendimiento", "Voluntariado", "Otros:", "Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  raw <- data.frame(
    q0027_0001 = haven::labelled(c(NA, 1, NA), c("Otros:" = 1)),
    q0027_0002 = haven::labelled(c(1, NA, NA), c("Emprendimiento" = 1)),
    q0027_0003 = haven::labelled(c(1, NA, NA), c("Voluntariado" = 1)),
    q0013_0001 = c(2, 1, NA),
    q0027_other = c("", "Detalle", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)

  expect_equal(as.character(out$q0027), c("1 2", "other", NA))
  expect_equal(out$q0013_1, raw$q0013_0001)
  expect_true("q0027_other" %in% names(out))
  expect_false(any(c("q0027_0001", "q0027_0002", "q0027_0003", "q0013_0001") %in% names(out)))
})

test_that("normalize_data_for_xlsform detecta y aplica mapeo de códigos SAV a XLSForm", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_p27",
      name = "p27",
      list_name = "lst_p27",
      label = "Actividad actual",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_p27", 9),
      name = as.character(1:9),
      label = c(
        "Emprendimiento",
        "Investigación",
        "Voluntariado o Pasantías",
        "Enseñanza/Dictado Independiente",
        "Consultor independiente",
        "Soy estudiante",
        "Me encuentro en búsqueda activa de empleo",
        "No me encuentro laborando ni en búsqueda de trabajo por motivos personales",
        "Otros"
      ),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    q0027_0001 = haven::labelled(c(NA, 1, NA), c("No me encuentro laborando ni en búsqueda de trabajo por motivos personales" = 1)),
    q0027_0002 = haven::labelled(c(1, NA, 1), c("Emprendimiento" = 1)),
    q0027_0003 = haven::labelled(c(NA_real_, NA_real_, NA_real_), c("Investigación" = 1)),
    q0027_0004 = haven::labelled(c(NA_real_, NA_real_, NA_real_), c("Voluntariado o Pasantías" = 1)),
    q0027_0005 = haven::labelled(c(NA_real_, NA_real_, NA_real_), c("Enseñanza/Dictado Independiente" = 1)),
    q0027_0006 = haven::labelled(c(NA_real_, NA_real_, NA_real_), c("Consultor independiente" = 1)),
    q0027_0007 = haven::labelled(c(NA_real_, NA_real_, NA_real_), c("Soy estudiante" = 1)),
    q0027_0008 = haven::labelled(c(NA_real_, NA_real_, NA_real_), c("Me encuentro en búsqueda activa de empleo" = 1)),
    q0027_0009 = haven::labelled(c(NA, NA, 1), c("Otros" = 1)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)
  maps <- attr(out, "xlsform_normalized")$choice_code_maps
  p27_map <- maps$p27

  expect_equal(as.character(out$p27), c("1", "8", "1 9"))
  expect_true(isTRUE(p27_map$requires_confirmation))
  expect_identical(
    p27_map$mappings[[which(vapply(p27_map$mappings, `[[`, character(1), "source_code") == "2")[1]]]$xls_code,
    "1"
  )
  expect_identical(
    p27_map$mappings[[which(vapply(p27_map$mappings, `[[`, character(1), "source_code") == "1")[1]]]$xls_code,
    "8"
  )
})

test_that("normalize_data_for_xlsform prioriza el mapa definido por el editor XLSForm", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_p27", "select_one lst_p31"),
      name = c("p27", "p31"),
      list_name = c("lst_p27", "lst_p31"),
      label = c("Actividad actual", "Ingreso"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p27", "lst_p27", "lst_p31", "lst_p31"),
      name = c("1", "2", "1", "2"),
      label = c("Pepino", "Tomate", "Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    p27_0002 = haven::labelled(c(1, NA), c("Etiqueta rara A" = 1)),
    p27_0003 = haven::labelled(c(NA, 1), c("Etiqueta rara B" = 1)),
    p31 = haven::labelled(c(2, 3), c("Otra etiqueta A" = 2, "Otra etiqueta B" = 3)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  user_maps <- list(
    list(
      variable = "p27",
      label = "Actividad actual",
      type = "select_multiple",
      list_name = "lst_p27",
      status = "manual_editor",
      high_confidence = TRUE,
      requires_confirmation = FALSE,
      mappings = list(
        list(source_code = "2", source_column = "p27_0002", source_label = "Pepino", xls_code = "1", xls_label = "Pepino", match = "manual_editor"),
        list(source_code = "3", source_column = "p27_0003", source_label = "Tomate", xls_code = "2", xls_label = "Tomate", match = "manual_editor")
      )
    ),
    list(
      variable = "p31",
      label = "Ingreso",
      type = "select_one",
      list_name = "lst_p31",
      status = "manual_editor",
      high_confidence = TRUE,
      requires_confirmation = FALSE,
      mappings = list(
        list(source_code = "2", source_column = "p31", source_label = "Bajo", xls_code = "1", xls_label = "Bajo", match = "manual_editor"),
        list(source_code = "3", source_column = "p31", source_label = "Alto", xls_code = "2", xls_label = "Alto", match = "manual_editor")
      )
    )
  )

  out <- normalize_data_for_xlsform(raw, inst, choice_code_maps = user_maps)
  maps <- attr(out, "xlsform_normalized")$choice_code_maps

  expect_equal(as.character(out$p27), c("1", "2"))
  expect_equal(as.character(out$p31), c("1", "2"))
  expect_false(isTRUE(maps$p27$requires_confirmation))
  expect_equal(maps$p27$status, "manual_editor")
})

test_that("normalize_data_for_xlsform adapta columnas q con padding a contrato p normalizado", {
  inst <- list(
    survey = data.frame(
      type = c("select_one lst_p1", "select_multiple lst_p7", "select_one lst_p7"),
      name = c("p1", "p7", "p7_1"),
      list_name = c("lst_p1", "lst_p7", "lst_p7"),
      label = c("P1", "P7", "Fila 1"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p1", "lst_p1", "lst_p7", "lst_p7"),
      name = c("1", "2", "1", "2"),
      label = c("Sí", "No", "A", "B"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )

  raw <- data.frame(
    q0001 = c(1, 2),
    q0007_0001 = haven::labelled(c(1, NA), c("A" = 1)),
    q0007_0002 = haven::labelled(c(NA, 1), c("B" = 1)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)

  expect_equal(out$p1, raw$q0001)
  expect_equal(unname(as.character(out$p7)), c("1", "2"))
  expect_false(any(c("q0001", "q0007_0001", "q0007_0002", "p7_0001", "p7_0002") %in% names(out)))
  aliases <- attr(out, "xlsform_normalized")$aliases
  expect_identical(unname(aliases["p7_1"]), "q0007_0001")
})

test_that("normalize_data_for_xlsform colapsa matriz SurveyMonkey de una fila a pN", {
  inst <- list(
    survey = data.frame(
      type = "select_one lst_p17",
      name = "p17",
      list_name = "lst_p17",
      label = "P17",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p17", "lst_p17"),
      name = c("1", "2"),
      label = c("Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(q0017_0001 = c(1, 2), check.names = FALSE)

  out <- normalize_data_for_xlsform(raw, inst)
  compat <- validate_data_xlsform_compatibility(out, inst)

  expect_equal(as.vector(out$p17), as.vector(raw$q0017_0001))
  expect_false(any(c("q0017_0001", "p17_1") %in% names(out)))
  expect_true(isTRUE(compat$ok))
  expect_equal(compat$n_missing, 0L)
  collapses <- attr(out, "xlsform_normalized")$single_child_collapses
  expect_identical(unname(collapses["p17"]), "p17_1")
})

test_that("normalize_data_for_xlsform no colapsa si el XLSForm espera pN_1", {
  inst <- list(
    survey = data.frame(
      type = "select_one lst_p17",
      name = "p17_1",
      list_name = "lst_p17",
      label = "P17 fila 1",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p17", "lst_p17"),
      name = c("1", "2"),
      label = c("Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(q0017_0001 = c(1, 2), check.names = FALSE)

  out <- normalize_data_for_xlsform(raw, inst)
  compat <- validate_data_xlsform_compatibility(out, inst)

  expect_false("p17" %in% names(out))
  expect_equal(out$p17_1, raw$q0017_0001)
  expect_true(isTRUE(compat$ok))
  expect_length(attr(out, "xlsform_normalized")$single_child_collapses, 0L)
})

test_that("normalize_data_for_xlsform no colapsa matrices con varios hijos", {
  inst <- list(
    survey = data.frame(
      type = "select_one lst_p17",
      name = "p17",
      list_name = "lst_p17",
      label = "P17",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p17", "lst_p17"),
      name = c("1", "2"),
      label = c("Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    q0017_0001 = c(1, 2),
    q0017_0002 = c(2, 1),
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)
  compat <- validate_data_xlsform_compatibility(out, inst)

  expect_false("p17" %in% names(out))
  expect_true(all(c("p17_1", "p17_2") %in% names(out)))
  expect_false(isTRUE(compat$ok))
  expect_equal(compat$missing_columns, "p17")
  expect_length(attr(out, "xlsform_normalized")$single_child_collapses, 0L)
})

test_that("normalize_data_for_xlsform reconstruye select_multiple y no lo colapsa", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_p7",
      name = "p7",
      list_name = "lst_p7",
      label = "P7",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p7", "lst_p7"),
      name = c("1", "2"),
      label = c("A", "B"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    q0007_0001 = haven::labelled(c(1, NA), c(A = 1)),
    q0007_0002 = haven::labelled(c(NA, 1), c(B = 1)),
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)
  compat <- validate_data_xlsform_compatibility(out, inst)

  expect_equal(as.character(out$p7), c("1", "2"))
  expect_false(any(c("p7_1", "p7_2", "q0007_0001", "q0007_0002") %in% names(out)))
  expect_true(isTRUE(compat$ok))
  expect_length(attr(out, "xlsform_normalized")$single_child_collapses, 0L)
})

test_that("normalize_data_for_xlsform extrae list_name desde type cuando el XLSForm no trae columna list_name", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_p7",
      name = "p7",
      label = "P7",
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p7", "lst_p7"),
      name = c("1", "2"),
      label = c("A", "B"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    q0007_0001 = haven::labelled(c(1, NA), c(A = 1)),
    q0007_0002 = haven::labelled(c(NA, 1), c(B = 1)),
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)
  compat <- validate_data_xlsform_compatibility(out, inst)

  expect_equal(as.character(out$p7), c("1", "2"))
  expect_false(any(c("p7_1", "p7_2", "q0007_0001", "q0007_0002") %in% names(out)))
  expect_true(isTRUE(compat$ok))
})

test_that("normalize_data_for_xlsform recodifica Other=0 de SurveyMonkey en select_one", {
  inst <- list(
    survey = data.frame(
      type = c("select_one lst_p12", "text"),
      name = c("p12", "p12_other"),
      list_name = c("lst_p12", NA),
      label = c("Institución", "Otra institución"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = rep("lst_p12", 3),
      name = c("1", "2", "14"),
      label = c("PUCP", "ESAN", "Otra institución:"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    q0012 = haven::labelled(
      c(0, 1, NA),
      labels = c("Otra institución:" = 0, PUCP = 1, ESAN = 2)
    ),
    q0012_other = c("Tecsup", "", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)

  expect_equal(as.character(out$p12), c("14", "1", NA))
  expect_equal(out$p12_other, raw$q0012_other)
  recodes <- attr(out, "xlsform_normalized")$select_one_other_recodes
  expect_identical(unname(recodes["p12"]), "0")
})

test_that("validate_data_xlsform_compatibility bloquea faltantes reales y reporta extras", {
  inst <- list(
    survey = data.frame(
      type = c("begin_group", "text", "integer", "calculate", "note", "end_group"),
      name = c("grp", "p1", "p2", "calc1", "nota1", "grp"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame()
  )
  data <- data.frame(p1 = "ok", respondent_id = "r1", check.names = FALSE)

  compat <- validate_data_xlsform_compatibility(data, inst)

  expect_false(isTRUE(compat$ok))
  expect_equal(compat$missing_columns, "p2")
  expect_true("respondent_id" %in% compat$extra_columns)
  expect_false(any(c("grp", "calc1", "nota1") %in% compat$missing_columns))
})

test_that("normalize_data_for_xlsform adapta columnas p con padding a contrato p sin padding", {
  inst <- list(
    survey = data.frame(
      type = c("select_one lst_p13", "select_one lst_p13", "text"),
      name = c("p13_1", "p13_2", "p24_1"),
      list_name = c("lst_p13", "lst_p13", NA),
      label = c("Item 1", "Item 2", "Funcion 1"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p13", "lst_p13"),
      name = c("1", "2"),
      label = c("Bajo", "Alto"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    p13_0001 = c(1, NA),
    p13_0002 = c(NA, 2),
    p24_0001 = c("Diseño", ""),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)

  expect_equal(out$p13_1, raw$p13_0001)
  expect_equal(out$p13_2, raw$p13_0002)
  expect_equal(out$p24_1, raw$p24_0001)
  expect_false(any(c("p13_0001", "p13_0002", "p24_0001") %in% names(out)))
  aliases <- attr(out, "xlsform_normalized")$aliases
  expect_identical(unname(aliases["p13_1"]), "p13_0001")
  expect_identical(unname(aliases["p24_1"]), "p24_0001")
})

test_that("normalize_data_for_xlsform aliasa q a p aunque no haya choices", {
  inst <- list(
    survey = data.frame(
      type = c("text", "integer"),
      name = c("p1", "p2"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame()
  )
  raw <- data.frame(q0001 = c("a", "b"), q0002 = c(1, 2), check.names = FALSE)

  out <- normalize_data_for_xlsform(raw, inst)

  expect_equal(out$p1, raw$q0001)
  expect_equal(out$p2, raw$q0002)
  expect_false(any(c("q0001", "q0002") %in% names(out)))
})

test_that("normalize_data_for_xlsform soporta XLSForm legacy con sufijo padded", {
  inst <- list(
    survey = data.frame(
      type = c("select_one lst_p13", "select_one lst_p13"),
      name = c("p13_0001", "p13_0002"),
      list_name = c("lst_p13", "lst_p13"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p13", "lst_p13"),
      name = c("1", "2"),
      label = c("Bajo", "Alto"),
      stringsAsFactors = FALSE
    )
  )
  raw <- data.frame(
    q0013_0001 = c(1, NA),
    q0013_0002 = c(NA, 2),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)

  expect_true(all(c("p13_0001", "p13_0002") %in% names(out)))
  expect_equal(out$p13_0001, raw$q0013_0001)
  expect_equal(out$p13_0002, raw$q0013_0002)
  expect_false(any(c("q0013_0001", "q0013_0002", "p13_1", "p13_2") %in% names(out)))
})

test_that("normalize_data_for_xlsform no toca data ya canonica", {
  inst <- list(
    survey = data.frame(
      type = "select_multiple lst_need",
      name = "need",
      list_name = "lst_need",
      label = "Necesidades",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = "lst_need",
      name = "a",
      label = "A",
      stringsAsFactors = FALSE
    )
  )
  raw <- data.frame(need = c("a", NA), stringsAsFactors = FALSE)
  out <- normalize_data_for_xlsform(raw, inst)
  expect_identical(out$need, raw$need)
})

test_that("normalize_data_for_xlsform preserva madre *_recod de select_multiple adaptado", {
  inst <- list(
    survey = data.frame(
      type = c("select_multiple lst_p19", "select_multiple lst_p19_recod", "text"),
      name = c("p19", "p19_recod", "p19_other"),
      list_name = c("lst_p19", "lst_p19_recod", ""),
      label = c("IA usada", "IA usada", "Otra IA"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_p19", "lst_p19", "lst_p19_recod", "lst_p19_recod"),
      name = c("1", "2", "1", "7"),
      label = c("IA generativa", "Otra", "IA generativa", "sin etiqueta"),
      stringsAsFactors = FALSE,
      check.names = FALSE
    )
  )
  raw <- data.frame(
    p19 = c("1", "1 2"),
    p19_recod = c("1", "1 7"),
    p19_other = c("", "herramienta interna"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )

  out <- normalize_data_for_xlsform(raw, inst)
  compat <- validate_data_xlsform_compatibility(out, inst)

  expect_true("p19_recod" %in% names(out))
  expect_identical(out$p19_recod, raw$p19_recod)
  expect_true(isTRUE(compat$ok))
})
