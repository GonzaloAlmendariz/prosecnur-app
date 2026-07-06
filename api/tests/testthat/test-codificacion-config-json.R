make_codif_config_inst <- function(include_p36 = TRUE, include_p40 = TRUE) {
  rows <- list()
  if (include_p36) {
    rows[[length(rows) + 1L]] <- data.frame(
      type = "select_one yesno",
      name = "p36",
      label = "Código Pulso",
      stringsAsFactors = FALSE
    )
    rows[[length(rows) + 1L]] <- data.frame(
      type = "text",
      name = "p36_other",
      label = "Otro código Pulso",
      stringsAsFactors = FALSE
    )
  }
  if (include_p40) {
    rows[[length(rows) + 1L]] <- data.frame(
      type = "integer",
      name = "p40",
      label = "Edad",
      stringsAsFactors = FALSE
    )
  }
  survey <- do.call(rbind, rows)
  choices <- data.frame(
    list_name = c("yesno", "yesno"),
    name = c("1", "99"),
    label = c("Sí", "Otros"),
    stringsAsFactors = FALSE
  )
  list(survey = survey, survey_raw = survey, choices = choices)
}

make_codif_categorization_inst <- function() {
  survey <- data.frame(
    type = rep("text", 7),
    name = c("p23", "p24_1", "p24_2", "p24_3", "p24_4", "p24_5", "p35"),
    label = c(
      "¿Cuál es su puesto actual?:",
      "Función 1:",
      "Función 2:",
      "Función 3:",
      "Función 4:",
      "Función 5:",
      "Después de todos sus años de egreso, coméntenos en qué podría mejorar la carrera:"
    ),
    stringsAsFactors = FALSE
  )
  choices <- data.frame(
    list_name = character(),
    name = character(),
    label = character(),
    stringsAsFactors = FALSE
  )
  list(survey = survey, survey_raw = survey, choices = choices)
}

seed_codif_config_session <- function(base_defs, with_project = FALSE) {
  sid <- session_create()
  s <- session_get(sid)
  s$estudio <- list(
    nombre = "Proyecto QA",
    processing_mode = if (length(base_defs) > 1L) "multibase" else "unibase",
    active_base = names(base_defs)[1],
    bases = stats::setNames(lapply(names(base_defs), function(base) list()), names(base_defs))
  )
  if (with_project) s$project_path <- tempfile(fileext = ".pulso")
  s$codif_por_base <- list()
  for (base in names(base_defs)) {
    def <- base_defs[[base]]
    inst <- def$inst %||% make_codif_config_inst()
    rows <- def$rows %||% list()
    groups <- def$groups %||% list()
    marcadas <- def$marcadas %||% list()
    respuestas <- def$respuestas %||% list()
    data <- def$data %||% NULL
    s$codif_por_base[[base]] <- list(
      inst = inst,
      data = data,
      familias_draft = list(rows = rows, source = "test"),
      grupos_recod = groups,
      marcadas = marcadas,
      respuestas_recod = respuestas
    )
  }
  .session_env[[sid]] <- s
  sid
}

codif_config_row_p36 <- function(modo_so = "padre") {
  list(
    use = TRUE,
    tipo = "select_one",
    modo_so = modo_so,
    parent = "p36",
    parent_label = "Código Pulso",
    list_norm = "yesno",
    parent_col = "p36",
    text_col = "p36_other",
    other_dummy_col = "",
    q_order = 1L
  )
}

codif_config_row_text <- function(parent, label = parent) {
  list(
    use = TRUE,
    tipo = "text",
    modo_so = "",
    parent = parent,
    parent_label = label,
    list_norm = "",
    parent_col = parent,
    text_col = parent,
    other_dummy_col = "",
    q_order = 1L
  )
}

codif_config_row_integer <- function(parent, label = parent) {
  list(
    use = TRUE,
    tipo = "integer",
    modo_so = "",
    parent = parent,
    parent_label = label,
    list_norm = "",
    parent_col = parent,
    text_col = "",
    other_dummy_col = "",
    q_order = 1L
  )
}

codif_config_row_select_multiple_with_other <- function(parent, text_col, label = parent) {
  list(
    use = TRUE,
    tipo = "select_multiple",
    modo_so = "",
    parent = parent,
    parent_label = label,
    list_norm = "",
    parent_col = parent,
    text_col = text_col,
    other_dummy_col = paste0(parent, "/99"),
    q_order = 1L
  )
}

codif_config_groups_p36 <- function(label = "Categoría 1") {
  list(
    list(
      codigo = "101",
      etiqueta = label,
      origen = "nuevo",
      respuestas = list("texto normalizado")
    )
  )
}

test_that("codificacion exporta JSON versionado sin filas de casos", {
  sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36()),
    marcadas = list(p36 = TRUE)
  )))

  bundle <- codif_config_export(sid)

  expect_equal(bundle$schema_version, "prosecnur.coding_config.v1")
  expect_equal(bundle$mode, "unibase")
  expect_length(bundle$variables, 1)
  expect_equal(bundle$variables[[1]]$name, "p36")
  expect_equal(bundle$variables[[1]]$categories[[1]]$code, "101")
  expect_false(bundle$metadata$contains_case_rows)
  expect_true(bundle$metadata$contains_response_match_values)
})

test_that("codificacion export omite filas sin configuracion efectiva", {
  sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(),
    marcadas = list(p36 = TRUE)
  )))

  bundle <- codif_config_export(sid)

  expect_length(bundle$variables, 0)
})

