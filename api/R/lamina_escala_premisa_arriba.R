# lamina_escala_premisa_arriba.R — la batería con tarjetas: cada premisa encima de su barra (ADR 0129)
#
# Revisión del PPT v7.23 de CCSS, ítem 7 (lámina 30, IA generativa: «aquí no entran los tres con la tarjeta estándar;
# ¿no son reducir las etiquetas y arriba de las barras como es el estándar?»). Con el panel de tarjetas al lado, la
# batería conservaba su columna de premisas a la izquierda: la barra se quedaba con lo que sobraba y las tarjetas iban
# angostas y compactas. Con tarjetas la premisa va encima de su barra, alineada a su borde izquierdo, y la barra usa todo
# el ancho de la columna de premisas; el panel recupera el ancho de la tarjeta estándar (`.TARJETAS_JUNTO_ANCHO`, la de
# la categórica) y las tarjetas bajan hasta la base, porque la leyenda va centrada bajo las barras y no bajo el panel.
#
# Ítem 12 (lámina 46, gobierno: «¿por qué aquí hay espacio en blanco si no hay nada?»): una escala partida reservaba la
# columna de tarjetas en todas sus láminas, aunque una no tuviera ninguna. La reserva y la premisa encima se deciden por
# lámina: la que no lleva tarjetas se compone como siempre, a todo el ancho.
#
# Sólo cambia la composición: cifras, orden, colores y Top Two Box son los de la espec.

#' Medidas de la premisa encima de su barra
#'
#' La barra arranca en el grosor de la escala; si las filas no caben, adelgaza hasta 0.3 in (sobre el piso de los paneles,
#' `.std_piso_panel_in()`, el de una lámina compuesta), no hasta el de la escala sola: la lámina comparte su alto con el
#' panel de tarjetas. Si ni así caben, la parte se compone como siempre (`.lam_escala_arriba_cabe`).
#' @keywords internal
.LAM_ARRIBA <- list(aire_rotulo = 0.02, sube_chica = 0.28, gap_min = 0.12, gap_max = 0.42, grosor_max = 0.42, grosor_min = 0.3,
                    aire_leyenda = 0.15)

#' ¿La espec de escala admite la premisa encima? Batería sin públicos (una barra por premisa), fuera del modo en filas
#' @keywords internal
.lam_escala_arriba_aplica <- function(espec) {
  is.list(espec) && identical(espec$tipo, "escala") && !identical(.lam_premisa_posicion(espec), "izquierda") && NROW(espec$filas) >= 2L && all(is.na(espec$filas$grupo_id)) &&
    !isTRUE(.lam_escala_modo_filas(espec))
}

#' Normaliza un texto de premisa para emparejarlo con la fila de una tarjeta (como `.lam_tarjetas_anclar`)
#' @keywords internal
.lam_arriba_norm <- function(x) gsub("[^[:alnum:]]", "", tolower(as.character(x)))

#' Lo que una parte de la escala hace con las tarjetas: reserva a la derecha y premisa encima, sólo si lleva alguna
#'
#' Lee `prosecnur.lam_escala_tarjetas` (`list(filas, reserva, arriba)`, la fija `.lam_tarjetas_slide_1` para una batería). Sin la
#' opción devuelve `NULL` y la parte se compone como siempre.
#' @param premisas Premisas de la parte (`.lam_escala_premisas`).
#' @return `NULL`, o `list(arriba, reserva)`.
#' @keywords internal
.lam_escala_tarjetas_parte <- function(premisas, espec = NULL) {
  op <- getOption("prosecnur.lam_escala_tarjetas")
  pos <- .lam_premisa_posicion(espec)
  # `premisa_posicion` (v7.25, ítem 4): «arriba» la pone encima también sin tarjetas; «izquierda» nunca.
  sin_op <- !is.list(op) || !length(op$filas)
  if (identical(pos, "arriba") && .lam_escala_arriba_aplica(espec)) {
    if (sin_op) return(list(arriba = TRUE, reserva = 0))
  } else if (sin_op || identical(pos, "izquierda")) return(NULL)
  textos <- vapply(premisas, function(p) as.character(p$texto %||% "")[1], "")
  lleva <- any(.lam_arriba_norm(textos) %in% .lam_arriba_norm(op$filas))
  list(arriba = (lleva && !isFALSE(op$arriba)) || identical(pos, "arriba"), reserva = if (lleva) as.numeric(op$reserva %||% 0) else 0)
}

