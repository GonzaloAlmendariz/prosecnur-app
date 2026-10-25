# graficador_barras_agrupadas_cruce.R — CCSS-7: la barra agrupada de un CRUCE por la ruta de respaldo.
#
# CCSS Perfil 2026, láminas 23 y 28 («Tiempo de llegada según dónde vive la familia», «Actitud frente a los cursos, según
# gestión del colegio»): dos series que son los grupos de otra pregunta. Salían con cinco defectos que nacían de reglas
# pensadas para el perfil de una serie o para el comparativo entre olas:
#   1. el verde azulado (#2A9D8F) de la paleta genérica de `.graficos_mk_palette`, fuera de marca;
#   2. rótulos envueltos a 30 caracteres (tope editorial de lámina completa) que en tres o cuatro líneas caían sobre la fila
#      siguiente;
#   3. la cifra blanca de 14 pt dentro de una barra de 15 pt de alto: se salía por arriba y por abajo;
#   4. `coord_flip` deja el primer grupo del dodge ABAJO del par, y la leyenda lo nombra primero;
#   5. una columna de rótulos del 45 % del ancho, con los rótulos pegados a su borde derecho: el gráfico vivía en el centro.
#
# Aquí sólo se decide la FORMA: colores, orden visual del par, ancho de la columna de rótulos, grosor del par y cuerpo de la
# cifra. Cifras, denominadores, orden de categorías y escala (0–100 %, decisión de Gonzalo 2026-10-09) no se tocan.
# El comparativo entre olas tiene su propia ruta (graficos_barras_comparativo.R) y el perfil de una serie la suya: ninguno
# entra aquí.

#' ¿La agrupada es un cruce? Dos o más series que no son el comparativo entre olas
#' @keywords internal
.agrupadas_es_cruce <- function(n_series, comparativo_activo = FALSE, orientacion = "horizontal", usar_canvas = TRUE) {
  n <- suppressWarnings(as.integer(n_series)[1])
  isTRUE(usar_canvas) && identical(orientacion, "horizontal") && !isTRUE(comparativo_activo) && is.finite(n) && !is.na(n) && n >= 2L
}

#' Paleta de marca de un cruce: la dicotómica para dos grupos y la rampa de azules de la casa para más
#'
#' Es la misma regla de las porciones nativas (`.lam_colores_pie`): un cruce y una dona de dos grupos se leen igual.
#' @param niveles Niveles de la serie, en el orden de la leyenda.
#' @keywords internal
.agrupadas_cruce_paleta <- function(niveles) {
  niveles <- as.character(niveles)
  if (!length(niveles)) return(character(0))
  stats::setNames(.lam_colores_pie(length(niveles)), niveles)
}

#' Color de la cifra DENTRO de cada barra del cruce: blanca sobre el azul, azul sobre el celeste
#' @keywords internal
.agrupadas_cruce_texto_dentro <- function(fill, sobre_oscuro = "white") {
  .contraste_texto(fill, sobre_oscuro = sobre_oscuro)
}