test_that("codificacion export respeta padre-hijo y textos independientes", {
  sid <- seed_codif_config_session(list(base_a = list(
    rows = list(
      codif_config_row_p36(),
      codif_config_row_text("p36_other", "Otro código Pulso"),
      codif_config_row_text("p10", "Texto independiente"),
      codif_config_row_integer("p40", "Edad"),
      codif_config_row_select_multiple_with_other("p19", "p19_other", "IA usada"),
      codif_config_row_text("p19_other", "Otra IA")
    ),
    groups = list(
      p36_other = codif_config_groups_p36("Otro integrado al padre"),
      p10 = codif_config_groups_p36("Texto solo"),
      p40 = codif_config_groups_p36("Edad agrupada"),
      p19_other = codif_config_groups_p36("SM integrado al padre")
    )
  )))

  bundle <- codif_config_export(sid)
  exported_names <- vapply(bundle$variables, function(v) v$name, character(1))
  rows <- lapply(bundle$variables, function(v) v$configuration$familias_row)
  by_name <- stats::setNames(rows, exported_names)

  expect_setequal(exported_names, c("p36", "p10", "p40", "p19"))
  expect_equal(by_name$p36$tipo, "select_one")
  expect_equal(by_name$p36$modo_so, "padre")
  expect_equal(by_name$p36$text_col, "p36_other")
  expect_equal(by_name$p10$tipo, "text")
  expect_equal(by_name$p40$tipo, "integer")
  expect_equal(by_name$p19$tipo, "select_multiple")
  expect_equal(by_name$p19$text_col, "p19_other")
})

test_that("codificacion import rechaza schema invalido", {
  sid <- seed_codif_config_session(list(base_a = list(inst = make_codif_config_inst())))

  expect_error(
    codif_config_preview_import(sid, list(schema_version = "otro.schema", variables = list())),
    "Schema inválido"
  )
})

test_that("codificacion import detecta variables compatibles", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36())
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list()
  )))
  bundle <- codif_config_export(source_sid)

  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(preview$summary$n_compatible, 1L)
  expect_equal(preview$items[[1]]$status, "compatible")
})

test_that("codificacion import no marca conflicto por draft sin grupos", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36())
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list(codif_config_row_p36()),
    groups = list()
  )))
  bundle <- codif_config_export(source_sid)

  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(preview$summary$n_compatible, 1L)
  expect_equal(preview$summary$n_conflicts, 0L)
  expect_equal(preview$items[[1]]$status, "compatible")
})

test_that("codificacion import ignora duplicados text adoptados en bundles antiguos", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36_other = codif_config_groups_p36("Integrada"))
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list()
  )))
  bundle <- codif_config_export(source_sid)
  duplicate <- bundle$variables[[1]]
  duplicate$id <- "base_a::p36_other"
  duplicate$name <- "p36_other"
  duplicate$type <- "text"
  duplicate$configuration$familias_row <- codif_config_row_text("p36_other", "Otro código Pulso")
  bundle$variables <- c(bundle$variables, list(duplicate))

  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(length(preview$items), 1L)
  expect_equal(preview$items[[1]]$source$name, "p36")
  expect_equal(preview$summary$n_compatible, 1L)
  expect_equal(preview$source$variables, 2L)
  expect_equal(preview$source$variables_after_normalization, 1L)
  expect_equal(preview$source$normalization$adopted_text_duplicates[[1]]$text_col, "p36_other")
})

test_that("codificacion import conserva modo hijo al deduplicar text adoptado", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36("hijo")),
    groups = list(p36_other = codif_config_groups_p36("Hijo integrado"))
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list()
  )))
  bundle <- codif_config_export(source_sid)
  duplicate <- bundle$variables[[1]]
  duplicate$id <- "base_a::p36_other"
  duplicate$name <- "p36_other"
  duplicate$type <- "text"
  duplicate$configuration$familias_row <- codif_config_row_text("p36_other", "Otro código Pulso")
  bundle$variables <- c(bundle$variables, list(duplicate))

  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(length(preview$items), 1L)
  expect_equal(preview$items[[1]]$source$name, "p36")
  expect_equal(preview$items[[1]]$source$mode_so, "hijo")
  expect_equal(preview$source$normalization$adopted_text_duplicates[[1]]$mode_so, "hijo")
})

test_that("codificacion import conserva text other solitaria", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_text("p36_other", "Otro código Pulso")),
    groups = list(p36_other = codif_config_groups_p36("Solitaria"))
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list()
  )))
  bundle <- codif_config_export(source_sid)

  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(length(preview$items), 1L)
  expect_equal(preview$items[[1]]$source$name, "p36_other")
  expect_equal(preview$source$variables_after_normalization, 1L)
  expect_length(preview$source$normalization$adopted_text_duplicates, 0)
})

test_that("codificacion import ignora variables sin configuracion efectiva", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36())
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list()
  )))
  bundle <- codif_config_export(source_sid)
  bundle$variables[[1]]$categories <- list()
  bundle$variables[[1]]$rules <- list()
  bundle$variables[[1]]$recodes <- list()
  bundle$variables[[1]]$configuration$grupos <- list()

  preview <- codif_config_preview_import(target_sid, bundle)

  expect_length(preview$items, 0)
  expect_equal(preview$summary$n_compatible, 0L)
})

test_that("codificacion import detecta variables faltantes", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36())
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(include_p36 = FALSE),
    rows = list()
  )))
  bundle <- codif_config_export(source_sid)

  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(preview$summary$n_missing, 1L)
})

test_that("codificacion import no sobrescribe sin seleccion explicita", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36("Importada"))
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36("Actual"))
  )))
  bundle <- codif_config_export(source_sid)
  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(preview$summary$n_conflicts, 1L)
  expect_error(codif_config_apply_import(target_sid, bundle, list()), "Selecciona")
  expect_equal(codif_snapshot(target_sid, "base_a")$grupos_recod$p36[[1]]$etiqueta, "Actual")
})

