# El KIT DE DASHBOARD del sistema Pulso PDF: paneles, KPIs, medidores y series.
#
# Existe porque estas piezas YA estaban dibujadas —el PDF telefónico tiene sus
# `rr()`, `metric_card()` y `meter()` como closures locales, y su gráfico de
# barras con línea acumulada vive suelto entre las líneas 780 y 950 de su
# renderizador—. Copiarlas a un segundo reporte era la trampa de siempre: un
# literal que gobierna la estética, duplicado, que diverge al primer retoque.
# Aquí viven una vez, con la paleta y la tipografía del kit (`pulso_pdf_theme.R`).
#
# Todas las medidas son npc de la página. **npc no es isométrico** en una hoja
# A4: un mismo número en x y en y no da el mismo milímetro. Por eso todo lo que
# tiene que salir cuadrado o circular corrige por `geo$page_w / geo$page_h`.

.ppd_num <- function(x, default = NA_real_) {
  v <- suppressWarnings(as.numeric(x))
  if (!length(v) || !is.finite(v[[1L]])) default else v[[1L]]
}

.ppd_miles <- function(x, decimales = 0L) {
  v <- .ppd_num(x)
  if (!is.finite(v)) return("-")
  formatC(round(v, decimales), big.mark = ",", format = "f", digits = decimales)
}

#' Panel redondeado: la superficie sobre la que se posa todo lo demás.
#'
#' @param x,y esquina inferior izquierda, en npc.
#' @param w,h ancho y alto en npc.
#' @param fill,col relleno y borde; `r` el radio de la esquina.
#' @export
pulso_pdf_panel <- function(x, y, w, h, tokens = pulso_pdf_tokens(),
                            fill = tokens$surface, col = tokens$tbl_frame,
                            lwd = 0.8, r = 0.012) {
  grid::grid.roundrect(x = x, y = y, width = w, height = h, just = c("left", "bottom"),
                       r = grid::unit(r, "npc"),
                       gp = grid::gpar(fill = fill, col = col, lwd = lwd))
  invisible(NULL)
}

#' Tarjeta de KPI: rótulo arriba, cifra grande, nota debajo y filete de tono.
#'
#' El filete de color NO es el único portador del significado —el rótulo y la
#' nota dicen lo mismo en palabras—, que es la regla de la casa para que una
#' impresión en blanco y negro siga leyéndose.
#'
#' @param rotulo etiqueta en versalitas.
#' @param valor la cifra, ya formateada.
#' @param nota línea de contexto bajo la cifra (opcional).
#' @param tono color del filete; por defecto el navy de marca.
#' @param destacado `TRUE` agranda la cifra: para el KPI principal de la página.
#' @export
pulso_pdf_kpi <- function(x, y, w, h, rotulo, valor, nota = "",
                          tokens = pulso_pdf_tokens(), ty = pulso_pdf_type(),
                          tono = tokens$navy, destacado = FALSE) {
  # Sin marco y con filete ARRIBA. El marco completo de la primera versión
  # encajonaba cinco tarjetas seguidas en cinco cajas y la página parecía un
  # formulario; el filete superior las agrupa como columnas de una misma franja.
  pulso_pdf_panel(x, y, w, h, tokens = tokens, fill = tokens$canvas, col = NA, r = 0.006)
  grid::grid.rect(x = x, y = y + h - 0.0032, width = w, height = 0.0032,
                  just = c("left", "bottom"), gp = grid::gpar(fill = tono, col = NA))
  pad <- 0.018
  grid::grid.text(pulso_pdf_versalitas(rotulo), x = x + pad, y = y + h - 0.030,
                  just = c("left", "top"),
                  gp = grid::gpar(col = tokens$faint, fontsize = 5.8, fontface = "bold"))
  grid::grid.text(valor, x = x + pad, y = y + (if (nzchar(nota)) 0.042 else 0.028),
                  just = c("left", "bottom"),
                  gp = grid::gpar(col = tokens$navy, fontsize = if (destacado) 26 else 18,
                                  fontface = "bold"))
  if (nzchar(nota)) {
    grid::grid.text(nota, x = x + pad, y = y + 0.020, just = c("left", "bottom"),
                    gp = grid::gpar(col = tokens$soft, fontsize = ty$caption))
  }
  invisible(NULL)
}

