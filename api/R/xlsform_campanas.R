# =============================================================================
# Editor XLSForm — campañas complementarias de un instrumento (ADR 0101)
# =============================================================================
# Una campaña complementaria es otra encuesta SurveyMonkey del MISMO
# instrumento (una campaña por correo, un canal telefónico). No se importa como
# otro formulario: se declara dentro del formulario principal, como variante de
# su procedencia (`source$variants`, el campo que el ADR 0040 definió y que lee
# `carga_acreditacion_mapping.R`). El XLSForm no cambia: rige el principal.
#
# El emparejado es el de las fuentes de una base (ADR 0099,
# `.sm_mb_alinear_fuente`): clave exacta etiqueta + firma de escala + ordinal,
# sin posición ni similitud. Se calcula sobre el XLSForm del formulario (el que
# rige) y el que la plataforma genera para la campaña. Declarar recalcula en el
# servidor: el cliente sólo elige la encuesta.
# =============================================================================

.XLSFORM_CAMPANA_ROL <- "campana_complementaria"

.xlsform_campana_es <- function(variant) {
  is.list(variant) && identical(as.character(variant$rol %||% "")[1], .XLSFORM_CAMPANA_ROL)
}

.xlsform_campana_entry <- function(sid, form_id) {
  s <- session_get(sid, required = FALSE)
  form_id <- as.character(form_id %||% "")[1]
  entry <- if (is.null(s)) NULL else .xlsform_forms_get(s, form_id)
  if (is.null(entry)) {
    stop_api(404, "E_FORM_NOT_FOUND", sprintf("No existe el formulario '%s'.", form_id))
  }
  entry
}

.xlsform_campana_survey_principal <- function(entry) {
  source <- entry$source %||% list()
  survey_id <- trimws(as.character(source$survey_id %||% "")[1])
  if (is.na(survey_id) || !nzchar(survey_id)) {
    stop_api(409, "E_CAMPANA_SIN_PRINCIPAL", paste0(
      "Este formulario no viene de una encuesta SurveyMonkey: una campaña complementaria ",
      "se agrega a un formulario importado desde SurveyMonkey."
    ))
  }
  survey_id
}

# El instrumento que rige: el borrador actual del formulario, leído como lo lee
# una base.
.xlsform_campana_inst_formulario <- function(entry) {
  raw <- .xlsform_revision_materialize(entry$workbook %||% list())
  path <- tempfile("xlsform_campana_", fileext = ".xlsx")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  writeBin(raw, path)
  reporte_instrumento(path = path)
}

.xlsform_campana_tabla_a_lista <- function(tbl) {
  if (is.null(tbl) || !NROW(tbl)) return(list())
  lapply(seq_len(NROW(tbl)), function(i) list(
    variable = as.character(tbl$variable[i]),
    etiqueta = as.character(tbl$etiqueta[i])
  ))
}

# Mapa por pregunta madre (`p<N>` de la campaña -> `p<N>` del instrumento), la
# forma que ya lee `carga_acreditacion_mapping.R`. Las filas de una matriz
# (`p13_1`) y su `_other` siguen a su madre; si las filas de una madre apuntan a
# madres distintas, la madre no entra y se declara.
.xlsform_campana_mapa_madres <- function(mapa) {
  mapa <- mapa %||% character(0)
  if (!length(mapa)) return(list(madres = list(), conflictos = character(0)))
  desde <- names(mapa)
  hacia <- unname(as.character(mapa))
  es_other <- grepl("_other$", desde)
  madre <- function(x) sub("^(p[0-9]+)(_[0-9]+)?$", "\\1", x, perl = TRUE)
  desde_m <- madre(desde[!es_other])
  hacia_m <- madre(hacia[!es_other])
  madres <- list()
  conflictos <- character(0)
  for (m in unique(desde_m)) {
    destinos <- unique(hacia_m[desde_m == m])
    if (length(destinos) == 1L) {
      madres[[length(madres) + 1L]] <- list(from = m, to = destinos[[1L]])
    } else {
      conflictos <- c(conflictos, m)
    }
  }
  list(madres = madres, conflictos = conflictos)
}

# Lo común a la vista previa, a la declaración y a la sugerencia: la definición
# de la campaña y su emparejado con el formulario.
.xlsform_campana_emparejar <- function(entry, details) {
  inst_base <- .xlsform_campana_inst_formulario(entry)
  inst_fuente <- .sm_mb_inst_generado(details)
  .sm_mb_alinear_fuente(inst_base, inst_fuente)
}

.xlsform_campana_traer <- function(sid, survey_id) {
  token <- .connections_token_require("surveymonkey", sid)
  tryCatch(
    sm_api_fetch_survey_details(survey_id, token),
    error = function(e) stop_api(400, "E_SM_API_FAILED", conditionMessage(e))
  )
}