test_that("codificacion import JSON preserva variables fuera de la seleccion", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36("Importada"))
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list(codif_config_row_p36(), codif_config_row_integer("p40", "Edad")),
    groups = list(
      p36 = codif_config_groups_p36("Actual"),
      p40 = codif_config_groups_p36("No tocar")
    ),
    marcadas = list(p36 = TRUE, p40 = TRUE),
    respuestas = list(p40 = list("25"))
  )))
  bundle <- codif_config_export(source_sid)
  preview <- codif_config_preview_import(target_sid, bundle)
  item <- preview$items[[1]]

  result <- codif_config_apply_import(
    target_sid,
    bundle,
    list(list(match_id = item$match_id, strategy = "replace")),
    "solo-p36.json"
  )

  target <- codif_snapshot(target_sid, "base_a")
  expect_equal(result$summary$variables_imported, 1L)
  expect_equal(target$grupos_recod$p36[[1]]$etiqueta, "Importada")
  expect_equal(target$grupos_recod$p40[[1]]$etiqueta, "No tocar")
  expect_equal(target$respuestas_recod$p40, list("25"))
  expect_true(isTRUE(target$marcadas$p40))
})

test_that("codificacion import multibase aplica solo bases compatibles", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36())
  )))
  target_sid <- seed_codif_config_session(list(
    base_a = list(inst = make_codif_config_inst(), rows = list()),
    base_b = list(inst = make_codif_config_inst(include_p36 = FALSE), rows = list())
  ))
  bundle <- codif_config_export(source_sid)
  preview <- codif_config_preview_import(target_sid, bundle)

  expect_equal(preview$summary$n_compatible, 1L)
  expect_equal(preview$summary$n_missing, 1L)

  compatible <- Filter(function(item) identical(item$status, "compatible"), preview$items)
  result <- codif_config_apply_import(
    target_sid,
    bundle,
    list(list(match_id = compatible[[1]]$match_id, strategy = "replace")),
    "fixture.json"
  )

  expect_equal(result$summary$variables_imported, 1L)
  expect_equal(codif_snapshot(target_sid, "base_a")$grupos_recod$p36[[1]]$codigo, "101")
  expect_null(codif_snapshot(target_sid, "base_b")$grupos_recod$p36)
})

test_that("codificacion import multibase limita por alias unico de base", {
  source_sid <- seed_codif_config_session(list(
    civil = list(
      rows = list(codif_config_row_p36()),
      groups = list(p36 = codif_config_groups_p36("Civil"))
    ),
    minas = list(
      rows = list(codif_config_row_p36()),
      groups = list(p36 = codif_config_groups_p36("Minas"))
    )
  ))
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(inst = make_codif_config_inst(), rows = list()),
    ingenieria_de_minas = list(inst = make_codif_config_inst(), rows = list()),
    ingenieria_quimica = list(inst = make_codif_config_inst(), rows = list())
  ))
  bundle <- codif_config_export(source_sid)

  preview <- codif_config_preview_import(target_sid, bundle)
  targets <- vapply(preview$items, function(item) item$target$base_id, character(1))

  expect_equal(length(preview$items), 2L)
  expect_setequal(targets, c("ingenieria_civil", "ingenieria_de_minas"))
  expect_equal(preview$summary$n_compatible, 2L)

  selections <- lapply(preview$items, function(item) {
    list(match_id = item$match_id, strategy = "replace")
  })
  result <- codif_config_apply_import(target_sid, bundle, selections, "alias.json")

  expect_equal(result$summary$variables_imported, 2L)
  expect_equal(codif_snapshot(target_sid, "ingenieria_civil")$grupos_recod$p36[[1]]$etiqueta, "Civil")
  expect_equal(codif_snapshot(target_sid, "ingenieria_de_minas")$grupos_recod$p36[[1]]$etiqueta, "Minas")
  expect_null(codif_snapshot(target_sid, "ingenieria_quimica")$grupos_recod$p36)
})

