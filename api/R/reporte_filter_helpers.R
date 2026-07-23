# =============================================================================
# Helpers compartidos de filtros declarativos — POLITICA CANONICA (unidad 5.6)
# =============================================================================
#
# Este archivo declara LA politica unica de filtros para todos los consumidores
# (reportes PPT/Word via `.apply_named_filters_safe`, dimensiones via
# `.dim_apply_filters`, dashboard via el formato [{var, valores}]). Antes
# convivian tres politicas divergentes para el mismo concepto (hallazgo P2-a
# del revisor metodologico); las divergencias ACCIDENTALES se corrigen aqui y
# las DELIBERADAS quedan declaradas como modo.
#
# ── Tabla de politica: op × tratamiento de NA × coercion × multivalor ────────
#
#   op          | NA en data                | coercion                        | multivalor (CSV)
#   ------------+---------------------------+---------------------------------+---------------------------
#   eq / in     | excluido: NA nunca        | string trimmed; puente numerico | OR entre valores
#               | satisface el filtro       | si la COLUMNA es numeric        |
#   neq / notin | excluido: NA tampoco pasa | idem eq                         | pasa si no esta en NINGUNO
#               | una desigualdad (*)       |                                 |
#   contains    | excluido                  | tolower, fixed (sin regex)      | OR entre TODOS los valores (**)
#   gt/lt/      | excluido                  | numerica; umbral no parseable   | usa solo el primer valor
#   gte/lte     |                           | emite warning y deja 0 filas    |
#   (op ajeno)  | excluido                  | se trata como `eq`              | OR entre valores
#
#   (*) NA = sin dato, no un valor: metodologicamente un NA no satisface NINGUN
#       filtro, ni de igualdad ni de desigualdad. Antes `neq`/`notin` RETENIAN
#       los NA (divergencia accidental respecto de `eq`); corregido en 5.6.
#   (**) Antes `contains` usaba solo vals[1] en silencio; ahora es OR sobre
#       todos los valores separados por coma.
#
#   Puente numerico: si la columna es numeric y el valor del filtro parsea como
#   numero, la igualdad se evalua ADEMAS numericamente — "1" == "1.0" == 1. En
#   columnas character NO se puentea ("01" != "1"): los codigos string se
#   comparan literales, tal como los manda el catalogo de choices.
#
# ── Modos: columnas ausentes y filtros incompletos ───────────────────────────
#
#   modo      | columna ausente (valor real)             | filtro sin valores (todo NA/"")
#   ----------+------------------------------------------+--------------------------------
#   strict    | condicion `pulso_filter_missing_column`,  | no-op CON warning (rastro del
#   (default) | degradable por lamina via                 | leak fantasma de simplifyDataFrame,
#             | `.apply_named_filters_safe`               | ver reporte_filter_guards.R)
#   lenient   | se ignora en silencio                     | no-op silencioso
#
#   `lenient` existe porque el dashboard NO debe romper cuando un filtro apunta
#   a una var que ya no esta en data tras un cambio de curacion (deliberado,
#   post-curacion). El formato dashboard [{var, valores}] activa lenient de
#   forma automatica; `.dashboard_apply_filtros` (dashboard_pane.R) es el
#   espejo legacy de ese modo y el destino es que delegue aqui con
#   mode = "lenient".
#
#   Excepcion comun a ambos modos: una fila de regla del editor visual
#   ({variable, op, value}) con variable o value vacios es no-op SILENCIOSO —
#   el usuario esta editando en vivo y el export no debe romper ni ensuciar el
#   log por una fila a medio escribir.

#' Igualdad canonica valor-de-columna vs valores de filtro.
#'
#' Comparacion textual trimmed + puente numerico cuando la columna es numeric
#' (ver tabla de politica en la cabecera). NA nunca matchea.
#' @keywords internal
.filter_values_match <- function(x, vals) {
  xv_chr <- trimws(as.character(x))
  m <- !is.na(xv_chr) & xv_chr %in% vals

  # Puente numerico SOLO para columnas numeric: "1.0" del filtro debe alcanzar
  # al 1 de la data (as.character(1) == "1" nunca igualaria "1.0" como texto).
  # En columnas character no se puentea para no fusionar codigos como "01"/"1".
  if (is.numeric(x)) {
    vals_num <- suppressWarnings(as.numeric(vals))
    vals_num <- vals_num[!is.na(vals_num)]
    if (length(vals_num)) {
      m <- m | (!is.na(x) & x %in% vals_num)
    }
  }
  m
}

