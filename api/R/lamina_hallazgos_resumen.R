# =============================================================================
# lamina_hallazgos_resumen.R — el dibujo nativo del resumen ejecutivo (modos «resumen» y «titulares»)
# =============================================================================
#
# Maqueta del 2026-11-04 (`05_resumen_V1_tabla_ejecutiva_*.png` y `09_resumen_V3_titular_por_capitulo.png`). Todo en
# piezas nativas y editables, en un grupo por lámina:
#
#   - V1 (`resumen`): encabezado de columnas en versalitas grises (CIFRA, HALLAZGO, DIFERENCIA PRINCIPAL FRENTE AL
#     RESTO); por capítulo, su rótulo en versalitas coral con un filete coral; por hallazgo, la cifra a 24 pt, la frase a
#     12.5 pt, debajo el intervalo (y la base si difiere) a 9 pt en gris y, a la derecha, las pastillas de la
#     diferencia principal y la línea «También». Filetes finos entre filas.
#   - V3 (`titulares`): el capítulo a la izquierda, la cifra con su intervalo, el titular en negrita con la frase debajo
#     («84% tiene a sus padres…») y las pastillas a la derecha.
#
# Las pastillas usan el tono de las del resumen de diferencias (`.lam_dif_tono`): color pleno con ▲▼ al 99%, fondo claro
# con borde punteado y △▽ al 95%; mayor en azul y menor en naranja. Al pie, la leyenda del mazo y la base
# (`.lam_dif_pie`). Con más de una lámina cada una lleva su título (`titulos`) o «(cont.)».
#
# Revisión del PPT v7.23 de CCSS, lámina 57 (ítem 14). Gonzalo: «no es necesario que las columnas digan "cifra",
# "hallazgo" y "diferencia principal"; la nota innecesaria y esos encabezados quitan alto; tampoco es necesario poner los
# intervalos (se asumen según el margen de error del estudio)». Sin encabezados de columna, sin la nota al pie y sin la
# línea del intervalo (el margen de error está en la ficha técnica). Queda sólo la base de la fila cuando difiere de la
# de la lámina. El alto ganado va a las filas: hasta 0.62 in, con la cifra y la frase más grandes cuando hay aire.

#' Pastilla de un grupo: «Econ. y Fin. 71% ▲»
#' @return Ancho dibujado (in).
#' @keywords internal
.lam_halla_res_pastilla <- function(lz, x, yc, texto, dir, fragil, pt = 9.5, dibujar = TRUE) {
  tn <- .lam_dif_tono(dir, fragil)
  wt <- .lam_ancho_tinta(texto, pt, TRUE); at <- 0.1 * 1.15
  w <- 0.09 + wt + 0.04 + at + 0.09; h <- 0.23
  if (!dibujar) return(w)
  .lam_forma_borde(lz, x, yc - h / 2, w, h, fill = tn$fill, borde = tn$borde, borde_pt = if (tn$punteado) 1 else 0.75,
                   punteado = tn$punteado, geom = "roundRect", radio = 0.035,
                   nombre = paste0("resumen_ejecutivo:pastilla:", if (isTRUE(fragil)) "95" else "99"))
  .lam_tyc_txt(lz, texto, x + 0.09, yc, wt + 0.04, pt, tn$texto, bold = TRUE, nombre = "resumen_ejecutivo:pastilla:texto")
  .lam_dif_triangulo(lz, x + 0.09 + wt + 0.04, yc, dir, tn$texto, lleno = !isTRUE(fragil), alto = 0.1)
  w
}

