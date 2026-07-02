library(testthat)

.acr_multi_with_mocked_binding <- function(target_env, name, value) {
  had_previous <- exists(name, envir = target_env, inherits = FALSE)
  previous <- if (had_previous) get(name, envir = target_env) else NULL
  was_locked <- had_previous && bindingIsLocked(name, target_env)
  if (was_locked) unlockBinding(name, target_env)
  assign(name, value, envir = target_env)
  if (was_locked) lockBinding(name, target_env)

  function() {
    exists_now <- exists(name, envir = target_env, inherits = FALSE)
    is_locked <- exists_now && bindingIsLocked(name, target_env)
    if (is_locked) unlockBinding(name, target_env)
    if (had_previous) {
      assign(name, previous, envir = target_env)
    } else if (exists_now) {
      rm(list = name, envir = target_env)
    }
    if (was_locked && exists(name, envir = target_env, inherits = FALSE)) {
      lockBinding(name, target_env)
    }
  }
}

.acr_multi_sm_details <- function(survey_id, actor) {
  code_label <- if (identical(actor, "Estudiantes")) {
    "Código Pulso personalizado"
  } else {
    "Código Pulso"
  }
  list(
    id = survey_id,
    title = paste("Acreditación Contabilidad -", actor),
    pages = list(
      list(
        id = paste0(survey_id, "_page_1"),
        position = 1L,
        title = paste("Cuestionario", actor),
        questions = list(
          list(
            id = paste0(survey_id, "_q1"),
            position = 1L,
            family = "single_choice",
            subtype = "vertical",
            headings = list(list(heading = "Nivel de satisfacción con el proceso")),
            answers = list(choices = list(
              list(position = 1L, text = "Bajo"),
              list(position = 2L, text = "Medio"),
              list(position = 3L, text = "Alto")
            ))
          ),
          list(
            id = paste0(survey_id, "_q2"),
            position = 2L,
            family = "open_ended",
            subtype = "single",
            headings = list(list(heading = code_label))
          ),
          list(
            id = paste0(survey_id, "_q3"),
            position = 3L,
            family = "single_choice",
            subtype = "vertical",
            headings = list(list(heading = "Sabe dónde consultar información")),
            answers = list(choices = list(
              list(position = 1L, text = "Sí"),
              list(position = 2L, text = "No")
            ))
          )
        )
      )
    )
  )
}

.acr_multi_kobo_detail <- function(asset_uid) {
  list(
    uid = asset_uid,
    name = "Acreditación Contabilidad - Administrativos",
    version_id = paste0("v-", asset_uid),
    date_modified = "2026-07-01T12:00:00Z",
    deployment = list(active = TRUE),
    content = list(
      survey = list(
        list(type = "text", name = "codigo_pulso", label = "Código Pulso"),
        list(type = "select_one satisfaccion", name = "q1", label = "Nivel de satisfacción con el proceso"),
        list(type = "select_one consulta", name = "q2", label = "Sabe dónde consultar información")
      ),
      choices = list(
        list(list_name = "satisfaccion", name = "1", label = "Bajo"),
        list(list_name = "satisfaccion", name = "2", label = "Medio"),
        list(list_name = "satisfaccion", name = "3", label = "Alto"),
        list(list_name = "consulta", name = "1", label = "Sí"),
        list(list_name = "consulta", name = "2", label = "No")
      ),
      settings = list(
        list(form_title = "Acreditación Contabilidad - Administrativos", form_id = "acrconta_admin", version = "20260701")
      )
    )
  )
}

.acr_multi_write_data_upload <- function(sid, filename, df) {
  path <- tempfile(fileext = ".xlsx")
  openxlsx::write.xlsx(list(datos = df), file = path, overwrite = TRUE)
  save_upload(sid, "data", filename, readBin(path, "raw", n = file.info(path)$size))
}

.acr_multi_sm_data <- function(actor_slug, values) {
  data.frame(
    response_id = paste0(actor_slug, "_", seq_along(values)),
    p1 = as.character(values),
    p2 = paste0("COD-", toupper(actor_slug), "-", seq_along(values)),
    p3 = rep(c("1", "2"), length.out = length(values)),
    stringsAsFactors = FALSE,
    check.names = FALSE
  )
}

.acr_multi_plot_labels <- function(p) {
  gb <- ggplot2::ggplot_build(p)
  unique(unlist(lapply(gb$data, function(x) {
    hits <- character(0)
    for (nm in c("label", "lab", "text", "palabra")) {
      if (nm %in% names(x)) hits <- c(hits, as.character(x[[nm]]))
    }
    hits
  })))
}