#' Medidor de avance: barra con el tramo cubierto y su marca de meta.
#'
#' @param valor proporción cubierta (0–1). Un valor > 1 se dibuja lleno y la
#'   cifra lo dice: el medidor no miente por recorte.
#' @export
pulso_pdf_medidor <- function(x, y, w, h, valor, tokens = pulso_pdf_tokens(),
                              tono = tokens$success, fondo = tokens$tbl_header) {
  v <- .ppd_num(valor, 0)
  grid::grid.roundrect(x = x, y = y, width = w, height = h, just = c("left", "bottom"),
                       r = grid::unit(h / 2.2, "npc"),
                       gp = grid::gpar(fill = fondo, col = NA))
  cubierto <- max(0, min(1, v))
  if (cubierto > 0) {
    grid::grid.roundrect(x = x, y = y, width = w * cubierto, height = h,
                         just = c("left", "bottom"), r = grid::unit(h / 2.2, "npc"),
                         gp = grid::gpar(fill = tono, col = NA))
  }
  invisible(NULL)
}

# --- La serie diaria --------------------------------------------------------
#
# Barras = lo que entró ese día. Línea = el acumulado. Reglas horizontales = las
# metas. Es el gráfico que pidió Gonzalo el 2026-09-11 («gráficas profesionales
# de avance diarios») y el mismo que ya usa el PDF telefónico, extraído aquí.
#
# **Dos ejes, y se dicen.** Las barras y la línea no comparten escala —un día
# bueno son 200 encuestas y el acumulado va por 1.500—, así que el eje del
# acumulado se rotula a la derecha y el del día a la izquierda. Sin esos dos
# rótulos el lector supone una sola escala y lee mal la pendiente.

.ppd_eje_bonito <- function(maximo, pasos = 4L) {
  m <- .ppd_num(maximo, 0)
  if (!is.finite(m) || m <= 0) return(c(0, 1))
  bruto <- m / pasos
  mag <- 10^floor(log10(bruto))
  paso <- c(1, 2, 2.5, 5, 10)[which.max(c(1, 2, 2.5, 5, 10) >= bruto / mag)] * mag
  seq(0, ceiling(m / paso) * paso, by = paso)
}

