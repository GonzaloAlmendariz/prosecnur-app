# Comparativo armonizado: variable declarada que no está en los datos
# =========================================================================
#
# Una fila de la matriz puede declarar para una base una variable que no
# llega a los datos de Analítica de esa base: porque Analítica la excluye
# (`variables_excluidas` de la config de ESA base) o porque la base no la
# trae. El comparativo no corta por eso: la medición sale «n.c.» con
# `motivo = "variable_ausente"` y `causa` («excluida» o «no_esta_en_la_base»),
# con su propia nota de pie y un aviso `variable_ausente`. Si ninguna medición
# de la fila queda con variable, la fila se omite (`pregunta_omitida` o
# `cruce_omitido`, motivo `variable_ausente`). Con una sola fila pedida se
# mantiene el 409 `E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE`.
#
# El preview de R3 (`.equiv_armon_preview`) no pasa por aquí y sigue cortando.

.ARMZ_CAUSAS_AUSENTE <- c("excluida", "no_esta_en_la_base")

#' Por qué la variable de una fila no está en los datos de una base.
#' @return "" si la base no declara la fila (o la variable está), si no
#'   "excluida" o "no_esta_en_la_base".
#' @noRd
.armz_ausencia <- function(fila, base, df, inst, excluidas = character(0)) {
  spec <- .equiv_armon_spec(fila, base)
  if (is.null(spec) || !is.data.frame(df)) return("")
  var <- spec$parent
  if (var %in% names(df)) return("")
  # Las dummies de una opción múltiple no son ausencia: las rechaza su 409.
  if (.armz_es_select_multiple(inst, df, var)) return("")
  if (var %in% as.character(excluidas %||% character(0))) "excluida" else "no_esta_en_la_base"
}

# Las bases de una fila donde su variable falta, con su causa.
.armz_ausentes_de <- function(d) {
  per <- names(d$ausente %||% character(0))
  per <- per[nzchar(d$ausente[per])]
  lapply(per, function(b) list(base = b, variable = unname(d$variable_por[[b]]),
                               motivo = unname(d$ausente[[b]])))
}

#' 409 de una fila que no conserva ninguna medición con variable porque las
#' que la declaran no la traen. `.armz_columnas_lista` lo omite si se pidió
#' más de una fila.
#' @noRd
.armz_stop_sin_utilizable <- function(d) {
  aus <- .armz_ausentes_de(d)
  frases <- vapply(aus, function(a) sprintf(
    if (identical(a$motivo, "excluida")) "«%s» está excluida en Analítica en la base «%s»."
    else "«%s» no está en la base «%s».", a$variable, a$base), character(1))
  stop_api(409, "E_EQUIV_ARMONIZACION_VARIABLE_AUSENTE", sprintf(
    "«%s» no conserva ninguna medición con su variable en los datos de Analítica. %s",
    d$titulo, paste(frases, collapse = " ")),
    list(fila = d$etiqueta, base = aus[[1]]$base, variable = aus[[1]]$variable,
         motivo = aus[[1]]$motivo, ausentes = aus))
}

# Frase de una ausencia: «la variable «p5» está excluida en Analítica en 2026».
.armz_frase_ausente <- function(variable, motivo, rotulos_txt, elemento = "") {
  de <- if (nzchar(elemento)) paste0(" de ", elemento) else ""
  if (identical(motivo, "excluida")) {
    sprintf("la variable «%s»%s está excluida en Analítica en %s", variable, de, rotulos_txt)
  } else {
    sprintf("la variable «%s»%s no está en la base de %s", variable, de, rotulos_txt)
  }
}

.armz_rotulo <- function(rotulos, b) {
  r <- if (!is.null(rotulos) && length(b) && b %in% names(rotulos)) rotulos[[b]] else b
  as.character(r %||% "")
}

#' Avisos `variable_ausente`: uno por fila y base.
#' @noRd
.armz_avisos_ausente <- function(ap, rotulos) {
  unidad <- .comparativo_unidad(rotulos[ap$periodos])
  out <- list()
  for (d in c(ap$preguntas, ap$cruces)) {
    for (a in .armz_ausentes_de(d)) {
      out[[length(out) + 1L]] <- list(
        tipo = "variable_ausente", base = a$base, fila = d$etiqueta, variable = a$variable,
        motivo = a$motivo, mensaje = sprintf("«%s»: %s. %s sale como n.c.", d$titulo,
          .armz_frase_ausente(a$variable, a$motivo, .armz_rotulo(rotulos, a$base)),
          .armz_capital(unidad$ese)))
    }
  }
  out
}

# Detalle de una fila omitida por `variable_ausente` (aviso y hoja «Preguntas omitidas»).
.armz_motivo_omision_ausente <- function(o, rotulos = NULL) {
  unidad <- .comparativo_unidad(if (is.null(rotulos)) character(0) else rotulos)
  ninguna <- if (identical(unidad$nombre, "año")) "ningún año" else "ninguna medición"
  frases <- vapply(o$ausentes %||% list(), function(a) .armz_capital(
    .armz_frase_ausente(a$variable, a$motivo, .armz_rotulo(rotulos, a$base))), character(1))
  paste0(sprintf("No queda %s con su variable en los datos de Analítica.", ninguna),
         if (length(frases)) paste0(" ", paste0(frases, ".", collapse = " ")) else "")
}

# ---- Pie del libro -------------------------------------------------------------

.comparativo_es_variable_ausente <- function(pp) identical((pp %||% list())$motivo, "variable_ausente")

#' «n.c.: la variable «p5» está excluida en Analítica en 2026.» `items` son
#' list(periodo, elemento, variable, causa): elemento "" es la pregunta, si no
#' la etiqueta del cruce. Los períodos con la misma variable, elemento y causa
#' se agrupan en una frase.
#' @noRd
.comparativo_linea_variable_ausente <- function(items, periodos, rotulos) {
  if (!length(items)) return("")
  clave <- vapply(items, function(it) paste(it$causa %||% "", it$variable %||% "",
                                            it$elemento %||% "", sep = "\001"), character(1))
  frases <- vapply(unique(clave), function(k) {
    sel <- items[clave == k]
    it <- sel[[1]]
    per <- vapply(sel, `[[`, character(1), "periodo")
    rot <- unname(rotulos[periodos[periodos %in% per]])
    .armz_frase_ausente(it$variable %||% "", it$causa %||% "",
                        .notas_pie_unir_es(rot), it$elemento %||% "")
  }, character(1))
  frases <- unname(frases)
  if (length(frases) > 1L) frases[-1] <- vapply(frases[-1], .armz_capital, character(1))
  paste0(.COMPARATIVO_NC, ": ", paste0(frases, ".", collapse = " "))
}

.comparativo_item_ausente <- function(pp, b, elemento = "") {
  list(periodo = b, elemento = elemento, variable = as.character(pp$variable %||% ""),
       causa = as.character(pp$causa %||% ""))
}

# Resumen del manifest: list(base, fila, variable, motivo) por ausencia.
.comparativo_resumen_ausente <- function(items, etiqueta) {
  lapply(items, function(it) list(
    base = it$periodo, fila = if (nzchar(it$elemento %||% "")) it$elemento else etiqueta,
    variable = it$variable, motivo = it$causa))
}
