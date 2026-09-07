# carga_aulas_libro_cierre_diario.R — la fila de cierre del «Avance diario».
# Unidad S5 del loop de mejora estética y técnica (2026-09-07).
#
# El bloque «Avance diario» del Avance tiene una fila por día y crece hacia
# abajo; con dos semanas de campo nadie sabe cuánto va sin sumar a mano. La
# fila de cierre es PRESENTACIÓN, no dato: el modelo (`ind$diario`) sigue
# siendo una fila por día y la fila «Total» la piden el writer del xlsx y el
# renderer del Sheets a esta única función, para que los dos digan lo mismo.
#
# Con un solo día no hay cierre: sumaría la única fila que hay.

#' La fila «Total» del avance diario, o `NULL` cuando no aporta.
#'
#' @param diario el `ind$diario` de `aulas_libro_indicadores()`: `Dia`,
#'   `Efectivas del dia`, `Efectivas acumuladas`, `Falta para la meta`.
#' @return un data.frame de UNA fila con las mismas columnas —«Total»; la suma
#'   de las efectivas del día; el último acumulado y lo último que falta, que
#'   NO se suman porque ya son acumulados— o `NULL` con menos de dos días.
#' @keywords internal
.cali_cierre_diario <- function(diario) {
  if (!is.data.frame(diario) || nrow(diario) < 2L) return(NULL)
  num <- function(v) suppressWarnings(as.numeric(v))
  fila <- diario[1L, , drop = FALSE]
  for (col in names(fila)) fila[[col]] <- NA
  fila[["Dia"]] <- "Total"
  if ("Efectivas del dia" %in% names(diario)) {
    fila[["Efectivas del dia"]] <- sum(num(diario[["Efectivas del dia"]]), na.rm = TRUE)
  }
  for (col in intersect(c("Efectivas acumuladas", "Falta para la meta"), names(diario))) {
    v <- num(diario[[col]])
    v <- v[is.finite(v)]
    fila[[col]] <- if (length(v)) v[[length(v)]] else NA_real_
  }
  fila
}
