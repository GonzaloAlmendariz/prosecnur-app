# =============================================================================
# Editor XLSForm — sugerencias de lógica al importar desde SurveyMonkey
# =============================================================================
# La API v3 de SurveyMonkey no expone la lógica de saltos (verificado en vivo el
# 2026-10-14: ni `details`, ni la página, ni la pregunta la traen; `/logic`
# responde 404). Por eso existe el motor de reglas del editor, y por eso el
# XLSForm importado nace sin saltos.
#
# Lo que sí se puede decir sin la lógica de SurveyMonkey es lo evidente: una
# pregunta de consentimiento («¿Desea continuar con la encuesta?») corta la
# encuesta cuando la respuesta es negativa. Se ofrece como SUGERENCIA que el
# analista acepta o descarta; nunca se aplica sola (checklist 2026-10-14, H4).
# El consentimiento se reconoce con el mismo criterio que Carga
# (`.sm_mb_consent_candidate_var`) y el «no» por la etiqueta, no por el código
# (`.sm_consent_etiqueta_afirmativa`).
# =============================================================================

.xlsform_sm_sugerencia_consentimiento <- function(inst) {
  var <- .sm_mb_consent_candidate_var(inst)
  if (!nzchar(var)) return(NULL)
  opciones <- .sm_consent_opciones_inst(inst, var)
  if (!nrow(opciones)) return(NULL)
  afirmativa <- .sm_consent_etiqueta_afirmativa(opciones$etiqueta)
  negativa <- grepl("^(no|not|rechazo|rechaza|declino)( |$)", .sm_mb_norm(opciones$etiqueta))
  if (!any(afirmativa) || !any(negativa)) return(NULL)
  questions <- .sm_mb_question_rows(inst)
  label_col <- .sm_mb_label_col(questions)
  etiqueta <- if (!is.na(label_col)) as.character(questions[[label_col]][questions$name == var][1]) else var
  list(
    tipo = "fin_de_encuesta",
    variable = var,
    etiqueta = etiqueta,
    opciones_que_cortan = lapply(which(negativa), function(i) list(
      codigo = opciones$codigo[i], etiqueta = opciones$etiqueta[i]
    )),
    motivo = paste0(
      "Es la pregunta de consentimiento: si la persona responde que no, la encuesta debería terminar. ",
      "SurveyMonkey no comparte su lógica por la API, así que revísalo y aplícalo si corresponde."
    )
  )
}

#' Sugerencias de lógica para una encuesta SurveyMonkey que se va a importar
#' @keywords internal
xlsform_sm_sugerencias_logica <- function(sid, survey_id) {
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  if (is.na(survey_id) || !nzchar(survey_id)) {
    stop_api(400, "E_MISSING_SURVEY_ID", "Elige la encuesta SurveyMonkey.")
  }
  token <- .connections_token_require("surveymonkey", sid)
  details <- tryCatch(
    sm_api_fetch_survey_details(survey_id, token),
    error = function(e) stop_api(400, "E_SM_API_FAILED", conditionMessage(e))
  )
  inst <- .sm_mb_inst_generado(details)
  sugerencias <- Filter(Negate(is.null), list(.xlsform_sm_sugerencia_consentimiento(inst)))
  list(
    ok = TRUE,
    survey_id = survey_id,
    logica_disponible_en_api = FALSE,
    aviso = paste0(
      "SurveyMonkey no comparte la lógica de saltos por su API: el formulario se importa sin saltos. ",
      "Agrégalos en «Lógica SurveyMonkey» o pega las reglas para traducirlas."
    ),
    sugerencias = sugerencias
  )
}

mount_xlsform_sm_sugerencias <- function(pr) {
  pr |>
    plumber::pr_post("/api/xlsform-editor/surveymonkey/sugerencias-logica", wrap_endpoint(function(req, res, ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_sm_sugerencias_logica(session_header(req), parsed$survey_id)
    }))
}