test_that("codificacion importa categorizaciones desde Excel por hoja y pares recat", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_industrial = list(inst = make_codif_categorization_inst(), rows = list()),
    ingenieria_de_minas = list(inst = make_codif_categorization_inst(), rows = list()),
    ingenieria_civil = list(inst = make_codif_categorization_inst(), rows = list())
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Industrial")
  openxlsx::writeData(wb, "Industrial", data.frame(
    "Puesto Actual" = c("Analista PCP", "Jefe de operaciones", "Analista PCP"),
    "Puesto (Recategorizado)" = c("Analistas e Ingenieros", "Jefaturas", "Analistas e Ingenieros"),
    "Función Principal" = c("Elaborar reportes", "Supervisar operaciones", "Diseñar dashboards"),
    "F. Principal (Recat)" = c("Análisis de Datos", "Supervisión", "Análisis de Datos"),
    check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", data.frame(
    "Puesto Actual" = c("Ingeniero civil"),
    "Puesto (Recategorizado)" = c(""),
    check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "Minas")
  openxlsx::writeData(wb, "Minas", data.frame(
    "¿Cuál es su puesto actual?:" = c("Supervisor mina", "Analista costos"),
    "Categoría de puesto" = c("Supervisión", "Analistas"),
    "¿Cuál es su función principal?" = c("Supervisar operación", "Reportar costos"),
    "Categoría de función principal" = c("Operaciones", "Finanzas"),
    check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  bundle <- codif_config_bundle_from_categorization_xlsx(target_sid, path, "categorias.xlsx")
  preview <- codif_config_preview_import(target_sid, bundle, "categorias.xlsx")

  expect_equal(bundle$mode, "multibase")
  expect_length(bundle$variables, 4)
  expect_equal(length(preview$items), 4L)
  expect_setequal(
    vapply(preview$items, function(item) item$target$base_id, character(1)),
    c("ingenieria_industrial", "ingenieria_de_minas")
  )
  expect_equal(preview$summary$n_compatible, 4L)

  selections <- lapply(preview$items, function(item) {
    list(match_id = item$match_id, strategy = "replace")
  })
  result <- codif_config_apply_import(target_sid, bundle, selections, "categorias.xlsx")

  expect_equal(result$summary$variables_imported, 4L)
  expect_equal(length(codif_snapshot(target_sid, "ingenieria_industrial")$grupos_recod$p23), 2L)
  expect_equal(length(codif_snapshot(target_sid, "ingenieria_industrial")$grupos_recod$p24_1), 2L)
  expect_equal(length(codif_snapshot(target_sid, "ingenieria_de_minas")$grupos_recod$p23), 2L)
  expect_equal(length(codif_snapshot(target_sid, "ingenieria_de_minas")$grupos_recod$p24_1), 2L)
  expect_null(codif_snapshot(target_sid, "ingenieria_civil")$grupos_recod$p23)
})

test_that("codificacion matrices p35 importan 9 bases y conservan multi-codigo por caso", {
  testthat::skip_if_not_installed("openxlsx")
  sheet_map <- c(
    Civil = "ingenieria_civil",
    Telecom = "ingenieria_de_las_telecomunicaciones",
    Minas = "ingenieria_de_minas",
    Electronica = "ingenieria_electronica",
    Geologica = "ingenieria_geologica",
    Industrial = "ingenieria_industrial",
    Informatica = "ingenieria_informatica",
    Mecanica = "ingenieria_mecanica",
    Mecatronica = "ingenieria_mecatronica"
  )
  base_defs <- lapply(names(sheet_map), function(sheet) {
    base <- sheet_map[[sheet]]
    list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(
        response_id = c(paste0(base, "_1"), paste0(base, "_2")),
        p35 = c("mejorar tecnologia", "más prácticas"),
        stringsAsFactors = FALSE
      )
    )
  })
  names(base_defs) <- unname(sheet_map)
  target_sid <- seed_codif_config_session(base_defs)

  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Diccionario")
  openxlsx::writeData(wb, "Diccionario", data.frame(codigo = 1, codificacion = "Tecnología"))
  for (sheet in names(sheet_map)) {
    base <- sheet_map[[sheet]]
    openxlsx::addWorksheet(wb, sheet)
    openxlsx::writeData(wb, sheet, data.frame(
      id_caso = c(paste0(base, "_1"), paste0(base, "_1"), paste0(base, "_2")),
      texto_p35 = c("mejorar tecnologia", "mejorar tecnologia", "más prácticas"),
      codigo = c("1", "2", "2"),
      codificacion = c("Tecnología", "Práctica", "Práctica"),
      obs = c("", "doble código", ""),
      stringsAsFactors = FALSE
    ))
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  matrix <- codif_matrix_preview(target_sid, path, "p35.xlsx")
  preview <- matrix$preview

  expect_equal(preview$summary$n_compatible, 9L)
  expect_equal(length(preview$items), 9L)
  expect_true(all(vapply(preview$items, function(item) {
    isTRUE(item$matrix_diagnostics$case_match_available) &&
      identical(item$matrix_diagnostics$unmatched_cases, 0L)
  }, logical(1))))

  selections <- lapply(preview$items, function(item) list(match_id = item$match_id, strategy = "replace"))
  result <- codif_matrix_apply_import(target_sid, matrix$bundle, selections, "p35.xlsx")

  expect_equal(result$summary$variables_imported, 9L)
  for (base in unname(sheet_map)) {
    groups <- codif_snapshot(target_sid, base)$grupos_recod$p35
    expect_length(groups, 2L)
    expect_equal(groups[[1]]$matrix_cases[[1]]$id_caso, paste0(base, "_1"))
    expect_equal(groups[[2]]$matrix_cases[[1]]$id_caso, paste0(base, "_1"))
  }
})

test_that("codificacion matrices p35 bloquean conflicto codigo-etiqueta", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_electronica = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(response_id = c("e1", "e2"), p35 = c("texto a", "texto b"), stringsAsFactors = FALSE)
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Electronica")
  openxlsx::writeData(wb, "Electronica", data.frame(
    id_caso = c("e1", "e2"),
    texto_p35 = c("texto a", "texto b"),
    codigo = c("1", "1"),
    codificacion = c("Etiqueta A", "Etiqueta B"),
    obs = c("", ""),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  matrix <- codif_matrix_preview(target_sid, path, "p35_conflicto.xlsx")
  item <- matrix$preview$items[[1]]

  expect_equal(item$status, "conflict")
  expect_false(item$can_apply)
  expect_match(matrix$bundle$metadata$warnings[[1]], "más de una etiqueta")
})

test_that("codificacion matrices caso-codigo aceptan variable explicita", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(response_id = c("c1", "c2"), p24_2 = c("gestionar datos", "modelar procesos"), stringsAsFactors = FALSE)
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", data.frame(
    id_caso = c("c1", "c2"),
    variable = c("p24_2", "p24_2"),
    texto_original = c("gestionar datos", "modelar procesos"),
    codigo = c("1", "2"),
    codificacion = c("Datos", "Procesos"),
    obs = c("", ""),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  matrix <- codif_matrix_preview(target_sid, path, "matriz_trabajo.xlsx")

  expect_equal(matrix$preview$summary$n_compatible, 1L)
  expect_equal(matrix$bundle$variables[[1]]$name, "p24_2")
  expect_equal(matrix$preview$items[[1]]$matrix_layout, "case_code_matrix")
})

test_that("codificacion matrices importan contrato final por bloques con observaciones", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(
        response_id = c("c1", "c2"),
        p23 = c("analista", "jefe"),
        p35 = c("ia y malla", "practicas"),
        stringsAsFactors = FALSE
      )
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", "Puesto actual", startRow = 1, startCol = 1, colNames = FALSE)
  openxlsx::writeData(wb, "Civil", matrix(c("ID caso", "Respuesta", "Código", "Categoría", "Observaciones"), nrow = 1), startRow = 2, startCol = 1, colNames = FALSE)
  openxlsx::writeData(wb, "Civil", data.frame(
    `ID caso` = "c1",
    Respuesta = "analista",
    Código = "1",
    Categoría = "Analista Junior",
    Observaciones = "",
    check.names = FALSE
  ), startRow = 3, startCol = 1, colNames = FALSE)
  openxlsx::writeData(wb, "Civil", "Mejoras de la carrera", startRow = 1, startCol = 7, colNames = FALSE)
  openxlsx::writeData(wb, "Civil", matrix(c("ID caso", "Respuesta", "Código", "Categoría", "Observaciones"), nrow = 1), startRow = 2, startCol = 7, colNames = FALSE)
  openxlsx::writeData(wb, "Civil", data.frame(
    `ID caso` = c("c1", "c1", "c2", "c2"),
    Respuesta = c("ia y malla", "ia y malla", "practicas", "practicas"),
    Código = c("1", "8", "2", "99"),
    Categoría = c("Tecnología", "Otro", "Prácticas", "No contesta"),
    Observaciones = c("nota tecnologia", "", "nota practica", ""),
    check.names = FALSE
  ), startRow = 3, startCol = 7, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  matrix <- codif_matrix_preview(target_sid, path, "matriz_final.xlsx")
  preview <- matrix$preview

  expect_equal(matrix$bundle$metadata$matrix_layouts, list("final_work_matrix"))
  expect_equal(preview$summary$n_compatible, 2L)
  expect_true(all(vapply(preview$items, function(item) identical(item$matrix_layout, "final_work_matrix"), logical(1))))
  expect_true(all(vapply(preview$items, function(item) identical(item$matrix_diagnostics$unmatched_cases, 0L), logical(1))))

  selections <- lapply(preview$items, function(item) list(match_id = item$match_id, strategy = "replace"))
  codif_matrix_apply_import(target_sid, matrix$bundle, selections, "matriz_final.xlsx")

  groups <- codif_snapshot(target_sid, "ingenieria_civil")$grupos_recod
  expect_equal(groups$p35[[1]]$matrix_cases[[1]]$obs, "nota tecnologia")
  expect_equal(groups$p35[[2]]$matrix_cases[[1]]$id_caso, "c1")
  expect_equal(groups$p35[[3]]$matrix_cases[[1]]$obs, "nota practica")

  map <- codif_matrix_map(target_sid, base = "ingenieria_civil")
  p35 <- map$bases[[1]]$variables[[which(vapply(map$bases[[1]]$variables, function(v) identical(v$variable, "p35"), logical(1)))]]
  expect_equal(p35$variable_label, "Después de todos sus años de egreso, coméntenos en qué podría mejorar la carrera")
  expect_equal(p35$variable_kind, "text_select_multiple")
  expect_equal(p35$variable_kind_label, "Texto abierto multicode")
  expect_equal(p35$n_casos, 2L)
  expect_equal(p35$n_asignaciones, 4L)
  expect_equal(p35$categories[[1]]$cases[[1]]$obs, "nota tecnologia")
  roles <- stats::setNames(
    vapply(p35$categories, function(category) category$category_role, character(1)),
    vapply(p35$categories, function(category) category$codigo, character(1))
  )
  role_labels <- stats::setNames(
    vapply(p35$categories, function(category) category$category_role_label, character(1)),
    vapply(p35$categories, function(category) category$codigo, character(1))
  )
  expect_equal(roles[["8"]], "otro")
  expect_equal(roles[["99"]], "no_contesta")
  expect_equal(role_labels[["8"]], "Otro")
  expect_equal(role_labels[["99"]], "No contesta")

  work <- codif_matrix_export_xlsx(target_sid, "work", variables = c("p23", "p35"), base = "ingenieria_civil")
  s <- session_get(target_sid)
  headers <- readxl::read_excel(s$files[[work$file_id]]$path, sheet = "Civil", col_names = FALSE, n_max = 2)
  expect_equal(as.character(headers[[1]][1]), "¿Cuál es su puesto actual?")
  expect_equal(as.character(headers[[7]][1]), "Después de todos sus años de egreso, coméntenos en qué podría mejorar la carrera")

  internal <- codif_matrix_export_xlsx(target_sid, "internal", variables = c("p23", "p35"), base = "ingenieria_civil")
  s <- session_get(target_sid)
  dictionary_head <- readxl::read_excel(s$files[[internal$file_id]]$path, sheet = "Diccionario", col_names = FALSE, n_max = 4)
  expect_true("Tipo" %in% as.character(unlist(dictionary_head, use.names = FALSE)))
})

test_that("codificacion matrices de una hoja respetan la base destino en proyectos multibase", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(response_id = c("c1", "c2"), p35 = c("texto civil a", "texto civil b"), stringsAsFactors = FALSE)
    ),
    ingenieria_mecatronica = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(response_id = c("m1", "m2"), p35 = c("texto meca a", "texto meca b"), stringsAsFactors = FALSE)
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", data.frame(
    id_caso = c("c1", "c2"),
    variable = c("p35", "p35"),
    texto_original = c("texto civil a", "texto civil b"),
    codigo = c("1", "2"),
    codificacion = c("Civil A", "Civil B"),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  matrix <- codif_matrix_preview(target_sid, path, "civil_p35.xlsx")
  targets <- vapply(matrix$preview$items, function(item) item$target$base_id, character(1))

  expect_equal(matrix$bundle$mode, "multibase")
  expect_equal(length(matrix$preview$items), 1L)
  expect_equal(targets, "ingenieria_civil")
})

