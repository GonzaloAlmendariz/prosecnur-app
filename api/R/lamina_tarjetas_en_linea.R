# lamina_tarjetas_en_linea.R — las diferencias de grupo pegadas a su barra, sin panel aparte (ADR 0129 §9)
#
# Maqueta «Colegio y resumen ejecutivo» (2026-11-04), alternativa B (`02_colegio_B_cifra_y_desglose_en_linea.png`): en
# una categórica en barras, bajo cada opción que difiere va un rótulo pequeño con el cruce («SEGÚN ESTUDIOS DE PADRES»)
# y los grupos como barras finas con su cifra y su marca, en la misma escala que el total. Se pide con
# `meta.tarjetas_diferencias.modo = "en_linea"` (en una lámina de dos gráficos, en la opción de su ranura).
#
# Reglas (propuesta, §3.1):
#   - solo una categórica en barras sin cruce; con otro gráfico van las tarjetas de siempre, con aviso;
#   - hasta dos opciones con desglose y un cruce por opción: el de la tarjeta de mayor prioridad (el orden de
#     `.tarjetas_seleccionar`); las demás diferencias se avisan;
#   - los grupos del desglose son los de la tarjeta (con dos grupos, los dos), con su tono: ▲ azul, ▼ naranja, y al 95%
#     barra clara y triángulo hueco (los de `.lam_dif_tono`).

.EN_LINEA_MAX <- 2L

#' Desgloses de una lámina en línea: por opción, la tarjeta de mayor prioridad, hasta dos opciones
#' @return Lista de tarjetas (una por opción), en el orden de prioridad.
#' @keywords internal
.tarjetas_en_linea <- function(t, titulo = "") {
  ts <- t$tarjetas %||% list()
  if (!length(ts)) return(list())
  filas <- vapply(ts, `[[`, "", "fila")
  prim <- ts[!duplicated(filas)]
  if (length(prim) > .EN_LINEA_MAX || length(prim) < length(ts)) {
    resto <- length(ts) - min(length(prim), .EN_LINEA_MAX)
    if (resto > 0L && exists(".pulso_aviso", mode = "function")) {
      .pulso_aviso(sprintf("Tarjetas de diferencias: en «%s» el desglose en línea muestra %d opciones con un cruce cada una; %d diferencias más quedan en las tablas de cruces.",
                           titulo, min(length(prim), .EN_LINEA_MAX), resto))
    }
  }
  utils::head(prim, .EN_LINEA_MAX)
}

#' ¿La lámina pide el desglose en línea y su gráfico lo admite? (una categórica en barras)
#' @keywords internal
.tarjetas_en_linea_aplica <- function(t, espec) {
  identical((t$opcion %||% list())$modo, "en_linea") && is.list(espec) && identical(espec$tipo, "categorica") &&
    !identical(t$tipo, "bateria") && length(espec$rotulos) >= 2L
}

#' Tono de un grupo del desglose: barra, texto y triángulo según su dirección y su nivel
#' @keywords internal
.en_linea_tono <- function(dir, fragil) {
  abajo <- identical(dir, "down"); fr <- isTRUE(fragil)
  barra <- if (fr) .std_color("tarjeta_barra_95") else if (abajo) .std_color("naranja_bottom_two_box") else .std_color("azul")
  texto <- if (abajo) .std_color("naranja_bottom_two_box_texto") else if (fr) .std_color("azul_medio") else .std_color("azul")
  list(barra = barra, texto = texto, lleno = !fr)
}

#' Alto de la fila de cada opción (in): la de la maqueta, o lo que pidan las líneas de su rótulo
#' @keywords internal
.en_linea_filas <- function(espec, m, wl) {
  lin <- vapply(as.character(espec$rotulos), function(r) .lam_lineas_tinta(r, wl, m$pt, TRUE), 0)
  pmax(m$fila, lin * m$pt * 1.2 / 72 + 0.12)
}

#' Alto que pide el gráfico en línea (in) con sus medidas de fila
#' @keywords internal
.en_linea_alto <- function(espec, enl, m, wl = 3) {
  extra <- sum(vapply(enl, function(t) m$cab + nrow(t$grupos) * m$fila_g + m$aire_g, 0))
  sum(.en_linea_filas(espec, m, wl)) + extra
}