#' La diferencia principal de un hallazgo desde `x`: pastillas, la cola «frente al N% del resto» o el texto gris
#' @keywords internal
.lam_halla_res_diferencia <- function(lz, comp, x, yc, w, pt = 9.5) {
  suave <- .std_color("texto_suave")
  if (is.null(comp) || !length(comp$partes)) return(invisible(0))
  if (!identical(comp$estado, "diferencia")) {
    # «Sin diferencias por …» o una comparación escrita a mano: texto, en gris si es la de la prueba.
    s <- comp$partes[[1]]$texto
    col <- if (identical(comp$estado, "manual")) .std_color("azul") else suave
    lin <- .lam_tyc_envolver(s, w, pt, TRUE)
    if (length(lin) > 2L) { lin <- lin[1:2]; .dif_aviso("Resumen ejecutivo", "la comparación «", s, "» no cabe en dos líneas; se recortó.") }
    lh <- pt * 1.2 / 72
    for (j in seq_along(lin)) .lam_tyc_txt(lz, lin[j], x, yc + (j - (length(lin) + 1) / 2) * lh, w, pt, col, bold = TRUE,
                                          nombre = "resumen_ejecutivo:sin_diferencias")
    return(invisible(w))
  }
  x0 <- x
  anchos <- vapply(comp$partes, function(pa) .lam_halla_res_pastilla(lz, 0, 0, pa$texto, pa$dir, pa$fragil, pt, dibujar = FALSE), 0)
  if (length(anchos) == 2L && is.null(comp$cola) && sum(anchos) + 0.1 > w && max(anchos) <= w) {
    # Las dos pastillas de un cruce de dos grupos no caben lado a lado (columna angosta de los titulares): una sobre otra.
    for (j in 1:2) .lam_halla_res_pastilla(lz, x, yc + (j - 1.5) * 0.27, comp$partes[[j]]$texto, comp$partes[[j]]$dir, comp$partes[[j]]$fragil, pt)
    return(invisible(max(anchos)))
  }
  for (pa in comp$partes) {
    wp <- .lam_halla_res_pastilla(lz, x, yc, pa$texto, pa$dir, pa$fragil, pt, dibujar = FALSE)
    if (x + wp > x0 + w + 1e-6) { .dif_aviso("Resumen ejecutivo", "la pastilla «", pa$texto, "» no cabe en su columna; se omitió."); next }
    .lam_halla_res_pastilla(lz, x, yc, pa$texto, pa$dir, pa$fragil, pt)
    x <- x + wp + 0.1
  }
  if (!is.null(comp$cola)) {
    wc <- .lam_ancho_tinta(comp$cola, pt, TRUE)
    if (x + wc <= x0 + w + 1e-6) .lam_tyc_txt(lz, comp$cola, x, yc, wc + 0.04, pt, suave, bold = TRUE, nombre = "resumen_ejecutivo:resto")
  }
  invisible(x - x0)
}

#' La línea «También Nivel 9 48% ▲»: el otro cruce que difiere, en el color de su marca
#' @keywords internal
.lam_halla_res_tambien <- function(lz, t, x, yc, pt = 9) {
  if (is.null(t)) return(invisible(0))
  tn <- .lam_dif_tono(t$dir, t$fragil)
  col <- if (!isTRUE(t$fragil) && identical(t$dir, "up")) .std_color("azul") else tn$linea
  s <- paste("También", t$texto)
  ws <- .lam_ancho_tinta(s, pt, TRUE)
  .lam_tyc_txt(lz, s, x, yc, ws + 0.04, pt, col, bold = TRUE, nombre = "resumen_ejecutivo:tambien")
  .lam_dif_triangulo(lz, x + ws + 0.05, yc, t$dir, col, lleno = !isTRUE(t$fragil), alto = 0.085)
  invisible(ws + 0.15)
}

#' La línea gris bajo la frase: sólo la base de la fila cuando difiere de la de la lámina («Base de 399»), o ""
#'
#' Revisión del PPT v7.23, ítem 14: el intervalo ya no se escribe (se asume por el margen de error de la ficha técnica).
#' @keywords internal
.lam_halla_res_contexto <- function(k) paste(as.character(k$base %||% character(0)), collapse = ". ")

#' Una frase en su columna a `pt`; si no cabe en una línea, baja medio punto hasta `min_pt` y, si aún no cabe, se recorta
#' @keywords internal
.lam_halla_res_ajustar <- function(s, w, pt, min_pt, bold = FALSE) {
  while (pt > min_pt && .lam_ancho_tinta(s, pt, bold) > w) pt <- pt - 0.5
  r <- .lam_dif_recortar(s, w, pt, bold)
  if (r$recortado) .dif_aviso("Resumen ejecutivo", "la frase «", s, "» no cabe en su columna y se recortó; acórtala.")
  list(texto = r$texto, pt = pt)
}

