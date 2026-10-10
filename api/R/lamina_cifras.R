# Pieza «Cifra» del motor nativo (F6.0b.6; inventario F6, A19; tipos 21 y 22 y láminas 172–175 del recetario).
#
# Gonzalo quiere que «Destacar cifras» exista con datos reales, no oculto. El recetario la dibuja así
# (`recetario_piezas.R::cifra`, `propuestas_rescatables.R::banda_cifras`): el valor en azul y negrita, el rótulo debajo en
# 12 pt negrita (hasta dos líneas) y el detalle en gris a 10 pt; todos los detalles a la misma altura aunque un rótulo
# ocupe más; ícono opcional en un círculo; separador vertical entre cifras. Con una cifra va a 54 pt, con tres a 44 y con
# cinco a 34; nunca más de cinco («con seis o más, la información va a una tabla»).

#' Espec de una banda de cifras destacadas
#'
#' @param items Lista de 1 a 5 cifras; cada una `list(valor, rotulo, detalle = NULL, icono = NULL)`. `valor` es el texto
#'   tal cual se muestra («172», «31%», «22 años»): la cifra ya viene calculada y redondeada por quien la pide.
#' @return Objeto `pulso_espec` de forma «cifras/1».
#' @export
pulso_cifras <- function(items) {
  if (!is.list(items) || !length(items)) .plan_spec_abort("`items` debe ser una lista con al menos una cifra.")
  if (length(items) > 5L) .plan_spec_abort("Una banda admite hasta cinco cifras; con más, la información va a una tabla.")
  limpio <- lapply(items, function(it) {
    it <- as.list(it)
    txt <- function(v) { v <- as.character(unlist(v) %||% "")[1]; if (is.na(v)) "" else trimws(v) }
    v <- txt(it$valor); r <- txt(it$rotulo)
    if (!nzchar(v) || !nzchar(r)) .plan_spec_abort("Cada cifra necesita `valor` y `rotulo`.")
    list(valor = v, rotulo = r, detalle = txt(it$detalle), icono = txt(it$icono))
  })
  structure(list(forma = "cifras/1", items = limpio), class = c("pulso_espec", "list"))
}

#' Tamaño de la cifra según cuántas hay (recetario: 1 → 54 pt, 3 → 44 pt, 5 → 34 pt)
#' @keywords internal
.lam_cifras_size <- function(n) c(54, 48, 44, 40, 34)[min(max(as.integer(n), 1L), 5L)]

#' ¿La banda va en nativo? De una a cinco cifras con valor y rótulo
#' @keywords internal
.lam_cifras_cabe <- function(espec) inherits(espec, "pulso_espec") && identical(espec$forma, "cifras/1") && length(espec$items) %in% 1:5

