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
                              ancho_cifra, size_texto, font_family = "") {
  if (!".sig_txt" %in% names(df_lab)) return(p)
  txt <- as.character(df_lab$.sig_txt); txt[is.na(txt)] <- ""
  con <- nzchar(txt) & nzchar(df_lab$lab) & is.finite(df_lab$.valor_plot)
  if (!any(con)) return(p)
  d <- df_lab
  chars <- pmax(1, nchar(gsub("\\s+", "", d$lab), type = "width"))
  por_caracter <- ancho_cifra / chars
  ancho_caps <- por_caracter * 0.8 * (nchar(txt, type = "width") + 1.6)
  aire <- 0.012 * base_max
  # Pegada a la cifra: dentro de la barra si la cifra va dentro y queda aire hasta el extremo; si no, tras la barra.
  tras_cifra_dentro <- d$valor_label + ancho_cifra / 2 + aire
  dentro <- d$inside & (tras_cifra_dentro + ancho_caps + aire) <= d$.valor_plot
  y <- ifelse(dentro, tras_cifra_dentro, ifelse(d$inside, d$.valor_plot + aire, d$valor_label + ancho_cifra + aire))
  hj <- rep(0, nrow(d))
  # Una cápsula que no cabe a la derecha del eje entra en la barra, pegada a su extremo.
  fuera_eje <- !dentro & (y + ancho_caps) > base_max
  y[fuera_eje] <- d$.valor_plot[fuera_eje] - aire; hj[fuera_eje] <- 1
  d$.y_caps <- y; d$.hj_caps <- hj
  # Las celdas sin marca se quedan en los datos (el dodge las necesita para ubicar las demás) pero con NA: ggplot las
  # descarta al dibujar y no deja una caja vacía.
  d$.sig_txt <- ifelse(con, txt, NA_character_)
  fragil <- con & as.logical(d$.sig_fragil %||% FALSE) %in% TRUE
  pos <- ggplot2::position_dodge(width = width_dodge, reverse = isTRUE(dodge_invertido))
  capa <- function(datos, texto, borde, tipo) {
    ggplot2::geom_label(
      data = datos,
      mapping = ggplot2::aes(x = .data[[var_categoria]], y = .data$.y_caps, label = .data$.sig_txt, group = .data$.serie,
                             hjust = .data$.hj_caps),
      inherit.aes = FALSE, position = pos, vjust = 0.5, size = size_texto * 0.8, family = font_family,
      fontface = "bold", fill = .sig_color("banda_clara", "#E3E7EF"), text.colour = texto, border.colour = borde,
      linetype = tipo, linewidth = if (identical(tipo, "solid")) 0 else 0.35,
      label.r = grid::unit(0.5, "lines"), label.padding = grid::unit(0.14, "lines"), show.legend = FALSE,
      na.rm = TRUE
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