.LAM_HALLA_RES_H_MAX <- 0.62   # alto máximo de una fila de la tabla ejecutiva (in)

#' Una lámina de la tabla ejecutiva (V1) con sus capítulos
#' @keywords internal
.lam_halla_res_tabla <- function(lz, capitulos, x0, x1, y0, y1) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); coral <- .std_color("coral")
  x_cifra <- x0 + 0.06; x_frase <- x0 + 1.3; x_dif <- x0 + 7.83; w_dif <- x1 - x_dif; w_frase <- x_dif - 0.3 - x_frase
  # Sin encabezados de columna (v7.23, ítem 14): la tabla empieza en el primer capítulo.
  y <- y0
  n_filas <- sum(vapply(capitulos, function(c) length(c$kpis), 0L)); h_cap <- 0.4
  h <- min(.LAM_HALLA_RES_H_MAX, (y1 - y - h_cap * length(capitulos)) / max(1L, n_filas))
  if (h < 0.4) .dif_aviso("Resumen ejecutivo", sprintf("las filas quedan de %.2f in y la cifra pide 0.40; baja el tope por lámina.", h))
  # Con aire, la cifra y la frase crecen con el alto de la fila: 24 y 12.5 pt a 0.45 in, 28 y 14 pt desde 0.6 in.
  t <- max(0, min(1, (h - 0.45) / 0.15))
  pt_cifra <- round((24 + 4 * t) * 2) / 2; pt_frase <- round((12.5 + 1.5 * t) * 2) / 2
  for (c in capitulos) {
    # El capítulo deja aire sobre su rótulo: no se pega a la última fila del anterior.
    .lam_tyc_txt(lz, toupper(c$titulo), x0, y + 0.16, x1 - x0, 9, coral, bold = TRUE, nombre = "resumen_ejecutivo:capitulo")
    .lam_caja(lz, x0, y + 0.29, x1 - x0, 0.012, coral, nombre = "resumen_ejecutivo:capitulo:filete")
    y <- y + h_cap
    for (j in seq_along(c$kpis)) {
      k <- c$kpis[[j]]; yc <- y + h / 2
      .lam_tyc_txt(lz, k$cifra, x_cifra, yc, 1.25, pt_cifra, azul, bold = TRUE, nombre = "resumen_ejecutivo:cifra")
      f <- .lam_halla_res_ajustar(k$texto, w_frase, pt_frase, 11)
      ctx <- .lam_halla_res_contexto(k)
      .lam_tyc_txt(lz, f$texto, x_frase, if (nzchar(ctx)) yc - 0.075 else yc, w_frase, f$pt, azul, nombre = "resumen_ejecutivo:hallazgo")
      if (nzchar(ctx)) .lam_tyc_txt(lz, ctx, x_frase, yc + 0.14, w_frase, 9, suave, nombre = "resumen_ejecutivo:base")
      con_t <- !is.null(k$tambien)
      .lam_halla_res_diferencia(lz, k$comparacion, x_dif, if (con_t) yc - 0.08 else yc, w_dif)
      if (con_t) .lam_halla_res_tambien(lz, k$tambien, x_dif, yc + 0.15)
      if (j < length(c$kpis)) .lam_caja(lz, x0, y + h - 0.004, x1 - x0, 0.008, .std_color("filete"), nombre = "resumen_ejecutivo:separador")
      y <- y + h
    }
  }
  invisible(y)
}

