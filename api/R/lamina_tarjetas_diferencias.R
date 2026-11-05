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
  # El nombre del grupo va encima de su barra y la barra usa todo el ancho (maqueta, versión 2; Gonzalo, v7 RV: «lo mejor»,
  # con los nombres completos).
  # Bajo un gráfico de una lámina de dos (ADR 0129 §6) la tarjeta es la compacta de la maqueta: nombre corto a la izquierda.
  apilada <- !.lam_tarjeta_compacta()
  xn <- if (apilada) 0 else if (angosta) 1.3 else if (media) 1.45 else 2.15
  # La columna de rótulos crece hasta el 45% del ancho interno si un nombre la pide; si ni así cabe, se parte.
  if (length(nombres) && !apilada) xn <- max(xn, min(max(.lam_ancho_tinta(nombres, if (angosta) 9.5 else 10, TRUE)) + 0.04, 0.45 * (w - 0.34)))
  pt_nombre <- if (angosta) 9.5 else 10
  list(angosta = angosta, apilada = apilada, alto_nombre = pt_nombre * 1.25 / 72, wi = w - 2 * (if (apilada) 0.14 else 0.17),
       pad_x = if (apilada) 0.14 else 0.17, pad_t = 0.11, pad_b = if (apilada) 0.05 else 0.1,
       xn = xn, reserva_cifra = if (angosta) 0.62 else 0.72,
       # Apilada, el renglón de la barra sólo lleva la barra y su cifra: lo justo para la cifra (10.5 pt).
       fila = if (apilada) 0.205 else if (angosta) 0.23 else 0.25, barra = if (angosta) 0.15 else 0.16, barra_dy = if (angosta) 0.04 else 0.045,
       pt_cruce = 8, pt_titulo = if (angosta) 10.5 else 11, pt_nombre = pt_nombre,
       pt_cifra = if (angosta) 10 else 10.5, alto_cruce = 0.17, aire_titulo = if (apilada) 0.05 else 0.08, aire_total = 0.04)
}

#' Ancho (in) bajo el que la tarjeta pone el nombre del grupo encima de su barra
#' @keywords internal
.TARJETA_ANCHO_APILADA <- 2.9

#' Holgura con que se cuentan las líneas del título de la tarjeta: PowerPoint compone el texto ~5 % más angosto que la
#' tinta que mide systemfonts, y una línea de más dejaba un hueco entre el título y las barras (Gonzalo, v7 RV)
#' @keywords internal
.TARJETA_TINTA_TITULO <- 1.05

#' Líneas que ocupa un rótulo de grupo en su columna (1 o 2); apilada, el nombre va en su propio renglón
#' @keywords internal
.lam_tarjeta_lineas_nombre <- function(nombre, m) {
  ancho <- if (isTRUE(m$apilada)) m$wi * .TARJETA_TINTA_TITULO + 0.22 else m$xn + 0.2   # misma holgura que el título
  min(if (isTRUE(m$apilada)) 3L else 2L, max(1L, as.integer(.lam_lineas_tinta(nombre, ancho, m$pt_nombre, TRUE))))   # apilada, hasta tres líneas
}

#' Alto de un renglón de grupo (in): con el nombre encima, suma su línea
#' @keywords internal
.lam_tarjeta_alto_renglon <- function(nombre, m) {
  if (isTRUE(m$apilada)) return(.lam_tarjeta_lineas_nombre(nombre, m) * m$alto_nombre + m$fila - 0.02)
  m$fila + (.lam_tarjeta_lineas_nombre(nombre, m) - 1L) * 0.16
}

#' Alto de una tarjeta (in) en un ancho
#' @keywords internal
.lam_tarjeta_alto <- function(t, w, cortos = character(0), tipo = "multiple", con_fila = TRUE) {
  enc <- .tarjetas_encabezado(t, con_fila, tipo)
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(w, nombres)
  h_fila <- if (!is.null(enc)) .lam_lineas_tinta(enc, (w - 2 * m$pad_x) * .TARJETA_TINTA_TITULO + 0.22, m$pt_titulo, TRUE) *
    m$pt_titulo * 1.2 / 72 + m$aire_titulo else m$aire_titulo
  renglones <- .lam_tarjeta_alto_renglon("Total", m) + sum(vapply(nombres, .lam_tarjeta_alto_renglon, numeric(1), m = m))
  m$pad_t + m$alto_cruce + h_fila + renglones + m$aire_total + m$pad_b + 0.02
}