#' El panel de la batería con la premisa encima: una columna del ancho de la tarjeta estándar, contra el margen derecho
#' @param L Disposición del panel (`.lam_tarjetas_disponer`); sólo se leen y cambian `xp` y `wp`.
#' @keywords internal
.lam_tarjetas_L_estandar <- function(L) {
  borde <- .std_valor("ppt", "geometria", "ancho") - .std_valor("ppt", "geometria", "margen_der")
  L$wp <- .TARJETAS_JUNTO_ANCHO; L$xp <- borde - L$wp
  L
}

#' Geometría de la batería con la premisa encima: dónde va cada premisa, su barra y el aire entre filas
#' @param y0,y1 Franja vertical del bloque (sin la leyenda).
#' @keywords internal
.lam_escala_arriba_geo <- function(espec, premisas, y0, y1) {
  L <- .std_geom("likert"); cb <- .lam_escala_columnas_box(espec)
  x <- L$x_premisa; wb <- L$x_barra + cb$ancho_barra - x
  pt <- .std_pt("pregunta"); n <- length(premisas)
  hp <- vapply(premisas, function(p) .lam_alto_tinta(as.character(p$texto %||% "")[1], wb + 0.2, pt, TRUE), 0)
  chica <- vapply(premisas, function(p) any(vapply(p$filas, function(fl) .lam_tiene_peq(.lam_escala_seg(espec, fl$i), wb), TRUE)), TRUE)
  sube <- ifelse(chica, .LAM_ARRIBA$sube_chica, 0)   # la cifra chica sube 0.28 in sobre su barra (`.lam_barra_apilada`): no pisa la premisa
  g <- min(.LAM_ARRIBA$grosor_max, max(.std_piso_escala_in(), .std_grosor(n, "escala_apilada")))
  fijo <- function(g) sum(hp + .LAM_ARRIBA$aire_rotulo + sube + g)
  disp <- y1 - y0
  piso <- max(.std_piso_panel_in(), .LAM_ARRIBA$grosor_min)
  if (fijo(g) + .LAM_ARRIBA$gap_min * (n - 1) > disp) g <- max(piso, (disp - sum(hp + .LAM_ARRIBA$aire_rotulo + sube) - .LAM_ARRIBA$gap_min * (n - 1)) / n)
  gap <- if (n > 1L) min(.LAM_ARRIBA$gap_max, max(.LAM_ARRIBA$gap_min, (disp - fijo(g)) / (n - 1))) else 0
  g_gap <- .lam_escala_arriba_grosor(g, gap, n, disp, fijo); g <- g_gap$g; gap <- g_gap$gap   # v7.25, ítem 4
  alto <- fijo(g) + gap * (n - 1)
  list(x = x, wb = wb, pt = pt, hp = hp, sube = sube, g = g, gap = gap, alto = alto, cb = cb,
       desplazo = max(0, (disp - alto) / 2), cabe = alto <= disp + 1e-6)
}

#' Franja vertical del bloque con la premisa encima y el piso de su leyenda
#'
#' La leyenda va centrada bajo las barras (no bajo el panel de tarjetas): en ese ancho puede pedir más filas, y cada fila
#' de más sube 0.3 in sobre «Base:» (`.lam_leyenda`); el bloque le deja ese lugar.
#' @keywords internal
.lam_escala_arriba_franja <- function(espec, leyenda = TRUE) {
  g_ <- .std_geom
  L <- g_("likert"); cb <- .lam_escala_columnas_box(espec); centro <- (L$x_premisa + L$x_barra + cb$ancho_barra) / 2
  labels <- espec$categorias$rotulo[espec$leyenda]
  k <- if (isTRUE(leyenda) && length(labels)) length(.lam_escala_arriba_leyenda(labels, centro)$plan$filas) else 1L
  piso <- g_("base_y") - .std_comp("llenar", "piso_leyenda") - getOption("prosecnur.lam_reserva_pie", 0) - 0.3 * max(0L, k - 1L)
  list(y0 = g_("zona_datos_y0") + 0.1, y1 = piso - (if (isTRUE(leyenda)) .LAM_ARRIBA$aire_leyenda else 0.15), piso = piso, centro = centro)
}

#' ¿La parte cabe con la premisa encima? (con la reserva del panel ya fijada)
#' @keywords internal
.lam_escala_arriba_cabe <- function(espec, premisas) {
  fr <- .lam_escala_arriba_franja(espec)
  isTRUE(.lam_escala_arriba_geo(espec, premisas, fr$y0, fr$y1)$cabe)
}

