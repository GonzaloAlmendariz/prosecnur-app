# =============================================================================
# Editor XLSForm — trazabilidad de fuentes SurveyMonkey
# =============================================================================
# El preview y el import remoto comparten una definición inmutable. Su huella
# no incluye timestamps ni credenciales: solo la definición base observada, el
# survey solicitado y la versión explícita del perfil de traducción.

.XLSFORM_EDITOR_SM_TRANSLATION_PROFILE <- "surveymonkey_api_xlsform/v1"
.XLSFORM_EDITOR_SM_HASH_SCOPE <- "xlsform_base+translation_profile"

.xlsform_editor_sm_hash <- function(value) {
  canonicalize <- function(node) {
    if (is.data.frame(node)) {
      node <- lapply(node, canonicalize)
    } else if (is.list(node)) {
      keys <- names(node)
      if (!is.null(keys) && length(keys) && all(nzchar(keys))) {
        node <- node[order(enc2utf8(keys), method = "radix")]
      }
      node <- lapply(node, canonicalize)
    } else if (is.factor(node)) {
      node <- as.character(node)
    } else if (inherits(node, c("Date", "POSIXct", "POSIXt"))) {
      node <- as.character(node)
    }
    node
  }

  encoded <- jsonlite::toJSON(
    canonicalize(value),
    auto_unbox = TRUE,
    null = "null",
    na = "null",
    digits = NA,
    pretty = FALSE
  )
  tolower(digest::digest(
    charToRaw(enc2utf8(as.character(encoded))),
    algo = "sha256",
    serialize = FALSE
  ))
}

.xlsform_editor_sm_question_count <- function(details) {
  pages <- (details %||% list())$pages %||% list()
  if (!is.list(pages) || !length(pages)) return(0L)
  as.integer(sum(vapply(pages, function(page) {
    questions <- if (is.list(page)) page$questions %||% list() else list()
    if (!is.list(questions)) return(0L)
    sum(vapply(questions, function(question) {
      family <- if (is.list(question)) {
        tolower(as.character(question$family %||% "")[1])
      } else {
        ""
      }
      !identical(family, "presentation")
    }, logical(1)))
  }, integer(1))))
}

.xlsform_editor_sm_definition <- function(details, survey_id,
                                           translation_profile) {
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  translation_profile <- trimws(as.character(translation_profile %||% "")[1])
  if (!nzchar(survey_id)) {
    stop_api(400, "E_MISSING_SURVEY_ID", "Falta 'survey_id' del survey en SurveyMonkey.")
  }
  if (!nzchar(translation_profile)) {
    stop_api(
      400,
      "E_SM_TRANSLATION_PROFILE_REQUIRED",
      "Falta el perfil de traducción SurveyMonkey."
    )
  }
  if (!is.list(details)) {
    stop_api(502, "E_SM_DEFINITION_INVALID", "SurveyMonkey devolvió una definición inválida.")
  }

  # La huella representa el instrumento que gobierna Procesamiento, no el
  # payload HTTP completo. SurveyMonkey puede cambiar `href`, timestamps u
  # otra metadata operativa sin alterar una sola celda del XLSForm; sellar ese
  # ruido produciría falsos stale. El perfil versionado hace explícita la
  # versión del traductor y el modelo base conserva orden de filas/opciones.
  xlsform_base <- tryCatch(
    sm_api_xlsform(
      details,
      style = .sm_api_default_style(),
      lang = "es"
    ),
    error = function(e) stop_api(
      502,
      "E_SM_DEFINITION_INVALID",
      sprintf("No se pudo construir la definición XLSForm trazable: %s", conditionMessage(e))
    )
  )
  question_count <- .xlsform_editor_sm_question_count(details)
  sha256 <- .xlsform_editor_sm_hash(list(
    survey_id = survey_id,
    xlsform_base = list(
      survey = xlsform_base$survey,
      choices = xlsform_base$choices,
      settings = xlsform_base$settings
    ),
    translation_profile = translation_profile
  ))

  list(
    schema = "surveymonkey_definition/v1",
    sha256 = sha256,
    fetched_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    survey_id = survey_id,
    question_count = question_count,
    hash_scope = .XLSFORM_EDITOR_SM_HASH_SCOPE,
    translation_profile = translation_profile
  )
}