#' Gráfico de avance diario: barras del día + línea acumulada + metas.
#'
#' @param x,y,w,h caja del gráfico (el área de trazado, sin rótulos externos).
#' @param dias etiquetas del eje horizontal (una por punto).
#' @param diarias valores de las barras.
#' @param acumulado valores de la línea; mismo largo que `diarias`.
#' @param metas named numeric: cada entrada dibuja una regla horizontal en la
#'   escala del acumulado, rotulada con su nombre.
#' @param etiquetar_barras `TRUE` escribe la cifra encima de cada barra; con
#'   muchas barras conviene apagarlo.
#' @param compacto `TRUE` achica tipografía y grosores para los paneles
#'   pequeños (las facultades).
#' @export
pulso_pdf_serie_diaria <- function(x, y, w, h, dias, diarias, acumulado,
                                   metas = numeric(0),
                                   tokens = pulso_pdf_tokens(), ty = pulso_pdf_type(),
                                   geo = pulso_pdf_geo("landscape"),
                                   color_barra = tokens$navy,
                                   color_linea = tokens$success,
                                   etiquetar_barras = TRUE,
                                   etiquetar_acumulado = TRUE,
                                   compacto = FALSE,
                                   rotulos_eje = TRUE) {
  n <- length(dias)
  if (!n) return(invisible(NULL))
  diarias <- as.numeric(diarias); acumulado <- as.numeric(acumulado)
  # En panel pequeño el cuerpo baja a 4,6: con 5,2 la cifra del día y la del
  # acumulado se tocaban en las facultades donde ambas series van juntas.
  fs <- if (compacto) 4.6 else ty$caption
  metas <- metas[is.finite(metas)]

  # El tope del acumulado incluye las metas: una meta fuera de la caja no se ve
  # y el lector cree que se alcanzó.
  tope_acu <- max(c(acumulado[is.finite(acumulado)], metas, 1), na.rm = TRUE)
  eje_acu <- .ppd_eje_bonito(tope_acu)
  tope_acu <- max(eje_acu)
  # Las barras se quedan en la mitad inferior de la caja. No es maquillaje: las
  # dos series comparten el rectángulo y sin este aire la barra más alta tapa la
  # línea del acumulado, que es la que responde la pregunta del documento. El
  # eje de la izquierda sigue rotulando los valores verdaderos.
  eje_dia <- .ppd_eje_bonito(max(c(diarias[is.finite(diarias)], 1), na.rm = TRUE))
  tope_dia <- max(eje_dia) * 1.85

  # **Estas tres son VECTORIZADAS a propósito.** La primera versión las escribió
  # con `.ppd_num()`, que devuelve el primer elemento, así que `py_acu(acumulado)`
  # daba UN número y la línea del acumulado salía perfectamente plana: tres días
  # con 329, 642 y 1.063 dibujados a la misma altura. El gráfico se generaba sin
  # error y sólo se ve mirándolo.
  px <- function(i) x + w * ((i - 0.5) / n)
  escala <- function(v, tope) {
    u <- suppressWarnings(as.numeric(v)); u[!is.finite(u)] <- 0
    y + h * (u / tope)
  }
  py_dia <- function(v) escala(v, tope_dia)
  py_acu <- function(v) escala(v, tope_acu)

  # Rejilla: en la escala del ACUMULADO, que es la que se lee contra las metas.
  for (v in eje_acu) {
    grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(py_acu(v), "npc"),
                     gp = grid::gpar(col = tokens$rule, lwd = 0.4, lty = if (v == 0) 1 else 3))
    if (rotulos_eje) {
      grid::grid.text(.ppd_miles(v), x = x + w + 0.006, y = py_acu(v), just = c("left", "centre"),
                      gp = grid::gpar(col = tokens$faint, fontsize = fs))
    }
  }
  # El eje de la izquierda —el del día— sólo en el gráfico grande. En un panel
  # de small multiple los dos ejes caen a menos de un centímetro uno del otro y
  # se pisan: se vio en la primera corrida, con un «30» montado sobre un «20».
  # El panel pequeño se lee por su forma y por su rótulo, no por sus ejes.
  if (rotulos_eje && !isTRUE(compacto)) {
    for (v in eje_dia[-1]) {
      grid::grid.text(.ppd_miles(v), x = x - 0.006, y = py_dia(v), just = c("right", "centre"),
                      gp = grid::gpar(col = tokens$faint, fontsize = fs))
    }
  }

  # Cada cuántos puntos se rotula. Se rotula uno de cada `salto` y SIEMPRE el
  # último, que es el que se busca. En la caja grande caben veinte cifras sin
  # tocarse; en un panel de small multiple, ocho.
  tope_rotulos <- if (compacto) 8L else 20L
  salto <- max(1L, ceiling(n / tope_rotulos))
  se_rotula <- function(i) (i - 1L) %% salto == 0L || i == n

  # **En panel pequeño, la cifra del día sólo si la serie es corta.** Con quince
  # jornadas, PSICOLOGÍA salía con quince «1» dentro de quince barras: quince
  # dígitos que no dicen nada y tapan la única línea que sí. El acumulado se
  # rotula siempre, porque es la curva que responde la pregunta del panel.
  if (isTRUE(compacto) && n > 6L) etiquetar_barras <- FALSE

  ancho_barra <- min((w / n) * 0.56, if (compacto) 0.022 else 0.052)
  alto_texto <- fs * 0.0022
  altos <- numeric(n)
  for (i in seq_len(n)) {
    v <- .ppd_num(diarias[[i]], 0)
    if (v <= 0) next
    alto_barra <- h * (v / tope_dia)
    altos[[i]] <- alto_barra
    grid::grid.rect(x = px(i), y = y, width = ancho_barra, height = alto_barra,
                    just = c("centre", "bottom"),
                    gp = grid::gpar(fill = color_barra, col = NA, alpha = 0.88))
    if (!etiquetar_barras || !se_rotula(i)) next
    # **La cifra del día va DENTRO de la barra cuando cabe.** Encima competía
    # con la cifra del acumulado, que pasa por ahí mismo: dos números casi
    # pegados y ninguno pertenece visiblemente a su serie. Dentro de la barra
    # pertenece a la barra, sin flecha ni leyenda que lo explique.
    if (alto_barra > alto_texto * 2.6) {
      # El punto del acumulado se posa justo en el borde alto de la barra
      # cuando el día es el primero de la serie: la cifra del día quedaba
      # tapada por el círculo. Se baja un renglón dentro de la misma barra.
      y_rotulo <- y + alto_barra - alto_texto * 0.9
      y_punto <- py_acu(acumulado[[i]])
      choca <- is.finite(y_punto) && abs(y_punto - y_rotulo) < alto_texto * 1.4
      if (choca && alto_barra > alto_texto * 4.2) y_rotulo <- y_rotulo - alto_texto * 1.8
      grid::grid.text(.ppd_miles(v), x = px(i), y = y_rotulo,
                      just = c("centre", "top"),
                      gp = grid::gpar(col = tokens$surface, fontsize = fs, fontface = "bold"))
    } else {
      grid::grid.text(.ppd_miles(v), x = px(i), y = y + alto_barra + 0.008,
                      just = c("centre", "bottom"),
                      gp = grid::gpar(col = color_barra, fontsize = fs, fontface = "bold"))
    }
  }

  # Las metas, con su rótulo pegado a la regla: una línea sin nombre obliga a
  # buscar la leyenda.
  if (length(metas)) {
    for (k in seq_along(metas)) {
      yy <- py_acu(metas[[k]])
      if (yy > y + h) next
      grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(yy, "npc"),
                       gp = grid::gpar(col = tokens$danger, lwd = 0.9, lty = 2))
      nombre <- names(metas)[[k]] %||% ""
      if (nzchar(nombre)) {
        arriba <- yy < y + h - 0.030
        grid::grid.text(paste0(nombre, " ", .ppd_miles(metas[[k]])),
                        x = x + 0.008, y = yy + (if (arriba) 0.009 else -0.009),
                        just = c("left", if (arriba) "bottom" else "top"),
                        gp = grid::gpar(col = tokens$danger, fontsize = fs, fontface = "bold"))
      }
    }
  }

  vivos <- which(is.finite(acumulado))
  if (length(vivos) >= 2L) {
    grid::grid.lines(x = grid::unit(px(vivos), "npc"), y = grid::unit(py_acu(acumulado[vivos]), "npc"),
                     gp = grid::gpar(col = color_linea, lwd = if (compacto) 1.2 else 1.9))
  }
  if (length(vivos)) {
    # Corrección de aspecto para que el punto sea REDONDO en una hoja apaisada.
    r <- if (compacto) 0.0035 else 0.0055
    grid::grid.circle(x = px(vivos), y = py_acu(acumulado[vivos]),
                      r = grid::unit(r, "npc"),
                      gp = grid::gpar(fill = color_linea, col = tokens$surface, lwd = 0.6))
    # El acumulado dice su cifra sobre el punto y en el color de su serie: sin
    # ella el lector ve la pendiente pero no sabe por cuánto va el campo en
    # ninguna jornada salvo la última, y ni siquiera en ésa (Gonzalo,
    # 2026-09-11: «falta el acumulado de cada día»).
    if (etiquetar_acumulado) {
      for (i in vivos) {
        if (!se_rotula(i)) next
        yy <- py_acu(acumulado[[i]])
        # **El rótulo esquiva la barra POR EL COSTADO.** Encima del punto caía
        # dentro del relleno navy —verde sobre azul oscuro, ilegible— porque la
        # línea del acumulado cruza las barras: las dos series comparten caja y
        # sólo la escala las separa. Al lado del punto siempre hay papel blanco,
        # salvo al borde derecho, donde se pasa al otro lado.
        dentro <- yy < y + altos[[i]] + alto_texto
        if (dentro) {
          margen <- ancho_barra / 2 + 0.005
          ancho_txt <- nchar(.ppd_miles(acumulado[[i]])) * fs * 0.00085
          cabe_der <- px(i) + margen + ancho_txt < x + w
          cabe_izq <- px(i) - margen - ancho_txt > x
          if (cabe_der || cabe_izq) {
            grid::grid.text(.ppd_miles(acumulado[[i]]),
                            x = px(i) + (if (cabe_der) margen else -margen), y = yy,
                            just = c(if (cabe_der) "left" else "right", "centre"),
                            gp = grid::gpar(col = color_linea, fontsize = fs, fontface = "bold"))
          } else {
            # Sin papel a los lados, por encima de la barra: es el único sitio
            # donde no se pisa con nada.
            grid::grid.text(.ppd_miles(acumulado[[i]]), x = px(i),
                            y = y + altos[[i]] + alto_texto * 1.6, just = c("centre", "bottom"),
                            gp = grid::gpar(col = color_linea, fontsize = fs, fontface = "bold"))
          }
        } else {
          arriba <- yy < y + h - 0.028
          grid::grid.text(.ppd_miles(acumulado[[i]]), x = px(i),
                          y = yy + (if (arriba) r + 0.006 else -(r + 0.006)),
                          just = c("centre", if (arriba) "bottom" else "top"),
                          gp = grid::gpar(col = color_linea, fontsize = fs, fontface = "bold"))
        }
      }
    }
  }

  if (rotulos_eje) {
    cada <- max(1L, ceiling(n / (if (compacto) 5L else 14L)))
    for (i in seq_len(n)) {
      if ((i - 1L) %% cada != 0L && i != n) next
      grid::grid.text(dias[[i]], x = px(i), y = y - 0.012, just = c("centre", "top"),
                      gp = grid::gpar(col = tokens$soft, fontsize = fs))
    }
  }
  grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(y, "npc"),
                   gp = grid::gpar(col = tokens$tbl_frame, lwd = 0.7))
  invisible(NULL)
}

