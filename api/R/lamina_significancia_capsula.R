# La cápsula ▲A de las diferencias significativas (propuesta §4.2 y §4.3, ADR 0128 §4)
# ===================================================================================
#
# Antes la marca viajaba como texto pegado a la cifra («44% A»): con el mismo cuerpo, el mismo peso y el mismo color,
# se fundía con ella (D3 de la propuesta). La cápsula es una pieza aparte: fondo `banda_clara`, texto `azul` a 0.8 × el
# cuerpo de la cifra, ▲ y las letras; la frágil lleva contorno punteado y texto en el azul de frágil (D4). Va detrás de
# la cifra, o dentro de la barra, en su extremo, cuando la barra tiene aire para las dos.
#
# El graficador sigue rotulando su cifra como siempre; esta capa solo agrega la cápsula con la misma posición
# (`position_dodge`) para que caiga en la barra que le corresponde. Se dibuja en ggplot, así que el PPT (rvg, editable)
# y el Word (PNG) la muestran igual.

# Azul de la frágil: ≈5.3:1 sobre el fondo de la lámina (el #4F7FAF de antes daba 3.76). Propuesta §4.3.
.SIG_COLOR_FRAGIL <- "#3A6591"

#' Color de un token del estándar, o el de reserva si el estándar no lo declara
#' @keywords internal
.sig_color <- function(nombre, reserva) tryCatch(.std_color(nombre), error = function(e) reserva)

#' Agrega la capa de cápsulas al gráfico de barras agrupadas
#'
#' @param df_lab Data frame de rótulos del graficador, con `.sig_txt` («▲AB») y `.sig_fragil` por celda.
#' @param ancho_cifra Ancho estimado de cada cifra en unidades de datos (el que el graficador ya usa para decidir si la
#'   cifra cabe dentro de la barra).
#' @keywords internal
.sig_capa_capsula <- function(p, df_lab, var_categoria, width_dodge, dodge_invertido = FALSE, base_max = 1,
                              ancho_cifra, size_texto, font_family = "", panel_in = NULL) {
  if (!".sig_txt" %in% names(df_lab)) return(p)
  txt <- as.character(df_lab$.sig_txt); txt[is.na(txt)] <- ""
  con <- nzchar(txt) & nzchar(df_lab$lab) & is.finite(df_lab$.valor_plot)
  if (!any(con)) return(p)
  d <- df_lab
  g <- .sig_capsula_geometria(d$lab, txt, size_texto, base_max, panel_in, ancho_cifra)
  # Pegada a la cifra (0.05 in): dentro de la barra si la cifra va dentro y queda aire hasta el extremo; si no, tras
  # la barra.
  tras_cifra_dentro <- d$valor_label + g$cifra / 2 + g$hueco
  dentro <- d$inside & (tras_cifra_dentro + g$capsula + g$hueco) <= d$.valor_plot
  y <- ifelse(dentro, tras_cifra_dentro, ifelse(d$inside, d$.valor_plot + g$hueco, d$valor_label + g$cifra + g$hueco))
  hj <- rep(0, nrow(d))
  # Una cápsula que no cabe a la derecha del eje entra en la barra, pegada a su extremo.
  fuera_eje <- !dentro & (y + g$capsula) > base_max
  y[fuera_eje] <- d$.valor_plot[fuera_eje] - g$hueco; hj[fuera_eje] <- 1
  d$.y_caps <- y; d$.hj_caps <- hj
  # Las celdas sin marca se quedan en los datos (el dodge las necesita para ubicar las demás) pero con NA: ggplot las
  # descarta al dibujar y no deja una caja vacía.
  d$.sig_txt <- ifelse(con, .sig_capsula_texto(txt), NA_character_)
  fragil <- con & as.logical(d$.sig_fragil %||% FALSE) %in% TRUE
  pos <- ggplot2::position_dodge(width = width_dodge, reverse = isTRUE(dodge_invertido))
  capa <- function(datos, texto, borde, tipo) {
    ggplot2::geom_label(
      data = datos,
      mapping = ggplot2::aes(x = .data[[var_categoria]], y = .data$.y_caps, label = .data$.sig_txt, group = .data$.serie,
                             hjust = .data$.hj_caps),
      inherit.aes = FALSE, position = pos, vjust = 0.5, size = g$size, family = font_family,
      fontface = "bold", fill = .sig_color("banda_clara", "#E3E7EF"), text.colour = texto, border.colour = borde,
      linetype = tipo, linewidth = if (identical(tipo, "solid")) 0 else 0.35,
      label.r = g$radio, label.padding = g$margen, show.legend = FALSE, na.rm = TRUE
    )
  }
  firmes <- d; firmes$.sig_txt[fragil] <- NA_character_
  p <- p + capa(firmes, .sig_color("azul", "#081F5C"), .sig_color("banda_clara", "#E3E7EF"), "solid")
  if (any(fragil)) {
    debiles <- d; debiles$.sig_txt[!fragil] <- NA_character_
    p <- p + capa(debiles, .SIG_COLOR_FRAGIL, .SIG_COLOR_FRAGIL, "dashed")
  }
  p
}