test_that("codificacion matrices laborales excluyen Revision como categoria", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(inst = make_codif_categorization_inst(), rows = list())
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", data.frame(
    "¿Cuál es su puesto actual?:" = c("controller", "analista"),
    "Categoría de puesto" = c("Revisión", "Analista Junior"),
    "¿Cuál es su función principal?" = c("controlar costos", "hacer reportes"),
    "Categoría de función principal" = c("Revisión", "Finanzas"),
    check.names = FALSE
  ))
  openxlsx::addWorksheet(wb, "Resumen")
  resumen <- data.frame(
    X1 = c("Resumen de recategorización laboral", "Carrera", "Civil", "Total"),
    X2 = c(NA, "Filas con datos", 2, 816),
    X3 = c(NA, "Puestos categorizados", 1, 535),
    X4 = c(NA, "Puestos con revisión", 1, 281),
    X5 = c(NA, "Funciones categorizadas", 1, 1335),
    X6 = c(NA, "Funciones con revisión", 1, 77),
    X7 = c(NA, "Filas con revisión", 1, 318),
    X8 = c(NA, "% filas con revisión", 0.5, 0.3897),
    check.names = FALSE
  )
  openxlsx::writeData(wb, "Resumen", resumen, colNames = FALSE)
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  matrix <- codif_matrix_preview(target_sid, path, "laboral.xlsx")
  labels <- unlist(lapply(matrix$bundle$variables, function(v) {
    vapply(v$configuration$grupos, function(g) g$etiqueta, character(1))
  }))

  expect_false("Revisión" %in% labels)
  expect_true("Analista Junior" %in% labels)
  expect_true("Finanzas" %in% labels)
  expect_equal(matrix$preview$matrix_summary$total$filas, 816L)
  expect_equal(matrix$preview$matrix_summary$total$puestos_categorizados, 535L)
  expect_equal(matrix$preview$matrix_summary$total$puestos_revision, 281L)
  expect_equal(matrix$preview$matrix_summary$total$funciones_categorizadas, 1335L)
  expect_equal(matrix$preview$matrix_summary$total$funciones_revision, 77L)
  expect_true(any(vapply(matrix$bundle$variables, function(v) {
    identical(v$metadata$diagnostics$review_rows, 1L)
  }, logical(1))))
})

