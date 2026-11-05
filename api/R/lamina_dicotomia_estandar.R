# lamina_dicotomia_estandar.R — estilo `barra_estandar` de la dicotómica (Renzo, informe Arte, 2026-10-22)
#
# El motor dibujaba toda pregunta de dos opciones que reparte el 100 % como `dicotomia` (barra partida con cifras de 22/40
# pt encima, `.lam_dicotomia`). Desde la revisión v7.23 (ítem 11) el único estilo es `barra_estandar`: una barra
# normal de 100 % partida en sus dos segmentos, con el porcentaje DENTRO de cada segmento (en blanco en los dos, G8 de
# Arte 2026-10-28; fuera del segmento, el azul de la casa), a 14 pt (`.std_pt("cifra")`) y con leyenda. En el Word, sin
# «(n)» ni base: la leyenda nombra las opciones y nada más.
#
# Cómo se elige (el slot gana al informe, el informe al defecto):
#   - slot:    `overrides$estilo_dicotomia` del gráfico (`p_dicotomica(estilo = "barra_estandar")`), copiado a la espec;
#   - informe: `presets$base$args$estilo_dicotomia`, que las entradas del PPT y del Word fijan en la opción
#              `prosecnur.estilo_dicotomia` durante el render (`.casos_junto_fijar`, mismo patrón que «Casos junto»).

.ESTILOS_DICOTOMIA <- c("partida", "barra_estandar")

#' Estilo vigente de una dicotomía: siempre `barra_estandar`
#'
#' Revisión del PPT v7.23 de CCSS, ítem 11 (Gonzalo: «pensé que el gráfico dicotómico ya había desaparecido; aquí debe
#' haber un gráfico apilado clásico»): decisión de identidad del mazo, no de una lámina. Ninguna franja dicotómica: una
#' pregunta de dos opciones va como barra apilada clásica, con las cifras dentro y su leyenda, como las demás apiladas
#' (en lámina sola, en ranura y en el Word, que ya la dibujaba así, N5). Un plan que todavía declara `partida` (en el slot
#' o en el informe) se lee como `barra_estandar`; el valor sigue siendo válido para no romper los planes guardados.
#' La barra partida (`.lam_dicotomia`) queda sólo como pieza del recetario, sin uso en el mazo.
#' @keywords internal
.lam_estilo_dicotomia <- function(espec) "barra_estandar"
`%|NA|%` <- function(a, b) if (is.na(a)) b else a

#' Copia a la espec el estilo que el slot pidió en sus overrides (el slot gana al informe)
#' @keywords internal
.lam_con_estilo_dicotomia <- function(espec, el) {
  est <- (el$overrides %||% list())$estilo_dicotomia
  if (is.list(espec) && !is.null(est) && length(est)) espec$estilo_dicotomia <- as.character(est)[1]
  if (is.list(espec) && isTRUE((el$overrides %||% list())$dicotomica_declarada)) espec$dicotomica_declarada <- TRUE   # N20
  espec
}

#' ¿Las dos categorías de la espec son Sí/No (o Verdadero/Falso)? La dicotomía es solo para ellas (N20)
#'
#' Una nominal de dos categorías (dedicación, sexo, «Pertenece a») es una variable como las demás y va en barras. Compara
#' los rótulos sin tildes, en minúsculas y sin «(n)» ni espacios. El analista que quiere la pieza para otro par la declara
#' con `p_dicotomica()` (`espec$dicotomica_declarada`).
#' @keywords internal
.lam_dicotomia_es_sino <- function(espec) {
  if (is.null(espec)) return(FALSE)
  if (isTRUE(espec$dicotomica_declarada)) return(TRUE)
  rot <- if (identical(espec$tipo, "escala")) {
    propias <- which(!(espec$categorias$especial %in% TRUE))
    as.character(espec$categorias$rotulo[propias])
  } else as.character(espec$rotulos)
  if (length(rot) != 2L) return(FALSE)
  norm <- gsub("[^a-z]", "", chartr("áéíóúü", "aeiouu", tolower(gsub("\\([^)]*\\)", "", rot))))
  all(grepl("^(si|no|verdadero|falso|true|false)$", norm)) && !identical(norm[1], norm[2])
}

#' Fija la opción del render con el estilo que declara el informe; sin declaración no toca nada
#' @return Las opciones anteriores, para `on.exit(options(...))`.
#' @keywords internal
.estilo_dicotomia_fijar <- function(presets) {
  declarado <- presets$base$args$estilo_dicotomia %||% presets$base$estilo_dicotomia
  if (is.null(declarado)) return(list())
  declarado <- as.character(declarado)[1]
  if (is.na(declarado) || !declarado %in% .ESTILOS_DICOTOMIA) {
    warning("`estilo_dicotomia` del informe no es válido («", declarado, "»); se usa «partida». Opciones: ",
            paste(.ESTILOS_DICOTOMIA, collapse = ", "), ".", call. = FALSE)
    return(list())
  }
  options(prosecnur.estilo_dicotomia = declarado)
}

