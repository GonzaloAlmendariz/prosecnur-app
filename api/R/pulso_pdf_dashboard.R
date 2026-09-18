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
  # **El rótulo se parte en dos líneas antes que recortarse.** Espaciado si cabe,
  # sin espaciar si no, y en dos renglones si tampoco: «FACULTADES QUE LLEGARON
  # A LA META» no entra de una en una tarjeta estrecha, y cortarlo en
  # «FACULTADES QUE L...» deja al lector adivinando. La elipsis queda como
  # último recurso, dentro del envoltorio.
  .ppd_rotulo_envuelto(rotulo, x = x + pad, y = y + h - 0.028, w = w - 2 * pad,
                       fontsize = ty$eyebrow, col = tokens$faint)
  # **La cifra va SIEMPRE a la misma altura**, haya nota o no. Subirla cuando no
  # hay nota parece «centrar mejor» esa tarjeta y lo que hace es romper la línea
  # que forman las cinco: basta una sin nota para que su número quede a distinta
  # altura que el de al lado.
  grid::grid.text(valor, x = x + pad, y = y + 0.042, just = c("left", "bottom"),
                  gp = grid::gpar(col = tokens$navy, fontsize = if (destacado) 26 else 18,
                                  fontface = "bold"))
  if (nzchar(nota)) {
    grid::grid.text(nota, x = x + pad, y = y + 0.020, just = c("left", "bottom"),
                    gp = grid::gpar(col = tokens$soft, fontsize = ty$caption))
  }
  invisible(NULL)
}

# Versalitas que caben en `ancho`: con aire si entra, sin aire si no, y
# recortadas con elipsis ASCII si tampoco. El device PDF no tiene el U+2026.
.ppd_rotulo_que_cabe <- function(texto, ancho, fontsize) {
  txt <- pulso_pdf_versalitas(texto, ancho = ancho, fontsize = fontsize)
  tope <- max(4L, floor(ancho / (fontsize * 0.00082)))
  if (nchar(txt) <= tope) return(txt)
  paste0(substr(txt, 1L, tope - 3L), "...")
}

