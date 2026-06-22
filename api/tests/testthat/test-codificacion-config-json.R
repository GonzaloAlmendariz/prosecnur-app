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
    type = rep("text", 6),
    name = c("p23", "p24_1", "p24_2", "p24_3", "p24_4", "p24_5"),
    label = c(
      "¿Cuál es su puesto actual?:",
      "Función 1:",
      "Función 2:",
      "Función 3:",
      "Función 4:",
      "Función 5:"
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
    s$codif_por_base[[base]] <- list(
      inst = inst,
      familias_draft = list(rows = rows, source = "test"),
      grupos_recod = groups,
      marcadas = marcadas,
      respuestas_recod = respuestas
    )
  }
  .session_env[[sid]] <- s
  sid
}

codif_config_row_p36 <- function() {
  list(
    use = TRUE,
    tipo = "select_one",
    modo_so = "padre",
    parent = "p36",
    parent_label = "Código Pulso",
    list_norm = "yesno",
    parent_col = "p36",
    text_col = "p36_other",
    other_dummy_col = "",
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