#' Leyenda horizontal de series (una muestra de color + su nombre).
#' @export
pulso_pdf_leyenda <- function(x, y, entradas, tokens = pulso_pdf_tokens(),
                              ty = pulso_pdf_type(), fontsize = NULL) {
  fs <- fontsize %||% ty$caption
  cx <- x
  for (k in seq_along(entradas)) {
    e <- entradas[[k]]
    forma <- e$forma %||% "barra"
    if (identical(forma, "contorno")) {
      grid::grid.rect(x = cx, y = y, width = 0.014, height = 0.012,
                      just = c("left", "centre"),
                      gp = grid::gpar(fill = NA, col = e$color, lwd = 0.8))
    } else if (identical(forma, "linea")) {
      grid::grid.lines(x = grid::unit(c(cx, cx + 0.020), "npc"), y = grid::unit(y, "npc"),
                       gp = grid::gpar(col = e$color, lwd = 1.8, lty = e$lty %||% 1))
    } else {
      grid::grid.rect(x = cx, y = y, width = 0.014, height = 0.012,
                      just = c("left", "centre"), gp = grid::gpar(fill = e$color, col = NA))
    }
    grid::grid.text(e$texto, x = cx + 0.026, y = y, just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$soft, fontsize = fs))
    cx <- cx + 0.030 + (nchar(e$texto) * fs * 0.00085) + 0.020
  }
  invisible(NULL)
}