#' Dibuja una banda de cifras en el lienzo
#'
#' @param pieza Geometría de la pieza `cifra()` del recetario (`ppt.geometria.cifra_pieza`) para las láminas de
#'   composición (p169, p171): caja desde el borde de su columna, valor de 0.62, rótulo y detalle a distancias fijas.
#'   `NULL` para la banda de las láminas de cifras solas (p174/p175), que corre la caja 0.1 y mide el valor por su tamaño.
#' @param calle Calle entre cifras; `NULL` para la de la banda (0.45, o 0.3 con cinco).
#' @return `list(iconos, alto)`: los íconos a colocar después como imagen (`n`, `x`, `y`, `d`) y el alto que ocupó.
#' @keywords internal
.lam_cifras_banda <- function(lz, espec, x, y, w, size = NULL, con_icono = NULL, pieza = NULL, calle = NULL) {
  it <- espec$items; n <- length(it)
  size <- size %||% .lam_cifras_size(n)
  con_icono <- con_icono %||% any(vapply(it, function(i) nzchar(i$icono), logical(1)))
  # Con ícono, la banda de siempre: la pieza `cifra()` del recetario no lo lleva y no se descarta en silencio.
  if (!is.null(pieza) && !isTRUE(con_icono)) return(.lam_cifras_pieza(lz, it, x, y, w, size, calle %||% 0.45, pieza))
  gap <- calle %||% (if (n >= 5) 0.3 else 0.45)
  wc <- (w - gap * (n - 1)) / n
  hn <- size * 1.25 / 72
  hr <- max(vapply(it, function(i) min(.lam_alto_txt(i$rotulo, wc + 0.1, 12, TRUE), 2 * 12 * 1.2 / 72 + 0.1), 0))
  y_ico <- y; y_val <- y + (if (con_icono) 0.75 else 0)
  alto <- (y_val - y) + hn + hr + 0.45
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); filete <- .std_color("filete")
  iconos <- list()
  for (k in seq_len(n)) {
    xk <- x + (k - 1) * (wc + gap)
    if (k > 1) .lam_linea(lz, xk - gap / 2, y, xk - gap / 2, y + alto, filete, pt = 0.75, nombre = "cifra:separador")
    if (con_icono && nzchar(it[[k]]$icono)) {
      .lam_caja(lz, xk, y_ico, 0.55, 0.55, azul, geom = "ellipse", nombre = "cifra:icono_fondo")
      iconos[[length(iconos) + 1L]] <- list(n = it[[k]]$icono, x = xk + 0.55 * 0.24, y = y_ico + 0.55 * 0.24, d = 0.55 * 0.52)
    }
    .lam_txt(lz, it[[k]]$valor, xk - 0.1, y_val, wc + 0.1, hn, size, azul, bold = TRUE, nombre = "cifra:valor")
    .lam_txt(lz, it[[k]]$rotulo, xk - 0.1, y_val + hn, wc + 0.1, hr, 12, azul, bold = TRUE, nombre = "cifra:rotulo")
    if (nzchar(it[[k]]$detalle)) .lam_txt(lz, it[[k]]$detalle, xk - 0.1, y_val + hn + hr + 0.05, wc + 0.1, 0.3, 10, suave, nombre = "cifra:detalle")
  }
  list(iconos = iconos, alto = alto)
}

#' Coloca los íconos de la banda (PNG blanco del recetario sobre el círculo azul)
#' @keywords internal
.lam_cifras_iconos <- function(doc, iconos) {
  for (ic in iconos) {
    ruta <- .lam_icono_ruta(ic$n, "blanco")
    if (!is.null(ruta)) doc <- officer::ph_with(doc, officer::external_img(ruta, width = ic$d, height = ic$d),
                                                location = officer::ph_location(left = ic$x, top = ic$y, width = ic$d, height = ic$d, newlabel = "cifra:icono"))
  }
  doc
}

#' Lámina de cifras destacadas (láminas 174–175 del recetario: tres o cinco cifras, con una lectura opcional debajo)
#' @keywords internal
.lam_laminas_cifras <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, lectura = NULL,
                                layout = "Graficos", master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g <- .std_geom; ml <- g("margen_izq"); W <- g("ancho"); ac <- W - ml - g("margen_der"); y0 <- g("zona_datos_y0")
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  lz <- .lam_lienzo()
  yb <- y0 + 0.2
  b <- .lam_cifras_banda(lz, espec, ml, yb, ac)
  if (!is.null(lectura) && nzchar(lectura)) {
    # Como la 174/175 del recetario: filete a 3.4 in del inicio de la banda (3.1 con cinco cifras) y la lectura debajo.
    yf <- yb + max(b$alto + 0.35, if (length(espec$items) >= 5L) 3.1 else 3.4)
    .lam_linea(lz, ml, yf, ml + ac, yf, .std_color("filete"), pt = 0.75, nombre = "cifra:filete")
    .lam_txt(lz, lectura, ml, yf + 0.2, ac, 0.7, 13, .std_color("azul"), bold = TRUE, nombre = "cifra:lectura")
  }
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:cifras")
  doc <- .lam_cifras_iconos(doc, b$iconos)
  doc <- .lam_pie(doc, base, folio)
  list(doc = por_lamina(doc), partes = 1L)
}