test_that("codificacion matrices exportan matriz de trabajo y auditoria estandar", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(response_id = "c1", p35 = "mejorar tecnologia", stringsAsFactors = FALSE)
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", data.frame(
    id_caso = c("c1", "c1"),
    texto_p35 = c("mejorar tecnologia", "mejorar tecnologia"),
    codigo = c("1", "2"),
    codificacion = c("Tecnología", "Prácticas"),
    obs = c("nota interna", "segunda nota"),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  matrix <- codif_matrix_preview(target_sid, path, "p35.xlsx")
  codif_matrix_apply_import(
    target_sid,
    matrix$bundle,
    list(list(match_id = matrix$preview$items[[1]]$match_id, strategy = "replace")),
    "p35.xlsx"
  )

  work <- codif_matrix_export_xlsx(target_sid, "work", variables = "p35")
  internal <- codif_matrix_export_xlsx(target_sid, "internal")
  client <- codif_matrix_export_xlsx(target_sid, "client")
  s <- session_get(target_sid)
  work_sheets <- readxl::excel_sheets(s$files[[work$file_id]]$path)
  internal_sheets <- readxl::excel_sheets(s$files[[internal$file_id]]$path)
  client_sheets <- readxl::excel_sheets(s$files[[client$file_id]]$path)
  work_header_rows <- readxl::read_excel(s$files[[work$file_id]]$path, sheet = "Civil", col_names = FALSE, n_max = 2)
  work_first_cases <- readxl::read_excel(s$files[[work$file_id]]$path, sheet = "Civil", col_names = FALSE, skip = 2, n_max = 2)
  internal_cases_headers <- names(readxl::read_excel(s$files[[internal$file_id]]$path, sheet = "Casos", skip = 3, n_max = 1))
  client_header_rows <- readxl::read_excel(s$files[[client$file_id]]$path, sheet = "Civil", col_names = FALSE, n_max = 2)
  client_first_cases <- readxl::read_excel(s$files[[client$file_id]]$path, sheet = "Civil", col_names = FALSE, skip = 2, n_max = 2)

  expect_false("Resumen" %in% work_sheets)
  expect_true(all(c("Diccionario", "Civil") %in% work_sheets))
  expect_true("Guía" %in% work_sheets)
  expect_true("Guía" %in% internal_sheets)
  expect_false("Guía" %in% client_sheets)
  expect_equal(as.character(work_header_rows[[1]][1]), "Después de todos sus años de egreso, coméntenos en qué podría mejorar la carrera")
  expect_equal(as.character(unlist(work_header_rows[2, 1:5], use.names = FALSE)), c("ID caso", "Respuesta", "Código", "Categoría", "Observaciones"))
  expect_equal(as.character(work_first_cases[[1]][1:2]), c("c1", "c1"))
  expect_equal(as.character(work_first_cases[[2]][1:2]), c("mejorar tecnologia", "mejorar tecnologia"))
  expect_equal(as.character(work_first_cases[[3]][1:2]), c("1", "2"))
  expect_equal(as.character(work_first_cases[[4]][1:2]), c("Tecnología", "Prácticas"))
  expect_equal(as.character(work_first_cases[[5]][1:2]), c("nota interna", "segunda nota"))
  expect_true(all(c("Resumen", "Diccionario", "Civil") %in% client_sheets))
  expect_false(any(c("Notas", "Casos", "Respuestas") %in% client_sheets))
  expect_equal(as.character(client_header_rows[[1]][1]), "Después de todos sus años de egreso, coméntenos en qué podría mejorar la carrera")
  expect_equal(as.character(unlist(client_header_rows[2, 1:4], use.names = FALSE)), c("ID caso", "Respuesta", "Código", "Categoría"))
  expect_false("Observaciones" %in% as.character(unlist(client_header_rows[2, ], use.names = FALSE)))
  expect_equal(as.character(client_first_cases[[1]][1:2]), c("c1", "c1"))
  expect_equal(as.character(client_first_cases[[2]][1:2]), c("mejorar tecnologia", "mejorar tecnologia"))
  expect_equal(as.character(client_first_cases[[3]][1:2]), c("1", "2"))
  expect_equal(as.character(client_first_cases[[4]][1:2]), c("Tecnología", "Prácticas"))
  expect_true("Casos" %in% internal_sheets)
  expect_true("ID caso" %in% internal_cases_headers)
  expect_false(any(grepl("_uuid|respondent_id|response_id|variable_fuente|variable_recodificada", as.character(unlist(client_header_rows, use.names = FALSE)))))
  guide_text <- readxl::read_excel(s$files[[work$file_id]]$path, sheet = "Guía", col_names = FALSE, n_max = 12)
  guide_text <- paste(as.character(unlist(guide_text, use.names = FALSE)), collapse = " ")
  expect_true(grepl("Otro", guide_text, fixed = TRUE))
  expect_true(grepl("No contesta", guide_text, fixed = TRUE))
  expect_true(grepl("no un código hardcodeado", guide_text, fixed = TRUE))
})