#' Negacion canonica: la fila pasa si tiene dato y NO matchea ningun valor.
#' Un NA no satisface una desigualdad (sin dato no es "distinto de").
#' @keywords internal
.filter_not_match <- function(x, vals) {
  xv_chr <- trimws(as.character(x))
  !is.na(xv_chr) & !.filter_values_match(x, vals)
}

#' `contains` canonico: OR de substring (tolower, fixed) sobre TODOS los
#' valores del filtro. NA nunca matchea.
#' @keywords internal
.filter_contains_match <- function(x, vals) {
  xv_chr <- trimws(as.character(x))
  hay <- tolower(xv_chr)
  hit <- rep(FALSE, length(hay))
  for (v in vals) {
    hit <- hit | grepl(tolower(v), hay, fixed = TRUE)
  }
  !is.na(xv_chr) & hit
}

#' Comparacion numerica canonica (gt/lt/gte/lte) contra el primer valor.
#'
#' Umbral no parseable -> warning + 0 filas: fallar visible ("Sin datos") es
#' preferible a un no-op que infle denominadores en silencio.
#' @keywords internal
.filter_num_cmp <- function(x, vals, cmp, nm, op) {
  xv_num <- suppressWarnings(as.numeric(x))
  ref <- suppressWarnings(as.numeric(vals[1]))
  if (is.na(ref)) {
    warning(sprintf(
      paste0("Filtro `%s` (op `%s`) con umbral no numerico (`%s`): ",
             "ninguna fila lo satisface."),
      nm, op, as.character(vals[1])
    ), call. = FALSE)
    return(rep(FALSE, length(xv_num)))
  }
  !is.na(xv_num) & cmp(xv_num, ref)
}