#' Dicotomía como barra normal: un solo 100 % partido en dos segmentos con su porcentaje dentro, y la leyenda debajo
#'
#' @param centro_ley Centro de la leyenda (la lámina completa la centra a toda la lámina, no a la barra).
#' @param x_ley,w_ley Límites entre los que puede moverse la leyenda (el panel, si la barra es más angosta que él).
#' @param g Grosor de la barra (in); `size` el tamaño del porcentaje (pt, el estándar de la cifra).
#' @return El `y` donde terminó lo dibujado.
#' @keywords internal
.lam_dicotomia_estandar <- function(lz, x, y, w, rotulos, cifras, largos, n = NULL, g = 0.34, size = .std_pt("cifra"),
                                    cols = .std_paleta("dicotomica"), x_ley = x, w_ley = w, centro_ley = x + w / 2) {
  cols <- as.character(cols)[1:2]
  etq <- if (is.null(n) || any(!is.finite(n[1:2]))) rotulos[1:2] else sprintf("%s (%d)", rotulos[1:2], as.integer(n[1:2]))
  w1 <- w * largos[1] / sum(largos[1:2])
  .lam_caja(lz, x, y, w1 + 0.004, g, cols[1], nombre = "barra:segmento")
  .lam_caja(lz, x + w1, y, w - w1, g, cols[2], nombre = "barra:segmento")
  hv <- size * 1.2 / 72 + 0.1
  seg <- list(c(x, w1), c(x + w1, w - w1))
  for (k in 1:2) {
    ancho_txt <- .lam_ancho_txt(cifras[k], size, TRUE) + 0.2
    if (seg[[k]][2] >= ancho_txt) {
      # G8 (Gabriela, Arte 2026-10-28: «mejor colocar todo en color blanco»): dentro de su segmento la cifra va en blanco
      # en los dos, también sobre el celeste del «No», como Contabilidad; la que sale fuera conserva el azul legible.
      .lam_txt(lz, cifras[k], seg[[k]][1], y + (g - hv) / 2, seg[[k]][2], hv, size, "#FFFFFF", bold = TRUE,
               align = "center", nombre = "barra:cifra")
    } else {
      # Segmento más angosto que su cifra: el porcentaje no cabe dentro, va sobre el segmento en el azul de la casa.
      .lam_txt(lz, cifras[k], seg[[k]][1] + seg[[k]][2] / 2 - ancho_txt / 2, y - hv, ancho_txt, hv, size, .std_color("azul"),
               bold = TRUE, align = "center", nombre = "barra:cifra")
    }
  }
  .lam_leyenda_panel(lz, y + g + 0.12, etq, cols, centro = centro_ley, x0 = x_ley, x1 = x_ley + w_ley)   # la leyenda se centra bajo la barra y puede ensanchar hasta el panel
}

#' La dicotomía del Word (siempre, N5): barra normal de 100 % con el porcentaje blanco dentro y la leyenda de las opciones
#' @keywords internal
.word_g_sino_estandar <- function(espec) {
  T <- .WORD_TINTA; navy <- .std_word("colores", "titulos")
  dd <- .lam_dicotomia_datos(espec)
  rot <- espec$rotulos[1:2]; cif <- dd$cifras[1:2]
  # «Casos junto al porcentaje» (`.casos_junto_decidir`, base chica < 30): la leyenda dice los casos de cada opción, como la
  # lámina del PPT («Masculino (4)»); sin la regla, o sin n, sale limpia.
  etq <- if (is.null(dd$n) || any(!is.finite(suppressWarnings(as.numeric(dd$n[1:2]))))) rot else sprintf("%s (%d)", rot, as.integer(round(as.numeric(dd$n[1:2]))))
  p1 <- espec$largos[1] / sum(espec$largos[1:2]) * 100
  col <- as.vector(.word_colores_de_espec(espec, rot, c(T$navy, T$celeste)))
  d <- data.frame(x0 = c(0, p1), x1 = c(p1, 100), k = factor(rot, levels = rot), cif = cif)
  d$cabe <- (d$x1 - d$x0) >= .WORD_ESCALA_CABE_PCT; d$xm <- (d$x0 + d$x1) / 2         # regla de cifras chicas: encima por debajo de 7 %
  hay_chicas <- any(!d$cabe)
  pub <- .word_sino_publico(espec)   # R2: el público a la izquierda, como la escala de una fila (reporte_word_publico_una_barra.R)
  g <- ggplot2::ggplot(d) + ggplot2::geom_rect(ggplot2::aes(xmin = .data$x0, xmax = .data$x1, ymin = 0, ymax = 1, fill = .data$k)) +
    ggplot2::scale_fill_manual(values = stats::setNames(col, rot), labels = etq, name = NULL) +
    ggplot2::geom_text(data = d[d$cabe, , drop = FALSE], ggplot2::aes(x = .data$xm, y = 0.5, label = .data$cif), size = .word_pt(9, "cifra"),
                       fontface = .word_cara("cifras"), colour = vapply(col[d$cabe], .lam_texto_sobre, ""), family = "Arial")
  if (hay_chicas) g <- g + ggplot2::geom_text(data = d[!d$cabe, , drop = FALSE], ggplot2::aes(x = pmin(pmax(.data$xm, 3), 97), y = 1.25, label = .data$cif),
                                              size = .word_pt(8, "cifra"), fontface = .word_cara("cifras"), colour = navy, family = "Arial")
  g <- g + pub$capa + ggplot2::scale_x_continuous(limits = if (is.null(pub)) c(0, 100) else c(pub$xmin, pub$xmax), expand = c(0, 0)) +
    ggplot2::scale_y_continuous(limits = c(0, if (hay_chicas) 1.5 else 1), expand = c(0, 0)) + .word_tema()
  .word_fijar_alto_por_grosor(g, 1)   # N25: grosor común; el eje y ya trae el aire de las cifras chicas
}