test_that("codificacion matrices no propagan observaciones entre casos", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(
        response_id = c("c1", "c2"),
        p35 = c("mejorar tecnologia", "mejorar tecnologia"),
        stringsAsFactors = FALSE
      )
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", data.frame(
    id_caso = c("c1", "c1", "c2"),
    texto_p35 = c("mejorar tecnologia", "mejorar tecnologia", "mejorar tecnologia"),
    codigo = c("1", "2", "1"),
    codificacion = c("Tecnología", "Prácticas", "Tecnología"),
    obs = c("nota solo c1", "", ""),
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  matrix <- codif_matrix_preview(target_sid, path, "p35.xlsx")
  codif_matrix_apply_import(
    target_sid,
    matrix$bundle,
    list(list(match_id = matrix$preview$items[[1]]$match_id, strategy = "replace")),
    "p35.xlsx"
  )

  work <- codif_matrix_export_xlsx(target_sid, "work", variables = "p35")
  s <- session_get(target_sid)
  rows <- readxl::read_excel(s$files[[work$file_id]]$path, sheet = "Civil", col_names = FALSE, skip = 2)

  expect_equal(nrow(rows), 3L)
  expect_equal(as.character(rows[[1]]), c("c1", "c1", "c2"))
  expect_equal(as.character(rows[[3]]), c("1", "2", "1"))
  expect_equal(as.character(rows[[5]][1]), "nota solo c1")
  expect_true(is.na(rows[[5]][2]) || !nzchar(as.character(rows[[5]][2])))
  expect_true(is.na(rows[[5]][3]) || !nzchar(as.character(rows[[5]][3])))
})

test_that("codificacion matrices exportan variables con etiquetas duplicadas", {
  testthat::skip_if_not_installed("openxlsx")
  inst <- make_codif_categorization_inst()
  inst$survey <- rbind(
    inst$survey,
    data.frame(type = c("text", "text"), name = c("p40", "p41"), label = c("Contacto", "Contacto"), stringsAsFactors = FALSE)
  )
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(
      inst = inst,
      rows = list(),
      data = data.frame(
        response_id = c("c1", "c2"),
        p40 = c("uno", "dos"),
        p41 = c("tres", "cuatro"),
        stringsAsFactors = FALSE
      )
    )
  ))

  out <- codif_matrix_export_xlsx(target_sid, visibility = "work", variables = list("p40", "p41"), base = "ingenieria_civil")
  meta <- get_file(target_sid, out$file_id)

  expect_true(file.exists(meta$path))
  expect_gt(out$size, 0L)
  expect_true("Civil" %in% openxlsx::getSheetNames(meta$path))
})

test_that("codificacion matrices distinguen visualmente seleccion unica y multiple", {
  testthat::skip_if_not_installed("openxlsx")
  inst <- make_codif_config_inst()
  inst$survey <- rbind(
    inst$survey,
    data.frame(type = "select_multiple ai", name = "p19", label = "IA usada", stringsAsFactors = FALSE)
  )
  target_sid <- seed_codif_config_session(list(
    base_a = list(
      inst = inst,
      rows = list(
        codif_config_row_p36(),
        codif_config_row_select_multiple_with_other("p19", "p19_other", "IA usada")
      ),
      groups = list(
        p36 = codif_config_groups_p36("Selección única QA"),
        p19 = codif_config_groups_p36("Selección múltiple QA")
      ),
      data = data.frame(
        response_id = "a1",
        p36 = "texto normalizado",
        p19 = "texto normalizado",
        stringsAsFactors = FALSE
      )
    )
  ))

  out <- codif_matrix_export_xlsx(target_sid, visibility = "client", variables = list("p36", "p19"), base = "base_a")
  s <- session_get(target_sid)
  resumen <- readxl::read_excel(s$files[[out$file_id]]$path, sheet = "Resumen", skip = 5)

  expect_true(all(c("Selección única", "Selección múltiple") %in% resumen$Tipo))
})

test_that("codificacion matrices exportan mapeo filtrado por base", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    base_a = list(
      inst = make_codif_categorization_inst(),
      groups = list(p35 = codif_config_groups_p36("Base A")),
      data = data.frame(response_id = "a1", p35 = "texto base a", stringsAsFactors = FALSE)
    ),
    base_b = list(
      inst = make_codif_categorization_inst(),
      groups = list(p35 = codif_config_groups_p36("Base B")),
      data = data.frame(response_id = "b1", p35 = "texto base b", stringsAsFactors = FALSE)
    )
  ))

  work <- codif_matrix_export_xlsx(target_sid, "work", variables = "p35", base = "base_b")
  client <- codif_matrix_export_xlsx(target_sid, "client", variables = "p35", base = "base_b")
  s <- session_get(target_sid)
  sheet_b <- "base_b"
  work_sheets <- readxl::excel_sheets(s$files[[work$file_id]]$path)
  client_sheets <- readxl::excel_sheets(s$files[[client$file_id]]$path)
  work_first_case <- readxl::read_excel(s$files[[work$file_id]]$path, sheet = sheet_b, col_names = FALSE, skip = 2, n_max = 1)
  client_first_case <- readxl::read_excel(s$files[[client$file_id]]$path, sheet = sheet_b, col_names = FALSE, skip = 2, n_max = 1)

  expect_true(sheet_b %in% work_sheets)
  expect_false("base_a" %in% work_sheets)
  expect_true(sheet_b %in% client_sheets)
  expect_false("base_a" %in% client_sheets)
  expect_equal(as.character(work_first_case[[2]][1]), "texto base b")
  expect_equal(as.character(client_first_case[[2]][1]), "texto base b")
})