#' Una lámina de titulares (V3): un hallazgo por capítulo
#' @keywords internal
.lam_halla_res_titulares <- function(lz, capitulos, x0, x1, y0, y1) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave"); coral <- .std_color("coral")
  w_cap <- 2.05; x_cifra <- x0 + 2.08; x_tit <- x0 + 3.25; x_dif <- x0 + 8.76; w_dif <- x1 - x_dif; w_tit <- x_dif - 0.25 - x_tit
  h <- min(0.78, (y1 - y0) / max(1L, length(capitulos)))
  y <- y0
  for (i in seq_along(capitulos)) {
    c <- capitulos[[i]]; k <- c$kpis[[1]]; yc <- y + h / 2
    lin <- utils::head(.lam_tyc_envolver(toupper(c$titulo), w_cap, 9, TRUE), 2L)
    for (j in seq_along(lin)) .lam_tyc_txt(lz, lin[j], x0, y + 0.2 + (j - 1) * 0.15, w_cap, 9, coral, bold = TRUE, nombre = "resumen_ejecutivo:capitulo")
    .lam_tyc_txt(lz, k$cifra, x_cifra, yc - 0.06, 1.15, 28, azul, bold = TRUE, nombre = "resumen_ejecutivo:cifra")
    ctx <- .lam_halla_res_contexto(k)   # sin intervalo (v7.23, ítem 14); sólo la base si difiere
    if (nzchar(ctx)) .lam_tyc_txt(lz, ctx, x_cifra + 0.02, yc + 0.27, 1.15, 9, suave, nombre = "resumen_ejecutivo:base")
    tit <- .lam_halla_res_ajustar(c$titular %||% paste(k$cifra, k$texto), w_tit, 15, 12.5, bold = TRUE)
    .lam_tyc_txt(lz, tit$texto, x_tit, yc - 0.12, w_tit, tit$pt, azul, bold = TRUE, nombre = "resumen_ejecutivo:titular")
    if (!is.null(c$titular)) {
      fr <- .lam_halla_res_ajustar(paste0(k$cifra, " ", k$texto, "."), w_tit, 11, 9.5)
      .lam_tyc_txt(lz, fr$texto, x_tit, yc + 0.13, w_tit, fr$pt, suave, nombre = "resumen_ejecutivo:hallazgo")
    }
    .lam_halla_res_diferencia(lz, k$comparacion, x_dif, yc - 0.02, w_dif)
    if (i < length(capitulos)) .lam_caja(lz, x0, y + h - 0.004, x1 - x0, 0.008, .std_color("filete"), nombre = "resumen_ejecutivo:separador")
    y <- y + h
  }
  invisible(y)
}

#' Láminas del resumen ejecutivo: una por página del modelo, con su título, la leyenda, la nota y la base
#' @return Lista con `doc` y `partes` (láminas agregadas).
#' @keywords internal
.lam_laminas_hallazgos_resumen <- function(doc, espec, titulo, ante = NULL, base = NULL, folio = NULL, layout = "Graficos2",
                                           master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  g <- .std_geom
  espec$nota <- NULL   # v7.23, ítem 14: sin la nota al pie; su alto pasa a las filas (`.lam_dif_limite`)
  paginas <- espec$paginas %||% list()
  if (!length(paginas)) paginas <- list(list())
  for (k in seq_along(paginas)) {
    tk <- espec$titulos[k] %||% NA_character_
    tk <- if (!is.na(tk) && nzchar(tk)) tk else if (k > 1L) .particion_titulo_cont(titulo) else titulo
    doc <- officer::add_slide(doc, layout = layout, master = master)
    doc <- .lam_titulo(doc, tk, ante = ante, avisar = k == 1L)
    x0 <- g("margen_izq"); x1 <- g("ancho") - g("margen_der") - 0.1
    y0 <- .lam_titulo_fin(tk) + 0.2; y1 <- .lam_dif_limite(espec) - 0.05
    lz <- .lam_lienzo()
    if (identical(espec$modo, "titulares")) .lam_halla_res_titulares(lz, paginas[[k]], x0, x1, y0 + 0.1, y1) else
      .lam_halla_res_tabla(lz, paginas[[k]], x0, x1, y0, y1)
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:resumen_ejecutivo")
    doc <- .lam_dif_pie(doc, espec, base, if (is.null(folio)) NULL else folio + k - 1L)
    doc <- por_lamina(doc)
  }
  list(doc = doc, partes = length(paginas))
}