.xlsform_campana_validar_nueva <- function(entry, survey_id) {
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  if (is.na(survey_id) || !nzchar(survey_id)) {
    stop_api(400, "E_MISSING_SURVEY_ID", "Elige la encuesta SurveyMonkey de la campaña.")
  }
  principal <- .xlsform_campana_survey_principal(entry)
  if (identical(principal, survey_id)) {
    stop_api(409, "E_CAMPANA_ES_PRINCIPAL",
             "Esa es la encuesta principal de este formulario, no una campaña complementaria.")
  }
  ya <- vapply(entry$source$variants %||% list(), function(v) {
    is.list(v) && identical(as.character(v$survey_id %||% "")[1], survey_id)
  }, logical(1))
  if (any(ya)) {
    stop_api(409, "E_CAMPANA_REPETIDA", "Esa encuesta ya está declarada en este formulario.")
  }
  survey_id
}

.xlsform_campana_resumen <- function(survey_id, details, al) {
  list(
    ok = TRUE,
    survey_id = survey_id,
    titulo = as.character(details$title %||% survey_id)[1],
    n_emparejadas = as.integer(al$n_emparejadas),
    n_preguntas_base = as.integer(al$n_preguntas_base),
    cobertura = as.numeric(al$cobertura),
    cobertura_texto = paste0(.sm_mb_cobertura_texto(al$cobertura), " %"),
    instrumento_distinto = isTRUE(al$instrumento_distinto),
    faltan = .xlsform_campana_tabla_a_lista(al$sin_par_base),
    extra = .xlsform_campana_tabla_a_lista(al$sin_par_fuente),
    ambiguas = .xlsform_campana_tabla_a_lista(al$ambiguas)
  )
}

#' Qué pasaría al declarar la campaña, sin escribir nada (ADR 0101)
#' @keywords internal
xlsform_campana_vista_previa <- function(sid, form_id, survey_id) {
  entry <- .xlsform_campana_entry(sid, form_id)
  survey_id <- .xlsform_campana_validar_nueva(entry, survey_id)
  details <- .xlsform_campana_traer(sid, survey_id)
  .xlsform_campana_resumen(survey_id, details, .xlsform_campana_emparejar(entry, details))
}

.xlsform_campana_forma <- function(entry, form_id, s) {
  list(
    id = entry$id %||% form_id,
    name = entry$name,
    source = entry$source,
    saved_at = entry$saved_at,
    publication = .xlsform_revision_publication(s, entry)
  )
}

#' Declara una campaña complementaria dentro del formulario (ADR 0101)
#' @keywords internal
xlsform_campana_declarar <- function(sid, form_id, survey_id) {
  entry <- .xlsform_campana_entry(sid, form_id)
  survey_id <- .xlsform_campana_validar_nueva(entry, survey_id)
  details <- .xlsform_campana_traer(sid, survey_id)
  al <- .xlsform_campana_emparejar(entry, details)
  if (isTRUE(al$instrumento_distinto)) {
    stop_api(409, "E_CAMPANA_OTRO_INSTRUMENTO", sprintf(paste0(
      "Esta encuesta comparte sólo el %s %% de las preguntas del formulario: parece otro cuestionario. ",
      "Impórtala como un formulario propio y relaciónalos en Equivalencias."
    ), .sm_mb_cobertura_texto(al$cobertura)))
  }

  definition <- .xlsform_editor_sm_definition(
    details, survey_id = survey_id,
    translation_profile = .XLSFORM_EDITOR_SM_TRANSLATION_PROFILE
  )
  madres <- .xlsform_campana_mapa_madres(al$mapa)
  content_sha256 <- .xlsform_revision_hash(entry$workbook %||% list())
  now <- .xlsform_forms_now()
  campana <- list(
    schema = "survey_campaign/v1",
    rol = .XLSFORM_CAMPANA_ROL,
    survey_id = survey_id,
    survey_title = as.character(details$title %||% survey_id)[1],
    definition_sha256 = as.character(definition$sha256 %||% "")[1],
    translation_profile = .XLSFORM_EDITOR_SM_TRANSLATION_PROFILE,
    variant_map_draft = madres$madres,
    madres_en_conflicto = as.list(madres$conflictos),
    mapa_variables = as.list(al$mapa),
    n_emparejadas = as.integer(al$n_emparejadas),
    n_preguntas_base = as.integer(al$n_preguntas_base),
    cobertura = as.numeric(al$cobertura),
    sin_par_base = .xlsform_campana_tabla_a_lista(al$sin_par_base),
    sin_par_fuente = .xlsform_campana_tabla_a_lista(al$sin_par_fuente),
    ambiguas = .xlsform_campana_tabla_a_lista(al$ambiguas),
    declarada_en = now,
    review_status = "confirmed",
    logic_confirmed_at = now,
    logic_confirmation_method = "campaign_declaration",
    logic_review = list(
      content_sha256 = content_sha256,
      definition_sha256 = as.character(definition$sha256 %||% "")[1]
    )
  )

  s <- session_get(sid)
  entry$source$variants <- c(entry$source$variants %||% list(), list(campana))
  s <- .xlsform_forms_upsert(s, entry)
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  fresh <- .xlsform_forms_get(s, entry$id)
  list(ok = TRUE, form = .xlsform_campana_forma(fresh, form_id, s), campana = campana)
}

