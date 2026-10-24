# =============================================================================
# graficos_dumbbell_forma.R — cómo se escribe la brecha entre dos grupos (L10, bandeja CCSS 2026-10-24)
# =============================================================================
#
# El dumbbell de CCSS Perfil 2026 salía con «Mujer (216.8814)» en la leyenda (la suma de pesos del grupo), con una
# columna «Diferencia» que no decía quién menos quién y con el segundo grupo en el verde azulado de `actores`. Esto
# sólo decide la FORMA: la diferencia sigue siendo el primer grupo menos el segundo y el porcentaje, el ponderado.

#' Sentido de la diferencia: «Mujer − Hombre» (primer grupo menos el segundo, como `graficar_dumbbell()`)
#' @keywords internal
.dumbbell_sentido <- function(a, b) paste0(a, " − ", b)

#' Columna con los casos que la leyenda puede escribir
#'
#' `var_n_casos` (casos sin ponderar) si la tabla la trae; si no, `var_n` sólo cuando todos sus valores son enteros
#' (sin ponderación `n` ya son casos). Un `n` fraccionario es una suma de pesos: `NULL`, la leyenda va sin número.
#' @keywords internal
.dumbbell_col_casos <- function(data, var_n = "n", var_n_casos = "n_casos") {
  cc <- as.character(var_n_casos %||% "")[1]
  if (!is.na(cc) && nzchar(cc) && cc %in% names(data)) return(cc)
  vn <- as.character(var_n %||% "")[1]
  if (is.na(vn) || !nzchar(vn) || !vn %in% names(data)) return(NULL)
  v <- suppressWarnings(as.numeric(data[[vn]])); v <- v[is.finite(v)]
  if (length(v) && all(abs(v - round(v)) < 1e-9)) vn else NULL
}

#' Casos como entero con separador de miles («1,204»)
#' @keywords internal
.dumbbell_fmt_casos <- function(n) format(round(n), big.mark = ",", trim = TRUE, scientific = FALSE)

#' Color de la cifra de cada grupo: el de su punto, salvo que sea tan claro que no se lea sobre el fondo de la lámina
#'
#' Entonces va en el azul medio de la marca (misma familia que el azul claro del punto).
#' @keywords internal
.dumbbell_colores_cifra <- function(colores) {
  lum <- vapply(colores, function(x) {
    rgb <- tryCatch(grDevices::col2rgb(x)[, 1] / 255, error = function(e) c(0, 0, 0))
    lin <- ifelse(rgb <= 0.03928, rgb / 12.92, ((rgb + 0.055) / 1.055)^2.4)
    sum(c(0.2126, 0.7152, 0.0722) * lin)
  }, numeric(1))
  unname(ifelse(lum > 0.4, .std_color("azul_medio"), colores))
}

#' Columna de rótulos de las pesas nativas: el ancho del recetario (2.8 in con diferencia, 2.2 sin ella) o, si algún
#' rótulo pide más de dos líneas a 13 pt, el más angosto (hasta 1.6 in más) en que todos caben en dos
#'
#' `NA` si ni así caben: la lámina sigue por la ruta de respaldo.
#' @keywords internal
.lam_pesas_ancho_rotulo <- function(rotulos, con_dif) {
  base <- if (isTRUE(con_dif)) 2.8 else 2.2
  for (w in seq(base, base + 1.6, by = 0.2)) {
    if (all(vapply(rotulos, function(x) .lam_lineas(x, w, 13, TRUE) <= 2L, TRUE))) return(w)
  }
  NA_real_
}

#' Tamaño del rótulo «Mujer − Hombre» de la columna de diferencia: 10 pt, o menos (hasta el piso de 8) si no cabe en 1.6 in
#' @keywords internal
.lam_pesas_sentido_pt <- function(txt) {
  for (pt in seq(10, 8, by = -0.5)) if (.lam_ancho_txt(txt, pt) <= 1.55) return(pt)
  8
}
