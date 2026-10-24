# graficos_cifra_sm.R — la cifra destacada de una select_multiple (G2, CCSS Perfil 2026-II).
#
# La madre de una SM no existe en la data, sólo sus dummies `<var>.<código>`, y `.cifra_desde_datos` pedía una columna
# única. Aquí la SM se convierte en esa columna: para «porcentaje», la dummy de la categoría (1 marcó, 0 respondió sin
# marcarla, NA no respondió la pregunta); para «n», si respondió. La base son los casos con alguna dummy respondida.

#' La SM `var` como una columna que `.cifra_desde_datos` sabe leer, o `NULL` si `var` no es una SM de la base
#' @return `list(data, var, categoria)` con la columna nueva en `data`.
#' @keywords internal
.cifra_sm_como_variable <- function(data, var, modo, categoria = NULL, instrumento = NULL) {
  dummies <- names(data)[startsWith(names(data), paste0(var, ".")) & !grepl(".", substring(names(data), nchar(var) + 2L), fixed = TRUE)]
  if (!length(dummies)) return(NULL)
  if (modo %in% c("mediana", "media")) {
    .plan_spec_abort(sprintf("«%s» es de opción múltiple: no tiene %s. Pide el porcentaje de una opción o el n.", var, modo))
  }
  m <- as.data.frame(lapply(data[dummies], function(x) suppressWarnings(as.numeric(as.character(x)))))
  respondio <- rowSums(!is.na(m)) > 0
  col <- paste0(".cifra_sm_", var)
  if (modo == "porcentaje") {
    codigos <- substring(dummies, nchar(var) + 2L)
    cat_ <- trimws(as.character(categoria %||% "")[1])
    etq <- if (!is.null(instrumento)) .explorar_map_choices(var, instrumento) else NULL
    if (!cat_ %in% codigos && length(etq)) {
      casa <- names(etq)[tolower(trimws(etq)) == tolower(cat_)]
      if (length(casa)) cat_ <- casa[1]
    }
    if (nzchar(cat_) && !cat_ %in% codigos) {
      .plan_spec_abort(sprintf("«%s» no es una opción de «%s» (%s).", cat_, var, paste(codigos, collapse = ", ")))
    }
    marca <- m[[which(codigos == cat_)[1]]] %||% rep(NA_real_, nrow(data))
    data[[col]] <- ifelse(respondio, ifelse(!is.na(marca) & marca == 1, "1", "0"), NA_character_)
    return(list(data = data, var = col, categoria = if (nzchar(cat_)) "1" else categoria))
  }
  data[[col]] <- ifelse(respondio, "1", NA_character_)
  list(data = data, var = col, categoria = categoria)
}
