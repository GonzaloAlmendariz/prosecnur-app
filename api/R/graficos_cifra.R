# La cifra destacada calculada desde los datos (F6.0b.6; inventario F6, A19).
#
# «Destacar cifras» tiene que salir con datos reales: el analista elige una pregunta y qué cifra quiere de ella —el
# porcentaje que eligió una categoría, cuántos respondieron, la mediana o la media— y el motor la calcula con la misma
# regla que el resto del informe (sobre quienes respondieron; redondeo al entero desde 0.5). El resultado es un ítem de
# `pulso_cifras()` listo para la banda (lamina_cifras.R).

#' Una cifra destacada desde una variable
#'
#' @param data Data frame de la base.
#' @param var Nombre de la variable.
#' @param modo «porcentaje» (de una categoría), «n» (respuestas válidas), «mediana» o «media».
#' @param categoria Para «porcentaje»: el código o la etiqueta de la categoría.
#' @param instrumento Opcional: para casar la categoría por su etiqueta.
#' @param rotulo,detalle Textos de la cifra; si `detalle` es `NULL` se arma uno con la base («56 de 178»).
#' @param unidad Para «mediana» o «media»: sufijo («años»).
#' @param decimales Decimales del valor (0 por defecto; la media usa 1).
#' @param icono Ícono del recetario (opcional).
#' @return Ítem de `pulso_cifras()`: `list(valor, rotulo, detalle, icono)` más `base` (respuestas válidas).
#' @keywords internal
.cifra_desde_datos <- function(data, var, modo = c("porcentaje", "n", "mediana", "media"), categoria = NULL,
                               instrumento = NULL, rotulo, detalle = NULL, unidad = NULL, decimales = NULL, icono = NULL) {
  modo <- match.arg(modo)
  if (!is.data.frame(data) || !var %in% names(data)) .plan_spec_abort(sprintf("La cifra pide «%s», que no está en la base.", var))
  x <- data[[var]]
  if (inherits(x, "haven_labelled")) x <- as.vector(x)
  validos <- !is.na(x) & !(is.character(x) & !nzchar(trimws(x)))
  n <- sum(validos)
  if (n == 0L) .plan_spec_abort(sprintf("«%s» no tiene respuestas válidas: no hay cifra que destacar.", var))
  valor <- switch(modo,
    porcentaje = {
      if (is.null(categoria) || !nzchar(as.character(categoria)[1])) .plan_spec_abort("Para un porcentaje, indica la categoría.")
      cat_ <- as.character(categoria)[1]
      codigos <- as.character(x[validos])
      etq <- if (!is.null(instrumento)) .explorar_map_choices(var, instrumento) else NULL
      if (!cat_ %in% codigos && length(etq)) {
        casa <- names(etq)[tolower(trimws(etq)) == tolower(trimws(cat_))]
        if (length(casa)) cat_ <- casa[1]
      }
      k <- sum(codigos == cat_)
      if (is.null(detalle)) detalle <- sprintf("%s de %s", format(k, big.mark = ","), format(n, big.mark = ","))
      paste0(.pulso_fmt_half_up(100 * k / n, decimales %||% 0L), "%")
    },
    n = format(n, big.mark = ","),
    mediana = , media = {
      num <- suppressWarnings(as.numeric(as.character(x[validos])))
      if (!any(is.finite(num))) .plan_spec_abort(sprintf("«%s» no es numérica: no tiene %s.", var, modo))
      v <- if (modo == "mediana") stats::median(num, na.rm = TRUE) else mean(num, na.rm = TRUE)
      d <- decimales %||% (if (modo == "media") 1L else 0L)
      trimws(paste(.pulso_fmt_half_up(v, d), unidad %||% ""))
    })
  if (is.null(detalle) && modo != "n") detalle <- sprintf("Base: %s respuestas", format(n, big.mark = ","))
  list(valor = valor, rotulo = rotulo, detalle = detalle %||% "", icono = icono %||% "", base = n)
}