#' Dónde empiezan y terminan los renglones de grupo dentro de la tarjeta (in de diseño, desde su borde superior)
#'
#' Lo usan las anotaciones de la lectura (la llave sobre los grupos): un nombre de dos líneas alarga su renglón.
#' @keywords internal
.lam_tarjeta_y_grupos <- function(t, w, tipo = "multiple", cortos = character(0)) {
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(w, nombres)
  enc <- .tarjetas_encabezado(t, TRUE, tipo)
  h_tit <- if (is.null(enc)) 0 else .lam_lineas_tinta(enc, (w - 2 * m$pad_x) * .TARJETA_TINTA_TITULO + 0.22, m$pt_titulo, TRUE) * m$pt_titulo * 1.2 / 72
  y0 <- m$pad_t + m$alto_cruce + h_tit + m$aire_titulo + .lam_tarjeta_alto_renglon("Total", m) + m$aire_total
  c(y0, y0 + sum(vapply(nombres, .lam_tarjeta_alto_renglon, numeric(1), m = m)))
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
.lam_tarjeta_dibujar <- function(b, t, box, rotulo_cruce, cortos = character(0), tipo = "multiple", con_fila = TRUE) {
  nombres <- .tarjetas_rotulo_grupo(t$grupos$etiqueta, cortos)
  m <- .lam_tarjeta_medidas(box$w, nombres)
  fr <- isTRUE(t$fragil)
  azul <- .std_color("azul"); suave <- .std_color("texto_suave")
  b$rect(box$l, box$t, box$w, box$h, fill = .std_color(if (fr) "tarjeta_fondo_95" else "tarjeta_fondo"),
         borde = .std_color(if (fr) "tarjeta_borde_95" else "tarjeta_borde"), pt = if (fr) 1.05 else 0.75,
         punteado = fr, radio = 0.0625,
         nombre = if (isTRUE(t$sin_diferencias)) "tarjeta:sin_diferencias" else if (fr) "tarjeta:95" else "tarjeta:99")
  x0 <- box$l + m$pad_x; wi <- box$w - 2 * m$pad_x; y <- box$t + m$pad_t
  # Antetítulo del cruce: versalitas de 8 pt, como el antetítulo de la lámina.
  b$txt(toupper(rotulo_cruce), x0, y, wi, m$alto_cruce, m$pt_cruce, suave, bold = TRUE, nombre = "tarjeta:cruce")
  y <- y + m$alto_cruce
  # En una batería la premisa ya está en el eje: la tarjeta no la repite y una línea guía la une a su fila (Gonzalo, v7 RV).
  # Tampoco repite la fila que ya es el título de la lámina (una batería de un solo ítem, ítem 23 de la v7 RV).
  # Sin columna de Top Two Box el encabezado nombra además el indicador, que no se ve en el gráfico («Claude · Todos los
  # días»; anclada a su premisa, solo «Todos los días»).
  enc <- .tarjetas_encabezado(t, con_fila, tipo)
  if (!is.null(enc)) {
    h_tit <- .lam_lineas_tinta(enc, wi * .TARJETA_TINTA_TITULO + 0.22, m$pt_titulo, TRUE) * m$pt_titulo * 1.2 / 72
    b$txt(enc, x0, y, wi, h_tit, m$pt_titulo, azul, bold = TRUE, nombre = "tarjeta:fila")
    y <- y + h_tit
  }
  y <- y + m$aire_titulo
  sep_b <- if (isTRUE(m$apilada)) 0 else 0.08
  ancho_barra <- wi - m$xn - sep_b - m$reserva_cifra
  maximo <- max(c(t$total, t$grupos$p), na.rm = TRUE) * 1.04
  X <- function(p) x0 + m$xn + sep_b + if (is.finite(p) && maximo > 0) ancho_barra * p / maximo else 0
  # El rótulo del grupo va siempre en azul y negrita; la cifra lleva el nivel (negrita al 99%, azul medio al 95%).
  renglon <- function(nombre, p, color_barra, color_txt, negrita, color_nombre, nombre_negrita, dir = NULL, fragil = FALSE,
                      alto = .lam_tarjeta_alto_renglon(nombre, m), clase = "grupo", cifra = NULL) {
    if (isTRUE(m$apilada)) {
      # El nombre en su renglón, alineado a la izquierda; la barra y la cifra debajo.
      lin <- .lam_tarjeta_lineas_nombre(nombre, m)
      b$txt(nombre, x0, y, wi, lin * m$pt_nombre * 1.2 / 72, m$pt_nombre, color_nombre, bold = nombre_negrita,
            nombre = paste0("tarjeta:", clase, ":rotulo"))
      y <<- y + lin * m$alto_nombre; alto <- alto - lin * m$alto_nombre
    } else {
      h_n <- m$pt_nombre * 1.2 / 72 * .lam_tarjeta_lineas_nombre(nombre, m)
      b$txt(nombre, x0, y + (alto - h_n) / 2, m$xn, h_n, m$pt_nombre, color_nombre, bold = nombre_negrita, align = "right",
            nombre = paste0("tarjeta:", clase, ":rotulo"))
    }
    xb <- x0 + m$xn + sep_b; wb <- X(p) - xb
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
    fr_k <- isTRUE(t$grupos$fragil[k]); dir_k <- t$grupos$dir[k]
    if (is.null(dir_k) || is.na(dir_k)) {
      # Opción `todas` (ítem 23): un grupo sin diferencia va sin flecha, con barra neutra y cifra sin negrita.
      renglon(nombres[k], t$grupos$p[k], .std_color("tarjeta_barra_neutra"), azul, FALSE, azul, TRUE, clase = "grupo_neutro")
      next
    }
    renglon(nombres[k], t$grupos$p[k], .std_color(if (fr_k) "tarjeta_barra_95" else "azul"),
            .std_color(if (fr_k) "tarjeta_borde_95" else "azul"), !fr_k, azul, TRUE, dir = dir_k, fragil = fr_k)
  }
  invisible(b)
}

#' Disposición del panel de tarjetas: columnas, ancho y alto de cada fila
#' @param y0,y1 Zona vertical disponible (in).
#' @keywords internal
.lam_tarjetas_disponer <- function(tarjetas, y0, y1, cortos = character(0), tipo = "multiple", fraccion = .tarjetas_panel_fraccion(tipo),
                                   escalar = TRUE) {
  g <- .std_geom
  util <- g("ancho") - g("margen_izq") - g("margen_der"); sep <- 0.12
  arma <- function(cols) {
    wp <- util * fraccion[[cols]]
    xp <- g("ancho") - g("margen_der") - wp
    cw <- (wp - sep * (cols - 1L)) / cols
    altos <- vapply(tarjetas, .lam_tarjeta_alto, numeric(1), w = cw, cortos = cortos, tipo = tipo)
    filas <- split(seq_along(tarjetas), ceiling(seq_along(tarjetas) / cols))
    alto_fila <- vapply(filas, function(i) max(altos[i]), numeric(1))
    total <- sum(alto_fila) + sep * max(0L, length(filas) - 1L)
    list(cols = cols, wp = wp, xp = xp, cw = cw, filas = filas, alto_fila = alto_fila, total = total, sep = sep,
         cabe = total <= y1 - y0 + 1e-6)
  }
  L <- arma(if (isTRUE(escalar)) .tarjetas_columnas_ppt(length(tarjetas)) else 1L)
  if (!isTRUE(escalar)) L$cabe <- TRUE   # la batería anclada se acomoda después; el ancho no se negocia
  if (!L$cabe && L$cols == 1L) L <- arma(2L)
  # Un panel angosto que no cabe en alto vuelve a los anchos de la maqueta (1/3 y 1/2).
  if (!L$cabe && !identical(fraccion, .TARJETAS_PANEL$estandar)) {
    return(.lam_tarjetas_disponer(tarjetas, y0, y1, cortos, tipo, fraccion = .TARJETAS_PANEL$estandar))
  }
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

#' Ancho del panel (fracción del ancho útil) con una y con dos columnas
#'
#' Maqueta aprobada: 1/3 y 1/2. El panel quitaba demasiado al gráfico del total (Gonzalo, PPT v7 RV): 20 % y 30 %, con el
#' nombre del grupo encima de su barra. Si así las tarjetas no caben en alto, vuelven los anchos de la maqueta.
#' @keywords internal
.TARJETAS_PANEL <- list(estandar = c(1 / 3, 1 / 2), angosto = c(0.20, 0.30))

#' @keywords internal
.tarjetas_panel_fraccion <- function(tipo) .TARJETAS_PANEL$angosto

#' ¿La lámina va con su panel de tarjetas? Solo si hay al menos una diferencia que mostrar
#' @keywords internal
.lam_tarjetas_aplica <- function(p, slide = NULL) {
  if (identical((slide$meta %||% list())$motor_nativo, FALSE) || !inherits(p, "ggplot")) return(FALSE)
  t <- attr(p, "pulso_tarjetas")
  espec <- attr(p, "pulso_espec")
  !is.null(t) && length(t$tarjetas) > 0L && !is.null(espec) && espec$tipo %in% c("categorica", "escala")
}

#' Aire (in) entre el gráfico del total y el panel de tarjetas (Gonzalo, v7 RV: 0.45 separaba demasiado)
#' @keywords internal
.TARJETAS_AIRE_PANEL <- 0.15

#' Reserva a la derecha (in) que deja el panel: el total termina `.TARJETAS_AIRE_PANEL` antes del panel
#' @keywords internal
.lam_tarjetas_reserva <- function(L, tipo = "multiple") {
  # En la escala la cifra del Top Two Box va centrada en su columna de 1 in: la columna puede llegar al panel sin que la
  # cifra lo toque (Gonzalo: «sigue muy distanciado»).
  aire <- if (identical(tipo, "bateria")) 0.05 else .TARJETAS_AIRE_PANEL   # la escala ya arrima su Top Two Box al borde
  .std_valor("ppt", "geometria", "ancho") - .std_valor("ppt", "geometria", "margen_der") - L$xp + aire
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
                                  sin_base = FALSE, sin_pie = FALSE, por_lamina = function(doc) doc, motor = NULL) {
  t <- attr(p, "pulso_tarjetas")
  texto <- function(x) {
    v <- if (inherits(x, "ppt_element_text")) x$text else if (is.character(x)) x else NULL
    if (is.null(v) || !length(v) || is.na(v[1]) || !nzchar(trimws(v[1]))) NULL else trimws(as.character(v)[1])
  }
  tit <- texto(titulo) %||% ""
  if (isTRUE(t$opcion$todas)) {   # ítem 23: la base dice que hay grupos sin flecha a propósito
    if (isTRUE(sin_base)) {
      nota_motor <- nota_de
      nota_de <- function(...) .tarjetas_nota_todas(nota_motor(...))
    } else if (!is.null(texto(slide$slots$base))) {   # la base escrita en la lámina
      slide$slots$base <- .tarjetas_nota_todas(texto(slide$slots$base))
    } else {
      base_motor <- base_auto
      base_auto <- function(...) .tarjetas_nota_todas(base_motor(...))
    }
  }
  cortos <- t$opcion$cortos
  y0 <- .lam_titulo_fin(tit) + 0.32; y1 <- .std_valor("ppt", "geometria", "base_y") - 0.12
  if (identical(t$tipo, "bateria")) y1 <- .std_valor("ppt", "geometria", "leyenda_y") - 0.1   # la leyenda corre bajo el panel
  # Una batería va anclada a sus premisas en una columna angosta (sin repetir la premisa): su ancho no escala aunque
  # las tarjetas no quepan en alto; si no caben, se anclan compactas o se dejan las principales (`.lam_tarjetas_anclar_cascada`).
  L <- if (identical(t$tipo, "bateria")) .lam_tarjetas_disponer(t$tarjetas, y0, y1, cortos = cortos, tipo = t$tipo, escalar = FALSE) else
    .lam_tarjetas_disponer(t$tarjetas, y0, y1, cortos = cortos, tipo = t$tipo)
  # v7.23, ítems 7 y 12 (lamina_escala_premisa_arriba.R): en la batería la premisa va encima de su barra y la tarjeta
  # recupera su ancho estándar; cada lámina de la escala reserva el panel sólo si lleva alguna tarjeta.
  arriba <- identical(t$tipo, "bateria") && .lam_escala_arriba_aplica(attr(p, "pulso_espec"))
  if (arriba) {   # la leyenda va bajo las barras: las tarjetas suben hasta el título y bajan hasta la base
    L <- .lam_tarjetas_L_estandar(L); y0 <- .lam_titulo_fin(tit) + 0.18; y1 <- .std_valor("ppt", "geometria", "base_y") - 0.06
  }
  op <- options(prosecnur.lam_reserva_derecha = .lam_tarjetas_reserva(L, t$tipo))
  on.exit(options(op), add = TRUE)
  op_esc <- options(prosecnur.lam_escala_tarjetas = if (identical(t$tipo, "bateria"))
    list(filas = vapply(t$tarjetas, function(tj) as.character(tj$fila %||% "")[1], ""), reserva = .lam_tarjetas_reserva(L, t$tipo), arriba = arriba))
  on.exit(options(op_esc), add = TRUE)
  # La leyenda de la escala corre a todo el ancho, también bajo el panel: en el ancho acotado pedía dos renglones y
  # pisaba la última fila (CCSS, batería de gobierno).
  op_ley <- options(prosecnur.lam_leyenda_ancho_completo = identical(t$tipo, "bateria"))
  on.exit(options(op_ley), add = TRUE)
  slide$slots$subtitle <- NULL   # versión 6: el título es la pregunta, sin subtítulo
  # Cascada, siempre dentro del motor: la lámina nativa tal cual; si en el ancho que queda no cabe, la misma lámina con la
  # letra declarada un punto menor (`size_ejes`, lamina_tamanos_declarados.R); y sólo si tampoco, la del recetario.
  if (!.lam_tarjetas_nativa_cabe(p, slide, el_plot) && is.null((el_plot$overrides %||% list())$size_ejes)) {
    menor <- el_plot; menor$overrides$size_ejes <- .std_pt("rotulo_categoria") - 1
    if (.lam_tarjetas_nativa_cabe(p, slide, menor)) el_plot <- menor
  }
  n0 <- length(doc)   # la escala puede partirse en varias láminas: cada tarjeta irá a la de su premisa
  espec_p <- attr(p, "pulso_espec")
  if (identical(t$opcion$modo, "en_linea")) {
    if (.tarjetas_en_linea_aplica(t, espec_p)) {
      # ADR 0129 §9: el desglose pegado a su barra, a todo el ancho y sin panel (lamina_tarjetas_en_linea.R).
      options(op); options(op_ley)
      slots <- slide$slots %||% list()
      base <- if (isTRUE(sin_base)) NULL else texto(slots$base) %||% texto(base_auto(el = el_plot,
        sufijo_auto = presets$base$args$sufijo_auto %||% NULL, formato = presets$base$args$formato %||% "Base: %s"))
      pie <- if (isTRUE(sin_pie)) NULL else texto(slots$footer) %||% texto(nota_de(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL))
      base_el <- .lam_unir_base(base, pie); if (nzchar(base_el)) base_el <- paste0(base_el, ".")
      return(.lam_laminas_en_linea(doc, espec_p, t, tit, ante = texto(antetitulo), base = base_el, folio = length(doc) + 1L,
                                   layout = layout, master = master, por_lamina = por_lamina))
    }
    if (exists(".pulso_aviso", mode = "function")) {
      .pulso_aviso(sprintf("Tarjetas de diferencias: «%s» pide el desglose en línea, que es solo para una categórica en barras; va con las tarjetas de siempre.", tit))
    }
  }
  if (identical(t$tipo, "bateria") && .lam_columna_llave_aplica(espec_p) && .lam_tarjetas_disponer_columna_ok(t)) {
    # Ítem 23 (v7 RV): una pregunta sola va en columna apilada con llave y deja la mitad derecha a las tarjetas.
    options(op); options(op_ley)
    slots <- slide$slots %||% list()
    base <- if (isTRUE(sin_base)) NULL else texto(slots$base) %||% texto(base_auto(el = el_plot,
      sufijo_auto = presets$base$args$sufijo_auto %||% NULL, formato = presets$base$args$formato %||% "Base: %s"))
    pie <- if (isTRUE(sin_pie)) NULL else texto(slots$footer) %||% texto(nota_de(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL))
    Lc <- .lam_tarjetas_disponer(t$tarjetas, y0, .std_valor("ppt", "geometria", "base_y") - 0.12, cortos = cortos, tipo = "multiple",
                                 fraccion = .TARJETAS_PANEL$estandar)
    base_col <- .lam_unir_base(base, pie); if (nzchar(base_col)) base_col <- paste0(base_col, ".")
    doc <- .lam_laminas_columna_llave(doc, espec_p, tit, ante = texto(antetitulo), base = base_col,
                                      folio = length(doc) + 1L, x1 = Lc$xp - 0.3, layout = layout, master = master,
                                      por_lamina = por_lamina)
    return(.lam_tarjetas_panel(doc, t, Lc))
  }
  if (.lam_tarjetas_nativa_cabe(p, slide, el_plot)) {
    doc <- .lam_slide_1_nativa(doc, p, slide, titulo, NULL, el_plot, presets, layout, master, antetitulo, base_auto, nota_de,
                               sin_base, sin_pie, por_lamina)
  } else {
    slots <- slide$slots %||% list()
    base <- if (isTRUE(sin_base)) NULL else texto(slots$base) %||% texto(base_auto(el = el_plot,
      sufijo_auto = presets$base$args$sufijo_auto %||% NULL, formato = presets$base$args$formato %||% "Base: %s"))
    pie <- if (isTRUE(sin_pie)) NULL else texto(slots$footer) %||% texto(nota_de(p, el_plot$overrides$nota_pie %||% el_plot$nota_pie %||% NULL))
    # La ruta del recetario (la del mazo para un gráfico sin pieza nativa), con el gráfico renderizado para el ancho que
    # queda: el de 12.5 in metido en la caja angosta cortaba sus rótulos (CCSS, agrupación presencial).
    p <- .lam_tarjetas_rerender(p, el_plot, motor)
    doc <- .lam_laminas_ggplot(doc, p, .espec_ggplot_marco("total"), titulo = tit, ante = texto(antetitulo),
                               base = .lam_unir_base(base, pie), folio = length(doc) + 1L, layout = layout, master = master,
                               por_lamina = por_lamina)$doc
  }
  options(op); options(op_ley)
  if (!identical(t$tipo, "bateria")) {
    # Una categórica en barras: la tarjeta junto a la barra de su categoría, con su guía (ítem 9 de la v7.11 RV).
    anclado <- tryCatch(.lam_tarjetas_anclar(doc, t, L, y0, .std_valor("ppt", "geometria", "base_y") - 0.12, laminas = seq.int(n0 + 1L, length(doc)),
                                             filas_fn = .lam_tarjetas_filas_barras, con_fila = TRUE, junto = TRUE), error = function(e) NULL)
    if (!is.null(anclado)) return(anclado)
  }
  if (identical(t$tipo, "bateria")) {
    anclado <- .lam_tarjetas_anclar_cascada(doc, t, L, y0, y1, laminas = seq.int(n0 + 1L, length(doc)), titulo = tit)
    if (!is.null(anclado)) return(anclado)
  }
  .lam_tarjetas_panel(doc, t, L)
}

#' ¿Las tarjetas de una columna con llave son de una sola fila? (todas comparan la misma pregunta)
#' @keywords internal
.lam_tarjetas_disponer_columna_ok <- function(t) length(unique(vapply(t$tarjetas, `[[`, "", "fila"))) <= 1L

.TARJETAS_JUNTO_AIRE <- 0.6    # del fin de la barra más larga (con su cifra) a la tarjeta de una categórica
.TARJETAS_JUNTO_ANCHO <- 3.4   # ancho de esa tarjeta: la del panel estándar de un tercio

#' Filas de la categórica nativa en barras de la lámina en curso: rótulo, centro de su barra y fin de su cifra
#'
#' La guía de una tarjeta de categórica sale del final de la barra de su categoría (con su cifra), como en las baterías.
#' NULL si la lámina no es de barras (columnas, dicotomía).
#' @keywords internal
.lam_tarjetas_filas_barras <- function(doc) {
  sl <- doc$slide$get_slide(doc$cursor)$get()
  ns <- xml2::xml_ns(sl)
  pieza <- function(nombre) {
    sps <- xml2::xml_find_all(sl, sprintf("//p:grpSp[p:nvGrpSpPr/p:cNvPr[@name='prosecnur:grafico:categorica']]//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre), ns)
    if (!length(sps)) return(NULL)
    off <- xml2::xml_find_first(sps, ".//a:off", ns); ext <- xml2::xml_find_first(sps, ".//a:ext", ns)
    num <- function(nodos, at) as.numeric(xml2::xml_attr(nodos, at)) / .EMU
    texto <- vapply(seq_along(sps), function(i) paste(xml2::xml_text(xml2::xml_find_all(sps[[i]], ".//a:t", ns)), collapse = " "), "")
    data.frame(texto = texto, x = num(off, "x"), y = num(off, "y"), w = num(ext, "cx"), h = num(ext, "cy"), stringsAsFactors = FALSE)
  }
  rot <- pieza("rotulo"); bar <- pieza("barra"); cif <- pieza("cifra")
  # Revisión v7.23, ítem 9 (lámina 37): una categoría de largo cero («No responde», <1%) no dibuja barra, y exigir una barra
  # por rótulo devolvía NULL: las tarjetas caían al panel en columna, sin su guía. Cada fila se busca por su altura en la
  # pieza que sí está (barra, pista o cifra); una fila sin barra ancla en su cifra.
  filas <- .lam_tarjetas_filas_por_altura(rot, bar, pieza("barra:pista"), cif)
  if (is.null(filas)) return(NULL)
  rot$yc <- filas$yc; rot$x_fin <- filas$fin + 0.07; rot$y_ancla <- filas$yc
  # Con la pista gris al 100% (lamina_barras_pista.R) la escala llega hasta el fin de la pista: la tarjeta no puede
  # arrimarse más acá (v7.14, lámina 25: la pista pasaba por debajo de la tarjeta).
  pista <- pieza("barra:pista")
  attr(rot, "fin_escala") <- if (is.null(pista)) NA_real_ else max(pista$x + pista$w)
  rot
}

#' Filas de la escala nativa en la lámina en curso: enunciado, centro vertical y fin de su cifra de Top Two Box
#' @keywords internal
.lam_tarjetas_filas_escala <- function(doc) {
  sl <- doc$slide$get_slide(doc$cursor)$get()
  ns <- xml2::xml_ns(sl)
  pieza <- function(nombre) {
    sps <- xml2::xml_find_all(sl, sprintf("//p:sp[p:nvSpPr/p:cNvPr[@name='%s']]", nombre), ns)
    if (!length(sps)) return(data.frame(texto = character(), x = numeric(), y = numeric(), w = numeric(), h = numeric()))
    off <- xml2::xml_find_first(sps, ".//a:off", ns); ext <- xml2::xml_find_first(sps, ".//a:ext", ns)
    num <- function(nodos, at) as.numeric(xml2::xml_attr(nodos, at)) / .EMU
    texto <- vapply(seq_along(sps), function(i) paste(xml2::xml_text(xml2::xml_find_all(sps[[i]], ".//a:t", ns)), collapse = " "), "")
    data.frame(texto = texto, x = num(off, "x"), y = num(off, "y"), w = num(ext, "cx"), h = num(ext, "cy"), stringsAsFactors = FALSE)
  }
  prem <- pieza("premisa"); box <- pieza("box:cifra")
  if (!nrow(prem)) return(NULL)
  prem$yc <- prem$y + prem$h / 2
  if (!nrow(box)) {
    # Sin columna de Top Two Box (G17) la guía sale del borde derecho de la barra de su premisa.
    seg <- pieza("segmento")
    if (!nrow(seg)) { prem$x_fin <- NA_real_; return(prem) }
    seg$yc <- seg$y + seg$h / 2
    filas_y <- unique(round(seg$yc, 3))
    k <- filas_y[.lam_fila_de_premisa(prem, filas_y)]
    prem$x_fin <- vapply(k, function(yy) { s <- seg[abs(seg$yc - yy) < 0.002, ]; max(s$x + s$w) + 0.07 }, 0)
    prem$y_ancla <- k
    return(.lam_premisa_arriba_a_su_fila(prem))
  }
  # El punto va a la mitad exacta de la cifra, que es la de su barra: la escala centra la caja de la cifra en la barra
  # (`.lam_bloque_escala`: caja de 0.3 in en `yb + (g - 0.3) / 2`).
  k <- .lam_fila_de_premisa(prem, box$y + box$h / 2)
  if (anyNA(k)) { prem$x_fin <- NA_real_; return(prem) }
  prem$x_fin <- box$x[k] + box$w[k] / 2 + .lam_ancho_tinta(box$texto[k], .std_pt("cifra"), TRUE) / 2 + 0.07
  prem$y_ancla <- box$y[k] + box$h[k] / 2
  .lam_premisa_arriba_a_su_fila(prem)
}

#' Panel de una batería anclado a sus premisas: cada tarjeta a la altura de su fila, en la lámina donde está su premisa
#' (la escala puede partirse), sin repetir el enunciado y con una línea guía desde el Top Two Box de la fila. NULL si
#' alguna premisa no se encuentra o si las tarjetas de una lámina no caben en una columna.
#' @keywords internal
.lam_tarjetas_anclar <- function(doc, t, L, y0, y1, laminas = length(doc), filas_fn = .lam_tarjetas_filas_escala, con_fila = FALSE,
                                 junto = FALSE) {
  norm <- function(x) gsub("[^[:alnum:]]", "", tolower(x))
  buscadas <- norm(vapply(t$tarjetas, `[[`, "", "fila"))
  donde <- rep(NA_integer_, length(buscadas)); filas_de <- list()
  for (idx in laminas) {
    doc <- officer::on_slide(doc, idx)
    f <- filas_fn(doc)
    if (is.null(f) || anyNA(f$x_fin)) next
    filas_de[[as.character(idx)]] <- f
    hit <- is.na(donde) & buscadas %in% norm(f$texto)
    donde[hit] <- idx
  }
  doc <- officer::on_slide(doc, max(laminas))
  if (anyNA(donde)) return(NULL)
  borde <- .std_valor("ppt", "geometria", "ancho") - .std_valor("ppt", "geometria", "margen_der")
  cw <- L$wp; xp <- borde - cw
  if (isTRUE(junto)) {
    # Barras que no llenan la lámina (una categórica: van al 100 %): la tarjeta se arrima al final de las barras y gana
    # ancho, en vez de quedar sola en el borde (ítem 9 de la v7.11 RV: «la tarjeta y las barras están tan distantes»).
    fin <- max(unlist(lapply(filas_de, `[[`, "x_fin")))
    escala <- suppressWarnings(max(unlist(lapply(filas_de, function(f) attr(f, "fin_escala"))), na.rm = TRUE))
    if (is.finite(escala)) fin <- max(fin, escala + 0.15 - .TARJETAS_JUNTO_AIRE)   # nada pasa por debajo de la tarjeta
    xp <- min(xp, fin + .TARJETAS_JUNTO_AIRE)
    cw <- min(.TARJETAS_JUNTO_ANCHO, borde - xp)
  }
  altos <- vapply(t$tarjetas, .lam_tarjeta_alto, numeric(1), w = cw, cortos = t$opcion$cortos, tipo = t$tipo, con_fila = con_fila)
  sep <- 0.12
  for (idx in unique(donde)) {
    if (sum(altos[donde == idx]) + sep * (sum(donde == idx) - 1L) > y1 - y0) return(NULL)
  }
  for (idx in unique(donde)) {
    doc <- officer::on_slide(doc, idx)
    filas <- filas_de[[as.character(idx)]]
    js <- which(donde == idx)
    k <- match(buscadas[js], norm(filas$texto))
    orden <- js[order(filas$yc[k])]; kk <- stats::setNames(k, js)
    # Cada tarjeta centrada en su fila; si se pisan, la de abajo baja; si el bloque se pasa del pie, sube entero.
    top <- stats::setNames(numeric(length(js)), js); cursor <- y0
    for (j in orden) { top[[as.character(j)]] <- max(cursor, filas$yc[kk[[as.character(j)]]] - altos[j] / 2); cursor <- top[[as.character(j)]] + altos[j] + sep }
    exceso <- (cursor - sep) - y1
    if (exceso > 0) {
      top <- top - exceso
      if (min(top) < y0) { cursor <- y0; for (j in orden) { top[[as.character(j)]] <- cursor; cursor <- cursor + altos[j] + sep } }   # apiladas desde arriba
    }
    lz <- .lam_lienzo(); tenue <- .std_color("texto_tenue")
    for (j in orden) {
      tj <- t$tarjetas[[j]]; tp <- top[[as.character(j)]]; fk <- kk[[as.character(j)]]
      .lam_tarjeta_dibujar(.lam_tarjeta_backend_ppt(lz), tj, list(l = xp, t = tp, w = cw, h = altos[j]),
                           unname(t$rotulos_cruce[tj$cruce]) %||% tj$cruce, cortos = t$opcion$cortos, tipo = t$tipo, con_fila = con_fila)
      # Línea guía en codo: del Top Two Box de la fila al borde de la tarjeta, con un punto en el origen.
      # Por el carril entre filas, sin cruzar otra barra (v7.25, ítem 6: `.lam_tarjeta_guia_ruta`).
      ya <- filas$y_ancla[fk]; xa <- filas$x_fin[fk]
      ruta <- .lam_tarjeta_guia_ruta(xa, ya, xp, tp, altos[j], filas$y_ancla, suppressWarnings(max(c(attr(filas, "fin_escala"), filas$x_fin - 0.07), na.rm = TRUE)))
      .lam_caja(lz, xa - 0.03, ya - 0.03, 0.06, 0.06, tenue, nombre = "tarjeta:guia:punto", geom = "ellipse")
      for (r in seq_len(nrow(ruta) - 1L)) .lam_linea(lz, ruta[r, 1], ruta[r, 2], ruta[r + 1L, 1], ruta[r + 1L, 2], tenue, pt = 0.75, nombre = "tarjeta:guia")
    }
    doc <- .lam_agrupar(doc, lz, nombre = "prosecnur:tarjetas_diferencias")
  }
  officer::on_slide(doc, max(laminas))
}

#' Ancla las tarjetas de una batería: normales; si no caben, compactas (nombre corto a la izquierda, como bajo un
#' gráfico de una lámina de dos); y si tampoco, las principales que quepan (estándar antes que compactas), con un aviso
#' de cuántas quedaron fuera.
#' El gráfico nunca se achica por las tarjetas.
#' @keywords internal
.lam_tarjetas_anclar_cascada <- function(doc, t, L, y0, y1, laminas, titulo = "") {
  intento <- function(tt, compacta = FALSE) {
    op <- options(prosecnur.lam_tarjeta_compacta = compacta); on.exit(options(op), add = TRUE)
    tryCatch(.lam_tarjetas_anclar(doc, tt, L, y0, y1, laminas = laminas), error = function(e) NULL)
  }
  n <- length(t$tarjetas)
  # v7.23, ítem 7: con el mismo número de tarjetas, la estándar va antes que la compacta (Gonzalo: «no entran los tres con
  # la tarjeta estándar»); la compacta sólo si deja una tarjeta más.
  for (k in rev(seq_len(n))) {
    tt <- t; tt$tarjetas <- utils::head(t$tarjetas, k)
    r <- intento(tt)
    if (is.null(r)) r <- intento(tt, compacta = TRUE)
    if (!is.null(r)) {
      if (k < n && exists(".pulso_aviso", mode = "function")) {
        .pulso_aviso(sprintf("Tarjetas de diferencias: en «%s» caben %d de %d tarjetas junto a sus premisas; van las principales.", titulo, k, n))
      }
      return(r)
    }
  }
  NULL
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

#' El gráfico del total renderizado de nuevo por el motor para el ancho acotado (`.render_element` del entorno del motor)
#' @keywords internal
.lam_tarjetas_rerender <- function(p, el_plot, motor) {
  rend <- if (is.environment(motor)) get0(".render_element", envir = motor, inherits = FALSE) else NULL
  if (!is.function(rend)) return(p)
  ancho <- .std_geom("ancho") - .std_geom("margen_izq") - .std_geom("margen_der")
  el <- el_plot; ov <- el$overrides %||% list()
  # El ancho del cajón manda (el del plan es el de la lámina entera) y los rótulos del eje se parten en proporción.
  ov$ancho <- ancho
  if (is.null(ov$ancho_max_eje_y) && is.null(ov$wrap_y)) ov$ancho_max_eje_y <- max(20L, as.integer(round(50 * ancho / 12.5)))
  el$overrides <- ov
  q <- tryCatch(rend(el, ancho_slot = ancho), error = function(e) NULL)
  if (!inherits(q, "ggplot")) return(p)
  for (a in c("pulso_espec", "pulso_tarjetas")) attr(q, a) <- attr(p, a)
  q
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