# Rótulo de versalitas que cabe en `w`, partiéndolo en hasta dos renglones.
# Devuelve invisible; dibuja donde se le dice, anclado arriba a la izquierda.
.ppd_rotulo_envuelto <- function(texto, x, y, w, fontsize, col, max_lineas = 2L) {
  espaciado <- pulso_pdf_versalitas(texto, ancho = w, fontsize = fontsize)
  tope <- max(4L, floor(w / (fontsize * 0.00082)))
  if (nchar(espaciado) <= tope) {
    grid::grid.text(espaciado, x = x, y = y, just = c("left", "top"),
                    gp = grid::gpar(col = col, fontsize = fontsize, fontface = "bold"))
    return(invisible(NULL))
  }
  lineas <- strwrap(toupper(texto), width = max(4L, tope))
  if (length(lineas) > max_lineas) {
    lineas <- lineas[seq_len(max_lineas)]
    ultima <- lineas[[max_lineas]]
    if (nchar(ultima) > tope - 3L) ultima <- substr(ultima, 1L, tope - 3L)
    lineas[[max_lineas]] <- paste0(ultima, "...")
  }
  for (k in seq_along(lineas)) {
    grid::grid.text(lineas[[k]], x = x, y = y - (k - 1L) * (fontsize * 0.0021),
                    just = c("left", "top"),
                    gp = grid::gpar(col = col, fontsize = fontsize, fontface = "bold"))
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
  pesos <- pulso_pdf_pesos()
  n <- length(dias)
  if (!n) return(invisible(NULL))
  diarias <- as.numeric(diarias); acumulado <- as.numeric(acumulado)
  # **El panel pequeño usa el MISMO cuerpo que el grande.** Bajarlo 1,2 pt
  # «porque es pequeño» es lo que hacía que las cifras de las facultades se
  # vieran diminutas: el panel es más chico, pero el lector es el mismo y el
  # papel también. Lo que se achica es cuántas cifras caben —eso ya lo resuelve
  # el salto de rótulos—, no el tamaño al que se leen.
  fs <- ty$caption
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
    # **La cifra del día va SIEMPRE encima de su barra** (Gonzalo, 2026-09-11:
    # «las del día siempre sobre la barra, a veces no sé por qué la pones
    # dentro»). La versión anterior la metía dentro cuando la barra era alta,
    # para no chocar con la cifra del acumulado; esa colisión ya la resuelve el
    # acumulado, que se aparta al costado cuando su punto cae dentro del
    # relleno. Con la regla condicional, además, una misma serie escribía unas
    # cifras dentro y otras fuera según la altura: dos tratamientos para el
    # mismo dato, que es lo que hace que una página parezca descuidada.
    grid::grid.text(.ppd_miles(v), x = px(i), y = y + alto_barra + 0.008,
                    just = c("centre", "bottom"),
                    gp = grid::gpar(col = color_barra, fontsize = fs, fontface = "bold"))
  }

  # Las metas, con su rótulo pegado a la regla: una línea sin nombre obliga a
  # buscar la leyenda.
  if (length(metas)) {
    for (k in seq_along(metas)) {
      yy <- py_acu(metas[[k]])
      if (yy > y + h) next
      grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(yy, "npc"),
                       gp = grid::gpar(col = tokens$danger, lwd = pesos$bloque, lty = 2))
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
                      gp = grid::gpar(fill = color_linea, col = tokens$surface, lwd = pesos$columna))
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

#' Leyenda horizontal de series.
#'
#' `centrado = TRUE` la compone respecto del eje de la caja que se le pase, en
#' vez de alinearla a la izquierda. Una leyenda pegada al margen izquierdo con
#' media página vacía a su derecha se lee como un resto; centrada bajo su
#' gráfico se lee como parte de él.
#'
#' El ancho se MIDE, no se supone: cada entrada aporta su muestra, su aire y el
#' texto estimado por el número de caracteres y el cuerpo. Sin medir no hay
#' centro posible.
#' @export
pulso_pdf_leyenda <- function(x, y, entradas, tokens = pulso_pdf_tokens(),
                              ty = pulso_pdf_type(), fontsize = NULL,
                              centrado = FALSE, ancho = NULL) {
  pesos <- pulso_pdf_pesos()
  if (!length(entradas)) return(invisible(NULL))
  fs <- fontsize %||% ty$caption
  muestra <- 0.016
  aire_muestra <- 0.009
  separacion <- 0.032
  ancho_txt <- function(txt) nchar(txt) * fs * 0.00082

  anchos <- vapply(entradas, function(e) muestra + aire_muestra + ancho_txt(e$texto),
                   numeric(1))
  total <- sum(anchos) + separacion * (length(entradas) - 1L)
  cx <- if (isTRUE(centrado)) x + ((ancho %||% (1 - 2 * x)) - total) / 2 else x

  for (k in seq_along(entradas)) {
    e <- entradas[[k]]
    forma <- e$forma %||% "barra"
    if (identical(forma, "contorno")) {
      grid::grid.rect(x = cx, y = y, width = muestra, height = 0.011,
                      just = c("left", "centre"),
                      gp = grid::gpar(fill = NA, col = e$color, lwd = 0.8))
    } else if (identical(forma, "linea")) {
      grid::grid.lines(x = grid::unit(c(cx, cx + muestra), "npc"), y = grid::unit(y, "npc"),
                       gp = grid::gpar(col = e$color, lwd = 1.6, lty = e$lty %||% 1))
      if (is.null(e$lty) || identical(e$lty, 1)) {
        grid::grid.circle(x = cx + muestra / 2, y = y, r = grid::unit(0.0032, "npc"),
                          gp = grid::gpar(fill = e$color, col = tokens$surface, lwd = pesos$columna))
      }
    } else {
      grid::grid.rect(x = cx, y = y, width = muestra, height = 0.011,
                      just = c("left", "centre"), gp = grid::gpar(fill = e$color, col = NA))
    }
    grid::grid.text(e$texto, x = cx + muestra + aire_muestra, y = y,
                    just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$soft, fontsize = fs))
    cx <- cx + anchos[[k]] + separacion
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
                        gp = grid::gpar(fill = tokens$surface, col = s$color, lwd = 1.0))
      }
      # **La barra llega hasta lo conseguido, y la meta se marca DENTRO de
      # ella** (Gonzalo, 2026-09-18: «no creo que deba pintarse de verde, sino
      # se pinta del mismo color pero la línea negra marca la meta y diferencia
      # el resto de la barra, que es exceso»).
      #
      # Revierte el recorte al 100 % que rigió desde el 2026-09-11. El recorte
      # dejaba a todas las facultades que pasan la cuota con la MISMA barra
      # llena —115 % y 250 % idénticas— y remataba el exceso con un filete de
      # 0,0035 npc, tan fino que la superación se leía más débil que la
      # carencia: cuando falta, el contorno hueco sobre el relleno se ve de
      # inmediato; cuando sobra, había que saber que ese borde estaba ahí. El
      # eje ya venía dimensionado con las efectivas (`.ppd_eje_bonito()` sobre
      # metas Y valores), así que el excedente cabe sin tocar la escala.
      if (is.finite(h_val) && h_val > 0) {
        # El relleno con su propio filete oscuro: sin él, contra el contorno del
        # mismo color, no se distingue dónde acaba lo conseguido y empieza lo
        # que falta.
        grid::grid.rect(x = cx, y = y, width = ancho_carril, height = h_val,
                        just = c("centre", "bottom"),
                        gp = grid::gpar(fill = s$color, col = tokens$ink, lwd = 0.4))
        # La cuota, cruzando la barra que la superó: lo de abajo es la meta y lo
        # de arriba el exceso. Va en tinta y no en el color de la serie porque
        # sobre el relleno del mismo color no se vería.
        if (.ppd_marca_de_cuota(h_val, h_meta)) {
          grid::grid.lines(
            x = grid::unit(c(cx - ancho_carril / 2, cx + ancho_carril / 2), "npc"),
            y = grid::unit(y + h_meta, "npc"),
            gp = grid::gpar(col = tokens$ink, lwd = 1.1))
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

  # **La inicial de cada serie bajo su carril.** Azul y rosa tienen la misma
  # luminancia (0,160 y 0,163): impreso en blanco y negro, los dos carriles de
  # un grupo son el mismo gris y la leyenda no sirve para distinguirlos. La
  # letra lo resuelve sin color, y de paso ahorra ir a buscar la leyenda incluso
  # a todo color. Sólo cuando la serie declara su `inicial`.
  if (any(vapply(series, function(s) nzchar(s$inicial %||% ""), logical(1)))) {
    for (i in seq_len(n)) {
      centro <- x + paso * (i - 0.5)
      for (j in seq_len(k)) {
        s <- series[[j]]
        if (!nzchar(s$inicial %||% "")) next
        cx <- centro + (j - (k + 1) / 2) * (ancho_carril * 1.12)
        grid::grid.text(s$inicial, x = cx, y = y - 0.011, just = c("centre", "top"),
                        gp = grid::gpar(col = s$color, fontsize = fs, fontface = "bold"))
      }
    }
  }

  # El rótulo va CENTRADO bajo su grupo, no alineado al borde izquierdo del
  # tramo: con dos carriles por categoría, el centro del grupo es donde el ojo
  # busca su nombre, y un rótulo de tres líneas alineado a la izquierda parecía
  # pertenecer al grupo anterior.
  # **El rótulo se envuelve al ancho REAL de su hueco, sin el suelo de catorce
  # caracteres del kit.** `pulso_pdf_chars()` nunca baja de 14 para que un texto
  # corrido no salga en columna de una palabra, pero aquí el hueco de cada
  # categoría puede ser mucho más estrecho que eso: con treinta facultades mide
  # seis caracteres, y forzar catorce hacía que «ARQUITECTURA Y URBANISMO» se
  # montara sobre su vecina. Cinco es el suelo razonable para un rótulo de eje.
  ancho_rotulo <- paso * 0.88
  tope_rotulo <- pulso_pdf_chars(ancho_rotulo, factor = 128, min_chars = 5L)
  for (i in seq_len(n)) {
    # Envolver no basta: `strwrap` no parte una PALABRA, y «ARQUITECTURA» son
    # doce caracteres donde caben seis, así que la línea se salía del hueco y
    # tocaba a la categoría vecina. Cada línea se recorta a lo que cabe, con
    # elipsis ASCII —el device PDF no tiene el U+2026—.
    lineas <- strwrap(categorias[[i]], width = tope_rotulo)
    lineas <- vapply(lineas, function(l) {
      if (nchar(l) <= tope_rotulo) l else paste0(substr(l, 1L, max(1L, tope_rotulo - 3L)), "...")
    }, character(1), USE.NAMES = FALSE)
    .form_pdf_text(categorias[[i]], x = x + paso * (i - 1) + paso * 0.06,
                   y = y - 0.032, w = ancho_rotulo, lines = lineas,
                   fontsize = fs, col = tokens$soft, line_h = 0.017,
                   align = "center")
  }
  invisible(NULL)
}

.ppd_vec <- function(x) {
  v <- suppressWarnings(as.numeric(x)); v[!is.finite(v)] <- NA_real_; v
}

# Qué barras llevan su cifra encima. Sólo se cuentan las que EXISTEN —una
# jornada sin efectivas no dibuja barra— porque contar sobre el calendario
# dejaba mudas la mitad de las dibujadas para hacer sitio a otras que no
# estaban (Gonzalo, 2026-09-18: «las barras siguen sin números»). Si caben
# todas, van todas; si no, una de cada tantas y SIEMPRE la última, que es la
# jornada que se busca.
# Cuántas cifras caben en un carril de ancho `w` sin tocarse, medidas sobre la
# MÁS LARGA de las que hay que escribir: es la que decide si se amontonan. El
# 1,25 es el aire entre dos cifras vecinas. Sustituye al tope fijo de seis, que
# silenciaba barras aunque sobrara papel (y que con cifras de cuatro dígitos en
# un panel estrecho se habría quedado corto en el otro sentido).
.ppd_cifras_que_caben <- function(diarias, w, fontsize) {
  v <- suppressWarnings(as.numeric(diarias)); v <- v[is.finite(v) & v > 0]
  if (!length(v)) return(1L)
  digitos <- max(nchar(vapply(v, .ppd_miles, character(1))))
  ancho_cifra <- digitos * fontsize * 0.00085 * 1.25
  if (!is.finite(ancho_cifra) || ancho_cifra <= 0) return(length(v))
  max(1L, as.integer(floor(w / ancho_cifra)))
}

.ppd_rotulos_de_barras <- function(diarias, tope) {
  v <- suppressWarnings(as.numeric(diarias)); v[!is.finite(v)] <- 0
  vivas <- which(v > 0)
  if (!length(vivas)) return(integer(0))
  tope <- max(1L, as.integer(tope))
  if (length(vivas) <= tope) return(vivas)
  salto <- max(1L, ceiling(length(vivas) / tope))
  vivas[unique(c(seq(1L, length(vivas), by = salto), length(vivas)))]
}

# ¿Hay que marcar la cuota DENTRO de la barra? Sólo cuando se superó: si no se
# llegó, la cuota ya se ve como contorno hueco por encima del relleno y una
# segunda marca sería redundante. Regla dictada por Gonzalo el 2026-09-18, que
# revierte el recorte al 100 % del 2026-09-11; vive aparte de la función de
# dibujo porque es la regla, no el trazo, y una regla se verifica.
.ppd_marca_de_cuota <- function(alto_valor, alto_meta) {
  if (!length(alto_meta) || !is.finite(alto_meta[[1L]]) || alto_meta[[1L]] <= 0) {
    return(FALSE)
  }
  isTRUE(alto_valor > alto_meta[[1L]])
}

#' Barra de progreso en línea, para una celda de tabla.
#' @export
pulso_pdf_barra_progreso <- function(x, y, w, h, valor, tokens = pulso_pdf_tokens(),
                                     color = tokens$navy, fondo = tokens$tbl_zebra) {
  v <- .ppd_num(valor, 0)
  # **El carril lleva filete.** Sin borde, una barra clara sobre papel blanco se
  # confunde con el fondo y no se ve dónde acaba: lo que el lector compara es
  # cuánto del carril está cubierto, así que el carril tiene que verse entero
  # (Gonzalo, 2026-09-11). El filete es tenue y oscuro, no negro puro: el negro
  # pesaría más que la propia barra.
  grid::grid.rect(x = x, y = y, width = w, height = h, just = c("left", "bottom"),
                  gp = grid::gpar(fill = fondo, col = tokens$soft, lwd = 0.4))
  cubierto <- max(0, min(1, v))
  if (cubierto > 0) {
    grid::grid.rect(x = x, y = y, width = w * cubierto, height = h, just = c("left", "bottom"),
                    gp = grid::gpar(fill = color, col = tokens$ink, lwd = 0.4))
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
#'
#' `ancho` y `fontsize`, cuando se dan, hacen que el aire se RETIRE si el rótulo
#' espaciado no cabe en su caja. El espaciado es un lujo tipográfico; que un
#' rótulo se salga de su tarjeta no lo es. La primera versión no medía nada y al
#' subir el cuerpo de 5,8 a 6,6 pt «CURSOS-HORARIO APLICADOS» se salió de su KPI.
#' @export
pulso_pdf_versalitas <- function(x, aire = " ", ancho = NULL, fontsize = NULL) {
  txt <- toupper(trimws(as.character(x %||% "")[[1L]]))
  if (!nzchar(txt) || nchar(txt) > 48L) return(txt)
  espaciado <- paste(strsplit(txt, "", fixed = TRUE)[[1L]], collapse = aire)
  if (is.null(ancho) || is.null(fontsize)) return(espaciado)
  cabe <- function(s) nchar(s) * fontsize * 0.00082 <= ancho
  if (cabe(espaciado)) espaciado else txt
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
  pesos <- pulso_pdf_pesos()
  m <- geo$margin; right <- 1 - m
  if (nzchar(antetitulo %||% "")) {
    grid::grid.text(pulso_pdf_versalitas(antetitulo), x = m, y = 0.955,
                    just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }
  if (nzchar(derecha %||% "")) {
    grid::grid.text(pulso_pdf_versalitas(derecha), x = right, y = 0.955,
                    just = c("right", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }
  grid::grid.text(titulo, x = m, y = 0.905, just = c("left", "centre"),
                  gp = grid::gpar(col = tokens$navy, fontsize = ty$title, fontface = "bold"))
  # La regla sube cuando no hay bajada. Dejarla fija a 0,845 abría una banda de
  # papel entre el título y la línea que se leía como un renglón perdido: el
  # hueco del subtítulo no puede quedar reservado cuando no hay subtítulo.
  hay_bajada <- nzchar(subtitulo %||% "")
  if (hay_bajada) {
    grid::grid.text(subtitulo, x = m, y = 0.868, just = c("left", "centre"),
                    gp = grid::gpar(col = tokens$soft, fontsize = ty$subtitle))
  }
  y_regla <- if (hay_bajada) 0.845 else 0.872
  grid::grid.lines(x = grid::unit(c(m, right), "npc"), y = grid::unit(y_regla, "npc"),
                   gp = grid::gpar(col = tokens$line, lwd = pesos$columna))
  grid::grid.lines(x = grid::unit(c(m, m + 0.052), "npc"), y = grid::unit(y_regla, "npc"),
                   gp = grid::gpar(col = tokens$navy, lwd = 2.2))
  invisible(NULL)
}

#' Pie de documento de cliente: hairline, marca, periodo y folio «03 / 09».
#' @export
pulso_pdf_pie <- function(pagina, de = NA_integer_, periodo = "",
                          tokens = pulso_pdf_tokens(), ty = pulso_pdf_type(),
                          geo = pulso_pdf_geo("landscape")) {
  pesos <- pulso_pdf_pesos()
  m <- geo$margin; right <- 1 - m
  grid::grid.lines(x = grid::unit(c(m, right), "npc"), y = grid::unit(0.068, "npc"),
                   gp = grid::gpar(col = tokens$line, lwd = pesos$columna))
  .pulso_pdf_draw_logo(m, 0.036, width_npc = 0.098, geo = geo, tokens = tokens)
  if (nzchar(periodo)) {
    grid::grid.text(periodo, x = 0.5, y = 0.036, just = c("centre", "centre"),
                    gp = grid::gpar(fontsize = ty$caption, col = tokens$faint))
  }
  # Folio con el total: «03 / 09» dice cuánto queda; «Pág. 3» no.
  folio <- if (is.finite(de)) {
    sprintf("%02d / %02d", as.integer(pagina), as.integer(de))
  } else sprintf("%02d", as.integer(pagina))
  grid::grid.text(folio, x = right, y = 0.036, just = c("right", "centre"),
                  gp = grid::gpar(fontsize = ty$caption, col = tokens$soft, fontface = "bold"))
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
                  gp = grid::gpar(col = tokens$navy, fontsize = ty$eyebrow, fontface = "bold"))
  grid::grid.lines(x = grid::unit(c(x, x + ancho), "npc"), y = grid::unit(y - 0.012, "npc"),
                   gp = grid::gpar(col = tokens$navy, lwd = 1.1))
  if (nzchar(bajada)) {
    grid::grid.text(bajada, x = x, y = y - 0.030, just = c("left", "bottom"),
                    gp = grid::gpar(col = tokens$faint, fontsize = ty$caption))
  }
  invisible(NULL)
}

# --- La serie diaria PARTIDA en dos cajas ------------------------------------
#
# Por qué existe, además de `pulso_pdf_serie_diaria()`: con las dos series en un
# mismo rectángulo hay que darles dos ejes, y dos ejes obligan a decidir cuál
# manda. Si manda el acumulado, la meta del diseño estira la escala —2.500
# contra un campo que va por 1.390— y el tercio alto de la caja se queda en
# blanco mientras las barras del día viven aplastadas abajo. Si manda el día,
# la curva del acumulado se sale.
#
# Partido, cada serie tiene la caja que le corresponde y su propio eje, sin
# ninguna escala prestada: arriba el acumulado contra la meta, que es la
# pregunta «¿cuánto llevamos?»; abajo el pulso de cada jornada, que es «¿a qué
# ritmo?». El eje de fechas es UNO y va al pie, compartido por las dos.

#' Avance diario en dos cajas apiladas: acumulado arriba, jornada abajo.
#'
#' @inheritParams pulso_pdf_serie_diaria
#' @param reparto proporción del alto que se lleva la caja del acumulado.
#' @export
pulso_pdf_serie_partida <- function(x, y, w, h, dias, diarias, acumulado,
                                    metas = numeric(0),
                                    tokens = pulso_pdf_tokens(), ty = pulso_pdf_type(),
                                    geo = pulso_pdf_geo("landscape"),
                                    color_barra = tokens$navy,
                                    color_linea = tokens$success,
                                    reparto = 0.60, hueco = 0.105,
                                    rotulo_acumulado = "", rotulo_diario = "",
                                    compacto = FALSE) {
  pesos <- pulso_pdf_pesos()
  n <- length(dias)
  if (!n) return(invisible(NULL))
  fs <- ty$caption
  diarias <- as.numeric(diarias); acumulado <- as.numeric(acumulado)
  metas <- metas[is.finite(metas)]
  # En panel, el cuerpo NO baja: lo que se reduce es cuántas cifras se escriben,
  # no el tamaño al que se leen.
  if (isTRUE(compacto)) hueco <- hueco * 0.60

  h_acu <- (h - hueco) * reparto
  h_dia <- (h - hueco) - h_acu
  y_acu <- y + h_dia + hueco

  # Los rótulos de las dos cajas los pone la primitiva, no el llamador: sus
  # alturas se derivan del reparto, y escritos fuera se desincronizan en cuanto
  # alguien cambia `reparto` o `hueco`.
  rotular <- function(txt, yy) {
    if (!nzchar(txt)) return(invisible(NULL))
    grid::grid.text(pulso_pdf_versalitas(txt), x = x, y = yy, just = c("left", "bottom"),
                    gp = grid::gpar(col = tokens$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }
  rotular(rotulo_acumulado, y_acu + h_acu + 0.016)
  rotular(rotulo_diario, y + h_dia + 0.020)

  px <- function(i) x + w * ((i - 0.5) / n)

  # --- Arriba: el acumulado contra la meta ---------------------------------
  eje_acu <- .ppd_eje_bonito(max(c(acumulado[is.finite(acumulado)], metas, 1), na.rm = TRUE),
                             pasos = if (isTRUE(compacto)) 2L else 4L)
  tope_acu <- max(eje_acu)
  py_acu <- function(v) {
    u <- suppressWarnings(as.numeric(v)); u[!is.finite(u)] <- 0
    y_acu + h_acu * (u / tope_acu)
  }
  for (v in eje_acu) {
    grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(py_acu(v), "npc"),
                     gp = grid::gpar(col = tokens$rule, lwd = 0.4, lty = if (v == 0) 1 else 3))
    grid::grid.text(.ppd_miles(v), x = x - 0.008, y = py_acu(v), just = c("right", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = fs))
  }
  for (k in seq_along(metas)) {
    yy <- py_acu(metas[[k]])
    grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(yy, "npc"),
                     gp = grid::gpar(col = tokens$danger, lwd = pesos$bloque, lty = 2))
    nombre <- names(metas)[[k]] %||% ""
    if (nzchar(nombre)) {
      grid::grid.text(paste0(nombre, " ", .ppd_miles(metas[[k]])), x = x + w, y = yy + 0.010,
                      just = c("right", "bottom"),
                      gp = grid::gpar(col = tokens$danger, fontsize = fs, fontface = "bold"))
    }
  }
  vivos <- which(is.finite(acumulado))
  if (length(vivos) >= 2L) {
    # Relleno bajo la curva: con una sola línea la caja de arriba se veía vacía
    # por dentro. El área dice de un golpe cuánto del camino está hecho.
    grid::grid.polygon(
      x = grid::unit(c(px(vivos), rev(px(vivos))), "npc"),
      y = grid::unit(c(py_acu(acumulado[vivos]), rep(y_acu, length(vivos))), "npc"),
      gp = grid::gpar(fill = color_linea, col = NA, alpha = 0.12))
    grid::grid.lines(x = grid::unit(px(vivos), "npc"),
                     y = grid::unit(py_acu(acumulado[vivos]), "npc"),
                     gp = grid::gpar(col = color_linea, lwd = if (isTRUE(compacto)) 1.4 else 2.0))
  }
  # **El punto se dibuja SIEMPRE; lo que se espacia es la cifra.** Estaban en el
  # mismo bucle, así que al escribir una etiqueta de cada dos desaparecían
  # también los puntos intermedios y la curva parecía saltarse jornadas —«¿por
  # qué el acumulado se salta días?», Gonzalo, 2026-09-11—. Son dos decisiones
  # distintas: el dato existe todos los días, su rótulo cabe sólo a ratos.
  r_punto <- if (isTRUE(compacto)) 0.0034 else 0.0055
  for (i in vivos) {
    grid::grid.circle(x = px(i), y = py_acu(acumulado[[i]]), r = grid::unit(r_punto, "npc"),
                      gp = grid::gpar(fill = color_linea, col = tokens$surface,
                                      lwd = pesos$columna))
  }
  tope_rotulos <- if (isTRUE(compacto)) 6L else 20L
  salto <- max(1L, ceiling(n / tope_rotulos))
  # **Las barras se cuentan entre ELLAS y su tope lo decide el ANCHO** (Gonzalo,
  # 2026-09-18: «las barras siguen sin números»). Antes el salto se calculaba
  # sobre las jornadas del calendario contra un tope de seis: en un panel de
  # once días, las barras de índice par salían mudas y, cuando había diez
  # barras reales, cuatro se quedaban sin cifra aunque sobrara papel entre
  # ellas. Una jornada sin efectivas no dibuja barra, así que lo que decide no
  # es cuántos días hay sino cuántas cifras caben: el paso entre barras contra
  # el ancho de la cifra más larga. Con dos o tres dígitos en estos paneles
  # caben todas; con cifras de miles en un panel estrecho, el tope baja solo.
  barras_rotuladas <- .ppd_rotulos_de_barras(
    diarias, .ppd_cifras_que_caben(diarias, w, fs))
  for (i in vivos) {
    if ((i - 1L) %% salto != 0L && i != n) next
    grid::grid.text(.ppd_miles(acumulado[[i]]), x = px(i), y = py_acu(acumulado[[i]]) + 0.013,
                    just = c("centre", "bottom"),
                    gp = grid::gpar(col = color_linea, fontsize = fs, fontface = "bold"))
  }
  grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(y_acu, "npc"),
                   gp = grid::gpar(col = tokens$tbl_frame, lwd = 0.7))

  # --- Abajo: la jornada ----------------------------------------------------
  eje_dia <- .ppd_eje_bonito(max(c(diarias[is.finite(diarias)], 1), na.rm = TRUE),
                             pasos = if (isTRUE(compacto)) 1L else 2L)
  tope_dia <- max(eje_dia) * 1.22
  ancho_barra <- min((w / n) * 0.56, if (isTRUE(compacto)) 0.026 else 0.052)
  for (v in eje_dia[-1]) {
    grid::grid.text(.ppd_miles(v), x = x - 0.008, y = y + h_dia * (v / tope_dia),
                    just = c("right", "centre"),
                    gp = grid::gpar(col = tokens$faint, fontsize = fs))
  }
  for (i in seq_len(n)) {
    v <- .ppd_num(diarias[[i]], 0)
    if (v <= 0) next
    alto <- h_dia * (v / tope_dia)
    grid::grid.rect(x = px(i), y = y, width = ancho_barra, height = alto,
                    just = c("centre", "bottom"),
                    gp = grid::gpar(fill = color_barra, col = NA, alpha = 0.9))
    if (!(i %in% barras_rotuladas)) next
    grid::grid.text(.ppd_miles(v), x = px(i), y = y + alto + 0.008, just = c("centre", "bottom"),
                    gp = grid::gpar(col = color_barra, fontsize = fs, fontface = "bold"))
  }
  grid::grid.lines(x = grid::unit(c(x, x + w), "npc"), y = grid::unit(y, "npc"),
                   gp = grid::gpar(col = tokens$tbl_frame, lwd = 0.7))

  # --- El eje de fechas, UNO solo al pie ------------------------------------
  cada <- max(1L, ceiling(n / (if (isTRUE(compacto)) 6L else 14L)))
  for (i in seq_len(n)) {
    if ((i - 1L) %% cada != 0L && i != n) next
    grid::grid.text(dias[[i]], x = px(i), y = y - 0.014, just = c("centre", "top"),
                    gp = grid::gpar(col = tokens$soft, fontsize = fs))
  }
  invisible(NULL)
}