test_that("codificacion matrices mapa excluye codificacion manual y reconstruye casos", {
  target_sid <- seed_codif_config_session(list(
    base_a = list(
      inst = make_codif_categorization_inst(),
      groups = list(
        p2 = codif_config_groups_p36("Edad agrupada"),
        p23 = codif_config_groups_p36("Analista Junior")
      ),
      data = data.frame(
        response_id = c("a1", "a2"),
        p2 = c("texto normalizado", "texto normalizado"),
        p23 = c("texto normalizado", "otro puesto"),
        stringsAsFactors = FALSE
      )
    )
  ))

  map <- codif_matrix_map(target_sid, base = "base_a")
  expect_equal(vapply(map$bases[[1]]$variables, `[[`, character(1), "variable"), "p23")
  expect_equal(map$bases[[1]]$variables[[1]]$n_casos, 1L)
  expect_equal(map$bases[[1]]$variables[[1]]$categories[[1]]$cases[[1]]$id_caso, "a1")
  expect_equal(map$bases[[1]]$variables[[1]]$categories[[1]]$cases[[1]]$respuesta, "texto normalizado")
})

test_that("codificacion matrices permiten corregir un caso puntual del mapeo", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_civil = list(
      inst = make_codif_categorization_inst(),
      rows = list(),
      data = data.frame(response_id = "c1", p35 = "mejorar tecnologia", stringsAsFactors = FALSE)
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Civil")
  openxlsx::writeData(wb, "Civil", data.frame(
    id_caso = "c1",
    texto_p35 = "mejorar tecnologia",
    codigo = "1",
    codificacion = "Tecnología",
    obs = "",
    stringsAsFactors = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  matrix <- codif_matrix_preview(target_sid, path, "p35.xlsx")
  codif_matrix_apply_import(
    target_sid,
    matrix$bundle,
    list(list(match_id = matrix$preview$items[[1]]$match_id, strategy = "replace")),
    "p35.xlsx"
  )

  before <- codif_matrix_map(target_sid)
  expect_equal(before$bases[[1]]$variables[[1]]$categories[[1]]$cases[[1]]$id_caso, "c1")

  patched <- codif_matrix_patch_case(
    target_sid,
    base = "ingenieria_civil",
    variable = "p35",
    id_caso = "c1",
    from_codigo = "1",
    codigo = "2",
    etiqueta = "Prácticas"
  )
  categories <- patched$map$bases[[1]]$variables[[1]]$categories
  target <- categories[[which(vapply(categories, function(x) identical(x$codigo, "2"), logical(1)))]]
  source <- categories[[which(vapply(categories, function(x) identical(x$codigo, "1"), logical(1)))]]

  expect_equal(target$n_casos, 1L)
  expect_equal(target$cases[[1]]$id_caso, "c1")
  expect_equal(target$cases[[1]]$etiqueta, "Prácticas")
  expect_equal(source$n_casos, 0L)
})

test_that("codificacion import Excel preserva variables fuera de la seleccion", {
  testthat::skip_if_not_installed("openxlsx")
  target_sid <- seed_codif_config_session(list(
    ingenieria_industrial = list(
      inst = make_codif_categorization_inst(),
      rows = list(codif_config_row_text("p24_2", "Función 2:")),
      groups = list(p24_2 = codif_config_groups_p36("Funcion previa")),
      marcadas = list(p24_2 = TRUE),
      respuestas = list(p24_2 = list("Gestion previa"))
    )
  ))
  path <- tempfile(fileext = ".xlsx")
  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Industrial")
  openxlsx::writeData(wb, "Industrial", data.frame(
    "Puesto Actual" = c("Analista PCP", "Jefe de operaciones"),
    "Categoría de puesto" = c("Analistas e Ingenieros", "Jefaturas"),
    check.names = FALSE
  ))
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)

  bundle <- codif_config_bundle_from_categorization_xlsx(target_sid, path, "categorias.xlsx")
  preview <- codif_config_preview_import(target_sid, bundle, "categorias.xlsx")
  result <- codif_config_apply_import(
    target_sid,
    bundle,
    lapply(preview$items, function(item) list(match_id = item$match_id, strategy = "replace")),
    "categorias.xlsx"
  )

  target <- codif_snapshot(target_sid, "ingenieria_industrial")
  expect_equal(result$summary$variables_imported, 1L)
  expect_equal(length(target$grupos_recod$p23), 2L)
  expect_equal(target$grupos_recod$p24_2[[1]]$etiqueta, "Funcion previa")
  expect_equal(target$respuestas_recod$p24_2, list("Gestion previa"))
  expect_true(isTRUE(target$marcadas$p24_2))
})

test_that("codificacion export/import roundtrip conserva estructura equivalente", {
  source_sid <- seed_codif_config_session(list(base_a = list(
    rows = list(codif_config_row_p36()),
    groups = list(p36 = codif_config_groups_p36("Categoría redonda")),
    marcadas = list(p36 = TRUE)
  )))
  target_sid <- seed_codif_config_session(list(base_a = list(
    inst = make_codif_config_inst(),
    rows = list()
  )), with_project = TRUE)
  bundle <- codif_config_export(source_sid)
  preview <- codif_config_preview_import(target_sid, bundle)
  result <- codif_config_apply_import(
    target_sid,
    bundle,
    list(list(match_id = preview$items[[1]]$match_id, strategy = "replace")),
    "roundtrip.json"
  )
  exported_again <- codif_config_export(target_sid)

  expect_equal(result$audit$event, "coding_config_import")
  expect_equal(result$summary$variables_imported, 1L)
  expect_equal(exported_again$variables[[1]]$categories[[1]]$label, "Categoría redonda")
  expect_true(session_get(target_sid)$project_dirty)
})