#' @keywords internal
.apply_named_filters <- function(df, filters = list(), arg_name = "filtros",
                                 mode = c("strict", "lenient")) {
  `%||%` <- function(x, y) if (!is.null(x)) x else y
  mode <- match.arg(mode)

  if (is.null(filters) || !length(filters)) return(df)
  if (!is.list(filters)) stop("`", arg_name, "` debe ser una lista nombrada.", call. = FALSE)

  .split_filter_values <- function(x) {
    if (is.null(x)) return(character(0))
    vals <- as.character(x)
    vals <- trimws(vals[!is.na(vals)])
    vals <- unlist(strsplit(vals, "\\s*,\\s*", perl = TRUE), use.names = FALSE)
    vals <- trimws(vals[!is.na(vals)])
    vals[nzchar(vals)]
  }

  .apply_rule_rows <- function(out, rules) {
    if (is.null(rules) || !NROW(rules)) return(out)
    for (i in seq_len(NROW(rules))) {
      rule <- rules[i, , drop = FALSE]
      nm <- trimws(as.character(rule$variable %||% "")[1])
      op <- trimws(as.character(rule$op %||% "eq")[1])
      val <- rule$value %||% ""
      vals <- .split_filter_values(val)

      # Mientras el usuario edita una fila incompleta, no debe romper el export.
      if (!nzchar(nm) || !length(vals)) next
      if (!(nm %in% names(out))) {
        if (identical(mode, "lenient")) next
        .filter_abort_missing_column(nm, arg_name)
      }

      col <- out[[nm]]
      keep <- switch(
        op,
        eq = .filter_values_match(col, vals),
        `in` = .filter_values_match(col, vals),
        neq = .filter_not_match(col, vals),
        notin = .filter_not_match(col, vals),
        contains = .filter_contains_match(col, vals),
        gt = .filter_num_cmp(col, vals, `>`, nm, op),
        lt = .filter_num_cmp(col, vals, `<`, nm, op),
        gte = .filter_num_cmp(col, vals, `>=`, nm, op),
        lte = .filter_num_cmp(col, vals, `<=`, nm, op),
        .filter_values_match(col, vals)
      )
      keep[is.na(keep)] <- FALSE
      out <- out[keep, , drop = FALSE]
    }
    out
  }

  # La UI nueva guarda filtros como filas: [{ variable, op, value }, ...].
  # Mantenerlo aqui evita que el export falle cuando el usuario borra o edita
  # reglas sin pasar por el formato legacy de lista nombrada.
  if (is.data.frame(filters)) {
    if (all(c("variable", "op", "value") %in% names(filters))) {
      return(.apply_rule_rows(out = df, rules = filters))
    }
  }

  # Formato del dashboard (UI de Pulso): [{var, valores: [...]}, ...].
  # Se normaliza a la forma legacy `list(var = c(vals))` y se delega al loop
  # final EN MODO LENIENT (politica declarada en la cabecera): vars
  # inexistentes y filtros incompletos se ignoran en silencio — un endpoint
  # del dashboard no debe romper porque el usuario tenga un filtro sobre una
  # var que ya no esta en data tras un cambio de curacion.
  if (length(filters) > 0L) {
    is_dashboard_list <- all(vapply(filters, function(x) {
      is.list(x) && all(c("var", "valores") %in% names(x))
    }, logical(1)))
    if (isTRUE(is_dashboard_list)) {
      mode <- "lenient"
      named <- list()
      for (f in filters) {
        var <- as.character(f$var %||% "")[1]
        vals <- as.character(unlist(f$valores %||% list()))
        vals <- trimws(vals[!is.na(vals)])
        vals <- vals[nzchar(vals)]
        if (!nzchar(var) || !length(vals)) next
        named[[var]] <- vals
      }
      if (!length(named)) return(df)
      filters <- named
    }
  }

  out <- df
  f_names <- names(filters)
  is_rule_list <- length(filters) > 0L &&
    all(vapply(filters, function(x) {
      is.list(x) && any(c("variable", "op", "value") %in% names(x))
    }, logical(1)))
  if (isTRUE(is_rule_list)) {
    rules <- data.frame(
      variable = vapply(filters, function(x) as.character(x$variable %||% "")[1], character(1)),
      op       = vapply(filters, function(x) as.character(x$op %||% "eq")[1], character(1)),
      value    = vapply(filters, function(x) paste(.split_filter_values(x$value %||% ""), collapse = ","), character(1)),
      stringsAsFactors = FALSE
    )
    return(.apply_rule_rows(out = out, rules = rules))
  }

  if (is.null(f_names) || any(!nzchar(trimws(f_names)))) {
    stop("`", arg_name, "` debe ser una lista nombrada por variable.", call. = FALSE)
  }

  for (nm in f_names) {
    vals <- as.character(filters[[nm]])
    vals <- trimws(vals[!is.na(vals)])
    vals <- vals[nzchar(vals)]

    # Un filtro con valores todos vacios/NA no restringe nada: es un no-op.
    # Debe evaluarse ANTES de exigir la columna. El parseo del plan JSON
    # (plumber `simplifyDataFrame`) rectangulariza el arreglo de slides y
    # filtra columnas de `filtros` de unas laminas a otras como `NA`: una
    # lamina de la base madre puede heredar un `current_code = NA` fantasma
    # de las laminas por-servicio de la base hija repeat. Ese fantasma no
    # debe romper el reporte. Ver reporte_filter_guards.R.
    #
    # En modo strict el no-op deja rastro (espejo del warning de columna
    # ausente en reporte_filter_guards.R): si un filtro GENUINO llega NA'd por
    # otro bug, ampliaria la base de la lamina sin señal alguna — la direccion
    # de fallo mas peligrosa porque produce numeros que parecen correctos. En
    # modo lenient (dashboard) el descarte es silencioso por diseño.
    if (!length(vals)) {
      if (identical(mode, "strict") && length(filters[[nm]])) {
        warning(sprintf(
          paste0("Filtro `%s` con valores vacios/NA se degrada a no-op: ",
                 "la lamina se calcula SIN esa restriccion."),
          nm
        ), call. = FALSE)
      }
      next
    }

    if (!(nm %in% names(out))) {
      if (identical(mode, "lenient")) next
      .filter_abort_missing_column(nm, arg_name)
    }

    keep <- .filter_values_match(out[[nm]], vals)
    out <- out[keep, , drop = FALSE]
  }

  out
}
