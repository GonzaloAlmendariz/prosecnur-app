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
