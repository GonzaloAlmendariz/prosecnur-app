# =============================================================================
# lamina_tarjetas_diferencias.R — la lámina del total con sus tarjetas de diferencias (ADR 0129, propuesta P08)
# =============================================================================
#
# Referencia visual exacta: `generadores/tarjetas2.mjs` de la maqueta del 2026-11-03 (láminas `v2-t*`). Todo en piezas
# nativas y editables, en dos grupos: el gráfico del total a la izquierda y el panel de tarjetas a la derecha.
#
#   - Título = la pregunta, sin subtítulo. El total conserva el tamaño del mazo: rótulos de 11 pt, cifras de 12 pt,
#     barras de hasta 0.36 in (versión 6). Las filas que tienen tarjeta van en negrita.
#   - Panel: una columna de 1/3 del ancho útil con 4 tarjetas o menos; dos columnas en la mitad con 5 o 6.
#   - Tarjeta: antetítulo del cruce, la fila, el total en gris y los grupos con ▲▼ (99%, borde continuo) o △▽ (95%,
#     borde punteado). Sin nota de significancia: solo base y fuente (la lectura va en «Cómo leer las diferencias»).
#
# Se engancha sin crecer `reporte_plan_ppt.R`: `.lam_citas_aplica()` y `.lam_citas_slide_1_nativa()` (lamina_citas.R)
# desvían aquí la lámina cuyo gráfico trae `pulso_tarjetas` con al menos una tarjeta. Sin diferencias, la lámina sigue
# su camino de siempre: el total ocupa la lámina.

#' Medidas de la tarjeta según su ancho (pulgadas y puntos; las de `tarjetas2.mjs`)
#' @keywords internal
.lam_tarjeta_medidas <- function(w, nombres = character(0)) {
  angosta <- w < 3.4; media <- !angosta && w < 4.6
  xn <- if (angosta) 1.3 else if (media) 1.45 else 2.15
  # La columna de rótulos crece hasta el 45% del ancho interno si un nombre la pide; si ni así cabe, se parte.
  if (length(nombres)) xn <- max(xn, min(max(.lam_ancho_tinta(nombres, if (angosta) 9.5 else 10, TRUE)) + 0.04, 0.45 * (w - 0.34)))
  list(angosta = angosta, pad_x = 0.17, pad_t = 0.12, pad_b = 0.1,
       xn = xn, reserva_cifra = if (angosta) 0.62 else 0.72,
       fila = if (angosta) 0.23 else 0.25, barra = if (angosta) 0.15 else 0.16, barra_dy = if (angosta) 0.04 else 0.045,
       pt_cruce = 8, pt_titulo = if (angosta) 10.5 else 11, pt_nombre = if (angosta) 9.5 else 10,
       pt_cifra = if (angosta) 10 else 10.5, alto_cruce = 0.17, aire_titulo = 0.08, aire_total = 0.04)
}

#' Líneas que ocupa un rótulo de grupo en su columna (1 o 2)
#' @keywords internal
.lam_tarjeta_lineas_nombre <- function(nombre, m) min(2L, max(1L, as.integer(.lam_lineas_tinta(nombre, m$xn + 0.2, m$pt_nombre, TRUE))))

#' Alto de una tarjeta (in) en un ancho
#' @keywords internal
.lam_tarjeta_alto <- function(t, w, cortos = character(0), tipo = "multiple") {
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(w, nombres)
  lineas <- .lam_lineas_tinta(.tarjetas_rotulo_fila(t$fila, tipo), w - 2 * m$pad_x + 0.2, m$pt_titulo, TRUE)
  extra <- sum(vapply(nombres, function(x) .lam_tarjeta_lineas_nombre(x, m) - 1L, integer(1))) * 0.16
  m$pad_t + m$alto_cruce + lineas * m$pt_titulo * 1.2 / 72 + m$aire_titulo + (nrow(t$grupos) + 1L) * m$fila +
    m$aire_total + extra + m$pad_b + 0.02
}

#' Dónde empiezan y terminan los renglones de grupo dentro de la tarjeta (in de diseño, desde su borde superior)
#'
#' Lo usan las anotaciones de la lectura (la llave sobre los grupos): un nombre de dos líneas alarga su renglón.
#' @keywords internal
.lam_tarjeta_y_grupos <- function(t, w, tipo = "multiple", cortos = character(0)) {
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(w, nombres)
  h_tit <- .lam_lineas_tinta(.tarjetas_rotulo_fila(t$fila, tipo), w - 2 * m$pad_x + 0.2, m$pt_titulo, TRUE) * m$pt_titulo * 1.2 / 72
  y0 <- m$pad_t + m$alto_cruce + h_tit + m$aire_titulo + m$fila + m$aire_total
  altos <- m$fila + (vapply(nombres, .lam_tarjeta_lineas_nombre, integer(1), m = m) - 1L) * 0.16
  c(y0, y0 + sum(altos))
}