#' Medidas del gráfico en línea que caben en `alto`: las de la maqueta, y si no caben, la letra de las opciones baja de
#' 14 a 11 pt y su fila hasta 0,32 in (un rótulo largo crece en líneas, así que cuenta su alto real); el desglose
#' conserva su medida, que es lo que se lee junto. Si ni así cabe, avisa: los rótulos deben acortarse.
#' @keywords internal
.en_linea_medidas <- function(espec, enl, alto, wl = 3) {
  m <- list(fila = 0.46, barra = 0.26, fila_g = 0.27, barra_g = 0.12, cab = 0.22, aire_g = 0.12, pt = 14, pt_g = 11, pt_cab = 8)
  for (pt in c(14, 13, 12, 11)) for (fila in c(0.46, 0.4, 0.36, 0.32)) {
    m$pt <- pt; m$fila <- fila; m$barra <- min(0.26, fila * 0.56)
    if (.en_linea_alto(espec, enl, m, wl) <= alto + 1e-6) return(m)
  }
  if (.en_linea_alto(espec, enl, m, wl) > alto + 0.15 && exists(".pulso_aviso", mode = "function")) {   # un desborde que se ve
    .pulso_aviso("Tarjetas de diferencias: el gráfico con desglose en línea no cabe en su alto. Acorta los rótulos de sus opciones en Identidad, Rótulos cortos del estudio.")
  }
  m
}

#' Dibuja la categórica en barras con su desglose en línea en `[x0, x1] × [y0, y1]`
#'
#' @param espec Espec `categorica` (rótulos, largos 0-1, cifras), en su orden.
#' @param enl Tarjetas del desglose (`.tarjetas_en_linea`).
#' @param rotulos_cruce Rótulos de los cruces («Estudios de padres»). @param cortos Rótulos cortos de grupo.
#' @return El fin vertical dibujado (in).
#' @keywords internal
.lam_barras_en_linea <- function(lz, espec, enl, rotulos_cruce, cortos = character(0), x0, x1, y0, y1) {
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  # Los grupos con su nombre corto, como en la tarjeta compacta (la maqueta: «Algún padre univ.»).
  op <- options(prosecnur.lam_tarjeta_compacta = TRUE); on.exit(options(op), add = TRUE)
  rot <- as.character(espec$rotulos)
  nombres_g <- unlist(lapply(enl, function(t) .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)))
  wl <- min(0.42 * (x1 - x0), max(c(.lam_ancho_tinta(rot, 14, TRUE), .lam_ancho_tinta(nombres_g, 11, TRUE), 1)) + 0.15)
  m <- .en_linea_medidas(espec, enl, y1 - y0, wl)
  filas_h <- .en_linea_filas(espec, m, wl)
  xb <- x0 + wl + 0.15; wb <- x1 - xb - 0.95
  y <- y0 + max(0, (y1 - y0 - .en_linea_alto(espec, enl, m, wl)) / 2)
  por_fila <- stats::setNames(enl, vapply(enl, `[[`, "", "fila"))
  marca <- function(dir, fragil, x, yc, color) .lam_dif_triangulo(lz, x, yc, dir, color, lleno = !isTRUE(fragil), alto = 0.1)
  for (i in seq_along(rot)) {
    t <- por_fila[[rot[i]]]
    hf <- filas_h[i]; yc <- y + hf / 2
    ht <- .lam_lineas_tinta(rot[i], wl, m$pt, TRUE) * m$pt * 1.2 / 72 + 0.1   # centrado con su barra
    .lam_txt(lz, rot[i], x0 - 0.1, yc - ht / 2, wl + 0.2, ht, m$pt, azul, bold = !is.null(t), align = "right", nombre = "en_linea:rotulo")
    .lam_caja(lz, xb, yc - m$barra / 2, wb, m$barra, .std_color("cebra"), nombre = "en_linea:pista")
    wv <- wb * max(0, min(1, as.numeric(espec$largos[i])))
    if (wv > 0.004) .lam_caja(lz, xb, yc - m$barra / 2, wv, m$barra, azul, nombre = "en_linea:barra")
    hc <- m$pt * 1.2 / 72 + 0.1
    .lam_txt(lz, espec$cifras[i], xb + wv + 0.03, yc - hc / 2, 0.9, hc, m$pt, azul, bold = TRUE, nombre = "en_linea:cifra")
    y <- y + hf
    if (is.null(t)) next
    cr <- unname(rotulos_cruce[t$cruce]) %||% t$cruce
    .lam_txt(lz, toupper(paste("según", cr)), x0 - 0.1, y - 0.02, wl + 0.2, m$cab, m$pt_cab, suave, bold = TRUE, align = "right",
             nombre = "en_linea:cruce")
    y <- y + m$cab
    nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
    for (g in seq_len(nrow(t$grupos))) {
      tn <- .en_linea_tono(t$grupos$dir[g], t$grupos$fragil[g])
      ycg <- y + m$fila_g / 2
      .lam_txt(lz, nombres[g], x0 - 0.1, ycg - (m$pt_g * 1.2 / 72 + 0.1) / 2, wl + 0.2, m$pt_g * 1.2 / 72 + 0.1, m$pt_g, tn$texto, bold = TRUE,
               align = "right", nombre = "en_linea:grupo")
      wg <- wb * max(0, min(1, t$grupos$p[g] / 100))
      if (wg > 0.004) .lam_caja(lz, xb, ycg - m$barra_g / 2, wg, m$barra_g, tn$barra, nombre = "en_linea:grupo:barra")
      cif <- .tarjetas_pct(t$grupos$p[g])
      wc <- .lam_ancho_tinta(cif, m$pt_g, TRUE)
      hg <- m$pt_g * 1.2 / 72 + 0.1
      .lam_txt(lz, cif, xb + wg + 0.03, ycg - hg / 2, wc + 0.25, hg, m$pt_g, tn$texto, bold = TRUE, nombre = "en_linea:grupo:cifra")
      if (!is.na(t$grupos$dir[g])) marca(t$grupos$dir[g], t$grupos$fragil[g], xb + wg + 0.03 + wc + 0.16, ycg, tn$texto)
      y <- y + m$fila_g
    }
    y <- y + m$aire_g
  }
  invisible(y)
}