#' Barra apilada horizontal de dos tramos (p. ej. el reparto por sexo).
#' @export
pulso_pdf_barra_partida <- function(x, y, w, h, valores, colores, rotulos = NULL,
                                    tokens = pulso_pdf_tokens(), ty = pulso_pdf_type()) {
  v <- suppressWarnings(as.numeric(valores)); v[!is.finite(v)] <- 0
  total <- sum(v)
  if (total <= 0) return(invisible(NULL))
  cx <- x
  for (k in seq_along(v)) {
    ww <- w * (v[[k]] / total)
    if (ww <= 0) next
    grid::grid.rect(x = cx, y = y, width = ww, height = h, just = c("left", "bottom"),
                    gp = grid::gpar(fill = colores[[k]], col = NA))
    if (!is.null(rotulos) && ww > 0.055) {
      grid::grid.text(rotulos[[k]], x = cx + ww / 2, y = y + h / 2, just = c("centre", "centre"),
                      gp = grid::gpar(col = "#ffffff", fontsize = ty$caption, fontface = "bold"))
    }
    cx <- cx + ww
  }
  invisible(NULL)
}

# --- Barras contra su meta ---------------------------------------------------
#
# El gráfico que ya usa la app en «Metas por facultad»: por cada categoría, un
# carril por serie; el carril entero es la meta (contorno) y lo conseguido va
# relleno dentro, con su porcentaje encima. Se lee sin leyenda de valores: el
# hueco que queda arriba ES lo que falta.
#
# **La escala la fija el llamador**, con `tope`, y no cada fila: dos filas de
# facultades con escalas distintas harían que la misma altura significara cosas
# distintas, que es justo lo que el gráfico viene a evitar.

