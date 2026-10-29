# lamina_filtro_sub_conta.R — la Sí/No con su escala dependiente de una barra, compuesta como Contabilidad (Gonzalo,
# 2026-10-28, sobre la lámina «¿Conoce el reglamento…?» de Arte: «ya quedamos en que las barras dicotómicas son barras
# apiladas, no dicotómicas especiales»; y «N = 77» chocaba con «TOP TWO BOX»).
#
# Contabilidad (motor antiguo, lámina 34 del 03.09.2026) la arma como dos filas de escala: la premisa a la izquierda, la
# Sí/No como barra apilada con su leyenda debajo, y la escala con su columna Top Two Box y «N = 39» sobre el extremo
# derecho de la barra. Las dos barras miden lo mismo y arrancan donde arranca toda barra de escala del informe
# (`.std_geom("likert")`), y el rótulo del box queda más arriba que la N: no se tocan.

#' Dibuja la Sí/No y su escala dependiente como dos filas de escala del estándar
#'
#' @param d Piezas de la dicotomía (`.lam_filtro_sub_dico()`): `rotulos`, `cifras`, `largos`, `colores`.
#' @param s Espec de la escala dependiente (una fila).
#' @param n_encima «N = 77» o `NULL`.
#' @param publico_f «120 respuestas» del filtro (`mostrar_respuestas`), o `NULL`.
#' @return Invisible, la `y` donde termina lo dibujado.
#' @keywords internal
.lam_filtro_sub_como_conta <- function(lz, espec, d, s, n_encima = NULL, publico_f = NULL) {
  g_ <- .std_geom; L <- g_("likert"); W <- g_("ancho")
  azul <- .std_color("azul"); g <- .std_grosor(1L, "escala_apilada")
  xb <- L$x_barra; cb <- .lam_escala_columnas_box(s); wb <- cb$ancho_barra
  # El rótulo corto del analista («Participaron», p192) va en la columna del público, como «Docentes» en Contabilidad.
  rot <- trimws(as.character(espec$rotulo %||% "")[1]); con_rot <- !is.na(rot) && nzchar(rot)
  wp <- (if (con_rot) L$x_actor else L$x_barra) - L$x_premisa - 0.2
  fila <- function(texto, yb, nota = NULL, actor = NULL) {   # la premisa a la izquierda, centrada con su barra
    hp <- .lam_alto_premisa_txt(texto, wp); hn <- if (is.null(nota)) 0 else 0.26
    yt <- yb + g / 2 - (hp + hn) / 2
    .lam_txt(lz, texto, L$x_premisa, yt, wp, hp, .std_pt("pregunta"), azul, bold = TRUE, align = "center", nombre = "premisa")   # centrada, como Contabilidad
    if (!is.null(nota)) .lam_txt(lz, nota, L$x_premisa, yt + hp - 0.04, wp, 0.26, .std_pt("n"), .std_color("texto_tenue"), nombre = "respuestas")
    if (!is.null(actor)) .lam_txt(lz, actor, L$x_actor, yb + g / 2 - 0.15, L$x_barra - L$x_actor - 0.1, 0.3, .std_pt("actor"), azul,
                                  bold = TRUE, align = "right", nombre = "escala:rotulo_fila")
    hp + hn
  }
  # Sí/No: barra apilada con las cifras en blanco dentro (G8) y su leyenda centrada en la lámina.
  y1 <- g_("zona_datos_y0") + 0.6
  hp1 <- fila(espec$pregunta_filtro, y1, nota = publico_f)
  lg <- d$largos[1:2]
  seg <- data.frame(ancho = lg / sum(lg), cifra = d$cifras[1:2], color = d$colores[1:2], dibujar = lg > 0, blanca = TRUE,
                    stringsAsFactors = FALSE)
  .lam_barra_apilada(lz, xb, y1, wb, seg, g)
  .lam_leyenda(lz, y1 + g + .std_comp("escala", "aire_leyenda_fila"), d$rotulos[1:2], d$colores[1:2], centrar_en = W / 2)
  # La escala dependiente, con el aire de Contabilidad entre las dos filas (~2,8 in de barra a barra en su lámina 34;
  # aquí 2,5 para dejarle sitio al pie).
  y2 <- max(y1 + 2.5, y1 + g / 2 + hp1 / 2 + 1.2)
  fila(espec$pregunta_sub, y2, actor = if (con_rot) rot)
  desde <- length(lz$cajas)
  .lam_barra_apilada(lz, xb, y2, wb, .lam_escala_seg(s, 1L), g)
  if (!is.null(n_encima)) .lam_n_encima_barra(lz, n_encima, xb + wb, y2, desde = desde)
  for (cc in cb$cols) {
    .lam_txt(lz, cc$rotulo, cc$x, y2 - .std_comp("escala", "rotulo_box_sobre"), cb$ancho_col, 0.26, .std_pt("rotulo_top_two_box"), cc$color, bold = TRUE,
             align = "center", nombre = paste0(cc$prefijo, ":rotulo"))
    .lam_etiqueta_box(lz, s, cc$x, y2, g, 1L, con_n = FALSE, caja = cc$caja, color = cc$color, w = cb$ancho_col, prefijo = cc$prefijo)
  }
  ley <- s$leyenda %||% seq_len(NROW(s$categorias))   # la leyenda de la escala, como en toda lámina de escala
  .lam_leyenda(lz, y2 + g + .std_comp("escala", "aire_leyenda_fila"), s$categorias$rotulo[ley], s$categorias$color[ley], centrar_en = W / 2)
  invisible(y2 + g + 0.45)
}
