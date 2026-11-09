# =============================================================================
# lamina_referencia_barra.R — la referencia de las barras sueltas: pista gris o eje sobrio, y la cifra que entra (B8)
# =============================================================================
#
# Gonzalo, 2026-11-09: «las barras agrupadas y barras … de cobertura debería tener la posibilidad de o tener un eje x
# abajo sobrio o tener ese fondo gris … sin la barra gris de fondo representando el 100% o tenerlo; sobre eso también
# hay un bug, la etiqueta de porcentaje siempre sale de la barra, el problema es que cuando está cerca del 100% el
# porcentaje debe entrar a la barra». Corrección: «ojo no en las apiladas, en las que no son apiladas como agrupadas o
# barras de cobertura».
#
# Mando común `referencia_barra` (graficos_metadata.R) de las barras que no son apiladas: agrupadas (y simples),
# categóricas y cobertura (las dos versiones). No aplica a apiladas, multiapiladas ni divergentes.
#   - "pista": la barra va sobre su pista gris hasta el 100% (lamina_barras_pista.R);
#   - "eje": sin pista, con un eje sobrio abajo: filete y marcas en gris tenue.
# Sin valor, cada gráfico conserva lo de hoy: las agrupadas y categóricas, lo de `pista_barras` (hoy, la pista); la
# cobertura, su línea de base sin pista ni marcas.
#
# La cifra: va a la derecha de la barra si cabe dentro del área; si no (barra cerca del 100%), entra a la barra,
# alineada a su extremo, en texto claro sobre el relleno con contraste de al menos 4,5:1 (si el blanco no lo alcanza,
# el azul del estándar o el negro, el de más contraste).

#' Valores del mando `referencia_barra`
#' @keywords internal
.LAM_REFERENCIA_BARRA <- c("pista", "eje")

#' Referencia declarada en la espec (`espec$referencia`), o `defecto` si no se declara o no es válida
#' @keywords internal
.lam_referencia_barra <- function(espec, defecto = NULL) {
  r <- as.character((espec %||% list())[["referencia"]] %||% "")[1]
  if (is.na(r) || !r %in% .LAM_REFERENCIA_BARRA) defecto else r
}

#' Contraste WCAG entre dos colores (1 a 21)
#' @keywords internal
.lam_contraste_ratio <- function(a, b) {
  la <- .lam_lum(a); lb <- .lam_lum(b)
  (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
}

#' Color de la cifra dentro de una barra: blanco si alcanza 4,5:1 sobre el relleno; si no, el azul del estándar o el
#' negro, el que más contraste dé (un gris medio no alcanza 4,5:1 ni con blanco ni con azul)
#' @keywords internal
.lam_cifra_dentro_color <- function(fill) {
  if (isTRUE(.lam_contraste_ratio("#FFFFFF", fill) >= 4.5)) return("#FFFFFF")
  cand <- c(.std_color("azul"), "#000000")
  cand[which.max(vapply(cand, function(c) .lam_contraste_ratio(c, fill), 0))]
}

#' ¿La cifra cabe a la derecha de la barra sin pasar el borde del área?
#' @param xb Inicio de la barra. @param lb Largo de la barra. @param tw Ancho de la cifra (in). @param x_tope Borde del área.
#' @keywords internal
.lam_cifra_cabe_fuera <- function(xb, lb, tw, x_tope) xb + lb + 0.02 + tw <= x_tope + 1e-6

#' Escribe la cifra de una barra: fuera si cabe en el área; si no, dentro, alineada al extremo y con contraste
#'
#' @param w_fuera Ancho del cuadro de texto cuando va fuera. @param x_tope Borde derecho del área de la barra y su cifra.
#' @return Invisible TRUE si la cifra entró a la barra.
#' @keywords internal
.lam_cifra_barra <- function(lz, texto, xb, lb, y, h, size, color_fuera, fill, x_tope, w_fuera, bold = FALSE, nombre = "cifra") {
  tw <- .lam_ancho_tinta(texto, size, bold) + 0.08
  if (.lam_cifra_cabe_fuera(xb, lb, tw, x_tope) || lb < tw + 0.06) {
    .lam_txt(lz, texto, xb + lb + 0.02, y, w_fuera, h, size, color_fuera, bold = bold, nombre = nombre)
    return(invisible(FALSE))
  }
  w <- tw + 0.2   # los márgenes internos del cuadro (0,1 in por lado)
  .lam_txt(lz, texto, xb + lb - 0.02 - w, y, w, h, size, .lam_cifra_dentro_color(fill), bold = bold, align = "right", nombre = nombre)
  invisible(TRUE)
}

#' Eje sobrio bajo las barras: un filete y las marcas en gris tenue
#'
#' @param x0 Origen de las barras. @param w Ancho que mide `tope`. @param y Alto del filete.
#' @param tope Valor del extremo (100 para porcentajes). @param marcas Valores rotulados.
#' @keywords internal
.lam_eje_barras <- function(lz, x0, w, y, tope = 100, marcas = seq(0, tope, length.out = 5), nombre = "eje") {
  if (!is.finite(w) || w <= 0 || !is.finite(tope) || tope <= 0) return(invisible(lz))
  .lam_caja(lz, x0, y, w, 0.008, .std_color("filete"), nombre = paste0(nombre, ":filete"))
  for (m in marcas) {
    xm <- x0 + w * m / tope
    .lam_txt(lz, paste0(.pulso_fmt_half_up(m, 0L), "%"), xm - 0.3, y + 0.03, 0.6, 0.24, 9, .std_color("texto_tenue"), align = "center",
             nombre = paste0(nombre, ":marca"))
  }
  invisible(lz)
}

#' Cifras del respaldo ggplot de las agrupadas que entran a su barra: las de fuera que pasarían el borde del área
#'
#' @param v Largo de cada barra (unidades del eje). @param fuera Las que hoy van fuera. @param offset Separación de la
#'   cifra. @param ancho Ancho de cada cifra (unidades del eje). @param margen Respiro dentro de la barra. @param tope Borde.
#' @keywords internal
.agrupadas_cifra_entra <- function(v, fuera, offset, ancho, margen, tope) {
  ok <- !is.na(v) & !is.na(fuera) & fuera
  ok & (v + offset + ancho > tope) & (v >= ancho + margen)
}