#' Barras de conseguido dentro de su meta, agrupadas por categoría.
#'
#' @param x,y,w,h caja de trazado.
#' @param categorias etiquetas del eje (una por grupo).
#' @param series lista de `list(nombre=, color=, meta=, valor=)`, cada `meta` y
#'   `valor` un vector del largo de `categorias`.
#' @param tope valor máximo del eje vertical, común a todas las llamadas.
#' @param etiqueta_pct `TRUE` escribe el porcentaje sobre cada carril.
#' @export
pulso_pdf_barras_meta <- function(x, y, w, h, categorias, series, tope,
                                  tokens = pulso_pdf_tokens(), ty = pulso_pdf_type(),
                                  etiqueta_pct = TRUE, fontsize = NULL,
                                  rejilla = numeric(0)) {
  n <- length(categorias)
  if (!n || !length(series)) return(invisible(NULL))
  fs <- fontsize %||% ty$caption
  tope <- .ppd_num(tope, 1); if (!is.finite(tope) || tope <= 0) tope <- 1
  alto <- function(v) h * (pmin(pmax(.ppd_vec(v), 0), tope) / tope)

  for (v in rejilla) {
    yy <- y + h * (v / tope)
    if (yy > y + h) next
    grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(yy, "npc"),
                     gp = grid::gpar(col = tokens$rule, lwd = 0.4, lty = 3))
    grid::grid.text(.ppd_miles(v), x = x - 0.006, y = yy, just = c("right", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = fs))
  }

  paso <- w / n
  k <- length(series)
  # El hueco entre carriles de un mismo grupo es la mitad del que separa grupos:
  # así se ve de un golpe qué par pertenece a qué facultad.
  ancho_carril <- (paso * 0.62) / k
  for (i in seq_len(n)) {
    centro <- x + paso * (i - 0.5)
    for (j in seq_len(k)) {
      s <- series[[j]]
      cx <- centro + (j - (k + 1) / 2) * (ancho_carril * 1.12)
      meta <- .ppd_vec(s$meta)[[i]]; valor <- .ppd_vec(s$valor)[[i]]
      h_meta <- alto(meta); h_val <- alto(valor)
      if (is.finite(h_meta) && h_meta > 0) {
        grid::grid.rect(x = cx, y = y, width = ancho_carril, height = h_meta,
                        just = c("centre", "bottom"),
                        gp = grid::gpar(fill = tokens$surface, col = s$color, lwd = 0.7))
      }
      # **El relleno NO pasa del contorno, aunque se haya superado la meta.**
      # Una facultad puede cerrar en 123 % —pasa, y es buena noticia— pero un
      # relleno que se sale de su carril se monta sobre el rótulo del vecino y
      # rompe la comparación entre carriles, que es lo único que este gráfico
      # hace. El exceso se dice donde sí cabe decirlo: el porcentaje de encima
      # escribe el 123 % completo (Gonzalo, 2026-09-11).
      if (is.finite(h_val) && h_val > 0) {
        h_pintado <- .ppd_alto_relleno(h_val, h_meta)
        grid::grid.rect(x = cx, y = y, width = ancho_carril, height = h_pintado,
                        just = c("centre", "bottom"),
                        gp = grid::gpar(fill = s$color, col = NA))
        # Un carril lleno se remata con un filete para que «lleno» y «lleno y de
        # sobra» no se vean idénticos.
        if (is.finite(h_meta) && h_val > h_meta) {
          grid::grid.rect(x = cx, y = y + h_meta, width = ancho_carril, height = 0.0035,
                          just = c("centre", "bottom"),
                          gp = grid::gpar(fill = tokens$success, col = NA))
        }
      }
      if (isTRUE(etiqueta_pct) && is.finite(meta) && meta > 0) {
        pct <- valor / meta
        grid::grid.text(sprintf("%.0f%%", pct * 100), x = cx,
                        y = y + max(h_meta, h_val) + 0.010, just = c("centre", "bottom"),
                        gp = grid::gpar(col = s$color, fontsize = fs, fontface = "bold"))
      }
    }
  }

  grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(y, "npc"),
                   gp = grid::gpar(col = tokens$tbl_frame, lwd = 0.7))
  for (i in seq_len(n)) {
    .form_pdf_text(categorias[[i]], x = x + paso * (i - 1) + paso * 0.06,
                   y = y - 0.010, w = paso * 0.88,
                   chars = pulso_pdf_chars(paso * 0.88, factor = 128),
                   fontsize = fs, col = tokens$soft, line_h = 0.017)
  }
  invisible(NULL)
}

