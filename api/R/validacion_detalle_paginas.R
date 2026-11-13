# Páginas del detalle de casos de una regla (POST /instrumento/regla).
#
# El detalle publicaba los primeros 500 casos y la tabla, el caso y la
# Decisión tomaban ese largo por el total: "1 de 500 casos del hallazgo" en
# una regla que marca 853 (ítem 22 del checklist de validación del
# practicante). Ahora el detalle se pide por páginas (`desde`, `limite`) y
# publica `n_casos_total`, que es el número de casos que la regla marca en la
# auditoría (grano: fila de la tabla auditada; base: la base pedida). Quien
# muestra cifras usa ese total, nunca el largo de la página.

.VALIDACION_DETALLE_LIMITE_DEFECTO <- 500L
.VALIDACION_DETALLE_LIMITE_MAXIMO <- 2000L

# Un entero >= `minimo` desde un argumento de Plumber (número o texto), o el
# valor por defecto si no vino. Lo que no se lee como entero falla con su causa.
.validacion_detalle_entero <- function(x, nombre, defecto, minimo, maximo = Inf) {
  if (is.null(x) || (length(x) == 1L && (is.na(x) || identical(as.character(x), "")))) {
    return(as.integer(defecto))
  }
  v <- suppressWarnings(as.numeric(as.character(x)[1]))
  if (length(x) != 1L || is.na(v) || v != round(v) || v < minimo || v > maximo) {
    stop_api(400, "E_BAD_REQUEST",
             sprintf("`%s` debe ser un entero entre %s y %s; llegó \"%s\".",
                     nombre, format(minimo), format(maximo),
                     paste(as.character(x), collapse = ", ")),
             details = list(campo = nombre))
  }
  as.integer(v)
}

#' Página de casos del detalle de una regla
#'
#' @param n_total casos que la regla marca en la auditoría.
#' @param desde posición (desde 0) del primer caso de la página.
#' @param limite casos por página, entre 1 y 2000 (500 si no viene).
#' @return lista con `indices` (posiciones desde 1 en la tabla de casos),
#'   `desde`, `limite`, `n_total` y `hay_mas`.
#' @keywords internal
.validacion_pagina_de_casos <- function(n_total, desde = NULL, limite = NULL) {
  n_total <- as.integer(n_total %||% 0L)
  if (is.na(n_total) || n_total < 0L) n_total <- 0L
  desde <- .validacion_detalle_entero(desde, "desde", 0L, 0L)
  limite <- .validacion_detalle_entero(limite, "limite", .VALIDACION_DETALLE_LIMITE_DEFECTO,
                                       1L, .VALIDACION_DETALLE_LIMITE_MAXIMO)
  inicio <- desde + 1L
  fin <- min(n_total, desde + limite)
  indices <- if (inicio <= fin) seq.int(inicio, fin) else integer(0)
  list(indices = indices, desde = desde, limite = limite, n_total = n_total,
       hay_mas = fin < n_total)
}
