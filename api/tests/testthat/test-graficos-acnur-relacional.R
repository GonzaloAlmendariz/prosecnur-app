source("setup-load-all.R")

.graficos_acnur_relational_study <- function() {
  sid <- session_create()
  parent <- data.frame(
    `_index` = 1:3,
    perfil = c("1", "2", "1"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  parent_inst <- list(
    survey = data.frame(
      type = "select_one perfil_list",
      name = "perfil",
      label = "Perfil de la persona encuestada",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("perfil_list", "perfil_list"),
      name = c("1", "2"),
      label = c("Persona titular", "Persona acompañante"),
      stringsAsFactors = FALSE
    )
  )
  repeat_data <- data.frame(
    `_index` = 1:3,
    `_parent_index` = c(2L, 2L, 3L),
    claridad = c("2", "1", "1"),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
  repeat_inst <- list(
    survey = data.frame(
      type = "select_one claridad_list",
      name = "claridad",
      label = "Claridad de la respuesta",
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("claridad_list", "claridad_list"),
      name = c("1", "2"),
      label = c("Clara", "Poco clara"),
      stringsAsFactors = FALSE
    )
  )

  estudio_add_base(
    sid, "principal", "xls-m", "data-m", "xlsx",
    parent, parent_inst, 3L, 3L
  )
  estudio_add_base(
    sid, "respuestas_servicios", "xls-h", "data-h", "xlsx",
    repeat_data, repeat_inst, 3L, 3L,
    extra_meta = list(
      source_kind = "kobo_repeat",
      parent_base = "principal",
      repeat_group = "respuestas_servicios",
      link_key = "_parent_index",
      parent_index_key = "_index"
    )
  )
  session_set(sid, "project_path", "/tmp/ACNUR_PDM_formal.pulso")
  sid
}

test_that("plan ACNUR relacional es un solo informe y no duplica heredadas", {
  sid <- .graficos_acnur_relational_study()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  refs <- .graficos_collect_plan_refs(suggested$plan)
  slides <- suggested$plan$slides
  bases <- unique(Filter(nzchar, vapply(slides, function(slide) {
    .graficos_scalar_chr(((slide %||% list())$payload %||% list())$base, "")
  }, character(1))))
  footers <- unique(Filter(nzchar, vapply(slides, function(slide) {
    .graficos_scalar_chr(((slide %||% list())$payload %||% list())$pie, "")
  }, character(1))))
  graph_notes <- unique(Filter(nzchar, unlist(lapply(slides, function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    lapply(payload, function(value) {
      graf <- .as_json_list(value)
      .graficos_scalar_chr((((graf %||% list())$args %||% list())$overrides %||% list())$nota_pie, "")
    })
  }), use.names = FALSE)))
  visible_text <- paste(unlist(lapply(slides, function(slide) {
    payload <- (slide %||% list())$payload %||% list()
    list(payload$titulo, payload$texto, payload$subtitulo, payload$subtexto)
  }), use.names = FALSE), collapse = " ")

  expect_true(suggested$ok)
  expect_equal(suggested$profile_id, "acnur_kobo_cruncher_plus")
  expect_equal(suggested$acnur_mode, "general")
  expect_equal(suggested$report_scope, "single_study")
  expect_equal(suggested$template_id, "acnur_16_9")
  expect_false(suggested$auto_otros_slides)
  expect_true("principal$perfil" %in% refs)
  expect_true("respuestas_servicios$claridad" %in% refs)
  expect_false("respuestas_servicios$perfil" %in% refs)
  expect_equal(sum(refs == "principal$perfil"), 1L)
  expect_length(bases, 0L)
  expect_length(footers, 0L)
  graph_slides <- Filter(function(slide) identical(slide$tipo, "p_slide_1_grafico"), slides)
  expect_true(all(vapply(graph_slides, function(slide) {
    meta <- (slide$payload %||% list())$meta %||% list()
    isTRUE(meta$suppress_base_placeholder) && isTRUE(meta$suppress_footer_placeholder)
  }, logical(1))))
  # Base principal y base repeat (pooled) comparten el formato limpio sin unidad
  # ni conteo de personas; el nombre del servicio solo se anexa cuando la fuente
  # se abre POR SERVICIO (no es el caso de este fixture pooled).
  expect_setequal(
    graph_notes,
    c(
      "Base: 3 de 3 (100.0%)."
    )
  )
  expect_false(any(grepl("territorial|KOICA|actor", visible_text, ignore.case = TRUE)))
  expect_equal(suggested$generation_audit$totals$generated, 2L)
  expect_equal(suggested$generation_audit$totals$omitted, 1L)
  expect_equal(suggested$generation_audit$totals$failed, 0L)
  expect_false(any(grepl("\\$\\{", visible_text)))
})

test_that("heredadas repeat quedan disponibles como dimensiones pero no como resultado", {
  sid <- .graficos_acnur_relational_study()
  on.exit(session_delete(sid), add = TRUE)

  suggested <- .graficos_suggested_plan(sid, config = list())
  repeat_source <- suggested$coverage$sources[[which(vapply(
    suggested$coverage$sources,
    function(source) identical(source$name, "respuestas_servicios"),
    logical(1)
  ))]]
  by_name <- stats::setNames(
    repeat_source$variables,
    vapply(repeat_source$variables, `[[`, character(1), "name")
  )

  expect_equal(repeat_source$source_role, "repeat")
  expect_equal(repeat_source$base_label, "Base: 3 respuestas de 2 encuestas")
  expect_true(isTRUE(by_name$perfil$graphable))
  expect_true(isTRUE(by_name$perfil$is_preferred))
  expect_false(isTRUE(by_name$perfil$suggest_as_primary))
  expect_false(isTRUE(by_name$perfil$coverage_countable))
  expect_true(isTRUE(by_name$claridad$suggest_as_primary))
  expect_true(isTRUE(by_name$claridad$coverage_countable))
})

test_that("etiquetas de base expresan encuestas y respuestas sin nombres tecnicos", {
  expect_equal(
    .reporte_plan_base_label("principal", list(n_encuestas = 426L)),
    "Base: 426 encuestas"
  )
  expect_equal(
    .reporte_plan_base_label(
      "repeat",
      list(n_instancias = 667L, n_personas = 426L)
    ),
    "Base: 667 respuestas de 426 encuestas"
  )
})

test_that("titulos dinamicos solo usan contexto repeat unico y materializado", {
  choices <- data.frame(
    list_name = "servicios",
    name = c("1", "2"),
    label = c("Orientación legal", "Atención de salud"),
    stringsAsFactors = FALSE
  )
  make_inst <- function() {
    list(
      survey = data.frame(
        type = "select_one resultado",
        name = "resultado",
        label = "¿Quedó satisfecho/a con la atención - ${current_label}?",
        stringsAsFactors = FALSE
      ),
      choices = choices
    )
  }

  principal <- .graficos_extract_vars_from_inst(
    make_inst(),
    data = data.frame(resultado = c("1", "1"), current_label = c("Orientación legal", "Orientación legal")),
    source_kind = "kobo"
  )[[1]]
  expect_equal(principal$label, "¿Quedó satisfecho/a con la atención?")
  expect_equal(principal$context_resolution, "universal")

  repeat_inst <- make_inst()
  attr(repeat_inst, "repeat_grain") <- list(kind = "instancia")
  repeat_unique <- .graficos_extract_vars_from_inst(
    repeat_inst,
    data = data.frame(resultado = c("1", "1"), current_label = c("Orientación legal", "Orientación legal")),
    source_kind = "kobo_repeat"
  )[[1]]
  expect_equal(repeat_unique$label, "¿Quedó satisfecho/a con la atención: Orientación legal?")
  expect_equal(repeat_unique$context_resolution, "unique_materialized_repeat_context")

  repeat_mixed <- .graficos_extract_vars_from_inst(
    repeat_inst,
    data = data.frame(resultado = c("1", "2"), current_label = c("Orientación legal", "Atención de salud")),
    source_kind = "kobo_repeat"
  )[[1]]
  expect_equal(repeat_mixed$label, "¿Quedó satisfecho/a con la atención?")
  expect_equal(repeat_mixed$context_resolution, "universal")
})

test_that("el filtro aplicado al universo no se convierte en resultado", {
  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)

  data <- data.frame(
    testreal = c("real", "real", "real"),
    Consent = c("Yes", "Yes", "Yes"),
    resultado = c("1", "2", "1"),
    stringsAsFactors = FALSE
  )
  inst <- list(
    survey = data.frame(
      type = c("select_one tipo_registro", "select_one consentimiento", "select_one resultado_list"),
      name = c("testreal", "Consent", "resultado"),
      label = c("¿Es una entrevista real o una prueba?", "¿Acepta continuar?", "Resultado principal"),
      stringsAsFactors = FALSE
    ),
    choices = data.frame(
      list_name = c("tipo_registro", "tipo_registro", "consentimiento", "consentimiento", "resultado_list", "resultado_list"),
      name = c("real", "test", "Yes", "No", "1", "2"),
      label = c("Entrevista real", "Prueba", "Sí", "No", "Sí", "No"),
      stringsAsFactors = FALSE
    )
  )
  estudio_add_base(sid, "principal", "xls", "data", "xlsx", data, inst, 3L, 2L)
  state <- session_get(sid)
  state$estudio$bases$principal$universe_filter <- list(
    enabled = TRUE,
    variable = "testreal",
    real_values = "real",
    test_values = "test",
    exclusion_rules = list(list(variable = "Consent", values = "No"))
  )
  session_set(sid, "estudio", state$estudio)
  session_set(sid, "project_path", "/tmp/ACNUR_PDM_formal.pulso")

  suggested <- .graficos_suggested_plan(sid, config = list())
  refs <- .graficos_collect_plan_refs(suggested$plan)
  omitted <- suggested$generation_audit$omitted

  expect_true("principal$resultado" %in% refs)
  expect_false("principal$testreal" %in% refs)
  expect_false("principal$Consent" %in% refs)
  expect_equal(sum(vapply(omitted, function(item) {
    identical(item$reason_code, "universe_filter") && isTRUE(item$operational_filter)
  }, logical(1))), 2L)
  expect_true(any(vapply(omitted, function(item) {
    identical(item$ref, "principal$testreal") &&
      identical(item$reason_code, "universe_filter") &&
      isTRUE(item$operational_filter)
  }, logical(1))))
})