#' Ancho de la columna de rótulos de un cruce y su envoltorio: lo justo para que quepan en su fila
#'
#' Se prueban columnas de menor a mayor (de 0.18 al ancho declarado), al cuerpo declarado y con 15 % de aire entre filas:
#' una línea si se logra sin pasar de un tercio del ancho; si no, dos líneas con la columna más angosta que las logre; si
#' no, la más angosta en que quepan; y si tampoco, se delega en `.agrupadas_rotulos_ajustar` (que encoge y avisa). La columna final mide la
#' tinta del rótulo más ancho más su aire, y lo que sobra pasa a las barras.
#'
#' @param etiquetas Rótulos de las categorías.
#' @param ancho Ancho del cajón (in).
#' @param w_etiquetas,w_bars,w_resto Pesos declarados de la fila del lienzo.
#' @param size_pt Cuerpo de los rótulos.
#' @param n_categorias Filas.
#' @param alto_in Alto del cajón.
#' @param frac_panel Fracción del cajón que queda para las filas.
#' @return `list(size, wrap, w_etiquetas, w_bars, cabe)` o `NULL` si no se puede medir.
#' @keywords internal
.agrupadas_cruce_rotulos <- function(etiquetas, ancho, w_etiquetas, w_bars, w_resto, size_pt, n_categorias, alto_in,
                                     lineheight = 1.2, negrita = FALSE, frac_panel = 0.62, titulo = NULL) {
  et <- as.character(etiquetas %||% character(0)); et <- et[!is.na(et) & nzchar(trimws(et))]
  a <- suppressWarnings(as.numeric(ancho)[1]); we <- suppressWarnings(as.numeric(w_etiquetas)[1])
  wb <- suppressWarnings(as.numeric(w_bars)[1]); wr <- suppressWarnings(as.numeric(w_resto)[1])
  s0 <- suppressWarnings(as.numeric(size_pt)[1]); alto <- suppressWarnings(as.numeric(alto_in)[1])
  n <- suppressWarnings(as.integer(n_categorias)[1])
  if (!is.finite(wr) || wr < 0) wr <- 0
  if (!length(et) || !is.finite(a) || a <= 0 || !is.finite(we) || we <= 0 || !is.finite(wb) || wb <= 0 ||
      !is.finite(s0) || s0 <= 0 || !is.finite(alto) || alto <= 0 || is.na(n) || n <= 0 ||
      !requireNamespace("stringr", quietly = TRUE)) return(NULL)
  lh <- suppressWarnings(as.numeric(lineheight)[1]); if (!is.finite(lh) || lh <= 0) lh <- 1.2
  total <- we + wb + wr; share0 <- we / total
  factor_negrita <- if (isTRUE(negrita)) 1.08 else 1
  fila_in <- alto * frac_panel / n
  # El descuento de `.agrupadas_rotulos_ajustar` (0.12 in) más 0.18 in: así el borde izquierdo del rótulo más ancho cae en
  # el borde del encabezado y del título (CCSS-28) y no 0.15 in a su izquierda, porque el lienzo arranca antes que el texto.
  aire_in <- 0.30
  medir <- function(share) {
    col_in <- a * share - aire_in
    if (col_in <= 0) return(NULL)
    w <- .chars_que_caben(et, col_in / factor_negrita, s0)
    if (is.na(w)) return(NULL)
    repeat {
      lin_txt <- unlist(strsplit(stringr::str_wrap(et, width = w), "\n", fixed = TRUE))
      anchos <- .ancho_texto_in(lin_txt, s0) * factor_negrita
      if (all(is.na(anchos) | anchos <= col_in) || w <= 8L) break
      w <- w - 1L
    }
    lin <- .agrupadas_lineas_eje(et, w)
    list(wrap = as.integer(w), lineas = lin, cabe = lin * s0 * lh / 72 <= fila_in * 0.85 + 1e-9,   # 15 % de aire entre filas
         tinta_in = max(c(0, anchos), na.rm = TRUE))
  }
  shares <- unique(c(seq(0.18, share0, by = 0.02), share0))
  pruebas <- lapply(shares, medir)
  ok <- !vapply(pruebas, is.null, logical(1))
  if (!any(ok)) return(NULL)
  pruebas <- pruebas[ok]; shares <- shares[ok]
  cabe <- vapply(pruebas, function(p) isTRUE(p$cabe), logical(1))
  lineas <- vapply(pruebas, function(p) as.integer(p$lineas), integer(1))
  # Una línea si cabe con la columna en a lo más un tercio del ancho (se lee mejor y no le quita a las barras); si no, dos
  # líneas con la columna más angosta que las logre (hasta el ancho declarado); si no, la más angosta en que quepan. Tres
  # o más líneas «caben» en la cuenta y se leen como un párrafo pegado a la fila vecina (lámina 28): son el último recurso.
  una <- cabe & lineas == 1L & shares <= max(0.34, shares[1])
  dos <- cabe & lineas <= 2L
  k <- if (any(una)) which(una)[1] else if (any(dos)) which(dos)[1] else if (any(cabe)) which(cabe)[1] else NA_integer_
  if (is.na(k)) {
    r <- .agrupadas_rotulos_ajustar(et, a, we, wb, wr, s0, n, alto, lh, negrita, titulo = titulo, frac_panel = frac_panel)
    return(r)
  }
  p <- pruebas[[k]]
  # La columna mide la tinta envuelta más su aire; nunca más que la probada ni menos que el piso de 0.18.
  share <- min(shares[k], max(0.18, (p$tinta_in + aire_in) / a))
  we2 <- share * total
  list(size = s0, wrap = p$wrap, w_etiquetas = we2, w_bars = wb + (we - we2), cabe = TRUE)
}