.ppd_vec <- function(x) {
  v <- suppressWarnings(as.numeric(x)); v[!is.finite(v)] <- NA_real_; v
}

# El alto que se PINTA dentro de un carril. Regla dictada por Gonzalo el
# 2026-09-11: «a veces el 100 % puede sobrepasar, como 123 % por ejemplo, pero
# la barra debe quedarse en 100 %». Vive aparte de la función de dibujo porque
# es la regla, no el trazo, y una regla se verifica.
.ppd_alto_relleno <- function(alto_valor, alto_meta) {
  if (!length(alto_meta) || !is.finite(alto_meta[[1L]]) || alto_meta[[1L]] <= 0) {
    return(alto_valor)
  }
  min(alto_valor, alto_meta[[1L]])
}

#' Barra de progreso en línea, para una celda de tabla.
#' @export
pulso_pdf_barra_progreso <- function(x, y, w, h, valor, tokens = pulso_pdf_tokens(),
                                     color = tokens$navy, fondo = tokens$tbl_zebra) {
  v <- .ppd_num(valor, 0)
  grid::grid.rect(x = x, y = y, width = w, height = h, just = c("left", "bottom"),
                  gp = grid::gpar(fill = fondo, col = tokens$rule, lwd = 0.35))
  cubierto <- max(0, min(1, v))
  if (cubierto > 0) {
    grid::grid.rect(x = x, y = y, width = w * cubierto, height = h, just = c("left", "bottom"),
                    gp = grid::gpar(fill = color, col = NA))
  }
  invisible(NULL)
}

# --- Tipografía editorial ----------------------------------------------------
#
# `grid` no tiene letter-spacing. Un rótulo en versalitas sin aire entre letras
# se lee apelmazado y es justo lo que separa un documento que parece hecho por
# un motor de uno que parece compuesto. Se consigue intercalando un espacio fino
# entre caracteres: es el mismo truco de la composición en plomo, y se aplica
# SÓLO a rótulos cortos en mayúsculas, nunca a texto corrido.

#' Aire entre letras para un rótulo corto en versalitas.
#' @export
pulso_pdf_versalitas <- function(x, aire = " ") {
  txt <- toupper(trimws(as.character(x %||% "")[[1L]]))
  if (!nzchar(txt) || nchar(txt) > 48L) return(txt)
  paste(strsplit(txt, "", fixed = TRUE)[[1L]], collapse = aire)
}