#' Quita una campaña declarada (ADR 0101)
#' @keywords internal
xlsform_campana_quitar <- function(sid, form_id, survey_id) {
  entry <- .xlsform_campana_entry(sid, form_id)
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  variants <- entry$source$variants %||% list()
  quedan <- Filter(function(v) {
    !(.xlsform_campana_es(v) && identical(as.character(v$survey_id %||% "")[1], survey_id))
  }, variants)
  if (length(quedan) == length(variants)) {
    stop_api(404, "E_CAMPANA_NO_ENCONTRADA", "Esa encuesta no está declarada como campaña de este formulario.")
  }
  s <- session_get(sid)
  entry$source$variants <- quedan
  s <- .xlsform_forms_upsert(s, entry)
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  fresh <- .xlsform_forms_get(s, entry$id)
  list(ok = TRUE, form = .xlsform_campana_forma(fresh, form_id, s))
}

#' ¿La encuesta que se va a importar es una campaña de un formulario existente? (ADR 0101)
#'
#' Compara contra cada formulario del proyecto que viene de SurveyMonkey y
#' sugiere el de mayor cobertura si alcanza el umbral del ADR 0099. La encuesta
#' principal de un formulario o una campaña ya declarada no se sugieren.
#' @keywords internal
xlsform_campana_sugerir <- function(sid, survey_id) {
  survey_id <- trimws(as.character(survey_id %||% "")[1])
  if (is.na(survey_id) || !nzchar(survey_id)) {
    stop_api(400, "E_MISSING_SURVEY_ID", "Elige la encuesta SurveyMonkey.")
  }
  s <- session_get(sid, required = FALSE)
  forms <- if (is.null(s)) list() else (s$xlsform_forms %||% list())
  candidatos <- Filter(function(entry) {
    src <- entry$source %||% list()
    principal <- trimws(as.character(src$survey_id %||% "")[1])
    if (is.na(principal) || !nzchar(principal) || identical(principal, survey_id)) return(FALSE)
    declaradas <- vapply(src$variants %||% list(), function(v) {
      is.list(v) && identical(as.character(v$survey_id %||% "")[1], survey_id)
    }, logical(1))
    !any(declaradas)
  }, forms)
  if (!length(candidatos)) return(list(ok = TRUE, sugerencia = NULL))

  details <- .xlsform_campana_traer(sid, survey_id)
  mejor <- NULL
  for (entry in candidatos) {
    al <- tryCatch(.xlsform_campana_emparejar(entry, details), error = function(e) NULL)
    if (is.null(al) || isTRUE(al$instrumento_distinto)) next
    if (is.null(mejor) || al$cobertura > mejor$al$cobertura) mejor <- list(entry = entry, al = al)
  }
  if (is.null(mejor)) return(list(ok = TRUE, sugerencia = NULL))
  list(ok = TRUE, sugerencia = list(
    form_id = mejor$entry$id,
    form_name = mejor$entry$name,
    survey_id_principal = as.character(mejor$entry$source$survey_id %||% "")[1],
    cobertura = as.numeric(mejor$al$cobertura),
    cobertura_texto = paste0(.sm_mb_cobertura_texto(mejor$al$cobertura), " %"),
    n_emparejadas = as.integer(mejor$al$n_emparejadas),
    n_preguntas_base = as.integer(mejor$al$n_preguntas_base)
  ))
}

# El autosave del cliente no es dueño de las campañas declaradas: trae la copia
# que tenía al cargar el formulario y, como `variants` se reemplaza como unidad
# (`.xlsform_forms_merge_source`), las borraría. Se conservan las del servidor y
# se aceptan del cliente sólo las variantes que no son campañas.
.xlsform_campanas_preservar <- function(previous_source, incoming_source) {
  if (!is.list(incoming_source) || is.null(incoming_source$variants)) return(incoming_source)
  servidor <- Filter(.xlsform_campana_es, previous_source$variants %||% list())
  cliente <- Filter(function(v) !.xlsform_campana_es(v), incoming_source$variants %||% list())
  incoming_source$variants <- c(cliente, servidor)
  incoming_source
}

mount_xlsform_campanas <- function(pr) {
  pr |>
    plumber::pr_post("/api/xlsform-editor/forms/<id>/campanas/vista-previa", wrap_endpoint(function(req, res, id = "", ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_campana_vista_previa(session_header(req), id, parsed$survey_id)
    })) |>
    plumber::pr_post("/api/xlsform-editor/forms/<id>/campanas", wrap_endpoint(function(req, res, id = "", ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_campana_declarar(session_header(req), id, parsed$survey_id)
    })) |>
    plumber::pr_delete("/api/xlsform-editor/forms/<id>/campanas/<survey_id>", wrap_endpoint(function(req, res, id = "", survey_id = "", ...) {
      xlsform_campana_quitar(session_header(req), id, survey_id)
    })) |>
    plumber::pr_post("/api/xlsform-editor/campanas/sugerir", wrap_endpoint(function(req, res, ...) {
      parsed <- .xlsform_editor_parse_body(req)
      xlsform_campana_sugerir(session_header(req), parsed$survey_id)
    }))
}
