# graficador_rotulos_eje_x.R — los rótulos de las columnas se envuelven con el ancho real de su columna.
#
# CCSS Perfil 2026 (p_slide_2_graficos, p_slide_6_graficos_poblacion): `graficar_barras_categoricas` envolvía a 18 caracteres
# fijos, calibrados para la lámina completa. En un cajón de 6.1 in con cuatro columnas «Hasta secundaria completa» era más
# ancha que su columna y se encimaba con «Superior técnica». El envoltorio sale ahora del ancho medido de cada columna; nunca
# es más largo que el pedido (`ancho_max`), así que la lámina completa no cambia. Si ni así cabe una palabra, el cuerpo baja
# de a medio punto hasta el piso del estándar (`cifra_minimo`) y, si tampoco cabe ahí, se queda en el piso y avisa.

#' Envoltorio y cuerpo de los rótulos del eje x para que cada línea quepa en su columna
#'
#' @param categorias Rótulos, uno por columna.
#' @param ancho_in Ancho físico del gráfico (in); los márgenes de 24 pt a cada lado se descuentan.
#' @param size_pt Cuerpo pedido.
#' @param ancho_max Envoltorio pedido en caracteres (tope: nunca se envuelve más largo).
#' @param bold ¿Rótulos en negrita?
#' @return `list(wrap, size, cabe)`.
#' @keywords internal
.rotulos_eje_x_ajuste <- function(categorias, ancho_in, size_pt, ancho_max = 18, bold = FALSE) {
  et <- as.character(categorias); et <- et[!is.na(et) & nzchar(et)]
  tope <- suppressWarnings(as.integer(ancho_max)[1])
  a <- suppressWarnings(as.numeric(ancho_in)[1]); s0 <- suppressWarnings(as.numeric(size_pt)[1])
  sin_cambio <- list(wrap = tope, size = size_pt, cabe = TRUE)
  if (!length(et) || !is.finite(tope) || !is.finite(a) || a <= 0 || !is.finite(s0)) return(sin_cambio)
  col <- (a - 2 * 24 / 72) / length(et) - 0.04
  mide <- function(x, s) tryCatch(.lam_ancho_tinta(x, s, bold), error = function(e) NULL)
  if (is.null(mide("x", s0))) return(sin_cambio)
  # El envoltorio más largo (<= tope) cuyas líneas caben en la columna a ese cuerpo, o NA si una palabra no cabe.
  envoltorio <- function(s) {
    for (w in seq(tope, 4L)) {
      lin <- unlist(strsplit(stringr::str_wrap(et, width = w), "\n", fixed = TRUE))
      if (all(mide(lin, s) <= col)) return(w)
    }
    NA_integer_
  }
  piso <- .std_valor("ppt", "tipografia", "cifra_minimo")
  for (s in unique(c(seq(s0, piso, by = -0.5), piso))) {
    if (s < piso) next
    w <- envoltorio(s)
    if (!is.na(w)) return(list(wrap = w, size = s, cabe = TRUE))
  }
  list(wrap = 4L, size = piso, cabe = FALSE)
}
