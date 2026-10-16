# Codificación › un texto que no encaja en ningún grupo puede quedar en «Otro».
#
# Gonzalo, 2026-10-16: «incluso una respuesta puede ser no codificable y quedar
# en otros y no está mal técnicamente». Hasta aquí un texto sin grupo se
# avisaba siempre como pendiente. «Dejar en «Otro»» registra, por pregunta, los
# textos sueltos de ese momento: dejan de avisarse y cuentan como decididos.
# Un texto que llegue después (otra versión de las respuestas) no está en la
# lista y vuelve a avisarse: no se tapa material que nadie revisó.

.codif_textos_en_otro_todos <- function(sid, source = NULL) {
  val <- codif_get(sid, "textos_en_otro", source = source)
  if (is.list(val)) val else list()
}

#' Textos normalizados de la pregunta que no están en ningún grupo.
#' @keywords internal
.codif_textos_sueltos_de <- function(sid, parent, source = NULL) {
  draft <- codif_get(sid, "familias_draft", source = source)
  data_df <- tryCatch(codif_data_cached(sid), error = function(e) NULL)
  grupos_map <- codif_get(sid, "grupos_recod", source = source) %||% list()
  diag <- .codif_textos_sin_codigo(parent, grupos_map, (draft %||% list())$rows, data_df, max_ejemplos = .Machine$integer.max)
  if (!length(diag)) return(character(0))
  unique(.normalize_text(as.character(unlist(diag[[1]]$ejemplos))))
}

#' Deja en «Otro» los textos sueltos actuales de una pregunta (o lo revierte).
#' @keywords internal
codif_textos_en_otro_set <- function(sid, parent, revertir = FALSE, source = NULL) {
  parent <- trimws(as.character(parent %||% ""))[1]
  if (is.na(parent) || !nzchar(parent)) {
    stop_api(400, "E_CODIF_NO_PARENT", "Falta la pregunta.")
  }
  todos <- .codif_textos_en_otro_todos(sid, source = source)
  if (isTRUE(revertir)) {
    todos[[parent]] <- NULL
  } else {
    nuevos <- .codif_textos_sueltos_de(sid, parent, source = source)
    todos[[parent]] <- as.list(unique(c(as.character(unlist(todos[[parent]])), nuevos)))
  }
  codif_set(sid, "textos_en_otro", todos, source = source)
  invisible(length(todos[[parent]] %||% list()))
}

# POST /api/codificacion/textos-en-otro  body {parent, revertir?} → {ok, parent, n_textos}
mount_codificacion_textos_en_otro <- function(pr) {
  pr |>
    plumber::pr_post("/api/codificacion/textos-en-otro", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      Encoding(body_raw) <- "UTF-8"
      parsed <- if (nzchar(body_raw)) {
        tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                 error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
      } else list()
      n <- codif_textos_en_otro_set(sid, parsed$parent, revertir = isTRUE(parsed$revertir))
      list(ok = TRUE, parent = as.character(parsed$parent %||% ""), n_textos = as.integer(n))
    }))
}
