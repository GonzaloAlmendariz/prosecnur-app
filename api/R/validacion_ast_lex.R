# =============================================================================
# Validación AST — normalizador léxico (Capa -1)
# =============================================================================
# Prepara expresiones ODK crudas antes del parser:
#   - Normaliza comillas tipográficas a ASCII (‘ ’ “ ” → ' ' " ")
#   - Normaliza espacios no estándar (NBSP, en/em space → espacio normal)
#   - Normaliza guiones largos (em/en dash → -)
#   - Reporta al llamador qué substituciones hizo para que pueda advertir
#     al usuario y educarlo a corregir en la fuente.
#
# Intencionalmente NO toca:
#   - Ocurrencias de smart quotes dentro de strings entre comillas (aunque
#     eso es raro porque entonces las comillas delimitantes también serían
#     smart y colapsa el expr entero — el normalizador trata todo el expr
#     como plano).
#   - La sintaxis ODK propiamente dicha (eso es trabajo del parser).
#
# Idempotente: `odk_normalize_lex(odk_normalize_lex(x)) == odk_normalize_lex(x)`.

# -----------------------------------------------------------------------------
# Tabla de substituciones — reordenable sin romper semántica
# -----------------------------------------------------------------------------
.ODK_LEX_SUBSTITUTIONS <- list(
  # Smart quotes singles
  list(pattern = "\u2018", replacement = "'",  label = "smart_quote_single_left"),
  list(pattern = "\u2019", replacement = "'",  label = "smart_quote_single_right"),
  list(pattern = "\u201A", replacement = "'",  label = "smart_quote_single_low"),
  list(pattern = "\u2039", replacement = "'",  label = "smart_quote_single_angle_left"),
  list(pattern = "\u203A", replacement = "'",  label = "smart_quote_single_angle_right"),
  # Smart quotes doubles
  list(pattern = "\u201C", replacement = "\"", label = "smart_quote_double_left"),
  list(pattern = "\u201D", replacement = "\"", label = "smart_quote_double_right"),
  list(pattern = "\u201E", replacement = "\"", label = "smart_quote_double_low"),
  list(pattern = "\u00AB", replacement = "\"", label = "smart_quote_double_angle_left"),
  list(pattern = "\u00BB", replacement = "\"", label = "smart_quote_double_angle_right"),
  # Espacios exóticos
  list(pattern = "\u00A0", replacement = " ",  label = "nbsp"),
  list(pattern = "\u2007", replacement = " ",  label = "figure_space"),
  list(pattern = "\u202F", replacement = " ",  label = "narrow_nbsp"),
  list(pattern = "\u2009", replacement = " ",  label = "thin_space"),
  list(pattern = "\u200B", replacement = "",   label = "zero_width_space"),
  # Guiones
  list(pattern = "\u2013", replacement = "-",  label = "en_dash"),
  list(pattern = "\u2014", replacement = "-",  label = "em_dash"),
  list(pattern = "\u2212", replacement = "-",  label = "minus_sign"),
  # Puntos suspensivos → tres puntos ASCII (por si aparecen en literales)
  list(pattern = "\u2026", replacement = "...", label = "ellipsis")
)

# -----------------------------------------------------------------------------
# API principal
# -----------------------------------------------------------------------------
#' Normaliza una expresión ODK cruda.
#'
#' @param expr character(1) — la expresión tal como viene del XLSForm.
#' @param report boolean — si TRUE, retorna lista `{text, findings}`; si FALSE,
#'   retorna solo el texto normalizado.
#' @return string (o lista si `report = TRUE`).
#' @export
odk_normalize_lex <- function(expr, report = FALSE) {
  if (is.null(expr) || is.na(expr) || !nzchar(expr)) {
    if (report) return(list(text = expr %||% "", findings = list()))
    return(expr %||% "")
  }
  if (!is.character(expr) || length(expr) != 1L) {
    stop("odk_normalize_lex(): expr debe ser string de largo 1.")
  }

  text <- expr
  findings <- list()
  for (sub in .ODK_LEX_SUBSTITUTIONS) {
    count <- .count_fixed(text, sub$pattern)
    if (count > 0L) {
      text <- gsub(sub$pattern, sub$replacement, text, fixed = TRUE)
      findings[[length(findings) + 1L]] <- list(
        label = sub$label,
        codepoint = sprintf("U+%04X", utf8ToInt(sub$pattern)),
        replacement = sub$replacement,
        count = count
      )
    }
  }
  # Colapsa runs de espacios dobles/triples → uno solo (defensivo).
  if (grepl("  +", text)) {
    text <- gsub("\\s+", " ", text)
  }
  # Trim bordes
  text <- trimws(text)

  if (report) return(list(text = text, findings = findings))
  text
}

#' Normaliza un vector de expresiones y devuelve un DF con el reporte.
#'
#' @param exprs character vector.
#' @param origin_labels character vector del mismo largo (ej. nombres de fila/var)
#'   — se usa para poder identificar qué expresión tenía el problema.
#' @return list `{normalized: chr, report: data.frame}`.
#' @export
odk_normalize_lex_batch <- function(exprs, origin_labels = NULL) {
  if (is.null(exprs) || !length(exprs)) {
    return(list(
      normalized = character(0),
      report = data.frame(
        origin = character(0),
        label = character(0),
        codepoint = character(0),
        count = integer(0),
        stringsAsFactors = FALSE
      )
    ))
  }
  if (is.null(origin_labels)) origin_labels <- as.character(seq_along(exprs))
  if (length(origin_labels) != length(exprs)) {
    stop("odk_normalize_lex_batch(): origin_labels debe tener mismo largo que exprs.")
  }
  out_text <- character(length(exprs))
  rep_rows <- list()
  for (i in seq_along(exprs)) {
    res <- odk_normalize_lex(exprs[i], report = TRUE)
    out_text[i] <- res$text
    for (f in res$findings) {
      rep_rows[[length(rep_rows) + 1L]] <- data.frame(
        origin = origin_labels[i],
        label = f$label,
        codepoint = f$codepoint,
        count = f$count,
        stringsAsFactors = FALSE
      )
    }
  }
  report <- if (length(rep_rows)) do.call(rbind, rep_rows)
            else data.frame(origin = character(0), label = character(0),
                            codepoint = character(0), count = integer(0),
                            stringsAsFactors = FALSE)
  list(normalized = out_text, report = report)
}

#' Detecta si una expresión contiene caracteres no-ASCII problemáticos
#' sin modificarla. Útil para validación pasiva.
#'
#' @return logical(1)
#' @export
odk_has_lex_issues <- function(expr) {
  if (is.null(expr) || is.na(expr) || !nzchar(expr)) return(FALSE)
  for (sub in .ODK_LEX_SUBSTITUTIONS) {
    if (grepl(sub$pattern, expr, fixed = TRUE)) return(TRUE)
  }
  FALSE
}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
.count_fixed <- function(haystack, needle) {
  # Cuenta ocurrencias literales (sin regex).
  if (!nzchar(haystack) || !nzchar(needle)) return(0L)
  parts <- strsplit(haystack, needle, fixed = TRUE)[[1]]
  length(parts) - 1L
}

# Operador %||% por si no está cargado desde otro archivo.
`%||%` <- function(a, b) if (is.null(a)) b else a