# Medidas de la propuesta §4.2, en pulgadas.
.SIG_CAPSULA_IN <- list(hueco = 0.05, izquierda = 0.06, derecha = 0.07, entre = 0.04)

#' Texto de la cápsula con el aire de 0.04 in entre el triángulo y las letras (un espacio fino)
#' @keywords internal
.sig_capsula_texto <- function(txt) sub("^([▲△▼▽])\\s*", "\\1\u2009", txt)

#' Geometría de la cápsula: cuerpo, márgenes, radio y anchos en unidades de datos
#'
#' Con el ancho físico del panel de barras (`panel_in`), las medidas salen en pulgadas reales: hueco de 0.05 in tras la
#' cifra, 0.06 in de margen a la izquierda y 0.07 a la derecha, alto de 1.45 × el cuerpo y radio de la mitad del alto.
#' Sin él, se usa la estimación por carácter del graficador.
#' @keywords internal
.sig_capsula_geometria <- function(cifras, txt, size_texto, base_max = 1, panel_in = NULL, ancho_cifra = NULL) {
  size_caps <- size_texto * 0.8                       # mm de ggplot
  cuerpo_pt <- size_caps * ggplot2::.pt
  alto_pt <- 1.45 * cuerpo_pt
  vertical_pt <- max(0.5, (alto_pt - cuerpo_pt) / 2)
  medidas <- .SIG_CAPSULA_IN
  margen <- ggplot2::margin(vertical_pt, medidas$derecha * 72, vertical_pt, medidas$izquierda * 72, unit = "pt")
  radio <- grid::unit(alto_pt / 2, "pt")
  panel <- suppressWarnings(as.numeric(panel_in)[1])
  if (is.finite(panel) && panel > 0) {
    por_in <- base_max / panel
    cifra_in <- tryCatch(.lam_ancho_tinta(as.character(cifras), size_texto * ggplot2::.pt, bold = TRUE),
                         error = function(e) nchar(as.character(cifras)) * size_texto * ggplot2::.pt * 0.56 / 72)
    txt_in <- tryCatch(.lam_ancho_tinta(.sig_capsula_texto(as.character(txt)), cuerpo_pt, bold = TRUE),
                       error = function(e) nchar(as.character(txt)) * cuerpo_pt * 0.56 / 72)
    return(list(size = size_caps, margen = margen, radio = radio, hueco = medidas$hueco * por_in,
                cifra = cifra_in * por_in, capsula = (txt_in + medidas$izquierda + medidas$derecha) * por_in))
  }
  chars <- pmax(1, nchar(gsub("\\s+", "", cifras), type = "width"))
  por_caracter <- ancho_cifra / chars
  list(size = size_caps, margen = margen, radio = radio, hueco = 0.012 * base_max, cifra = ancho_cifra,
       capsula = por_caracter * 0.8 * (nchar(txt, type = "width") + 1.6))
}