test_that("acreditación multi-actor can import, process independently, and report mixed actor bases", {
  skip_if_not_installed("openxlsx")
  skip_if_not_installed("officer")
  skip_if_not_installed("rvg")
  skip_if_not_installed("ggplot2")

  sid <- session_create()
  on.exit(session_delete(sid), add = TRUE)
  session_set(sid, "monitoreo_profile", list(id = "acreditacion", family = "acreditacion", label = "Acreditación"))

  uploads <- list(
    estudiantes = .acr_multi_write_data_upload(
      sid,
      "estudiantes.xlsx",
      .acr_multi_sm_data("estudiantes", c("3", "2", "3", "1"))
    ),
    docentes = .acr_multi_write_data_upload(
      sid,
      "docentes.xlsx",
      .acr_multi_sm_data("docentes", c("2", "2", "3"))
    ),
    egresados = .acr_multi_write_data_upload(
      sid,
      "egresados.xlsx",
      .acr_multi_sm_data("egresados", c("1", "3", "3", "2"))
    )
  )
  sm_details <- list(
    sm_estudiantes = .acr_multi_sm_details("sm_estudiantes", "Estudiantes"),
    sm_docentes = .acr_multi_sm_details("sm_docentes", "Docentes"),
    sm_egresados = .acr_multi_sm_details("sm_egresados", "Egresados")
  )

  sm_env <- environment(sm_multibase_import_independent)
  carga_env <- environment(.carga_import_kobo_independent)
  restores <- list(
    .acr_multi_with_mocked_binding(sm_env, "sm_api_fetch_survey_details", function(survey_id, token, ...) {
      expect_equal(token, "sm-local-token")
      sm_details[[survey_id]] %||% stop(sprintf("Unexpected SurveyMonkey survey_id: %s", survey_id), call. = FALSE)
    }),
    .acr_multi_with_mocked_binding(sm_env, "sm_api_fetch_responses_bulk", function(survey_id, token, page = 1L, per_page = 1L, ...) {
      expect_equal(token, "sm-local-token")
      list(total = 0L, data = list())
    }),
    .acr_multi_with_mocked_binding(sm_env, "sm_api_fetch_all_responses_bulk", function(...) {
      stop("Uploaded SurveyMonkey data should avoid response download in this test.", call. = FALSE)
    }),
    .acr_multi_with_mocked_binding(carga_env, ".connections_token_require", function(provider, sid = NULL, profile_id = NULL, base_url = NULL) {
      expect_equal(provider, "kobo")
      expect_equal(profile_id, "kobo-acreditacion")
      "kobo-local-token"
    }),
    .acr_multi_with_mocked_binding(carga_env, ".kobo_api_fetch_json", function(url, token) {
      expect_equal(token, "kobo-local-token")
      .acr_multi_kobo_detail("asset_administrativos")
    }),
    .acr_multi_with_mocked_binding(carga_env, "kobo_api_fetch_all_asset_data", function(asset_uid, token, base_url = NULL) {
      expect_equal(asset_uid, "asset_administrativos")
      expect_equal(token, "kobo-local-token")
      list(
        total = 3L,
        results = list(
          list(codigo_pulso = "ADM-1", q1 = "3", q2 = "1"),
          list(codigo_pulso = "ADM-2", q1 = "2", q2 = "2"),
          list(codigo_pulso = "ADM-3", q1 = "3", q2 = "1")
        )
      )
    }),
    .acr_multi_with_mocked_binding(carga_env, "kobo_api_flatten_results", function(results) {
      data.frame(
        codigo_pulso = vapply(results, `[[`, character(1), "codigo_pulso"),
        q1 = vapply(results, `[[`, character(1), "q1"),
        q2 = vapply(results, `[[`, character(1), "q2"),
        stringsAsFactors = FALSE,
        check.names = FALSE
      )
    })
  )
  on.exit(lapply(rev(restores), function(restore) restore()), add = TRUE)

  sm_import <- sm_multibase_import_independent(
    sid = sid,
    token = "sm-local-token",
    specs = list(
      list(
        survey_id = "sm_estudiantes",
        label = "Estudiantes",
        source_alias = "Estudiantes",
        source_title = "Acreditación Contabilidad - Estudiantes",
        data_file_id = uploads$estudiantes$file_id
      ),
      list(
        survey_id = "sm_docentes",
        label = "Docentes",
        source_alias = "Docentes",
        source_title = "Acreditación Contabilidad - Docentes",
        data_file_id = uploads$docentes$file_id
      ),
      list(
        survey_id = "sm_egresados",
        label = "Egresados",
        source_alias = "Egresados",
        source_title = "Acreditación Contabilidad - Egresados",
        data_file_id = uploads$egresados$file_id
      )
    ),
    logic_rules = "Q1 = C1 => Ocultar P2.",
    logic_rules_by_survey = list(
      sm_docentes = "Q1 != C1 => Ocultar P2."
    )
  )
  expect_true(sm_import$ok)
  expect_equal(sm_import$n_bases, 3L)
  expect_equal(sm_import$processing_mode, "independent_siblings")

  kobo_import <- .carga_import_kobo_independent(sid, list(
    assets = list(list(
      asset_uid = "asset_administrativos",
      source_alias = "Administrativos",
      source_title = "Acreditación Contabilidad - Administrativos",
      base_url = "https://kobo.unhcr.org",
      connection_profile_id = "kobo-acreditacion"
    ))
  ))
  expect_true(kobo_import$ok)
  expect_equal(kobo_import$n_bases, 4L)

  expected_bases <- c("administrativos", "docentes", "egresados", "estudiantes")
  bases <- estudio_list_bases(sid)
  expect_setequal(names(bases), expected_bases)
  expect_equal(estudio_processing_mode(sid), "independent_siblings")
  expect_equal(bases$administrativos$source_kind, "kobo_api")
  expect_equal(bases$docentes$source_kind, "surveymonkey_upload")
  expect_equal(bases$egresados$source_alias, "Egresados")
  for (base_name in c("estudiantes", "docentes", "egresados")) {
    xls_meta <- get_file(sid, bases[[base_name]]$xlsform_file_id)
    survey_sheet <- as.data.frame(
      readxl::read_excel(xls_meta$path, sheet = "survey", .name_repair = "minimal"),
      stringsAsFactors = FALSE
    )
    rel_p2 <- as.character(survey_sheet$relevant[survey_sheet$name == "p2"][1])
    expect_equal(rel_p2, if (identical(base_name, "docentes")) "${p1} = '1'" else "${p1} != '1'")
    expect_equal(bases[[base_name]]$surveymonkey_logic_sync$kind, "surveymonkey_direct_logic")
    expect_equal(bases[[base_name]]$surveymonkey_logic_sync$rules_count, 1L)
    expect_equal(
      bases[[base_name]]$surveymonkey_logic_sync$rules_scope,
      if (identical(base_name, "docentes")) "survey" else "global"
    )
  }

  flat_meta <- paste(unlist(bases, recursive = TRUE, use.names = TRUE), collapse = " ")
  expect_false(grepl("sm-local-token|kobo-local-token", flat_meta))

  for (base_name in expected_bases) {
    estudio_active_base_set(sid, base_name)
    scoped <- estudio_processing_filter_sources(sid)
    expect_equal(names(scoped$data_sources), base_name)
    expect_equal(names(scoped$inst_sources), base_name)
    expect_true(nrow(scoped$data_sources[[base_name]]) > 0L)
  }

  session_set(sid, "codif_por_base", list(
    estudiantes = list(
      familias_draft = list(rows = list(list(parent = "p1", use = TRUE))),
      grupos_recod = list(p1 = list(list(code = "3", label = "Alto positivo"))),
      familias_split = list(stale = TRUE),
      familias_xlsx_path = "/tmp/stale.xlsx"
    )
  ))
  copied <- estudio_propagate_shared_codif_logic(
    sid,
    template_base = "estudiantes",
    targets = c("docentes", "egresados"),
    overwrite = TRUE
  )
  expect_setequal(copied, c("docentes", "egresados"))
  codif <- session_get(sid)$codif_por_base
  expect_equal(codif$docentes$shared_logic_from, "estudiantes")
  expect_null(codif$docentes$familias_split)
  expect_equal(codif$egresados$grupos_recod$p1[[1]]$label, "Alto positivo")

  s <- session_get(sid)
  report_order <- c("estudiantes", "docentes", "egresados", "administrativos")
  plan <- list(
    diapo_001 = p_slide_1_grafico(
      grafico = p_barras_multiapiladas(
        modo = "var",
        vars = c("estudiantes$p1", "docentes$p1", "egresados$p1", "administrativos$q1")
      )
    ),
    diapo_002 = p_slide_2_graficos(
      izquierda = p_barras_multiapiladas(
        modo = "var",
        vars = c("estudiantes$p3", "docentes$p3", "administrativos$q2")
      ),
      derecha = p_barras_apiladas("egresados$p1")
    )
  )

  out <- reporte_ppt_plan(
    data = s$rp_data_sources[report_order],
    instrumento = s$rp_inst_sources[report_order],
    plan = plan,
    presets = p_presets(
      multi_apiladas = list(usar_canvas = TRUE, mostrar_leyenda = FALSE)
    ),
    solo_lista = TRUE,
    mensajes_progreso = FALSE
  )

  expect_length(out$rendered, 3L)
  expect_true(all(vapply(out$rendered, inherits, logical(1), what = "ggplot")))
  labels <- .acr_multi_plot_labels(out$rendered[[1]])
  expect_true(all(c("Estudiantes", "Docentes", "Egresados", "Administrativos") %in% labels))
})