#' Forma con borde (continuo o punteado), relleno opcional y volteo vertical
#' @keywords internal
.lam_forma_borde <- function(lz, l, t, w, h, fill = NULL, borde = NULL, borde_pt = 0.75, punteado = FALSE,
                             geom = "rect", voltear = FALSE, radio = 0, nombre = "forma") {
  av <- if (identical(geom, "roundRect") && radio > 0) sprintf('<a:gd name="adj" fmla="val %d"/>', as.integer(min(50000, 100000 * radio / max(1e-6, min(w, h))))) else ""
  relleno <- if (is.null(fill)) "<a:noFill/>" else paste0('<a:solidFill><a:srgbClr val="', .lam_hex(fill), '"/></a:solidFill>')
  linea <- if (is.null(borde)) "<a:ln><a:noFill/></a:ln>" else paste0(
    '<a:ln w="', as.integer(round(borde_pt * 12700)), '"><a:solidFill><a:srgbClr val="', .lam_hex(borde), '"/></a:solidFill>',
    if (punteado) '<a:prstDash val="dash"/>' else "", '<a:round/></a:ln>')
  xfrm <- sprintf('<a:xfrm%s><a:off x="%.0f" y="%.0f"/><a:ext cx="%.0f" cy="%.0f"/></a:xfrm>', if (voltear) ' flipV="1"' else "",
                  l * .EMU, t * .EMU, max(0, w) * .EMU, max(0, h) * .EMU)
  xml <- paste0(
    '<p:sp><p:nvSpPr><p:cNvPr id="0" name="', .lam_xml_esc(nombre), '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>',
    '<p:spPr>', xfrm, '<a:prstGeom prst="', geom, '"><a:avLst>', av, '</a:avLst></a:prstGeom>', relleno, linea, '</p:spPr>',
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></p:txBody></p:sp>')
  .lam_registrar(lz, xml, l, t, w, h)
}

#' Triángulo de dirección: ▲▼ lleno (99%) o △▽ hueco (95%)
#' @keywords internal
.lam_tarjeta_triangulo <- function(lz, x, yc, dir, fragil, alto = 0.075) {
  ancho <- alto * 1.15
  col <- if (isTRUE(fragil)) .std_color("tarjeta_borde_95") else .std_color("azul")
  .lam_forma_borde(lz, x, yc - alto / 2, ancho, alto, fill = if (isTRUE(fragil)) NULL else col, borde = col, borde_pt = 1,
                   geom = "triangle", voltear = identical(dir, "down"), nombre = if (identical(dir, "down")) "tarjeta:menor" else "tarjeta:mayor")
}

#' Backend de dibujo de la tarjeta en piezas nativas del PPT
#'
#' La tarjeta se describe una sola vez (`.lam_tarjeta_dibujar`) contra tres primitivas: `rect`, `txt` (caja de CONTENIDO,
#' sin los márgenes internos del cuadro de texto) y `tri`. El Word usa las mismas con `grid` (reporte_word_tarjetas.R).
#' @keywords internal
.lam_tarjeta_backend_ppt <- function(lz) {
  list(
    rect = function(l, t, w, h, fill = NULL, borde = NULL, pt = 0.75, punteado = FALSE, radio = 0, nombre = "tarjeta:caja") {
      .lam_forma_borde(lz, l, t, w, h, fill = fill, borde = borde, borde_pt = pt, punteado = punteado,
                       geom = if (radio > 0) "roundRect" else "rect", radio = radio, nombre = nombre)
    },
    txt = function(s, l, t, w, h, size, color, bold = FALSE, align = "left", nombre = "tarjeta:texto") {
      .lam_txt(lz, s, l - 0.1, t - 0.05, w + 0.2, h + 0.1, size, color, bold = bold, align = align, nombre = nombre)
    },
    tri = function(x, yc, dir, fragil) .lam_tarjeta_triangulo(lz, x, yc, dir, fragil)
  )
}

#' Dibuja una tarjeta con un backend (`.lam_tarjeta_backend_ppt` o el de grid del Word)
#' @param t Tarjeta de `.tarjetas_seleccionar()`.
#' @param box Caja de la tarjeta `list(l, t, w, h)` en pulgadas de diseño.
#' @param rotulo_cruce Antetítulo («Área»).
#' @keywords internal
.lam_tarjeta_dibujar <- function(b, t, box, rotulo_cruce, cortos = character(0), tipo = "multiple") {
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(box$w, nombres)
  fr <- isTRUE(t$fragil)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  b$rect(box$l, box$t, box$w, box$h, fill = .std_color(if (fr) "tarjeta_fondo_95" else "tarjeta_fondo"),
         borde = .std_color(if (fr) "tarjeta_borde_95" else "tarjeta_borde"), pt = if (fr) 1.05 else 0.75,
         punteado = fr, radio = 0.0625, nombre = if (fr) "tarjeta:95" else "tarjeta:99")
  x0 <- box$l + m$pad_x; wi <- box$w - 2 * m$pad_x; y <- box$t + m$pad_t
  # Antetítulo del cruce: versalitas de 8 pt, como el antetítulo de la lámina.
  b$txt(toupper(rotulo_cruce), x0, y, wi, m$alto_cruce, m$pt_cruce, suave, bold = TRUE, nombre = "tarjeta:cruce")
  y <- y + m$alto_cruce
  fila <- .tarjetas_rotulo_fila(t$fila, tipo)
  h_tit <- .lam_lineas_tinta(fila, wi + 0.2, m$pt_titulo, TRUE) * m$pt_titulo * 1.2 / 72
  b$txt(fila, x0, y, wi, h_tit, m$pt_titulo, azul, bold = TRUE, nombre = "tarjeta:fila")
  y <- y + h_tit + m$aire_titulo
  ancho_barra <- wi - m$xn - 0.08 - m$reserva_cifra
  maximo <- max(c(t$total, t$grupos$p), na.rm = TRUE) * 1.04
  X <- function(p) x0 + m$xn + 0.08 + if (is.finite(p) && maximo > 0) ancho_barra * p / maximo else 0
  # El rótulo del grupo va siempre en azul y negrita; la cifra lleva el nivel (negrita al 99%, azul medio al 95%).
  renglon <- function(nombre, p, color_barra, color_txt, negrita, color_nombre, nombre_negrita, dir = NULL, fragil = FALSE,
                      alto = m$fila, clase = "grupo", cifra = NULL) {
    h_n <- m$pt_nombre * 1.2 / 72 * .lam_tarjeta_lineas_nombre(nombre, m)
    b$txt(nombre, x0, y + (alto - h_n) / 2, m$xn, h_n, m$pt_nombre, color_nombre, bold = nombre_negrita, align = "right",
          nombre = paste0("tarjeta:", clase, ":rotulo"))
    xb <- x0 + m$xn + 0.08; wb <- X(p) - xb
    if (wb > 0.004) b$rect(xb, y + (alto - m$barra) / 2, wb, m$barra, fill = color_barra, nombre = paste0("tarjeta:", clase, ":barra"))
    cifra <- if (is.null(cifra) || is.na(cifra) || !nzchar(cifra)) .tarjetas_pct(p) else cifra
    h_c <- m$pt_cifra * 1.2 / 72
    w_c <- .lam_ancho_tinta(cifra, m$pt_cifra, negrita)
    b$txt(cifra, X(p) + 0.07, y + (alto - h_c) / 2, w_c + 0.05, h_c, m$pt_cifra, color_txt, bold = negrita,
          nombre = paste0("tarjeta:", clase, ":cifra"))
    if (!is.null(dir)) b$tri(X(p) + 0.07 + w_c + 0.05, y + alto / 2, dir, fragil)
    y <<- y + alto
  }
  renglon("Total", t$total, .std_color("tarjeta_total"), suave, FALSE, suave, FALSE, clase = "total", cifra = t$cifra_total)
  y <- y + m$aire_total
  for (k in seq_len(nrow(t$grupos))) {
    fr_k <- isTRUE(t$grupos$fragil[k])
    alto_k <- m$fila + (.lam_tarjeta_lineas_nombre(nombres[k], m) - 1L) * 0.16
    renglon(nombres[k], t$grupos$p[k], .std_color(if (fr_k) "tarjeta_barra_95" else "azul"),
            .std_color(if (fr_k) "tarjeta_borde_95" else "azul"), !fr_k, azul, TRUE, dir = t$grupos$dir[k], fragil = fr_k,
            alto = alto_k)
  }
  invisible(b)
}

#' Disposición del panel de tarjetas: columnas, ancho y alto de cada fila
#' @param y0,y1 Zona vertical disponible (in).
#' @keywords internal
.lam_tarjetas_disponer <- function(tarjetas, y0, y1, cortos = character(0), tipo = "multiple") {
  g <- .std_geom
  util <- g("ancho") - g("margen_izq") - g("margen_der"); sep <- 0.12
  arma <- function(cols) {
    wp <- if (cols == 1L) util / 3 else util / 2
    xp <- g("ancho") - g("margen_der") - wp
    cw <- (wp - sep * (cols - 1L)) / cols
    altos <- vapply(tarjetas, .lam_tarjeta_alto, numeric(1), w = cw, cortos = cortos, tipo = tipo)
    filas <- split(seq_along(tarjetas), ceiling(seq_along(tarjetas) / cols))
    alto_fila <- vapply(filas, function(i) max(altos[i]), numeric(1))
    total <- sum(alto_fila) + sep * max(0L, length(filas) - 1L)
    list(cols = cols, wp = wp, xp = xp, cw = cw, filas = filas, alto_fila = alto_fila, total = total, sep = sep,
         cabe = total <= y1 - y0 + 1e-6)
  }
  L <- arma(.tarjetas_columnas_ppt(length(tarjetas)))
  if (!L$cabe && L$cols == 1L) L <- arma(2L)
  if (!L$cabe && exists(".pulso_aviso", mode = "function")) {
    .pulso_aviso(sprintf("Tarjetas de diferencias: el panel mide %.2f in y la lámina tiene %.2f in.", L$total, y1 - y0))
  }
  y <- y0 + max(0, (y1 - y0 - L$total) / 2)
  cajas <- list()
  for (r in seq_along(L$filas)) {
    for (c in seq_along(L$filas[[r]])) {
      i <- L$filas[[r]][c]
      cajas[[i]] <- list(l = L$xp + (c - 1L) * (L$cw + L$sep), t = y, w = L$cw, h = L$alto_fila[r])
    }
    y <- y + L$alto_fila[r] + L$sep
  }
  L$cajas <- cajas
  L
}

#' ¿La lámina va con su panel de tarjetas? Solo si hay al menos una diferencia que mostrar
#' @keywords internal
.lam_tarjetas_aplica <- function(p, slide = NULL) {
  if (identical((slide$meta %||% list())$motor_nativo, FALSE) || !inherits(p, "ggplot")) return(FALSE)
  t <- attr(p, "pulso_tarjetas")
  espec <- attr(p, "pulso_espec")
  !is.null(t) && length(t$tarjetas) > 0L && !is.null(espec) && espec$tipo %in% c("categorica", "escala")
}

#' Reserva a la derecha (in) que deja el panel: el total termina 0.45 in antes del panel
#' @keywords internal
.lam_tarjetas_reserva <- function(L) {
  .std_valor("ppt", "geometria", "ancho") - .std_valor("ppt", "geometria", "margen_der") - L$xp + 0.45
}

#' La rama `slide_1` con tarjetas (enganche de lamina_citas.R)
#'
#' El gráfico del total lo compone EL MOTOR, con su estándar (rótulos, cifras fuera con línea guía, leyenda centrada,
#' resaltado, paleta, base y folio): la misma lámina nativa de siempre (`.lam_slide_1_nativa`) o, si no tiene pieza
#' nativa, la del recetario para un ggplot (`.lam_laminas_ggplot`). Lo único distinto es el ancho: con
#' `prosecnur.lam_reserva_derecha` la geometría del estándar (`.std_geom`) termina antes del panel. Después se agrega el
#' panel de tarjetas en la misma lámina. (Gonzalo, v7 RV: el total redibujado a mano no seguía los estándares.)
#' @keywords internal
.lam_tarjetas_slide_1 <- function(doc, p, slide, titulo, el_plot, presets, layout, master, antetitulo, base_auto, nota_de,
                                  sin_base = FALSE, sin_pie = FALSE, por_lamina = function(doc) doc) {
  t <- attr(p, "pulso_tarjetas")
  texto <- function(x) {
    v <- if (inherits(x, "ppt_element_text")) x$text else if (is.character(x)) x else NULL
    if (is.null(v) || !length(v) || is.na(v[1]) || !nzchar(trimws(v[1]))) NULL else trimws(as.character(v)[1])
  }
  tit <- texto(titulo) %||% ""
  cortos <- t$opcion$cortos
  y0 <- .lam_titulo_fin(tit) + 0.32; y1 <- .std_valor("ppt", "geometria", "base_y") - 0.12
  L <- .lam_tarjetas_disponer(t$tarjetas, y0, y1, cortos = cortos, tipo = t$tipo)
  op <- options(prosecnur.lam_reserva_derecha = .lam_tarjetas_reserva(L))
  on.exit(options(op), add = TRUE)
  slide$slots$subtitle <- NULL   # versión 6: el título es la pregunta, sin subtítulo
  # Cascada, siempre dentro del motor: la lámina nativa tal cual; si en el ancho que queda no cabe, la misma lámina con la
  # letra declarada un punto menor (`size_ejes`, lamina_tamanos_declarados.R); y sólo si tampoco, la del recetario.
  if (!.lam_tarjetas_nativa_cabe(p, slide, el_plot) && is.null((el_plot$overrides %||% list())$size_ejes)) {
    menor <- el_plot; menor$overrides$size_ejes <- .std_pt("rotulo_categoria") - 1
    if (.lam_tarjetas_nativa_cabe(p, slide, menor)) el_plot <- menor
  }
  if (.lam_tarjetas_nativa_cabe(p, slide, el_plot)) {
    doc <- .lam_slide_1_nativa(doc, p, slide, titulo, NULL, el_plot, presets, layout, master, antetitulo, base_auto, nota_de,
                               sin_base, sin_pie, por_lamina)
  } else {
    slots <- slide$slots %||% list()
    base <- if (isTRUE(sin_base)) NULL else texto(slots$base) %||% texto(base_auto(el = el_plot,
      sufijo_auto = presets$base$args$sufijo_auto %||% NULL, formato = presets$base$args$formato %||% "Base: %s"))
    pie <- if (isTRUE(sin_pie)) NULL else texto(slots$footer) %||% texto(nota_de(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL))
    doc <- .lam_laminas_ggplot(doc, p, .espec_ggplot_marco("total"), titulo = tit, ante = texto(antetitulo),
                               base = .lam_unir_base(base, pie), folio = length(doc) + 1L, layout = layout, master = master,
                               por_lamina = por_lamina)$doc
  }
  options(op)
  .lam_tarjetas_panel(doc, t, L)
}

#' ¿El total cabe como lámina nativa en el ancho que deja el panel? (lo que decide `.lam_slide_1_nativa` para su forma)
#'
#' `.lam_compositor_aplica` mide con la dicotomía y las columnas; la lámina, en cambio, pide barras para la agrupada de
#' una serie, y con el ancho acotado esa forma puede no caber (CCSS, «cinco años»: diez opciones de dos y tres líneas).
#' @keywords internal
.lam_tarjetas_nativa_cabe <- function(p, slide, el_plot) {
  if (!.lam_compositor_aplica(p, slide)) return(FALSE)
  espec <- attr(p, "pulso_espec")
  if (!identical(espec$tipo, "categorica") || identical(espec$forma, "lollipop")) return(TRUE)
  if (.lam_dicotomia_cabe(espec, .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der"))) return(TRUE)
  espec <- .lam_espec_con_tamanos(espec, el_plot)
  forma <- .lam_categorica_forma(espec, if (identical(el_plot$.element_type, "barras_agrupadas")) "barras" else "columnas")
  if (is.na(forma)) return(FALSE)
  if (identical(forma, "columnas")) return(TRUE)
  # Barras: la columna de rótulos tiene que quedar dentro de su tope (35 % del ancho); si el motor vuelve a la columna
  # natural, los rótulos largos se salen por la izquierda.
  ancho <- .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")
  .lam_barras_geo(espec)$wlab <= .lam_barras_tope_rotulo() * ancho + 1e-6
}

#' Dibuja el panel de tarjetas en la lámina en curso
#' @keywords internal
.lam_tarjetas_panel <- function(doc, t, L) {
  lz <- .lam_lienzo()
  for (i in seq_along(t$tarjetas)) {
    tj <- t$tarjetas[[i]]
    .lam_tarjeta_dibujar(.lam_tarjeta_backend_ppt(lz), tj, L$cajas[[i]], unname(t$rotulos_cruce[tj$cruce]) %||% tj$cruce,
                         cortos = t$opcion$cortos, tipo = t$tipo)
  }
  .lam_agrupar(doc, lz, nombre = "prosecnur:tarjetas_diferencias")
}