#' Cromo de página: antetítulo, título de sección, bajada y la regla doble.
#'
#' Sustituye a `pulso_pdf_header()` en los documentos de cliente. La diferencia
#' es la REGLA DOBLE: un segmento corto y grueso en navy bajo el título, y la
#' hairline clara que cruza la página entera. Una sola línea de punta a punta
#' parte la hoja en dos; el segmento corto ancla el bloque de título y la
#' hairline sólo separa.
#' @export
pulso_pdf_cromo <- function(antetitulo, titulo, subtitulo = "",
                            tokens = pulso_pdf_tokens(), ty = pulso_pdf_type(),
                            geo = pulso_pdf_geo("landscape"), derecha = "") {
  m <- geo$margin; right <- 1 - m
  if (nzchar(antetitulo %||% "")) {
    grid::grid.text(pulso_pdf_versalitas(antetitulo), x = m, y = 0.955,
                    just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = 6.0, fontface = "bold"))
  }
  if (nzchar(derecha %||% "")) {
    grid::grid.text(pulso_pdf_versalitas(derecha), x = right, y = 0.955,
                    just = c("right", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = 6.0, fontface = "bold"))
  }
  grid::grid.text(titulo, x = m, y = 0.905, just = c("left", "centre"),
                  gp = grid::gpar(col = tokens$navy, fontsize = 16.5, fontface = "bold"))
  if (nzchar(subtitulo %||% "")) {
    grid::grid.text(subtitulo, x = m, y = 0.868, just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$soft, fontsize = 9))
  }
  y_regla <- 0.845
  grid::grid.lines(x = grid::unit(c(m, right), "npc"), y = grid::unit(y_regla, "npc"),
                   gp = grid::gpar(col = tokens$line, lwd = 0.6))
  grid::grid.lines(x = grid::unit(c(m, m + 0.052), "npc"), y = grid::unit(y_regla, "npc"),
                   gp = grid::gpar(col = tokens$navy, lwd = 2.2))
  invisible(NULL)
}

#' Pie de documento de cliente: hairline, marca, periodo y folio «03 / 09».
#' @export
pulso_pdf_pie <- function(pagina, de = NA_integer_, periodo = "",
                          tokens = pulso_pdf_tokens(), ty = pulso_pdf_type(),
                          geo = pulso_pdf_geo("landscape")) {
  m <- geo$margin; right <- 1 - m
  grid::grid.lines(x = grid::unit(c(m, right), "npc"), y = grid::unit(0.068, "npc"),
                   gp = grid::gpar(col = tokens$line, lwd = 0.6))
  .pulso_pdf_draw_logo(m, 0.036, width_npc = 0.098, geo = geo, tokens = tokens)
  if (nzchar(periodo)) {
    grid::grid.text(periodo, x = 0.5, y = 0.036, just = c("centre", "centre"),
                    gp = grid::gpar(fontsize = 7.2, col = tokens$faint))
  }
  # Folio con el total: «03 / 09» dice cuánto queda; «Pág. 3» no.
  folio <- if (is.finite(de)) {
    sprintf("%02d / %02d", as.integer(pagina), as.integer(de))
  } else sprintf("%02d", as.integer(pagina))
  grid::grid.text(folio, x = right, y = 0.036, just = c("right", "centre"),
                  gp = grid::gpar(fontsize = 7.6, col = tokens$soft, fontface = "bold"))
  invisible(NULL)
}

#' Rótulo de sección dentro de una página: versalitas con aire, regla corta y
#' una bajada opcional.
#'
#' No compite con el título de página: es del tamaño de un pie, no de un titular.
#' Un segundo titular grande en la misma hoja obliga al lector a decidir cuál
#' manda.
#' @export
pulso_pdf_rotulo_seccion <- function(x, y, texto, bajada = "", ancho = 0.10,
                                     tokens = pulso_pdf_tokens(), ty = pulso_pdf_type()) {
  grid::grid.text(pulso_pdf_versalitas(texto), x = x, y = y, just = c("left", "bottom"),
                  gp = grid::gpar(col = tokens$navy, fontsize = 7.0, fontface = "bold"))
  grid::grid.lines(x = grid::unit(c(x, x + ancho), "npc"), y = grid::unit(y - 0.012, "npc"),
                   gp = grid::gpar(col = tokens$navy, lwd = 1.1))
  if (nzchar(bajada)) {
    grid::grid.text(bajada, x = x, y = y - 0.030, just = c("left", "bottom"),
                    gp = grid::gpar(col = tokens$faint, fontsize = ty$caption))
  }
  invisible(NULL)
}