#' Dibuja la batería con cada premisa encima de su barra, la columna de Top Two Box (si la hay) y la leyenda bajo las barras
#' @return Invisible, la `y` donde terminan las barras.
#' @keywords internal
.lam_bloque_escala_arriba <- function(lz, espec, premisas, leyenda = TRUE, negrita = TRUE) {
  azul <- .std_color("azul")
  fr <- .lam_escala_arriba_franja(espec, leyenda); y0 <- fr$y0; piso <- fr$piso; centro <- fr$centro
  ley <- espec$leyenda; labels <- espec$categorias$rotulo[ley]
  geo <- .lam_escala_arriba_geo(espec, premisas, fr$y0, fr$y1)
  con_n <- isTRUE(espec$mostrar_respuestas); hay_chica <- con_n && .lam_base_chica(espec)
  wcol <- geo$cb$ancho_col
  y <- y0 + geo$desplazo
  for (cc in geo$cb$cols) .lam_txt(lz, cc$rotulo, cc$x, y - .std_comp("escala", "rotulo_box_sobre"), wcol, 0.26, .std_pt("rotulo_top_two_box"),
                                   cc$color, bold = TRUE, align = "center", nombre = paste0(cc$prefijo, ":rotulo"))
  for (i in seq_along(premisas)) {
    p <- premisas[[i]]; fl <- p$filas[[1]]
    .lam_txt(lz, p$texto, geo$x - .LAM_SANGRIA_TXT, y, geo$wb + 2 * .LAM_SANGRIA_TXT, geo$hp[i], geo$pt, azul, bold = negrita,
             nombre = "premisa")
    yb <- y + geo$hp[i] + .LAM_ARRIBA$aire_rotulo + geo$sube[i]
    antes <- length(lz$cajas)
    .lam_barra_apilada(lz, geo$x, yb, geo$wb, .lam_escala_seg(espec, fl$i), geo$g)
    if (!is.null(fl$n)) .lam_n_encima_barra(lz, fl$n, geo$x + geo$wb, yb, desde = antes)
    for (cc in geo$cb$cols) .lam_etiqueta_box(lz, espec, cc$x, yb, geo$g, fl$i, con_n = hay_chica, caja = cc$caja, color = cc$color,
                                              w = wcol, prefijo = cc$prefijo)
    y <- yb + geo$g + (if (i < length(premisas)) geo$gap else 0)
  }
  if (isTRUE(leyenda)) .lam_escala_arriba_leyenda_dibujar(lz, min(piso, y + .LAM_ARRIBA$aire_leyenda), labels, espec$categorias$color[ley], centro)
  invisible(y)
}

#' Fila (índice en `ycs`) de cada premisa: la más cercana que no quede por encima de la premisa
#'
#' Con la premisa encima de su barra, la barra de la premisa anterior puede quedar más cerca de su centro que la suya: en la
#' lámina de IA la tarjeta de «Otras herramientas» salía de la barra de NotebookLM. Una premisa nunca es de una fila que
#' queda por encima de ella; en la batería de siempre la fila cruza la premisa y la regla no cambia nada.
#' @param prem Piezas «premisa» (`y`, `h`, `yc`). @param ycs Centros de las filas candidatas.
#' @keywords internal
.lam_fila_de_premisa <- function(prem, ycs) {
  if (!length(ycs)) return(rep(NA_integer_, nrow(prem)))
  vapply(seq_len(nrow(prem)), function(i) {
    ok <- which(ycs >= prem$y[i] - 0.01)
    if (!length(ok)) ok <- seq_along(ycs)
    ok[which.min(abs(ycs[ok] - prem$yc[i]))]
  }, 1L)
}

#' Una premisa encima de su barra se ubica (para su tarjeta) a la altura de la barra, no de su texto
#' @keywords internal
.lam_premisa_arriba_a_su_fila <- function(prem) {
  arriba <- is.finite(prem$y_ancla) & prem$y + prem$h <= prem$y_ancla
  prem$yc[arriba] <- prem$y_ancla[arriba]
  prem
}

#' ¿Todas las partes con tarjetas caben con la premisa encima? Si una no cabe, ninguna la lleva
#'
#' Una pregunta partida en dos láminas no cambia de forma a mitad de camino (CCSS, redes sociales: la primera parte, con
#' cifras chicas en cuatro barras, no cabía y salía con su columna de premisas, y la segunda con la premisa encima).
#' Sin la opción de tarjetas devuelve `FALSE` y nada cambia.
#' @param partes Partes de la escala (`.lam_escala_partir`).
#' @keywords internal
.lam_escala_arriba_partes <- function(espec, partes) {
  modos <- lapply(partes, .lam_escala_tarjetas_parte, espec = espec)
  con <- which(vapply(modos, function(m) isTRUE(m$arriba), TRUE))
  if (!length(con)) return(FALSE)
  all(vapply(con, function(k) {
    op <- options(prosecnur.lam_reserva_derecha = modos[[k]]$reserva, prosecnur.lam_leyenda_ancho_completo = FALSE)
    on.exit(options(op))
    .lam_escala_arriba_cabe(espec, partes[[k]])
  }, TRUE))
}