#' Leyenda de las marcas en línea, en una fila: ▲ mayor, ▼ menor, llenos al 99% y huecos al 95%
#' @return Alto (in).
#' @keywords internal
.lam_en_linea_leyenda <- function(lz, x, y, pt = 10) {
  azul <- .std_color("azul"); nar <- .std_color("naranja_bottom_two_box_texto"); suave <- .std_color("texto_suave")
  items <- list(list(list(c("up", FALSE, azul)), "Mayor que el resto"), list(list(c("down", FALSE, nar)), "Menor que el resto"),
                list(list(c("up", FALSE, azul), c("down", FALSE, nar)), "99% de confianza"),
                list(list(c("up", TRUE, azul), c("down", TRUE, nar)), "95% de confianza"))
  for (it in items) {
    for (tr in it[[1]]) { .lam_dif_triangulo(lz, x, y + 0.12, tr[1], tr[3], lleno = !as.logical(tr[2]), alto = 0.1, nombre = "en_linea:leyenda:marca"); x <- x + 0.14 }
    .lam_txt(lz, it[[2]], x - 0.06, y - 0.03, .lam_ancho_tinta(it[[2]], pt) + 0.25, 0.3, pt, suave, nombre = "en_linea:leyenda")
    x <- x + .lam_ancho_tinta(it[[2]], pt) + 0.4
  }
  0.3
}

#' Lámina de un gráfico con el desglose en línea: título, el gráfico a todo el ancho, la leyenda de marcas, base y folio
#' @keywords internal
.lam_laminas_en_linea <- function(doc, espec, t, titulo, ante = NULL, base = NULL, folio = NULL, layout = "Graficos2",
                                  master = "Office Theme", por_lamina = function(doc) doc) {
  force(folio)
  doc <- officer::add_slide(doc, layout = layout, master = master)
  doc <- .lam_titulo(doc, titulo, ante = ante)
  lz <- .lam_lienzo()
  g_ <- .std_geom
  y0 <- .lam_titulo_fin(titulo) + 0.4; y1 <- .std_valor("ppt", "geometria", "base_y") - 0.55
  enl <- .tarjetas_en_linea(t, titulo)
  .lam_barras_en_linea(lz, espec, enl, t$rotulos_cruce, t$opcion$cortos, g_("margen_izq") + 0.4, g_("ancho") - g_("margen_der") - 0.4, y0, y1)
  if (length(enl)) .lam_en_linea_leyenda(lz, g_("margen_izq"), y1 + 0.12)
  doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:grafico:en_linea")
  doc <- .lam_pie(doc, base, folio)
  por_lamina(doc)
}
