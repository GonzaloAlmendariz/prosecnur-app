source("setup-load-all.R")

.gr_weighted_repeat_study <- function() {
  sid <- session_create()
  parent <- data.frame(
    `_index` = 1:3, sexo = c("1", "2", "1"), edad = c(30, 40, 25),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  parent_inst <- list(
    survey = data.frame(
      type = c("select_one lst_sexo", "integer"), name = c("sexo", "edad"),
      label = c("Sexo", "Edad"), stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_sexo", "lst_sexo"), name = c("1", "2"),
      label = c("Mujer", "Hombre"), stringsAsFactors = FALSE
    )
  )
  child <- data.frame(
    `_index` = 1:3, `_parent_index` = c(2L, 2L, 3L),
    srv_claridad = c("2", "1", "1"), stringsAsFactors = FALSE,
    check.names = FALSE
  )
  child_inst <- list(
    survey = data.frame(
      type = "select_one lst_claridad", name = "srv_claridad",
      label = "Claridad", stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("lst_claridad", "lst_claridad"), name = c("1", "2"),
      label = c("Si", "No"), stringsAsFactors = FALSE
    )
  )
  estudio_add_base(sid, "madre", "xls-m", "data-m", "xlsx",
                   parent, parent_inst, 3L, 3L)
  estudio_add_base(
    sid, "rep_servicios", "xls-h", "data-h", "xlsx",
    child, child_inst, 3L, 3L,
    extra_meta = list(
      source_kind = "kobo_repeat", parent_base = "madre",
      repeat_group = "rep_servicios", link_key = "_parent_index",
      parent_index_key = "_index"
    )
  )
  list(sid = sid, child_name = "rep_servicios")
}

test_that("graficos consume fuentes repeat enriquecidas, ponderadas y con grano", {
  st <- .gr_weighted_repeat_study()
  on.exit(session_delete(st$sid), add = TRUE)
  child_name <- st$child_name

  session_set(st$sid, "analitica_config", list(ponderacion = list(
    enabled = TRUE,
    design = list(var = "sexo", pop_sizes = list(`1` = 50, `2` = 50))
  )))
  sources <- .graficos_processing_sources(st$sid)
  child <- sources$data_sources[[child_name]]
  child_inst <- sources$inst_sources[[child_name]]

  # Gráficos/PPT/Word comparten esta fuente: debe permitir srv_* × sexo.
  expect_true(all(c("srv_claridad", "sexo", "edad", "peso") %in% names(child)))
  expect_equal(as.character(child$sexo), c("2", "2", "1"))
  expect_equal(child$peso, c(1.5, 1.5, 0.75), tolerance = 1e-8)
  expect_true(isTRUE(attr(child$sexo, "repeat_inherited")))

  grain <- attr(child_inst, "repeat_grain", exact = TRUE)
  expect_equal(grain$kind, "instancia")
  expect_equal(grain$n_instancias, 3L)
  expect_equal(grain$n_personas, 2L)
  expect_equal(attr(child, "repeat_design", exact = TRUE)$cluster_col,
               "_parent_index")

  payload <- .graficos_variables_sources_payload(st$sid)
  repeat_source <- payload$sources[[which(vapply(
    payload$sources,
    function(source) identical(source$name, child_name),
    logical(1)
  ))]]
  by_name <- stats::setNames(
    repeat_source$variables,
    vapply(repeat_source$variables, `[[`, character(1), "name")
  )

  expect_equal(repeat_source$source_role, "repeat")
  expect_equal(repeat_source$repeat_grain$n_instancias, 3L)
  expect_equal(repeat_source$repeat_grain$n_personas, 2L)
  expect_equal(repeat_source$base_label, "Base: 3 respuestas de 2 encuestas")
  expect_true(isTRUE(by_name$sexo$parent_inherited))
  expect_true(isTRUE(by_name$sexo$repeat_inherited))
  expect_false(isTRUE(by_name$sexo$suggest_as_primary))
  expect_true(isTRUE(by_name$sexo$graphable))
  expect_true(isTRUE(by_name$sexo$is_preferred))
  expect_true(isTRUE(by_name$srv_claridad$suggest_as_primary))
})

test_that("graficos_repeat_enrich_sources es benigno para una base normal", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  data <- data.frame(q1 = c("1", "2"), stringsAsFactors = FALSE)
  inst <- list(survey = data.frame(
    type = "select_one lst", name = "q1", label = "Pregunta",
    stringsAsFactors = FALSE
  ))
  src <- list(data_sources = list(default = data), inst_sources = list(default = inst))

  out <- .graficos_repeat_enrich_sources(sid, src)
  expect_equal(out$data_sources$default, data)
  expect_equal(out$inst_sources$default, inst)
  expect_null(attr(out$data_sources$default, "repeat_design", exact = TRUE))
})