.xlsform_editor_sm_assert_definition <- function(definition, expected_sha256,
                                                  expected_profile) {
  definition_schema <- as.character((definition %||% list())$schema %||% "")[1]
  definition_sha256 <- as.character((definition %||% list())$sha256 %||% "")[1]
  definition_survey_id <- as.character((definition %||% list())$survey_id %||% "")[1]
  definition_profile <- as.character(
    (definition %||% list())$translation_profile %||% ""
  )[1]
  if (!is.list(definition) ||
      !grepl("^surveymonkey_definition/v[0-9]+$", definition_schema) ||
      !grepl("^[0-9a-f]{64}$", definition_sha256) ||
      !nzchar(definition_survey_id) ||
      !nzchar(definition_profile)) {
    stop_api(
      502,
      "E_SM_DEFINITION_INVALID",
      "SurveyMonkey devolvió una definición sin formato trazable."
    )
  }

  expected_sha256 <- trimws(as.character(expected_sha256 %||% "")[1])
  expected_profile <- trimws(as.character(expected_profile %||% "")[1])
  if (!grepl("^[0-9a-f]{64}$", expected_sha256)) {
    stop_api(
      400,
      "E_SM_DEFINITION_REQUIRED",
      "expected_definition_sha256 debe ser un SHA-256 lowercase de 64 caracteres."
    )
  }
  if (!nzchar(expected_profile)) {
    stop_api(
      400,
      "E_SM_TRANSLATION_PROFILE_REQUIRED",
      "Falta expected_translation_profile."
    )
  }

  if (!identical(expected_profile, definition_profile)) {
    stop_api(
      409,
      "E_SM_TRANSLATION_PROFILE_STALE",
      "El perfil de traducción cambió desde la previsualización. Actualiza el preview antes de importar."
    )
  }
  if (!identical(expected_sha256, definition_sha256)) {
    stop_api(
      409,
      "E_SM_DEFINITION_STALE",
      "La definición SurveyMonkey cambió desde la previsualización. Actualiza el preview antes de importar."
    )
  }
  invisible(TRUE)
}

.xlsform_editor_sm_logic_provenance <- function(
    rules_text,
    paginas = NULL,
    paginas_labels = NULL,
    choice_order_overrides = NULL,
    choice_code_maps = NULL) {
  rules_text <- enc2utf8(as.character(rules_text %||% "")[1])
  input <- list(
    schema = "surveymonkey_logic_input/v1",
    rules_text = rules_text,
    paginas = paginas %||% list(),
    paginas_labels = paginas_labels %||% list(),
    choice_order_overrides = choice_order_overrides %||% list(),
    choice_code_maps = choice_code_maps %||% list()
  )
  rule_lines <- trimws(strsplit(rules_text, "\n", fixed = TRUE)[[1]])
  rule_lines <- rule_lines[nzchar(rule_lines)]
  maps <- list(
    choice_order_overrides = input$choice_order_overrides,
    choice_code_maps = input$choice_code_maps
  )

  list(
    schema = "surveymonkey_logic_provenance/v1",
    method = "editor_reviewed_translation",
    input_sha256 = .xlsform_editor_sm_hash(input),
    rules_sha256 = .xlsform_editor_sm_hash(rules_text),
    maps_sha256 = .xlsform_editor_sm_hash(maps),
    rules_count = as.integer(length(rule_lines)),
    applied_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
}

.xlsform_editor_sm_source <- function(definition, details, survey_title,
                                       logic_provenance = NULL) {
  provenance <- list(
    provider = "surveymonkey_api",
    endpoint = "survey_details"
  )
  if (is.list(logic_provenance) && length(logic_provenance)) {
    provenance$logic <- logic_provenance
  }
  list(
    schema = "survey_source/v1",
    survey_id = as.character(definition$survey_id %||% "")[1],
    survey_title = as.character(survey_title %||% "SurveyMonkey API")[1],
    definition_sha256 = as.character(definition$sha256 %||% "")[1],
    definition_fetched_at = definition$fetched_at %||% NULL,
    definition_hash_scope = as.character(definition$hash_scope %||% "")[1],
    translation_profile = as.character(definition$translation_profile %||% "")[1],
    question_count = as.integer(definition$question_count %||% 0L),
    remote_payload_sha256_observed = .xlsform_editor_sm_hash(details),
    provenance = provenance,
    translated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    logic_status = "pending_manual_confirmation",
    publication_guard = paste0(
      "Confirma manualmente la lógica en el Editor antes de publicar este ",
      "instrumento."
    )
  )
}

.xlsform_editor_reimport_source <- function(meta) {
  meta <- meta %||% list()
  previous <- meta$source
  if (!is.list(previous) || !length(previous)) {
    return(list(
      kind = "xlsform",
      original_name = as.character(meta$original_name %||% "")[1]
    ))
  }

  source <- .xlsform_forms_sanitize_source(previous)
  for (field in c(
    "logic_confirmed_at", "logic_confirmation_method", "logic_review",
    "publication", "publication_status", "publication_revision_id",
    "published_at", "published_revision_id", "latest_revision"
  )) {
    source[[field]] <- NULL
  }

  if (identical(as.character(source$kind %||% "")[1], "surveymonkey") ||
      !is.null(source$logic_status)) {
    source$logic_status <- "pending_manual_confirmation"
  } else {
    source$logic_status <- NULL
  }

  if (is.list(source$variants) && length(source$variants)) {
    source$variants <- lapply(source$variants, function(variant) {
      if (!is.list(variant)) return(variant)
      variant <- .xlsform_forms_sanitize_source(variant)
      variant$review_status <- "pending_manual_confirmation"
      variant$logic_confirmed_at <- NULL
      variant$logic_confirmation_method <- NULL
      variant$logic_review <- NULL
      variant$publication <- NULL
      variant$published_at <- NULL
      variant
    })
  }
  source
}