#' Grosor del par y cuerpo de la cifra de un cruce
#'
#' El par va pegado (grosor igual al dodge del comparativo, 0.86): el aire va entre categorías. La cifra baja hasta caber
#' en el alto de su barra con el mismo margen del comparativo (72 %); con un piso de 8 pt. Si ni al piso cabe, la cifra va
#' fuera de la barra y en azul (`fuera = TRUE`).
#' @return `list(dodge, grosor, size_mm, alto_barra_in, fuera)`.
#' @keywords internal
.agrupadas_cruce_par <- function(size_mm, n_categorias, n_series, alto_in, frac_panel = 0.62, frac = 0.72,
                                 minimo_pt = .std_valor("ppt", "tipografia", "cifra_minimo") %||% 8) {
  d <- .BARRAS_COMPARATIVO_DODGE
  s <- suppressWarnings(as.numeric(size_mm)[1])
  n <- suppressWarnings(as.integer(n_categorias)[1]); k <- suppressWarnings(as.integer(n_series)[1])
  alto <- suppressWarnings(as.numeric(alto_in)[1])
  if (!is.finite(s) || s <= 0 || is.na(n) || n <= 0 || is.na(k) || k <= 0 || !is.finite(alto) || alto <= 0) {
    return(list(dodge = d, grosor = d, size_mm = size_mm, alto_barra_in = NA_real_, fuera = FALSE))
  }
  barra_in <- alto * frac_panel * d / (n * k)
  tope_mm <- barra_in * frac * 25.4
  min_mm <- minimo_pt * 25.4 / 72
  s2 <- if (s / 25.4 <= barra_in * frac) s else max(min_mm, tope_mm)
  list(dodge = d, grosor = d, size_mm = s2, alto_barra_in = barra_in, fuera = s2 / 25.4 > barra_in * frac + 1e-9)
}

#' Paleta de marca del cruce, salvo que el analista declare colores que nombren a sus grupos o la serie sea una escala
#'
#' Declarar es elegir (la misma regla del perfil monocromo); una serie de acuerdo o satisfacción conserva su Likert.
#' @return Vector nombrado, o `NULL` si manda otra paleta.
#' @keywords internal
.agrupadas_cruce_paleta_efectiva <- function(niveles, colores_series = NULL) {
  niveles <- as.character(niveles)
  if (!length(niveles)) return(NULL)
  if (!is.null(colores_series) && length(names(colores_series)) && any(names(colores_series) %in% niveles)) return(NULL)
  if (!is.null(.graficos_paleta_likert(niveles))) return(NULL)
  .agrupadas_cruce_paleta(niveles)
}

#' Color de la cifra dentro de la barra: la del motor fuera del cruce; en el cruce, la legible sobre el color de su grupo
#' @keywords internal
.agrupadas_cruce_cifra_dentro <- function(cruce, fill_key, color_texto_barras) {
  if (is.null(cruce) || !length(cruce$colores)) return(rep(color_texto_barras, length(fill_key)))
  fill <- unname(cruce$colores[as.character(fill_key)])
  out <- .agrupadas_cruce_texto_dentro(fill, sobre_oscuro = color_texto_barras)
  out[is.na(fill)] <- color_texto_barras
  out
}

#' Lo que el cruce decidió, para los tests y el diagnóstico (atributo `pulso_barras_agrupadas_cruce`)
#' @keywords internal
.agrupadas_cruce_diagnostico <- function(cruce, pal_fill, niveles_serie) {
  list(colores = pal_fill, orden_leyenda = as.character(niveles_serie), dodge_invertido = isTRUE(cruce$dodge_invertido),
       size_cifra_mm = cruce$size_mm, alto_barra_in = cruce$alto_barra_in, cifra_fuera = isTRUE(cruce$fuera))
}
