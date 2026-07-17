# W1 — Whitelist del workspace incompleta (perdida silenciosa en round-trip).
#
# El workspace del estudio es whitelist-only: todo campo que el frontend
# declare y no este en .cm_normalize_workspace / aulas_config se BORRA en cada
# PUT→GET. Faltaban: category_mappings (mapeos manuales de categorias) y los 6
# campos de reemplazos del DEFAULT_UNIVERSITY_AULAS_CONFIG del TS. Defaults
# espejo de frontend/src/features/calcMuestra/universidad/shared/constants.ts.

.ws_roundtrip <- function(workspace) {
  calc_muestra_normalize_estudio(list(titulo = "t", workspace = workspace))$workspace
}

test_that("category_mappings sobrevive el round-trip con normalizacion defensiva", {
  ws <- .ws_roundtrip(list(
    frame_mode = "acreditacion",
    category_mappings = list(
      list(
        role = "condition",
        label = "Condición",
        source_role = "base_madre",
        column = "condicion",
        values = list(
          list(raw = "REGULAR", label = "REGULAR", include = TRUE, notes = "canonico"),
          list(raw = "", label = "Sin dato"),                # raw vacio se conserva
          "no-es-lista"                                      # entrada invalida -> se descarta
        )
      ),
      list(role = "", values = list()),                      # sin role -> se descarta
      "basura"                                               # no-lista -> se descarta
    )
  ))

  cm <- ws$category_mappings
  expect_length(cm, 1L)
  expect_equal(cm[[1]]$role, "condition")
  expect_equal(cm[[1]]$column, "condicion")
  expect_length(cm[[1]]$values, 2L)
  expect_equal(cm[[1]]$values[[1]]$raw, "REGULAR")
  expect_true(isTRUE(cm[[1]]$values[[1]]$include))
  expect_equal(cm[[1]]$values[[2]]$raw, "")
  expect_true(isTRUE(cm[[1]]$values[[2]]$include)) # include default TRUE

  # Segundo round-trip: estable (no se degrada ni se pierde).
  ws2 <- .ws_roundtrip(ws)
  expect_equal(ws2$category_mappings, cm)

  # Ausente -> list() (proyectos viejos).
  expect_equal(.ws_roundtrip(list(frame_mode = "legacy"))$category_mappings, list())
})

test_that("los 6 campos de reemplazos del aulas_config sobreviven el round-trip", {
  ws <- .ws_roundtrip(list(
    frame_mode = "acreditacion",
    aulas_config = list(
      schema = "calc_muestra_workspace_aulas_v1",
      replacement_depth_strategy = "fixed_depth",
      min_replacements_per_titular = 2L,
      max_replacements_per_titular = 7L,
      extra_pool_policy = "none",
      replacement_equivalence_vars = list("faculty", "program"),
      replacement_score_weights = list(faculty = 50, custom_var = 3, invalido = "x")
    )
  ))
  cfg <- ws$aulas_config
  expect_equal(cfg$replacement_depth_strategy, "fixed_depth")
  expect_equal(cfg$min_replacements_per_titular, 2L)
  expect_equal(cfg$max_replacements_per_titular, 7L)
  expect_equal(cfg$extra_pool_policy, "none")
  expect_equal(unlist(cfg$replacement_equivalence_vars), c("faculty", "program"))
  # Pesos: el input pisa clave a clave sobre los defaults del motor; los no
  # numericos se descartan (queda el default) y las claves custom se conservan.
  expect_equal(cfg$replacement_score_weights$faculty, 50)
  expect_equal(cfg$replacement_score_weights$program, 22)      # default del motor
  expect_equal(cfg$replacement_score_weights$custom_var, 3)
  expect_null(cfg$replacement_score_weights$invalido)          # no numerico -> descartado

  # Doble round-trip estable.
  ws2 <- .ws_roundtrip(ws)
  expect_equal(ws2$aulas_config$replacement_score_weights, cfg$replacement_score_weights)
  expect_equal(ws2$aulas_config$replacement_equivalence_vars, cfg$replacement_equivalence_vars)
})

test_that("ausencia de los campos de reemplazos aplica los defaults del TS (= motor)", {
  cfg <- .ws_roundtrip(list(
    frame_mode = "acreditacion",
    aulas_config = list(schema = "calc_muestra_workspace_aulas_v1")
  ))$aulas_config
  motor <- calc_muestra_aulas_default_config()$selector

  expect_equal(cfg$replacement_depth_strategy, "max_complete_chains_by_cell")
  expect_equal(cfg$min_replacements_per_titular, 1L)
  expect_equal(cfg$max_replacements_per_titular, 11L)
  expect_equal(cfg$extra_pool_policy, "leftover_after_chains")
  expect_equal(cfg$replacement_equivalence_vars, motor$replacement_equivalence_vars)
  expect_equal(cfg$replacement_score_weights, motor$replacement_score_weights)

  # list() vacia EXPLICITA en equivalence_vars se respeta (contrato de los
  # patrones: el usuario limpio la lista a proposito).
  cfg_vacia <- .ws_roundtrip(list(
    frame_mode = "acreditacion",
    aulas_config = list(replacement_equivalence_vars = list())
  ))$aulas_config
  expect_equal(cfg_vacia$replacement_equivalence_vars, list())
})
