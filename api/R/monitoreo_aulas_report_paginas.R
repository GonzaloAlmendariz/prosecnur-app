# Las páginas del reporte de avance de aulas que NO son la tabla por facultad.
#
# Viven aparte del renderizador porque cada una es un layout entero y el archivo
# del reporte ya cargaba con la tabla de diecisiete columnas. Todas dibujan
# sobre la página ACTUAL: quien las llama abre la página y pone cabecera y pie.

# `.form_pdf_clean_text()` es ESCALAR: le entra un vector y devuelve sólo su
# primer elemento, sin aviso. Pasado un vector de facultades, la página de metas
# salía con un único rótulo —«DERECHO»— y catorce carriles anónimos. Se ve
# mirando el PDF; el código no falla.
.marp_limpiar <- function(x) {
  vapply(as.character(x), function(v) .form_pdf_clean_text(v), character(1), USE.NAMES = FALSE)
}

.marp_tono_de_avance <- function(p, tok) {
  v <- suppressWarnings(as.numeric(p))
  if (!length(v) || !is.finite(v[[1L]])) return(tok$soft)
  if (v[[1L]] >= 0.95) tok$success else if (v[[1L]] >= 0.70) tok$warn else tok$danger
}

# --- Página de resumen -------------------------------------------------------
#
# Lo que un cliente mira primero, en el orden en que lo pregunta: cuánto se
# lleva, sobre cuánto, cuánto falta y en cuántas aulas se consiguió. Debajo, la
# tabla «Avance general» del libro tal cual, que es la que Gonzalo aprobó.

.marp_pagina_resumen <- function(model, tok, ty, geo, x0, ancho) {
  t <- model$total
  huecos <- 0.016
  n_kpi <- 5L
  w_kpi <- (ancho - huecos * (n_kpi - 1L)) / n_kpi
  y_kpi <- 0.680; h_kpi <- 0.155

  kpi <- function(i, rotulo, valor, nota, tono, destacado = FALSE) {
    pulso_pdf_kpi(x0 + (i - 1L) * (w_kpi + huecos), y_kpi, w_kpi, h_kpi,
                  rotulo, valor, nota, tokens = tok, ty = ty, tono = tono,
                  destacado = destacado)
  }
  tono_avance <- .marp_tono_de_avance(t$avance, tok)
  kpi(1L, "Avance de la muestra", .marp_pct(t$avance),
      sprintf("%s de %s", .marp_personas(t$conseguidas), .marp_personas(t$muestra)),
      tono_avance, destacado = TRUE)
  kpi(2L, "Encuestas efectivas", .marp_personas(t$conseguidas), "en plataforma", tok$navy)
  kpi(3L, "Muestra del diseño", .marp_personas(t$muestra), "meta por facultad y sexo", tok$navy)
  kpi(4L, "Faltan", .marp_personas(t$faltan, faltante = TRUE),
      if (identical(as.integer(t$facultades_abiertas), 1L)) "en 1 facultad"
      else sprintf("en %d facultades", as.integer(t$facultades_abiertas)),
      if (.marp_num(t$faltan, 0) > 0) tok$warn else tok$success)
  kpi(5L, "Cursos-horario aplicados", .marp_personas(t$aulas_aplicadas), "aulas visitadas", tok$navy)

  # El medidor, con la sobremuestra marcada sobre la MISMA barra: las dos metas
  # se leen en la misma regla o no se comparan.
  y_med <- 0.596
  pulso_pdf_rotulo_seccion(x0, y_med + 0.062, "Cuánto se lleva de cada meta",
                           tokens = tok, ty = ty, ancho = 0.072)
  # Más fino: una barra gruesa se lee como un bloque de color y compite con las
  # tarjetas de arriba. Con 0,016 es una regla cargada, que es lo que es.
  pulso_pdf_medidor(x0, y_med, ancho, 0.016, .marp_num(t$avance, 0),
                    tokens = tok, tono = tok$navy)
  grid::grid.text(paste0(.marp_pct(t$avance), " de la muestra"),
                  x = x0, y = y_med - 0.030, just = c("left", "bottom"),
                  gp = grid::gpar(col = tok$ink, fontsize = ty$footer, fontface = "bold"))
  sm <- .marp_num(t$sobremuestra, NA_real_)
  if (is.finite(sm) && sm > 0) {
    avance_sm <- .marp_num(t$conseguidas, 0) / sm
    grid::grid.text(paste0(.marp_pct(avance_sm), " de la sobremuestra (", .marp_personas(sm), ")"),
                    x = x0 + ancho, y = y_med - 0.030, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$soft, fontsize = ty$footer))
    # La marca de dónde cae la muestra dentro de la sobremuestra no se dibuja:
    # el medidor mide contra la muestra y dos escalas en una barra se confunden.
  }

  .marp_tabla_general(model$general, tok, ty, x0, ancho, y_top = 0.470)
  invisible(NULL)
}

# La tabla traspuesta: una fila por concepto, columnas Total / Hombres / Mujeres.
# «Aulas asignadas» NO entra: el reparto interno de quién va a qué aula no es
# asunto del cliente, y es la única fila de la tabla del libro que lo es.
.marp_tabla_general <- function(general, tok, ty, x0, ancho, y_top) {
  if (!is.data.frame(general) || !nrow(general)) return(invisible(NULL))
  ind <- names(general)[[1L]]
  filas <- general[!(as.character(general[[ind]]) %in% "Aulas asignadas"), , drop = FALSE]
  if (!nrow(filas)) return(invisible(NULL))

  pulso_pdf_rotulo_seccion(
    x0, y_top + 0.058, "Avance general",
    bajada = "Las mismas cifras de la hoja «Avance de campo» del libro del operativo.",
    tokens = tok, ty = ty, ancho = 0.052)

  w_rot <- 0.300
  w_col <- (ancho - w_rot) / 3
  xs <- c(x0, x0 + w_rot, x0 + w_rot + w_col, x0 + w_rot + 2 * w_col, x0 + ancho)
  alto <- 0.036

  # Sin banda de relleno: dos hairlines bastan para acotar el encabezado y dejan
  # la tabla más liviana que un bloque de color.
  pulso_pdf_hairline(x0, x0 + ancho, y_top, tokens = tok, lwd = 0.9)
  for (k in 2:4) {
    grid::grid.text(pulso_pdf_versalitas(names(general)[[k]]), x = xs[k + 1L] - 0.010,
                    y = y_top - 0.021, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = 5.8, fontface = "bold"))
  }
  grid::grid.text(pulso_pdf_versalitas(ind), x = x0 + 0.010, y = y_top - 0.021,
                  just = c("left", "bottom"),
                  gp = grid::gpar(col = tok$faint, fontsize = 5.8, fontface = "bold"))
  pulso_pdf_hairline(x0, x0 + ancho, y_top - 0.030, tokens = tok, lwd = 0.5)

  proporciones <- AULAS_AVANCE_PROPORCIONES$general %||% character(0)
  y <- y_top - 0.030 - alto
  for (i in seq_len(nrow(filas))) {
    rotulo <- as.character(filas[[ind]][[i]])
    # Las filas de porcentaje llevan un fondo tenue; las demás van limpias. La
    # zebra alterna por posición y no por significado, así que pintaba de gris
    # filas que no tienen nada en común.
    destacada <- rotulo %in% proporciones
    if (destacada) {
      grid::grid.rect(x = x0, y = y, width = ancho, height = alto, just = c("left", "bottom"),
                      gp = grid::gpar(fill = tok$tbl_zebra, col = NA))
    }
    grid::grid.text(rotulo, x = x0 + 0.010, y = y + alto / 2, just = c("left", "centre"),
                    gp = grid::gpar(col = tok$ink, fontsize = ty$body,
                                    fontface = if (destacada) "bold" else "plain"))
    for (k in 2:4) {
      v <- filas[[k]][[i]]
      txt <- if (destacada) .marp_pct(v) else .marp_personas(v, faltante = grepl("^Faltantes", rotulo))
      grid::grid.text(txt, x = xs[k + 1L] - 0.010, y = y + alto / 2, just = c("right", "centre"),
                      gp = grid::gpar(col = if (destacada) tok$navy else tok$ink,
                                      fontsize = ty$body,
                                      fontface = if (destacada) "bold" else "plain"))
    }
    pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = 0.4)
    y <- y - alto
  }
  invisible(NULL)
}

# --- Página del ritmo global -------------------------------------------------

.marp_pagina_ritmo <- function(ritmo, tok, ty, geo, x0, ancho) {
  serie <- ritmo$total
  # **La sobremuestra NO entra en los gráficos** (Gonzalo, 2026-09-11: «que la
  # sobremuestra que considere para los KPIs y tablas como ahora, pero ya no
  # para gráficos»). Sigue en las tarjetas, en «Avance general» y en el detalle
  # por facultad. Aquí sobraba por dos motivos: una segunda regla de meta
  # duplica el mensaje, y su valor —3.750 contra 2.500— estiraba el eje del
  # acumulado hasta 4.000 y dejaba la curva del campo aplastada contra el suelo.
  metas <- c()
  if (is.finite(ritmo$meta %||% NA_real_)) metas <- c(metas, stats::setNames(ritmo$meta, "Muestra"))
  etiquetas <- .marp_etiquetas_de_dia(serie)

  pulso_pdf_serie_diaria(x0, 0.225, ancho - 0.045, 0.545,
                         dias = etiquetas, diarias = serie$efectivas,
                         acumulado = serie$acumulado, metas = metas,
                         tokens = tok, ty = ty, geo = geo)

  pulso_pdf_leyenda(x0, 0.150, list(
    list(texto = "Encuestas efectivas del día", color = tok$navy, forma = "barra"),
    list(texto = "Acumulado del campo", color = tok$success, forma = "linea"),
    list(texto = "Muestra del diseño", color = tok$danger, forma = "linea", lty = 2)
  ), tokens = tok, ty = ty)

  pico <- which.max(serie$efectivas)
  # La etiqueta del eje lleva un salto de línea dentro («09/09\nmié»): en una
  # frase corrida eso parte la oración en dos renglones a media palabra.
  dia_pico <- gsub("\n", " ", etiquetas[[pico]], fixed = TRUE)
  grid::grid.text(
    sprintf("%d jornadas de campo. El día más productivo fue el %s, con %s encuestas efectivas.",
            nrow(serie), dia_pico, .marp_personas(serie$efectivas[[pico]])),
    x = x0, y = 0.108, just = c("left", "bottom"),
    gp = grid::gpar(col = tok$soft, fontsize = ty$footer))
  invisible(NULL)
}

# «08/09 Lun» — la fecha corta con su día de la semana, que es como se habla de
# una jornada de campo. Sin el día de la semana, un lunes y un sábado se ven
# igual y el sábado rinde distinto.
.marp_etiquetas_de_dia <- function(serie) {
  f <- suppressWarnings(as.Date(serie$dia))
  vapply(seq_len(nrow(serie)), function(i) {
    corta <- if (is.na(f[[i]])) as.character(serie$dia[[i]]) else format(f[[i]], "%d/%m")
    ds <- as.character(serie$dia_semana[[i]] %||% "")
    if (nzchar(ds)) paste0(corta, "\n", substr(ds, 1L, 3L)) else corta
  }, character(1))
}

# --- Páginas del ritmo por facultad -----------------------------------------
#
# Small multiples: un panel por facultad, misma escala de tiempo y CADA UNA con
# su propia escala vertical. Compartir la escala vertical haría ilegibles a las
# facultades pequeñas —DERECHO mueve diez veces lo que EDUCACIÓN— y el panel
# dice su meta y su avance en palabras, que es lo que se compara.

.marp_paneles_por_facultad <- function(paneles, tok, ty, geo, x0, ancho, columnas = 4L, filas = 2L) {
  # El alto se reparte contando lo que cada fila necesita ADEMÁS del trazado:
  # dos renglones de rótulo arriba (~0.045) y los días abajo (~0.035). La
  # primera versión dejaba 0.075 de hueco y el título de la segunda fila caía
  # sobre las fechas de la primera.
  hueco_x <- 0.020; hueco_y <- 0.095
  w <- (ancho - hueco_x * (columnas - 1L)) / columnas
  h <- 0.245
  y_primera <- 0.500

  for (k in seq_along(paneles)) {
    p <- paneles[[k]]
    i <- (k - 1L) %% columnas
    j <- (k - 1L) %/% columnas
    px <- x0 + i * (w + hueco_x)
    py <- y_primera - j * (h + hueco_y)

    conseguidas <- if (nrow(p$serie)) p$serie$acumulado[[nrow(p$serie)]] else 0
    meta <- suppressWarnings(as.numeric(p$meta))
    avance <- if (length(meta) && is.finite(meta) && meta > 0) conseguidas / meta else NA_real_

    nombre <- .form_pdf_clean_text(p$facultad)
    tope <- pulso_pdf_chars(w, factor = 122)
    if (nchar(nombre) > tope) nombre <- paste0(substr(nombre, 1L, tope - 3L), "...")
    grid::grid.text(nombre, x = px, y = py + h + 0.048, just = c("left", "bottom"),
                    gp = grid::gpar(col = tok$navy, fontsize = 8.4, fontface = "bold"))
    grid::grid.text(
      sprintf("%s de %s  ·  %s", .marp_personas(conseguidas),
              if (is.finite(meta)) .marp_personas(meta) else "-", .marp_pct(avance)),
      x = px, y = py + h + 0.026, just = c("left", "bottom"),
      gp = grid::gpar(col = .marp_tono_de_avance(avance, tok), fontsize = ty$caption, fontface = "bold"))

    # Una sola meta por panel: la de la muestra. La sobremuestra se lee en las
    # tarjetas y en las tablas, no aquí.
    metas <- if (is.finite(meta) && meta > 0) stats::setNames(meta, "") else numeric(0)
    pulso_pdf_serie_diaria(px, py, w, h,
                           dias = .marp_etiquetas_de_dia(p$serie),
                           diarias = p$serie$efectivas, acumulado = p$serie$acumulado,
                           metas = metas, tokens = tok, ty = ty, geo = geo,
                           etiquetar_barras = FALSE, compacto = TRUE)
  }
  invisible(NULL)
}

.marp_num <- function(x, default = NA_real_) {
  v <- suppressWarnings(as.numeric(x))
  if (!length(v) || !is.finite(v[[1L]])) default else v[[1L]]
}

# --- Página «Metas por facultad» --------------------------------------------
#
# El mismo gráfico que la app muestra en pantalla, llevado al documento: por
# facultad, el carril de hombres y el de mujeres; el contorno es la cuota y el
# relleno lo conseguido. TODAS en la misma escala, que es lo que deja comparar
# el tamaño del trabajo de una facultad con el de otra.
#
# **Se parte en dos filas desde OCHO facultades**, mitad arriba y mitad abajo.
# Es la regla que dictó Gonzalo para la pantalla el 2026-09-10 («eso no pasa
# siempre, pasa que haya más de 8 facultades en adelante y se parte a la mitad
# a partir de allí») y vale igual aquí: con quince carriles dobles en una sola
# fila, los rótulos de facultad no caben ni partidos.

.MARP_UMBRAL_DOS_FILAS <- 8L

.marp_pagina_metas <- function(facultades, tok, ty, geo, x0, ancho) {
  n <- nrow(facultades)
  nombres <- .marp_limpiar(facultades[["Facultad"]])
  col <- function(k) suppressWarnings(as.numeric(facultades[[k]]))

  meta_h <- col("Muestra hombres"); meta_m <- col("Muestra mujeres")
  ef_h <- col("Efectivas hombres"); ef_m <- col("Efectivas mujeres")

  rejilla <- .ppd_eje_bonito(max(c(meta_h, meta_m, ef_h, ef_m, 1), na.rm = TRUE), pasos = 4L)
  # Aire sobre el carril más alto: sin él, el porcentaje del carril que llega al
  # techo se dibuja fuera de la caja y no aparece en el documento.
  tope <- max(rejilla) * 1.10

  cortes <- if (n >= .MARP_UMBRAL_DOS_FILAS) {
    mitad <- ceiling(n / 2)
    list(seq_len(mitad), seq.int(mitad + 1L, n))
  } else list(seq_len(n))

  alto_fila <- if (length(cortes) == 2L) 0.255 else 0.520
  y_fila <- if (length(cortes) == 2L) c(0.455, 0.135) else 0.190

  for (f in seq_along(cortes)) {
    idx <- cortes[[f]]
    pulso_pdf_barras_meta(
      x0 + 0.030, y_fila[[f]], ancho - 0.030, alto_fila,
      categorias = nombres[idx],
      series = list(
        list(nombre = "Hombres", color = tok$sexo_h, meta = meta_h[idx], valor = ef_h[idx]),
        list(nombre = "Mujeres", color = tok$sexo_m, meta = meta_m[idx], valor = ef_m[idx])
      ),
      tope = tope, tokens = tok, ty = ty, rejilla = rejilla[-1])
  }

  pulso_pdf_leyenda(x0, 0.775, list(
    list(texto = "Hombres: conseguido", color = tok$sexo_h, forma = "barra"),
    list(texto = "Mujeres: conseguido", color = tok$sexo_m, forma = "barra")
  ), tokens = tok, ty = ty)
  grid::grid.text("El contorno de cada carril es la cuota del diseno; el relleno, lo conseguido.",
                  x = x0 + ancho, y = 0.775, just = c("right", "centre"),
                  gp = grid::gpar(col = tok$soft, fontsize = ty$caption))
  invisible(NULL)
}

# --- Página «Avance por facultad y sexo» ------------------------------------
#
# La tabla con la barra dentro, que es como se lee en la app. La versión de
# diecisiete columnas sigue al final del documento: ésta responde «¿cómo va?» de
# un vistazo, aquélla responde «¿cuánto exactamente?».

# OCHO y no nueve: cada facultad ocupa su renglón más los dos de sexo (0,082
# npc), y con nueve la última pareja caía por debajo de la regla del pie. Se vio
# en el PNG, no en el código.
.marp_filas_por_pagina_avance <- function() 8L

.marp_pagina_avance_visual <- function(facultades, idx, tok, ty, x0, ancho,
                                       aulas_plan = numeric(0)) {
  col <- function(k, i) suppressWarnings(as.numeric(facultades[[k]][[i]]))

  # Geometría de la tabla, declarada UNA vez: los encabezados y las celdas se
  # posicionan con los mismos números o se desalinean al primer retoque.
  w_fac <- 0.255; w_sexo <- 0.068; w_barra <- 0.165
  x_fac <- x0; x_sexo <- x_fac + w_fac; x_barra <- x_sexo + w_sexo
  resto <- x0 + ancho - (x_barra + w_barra) - 0.010
  w_num <- resto / 6
  x_num <- (x_barra + w_barra + 0.010) + (seq_len(6L) - 1L) * w_num

  y_top <- 0.800
  grid::grid.rect(x = x0, y = y_top, width = ancho, height = 0.034,
                  just = c("left", "bottom"),
                  gp = grid::gpar(fill = tok$tbl_header, col = tok$tbl_frame, lwd = 0.6))
  cab <- function(txt, x, just = "right") {
    grid::grid.text(txt, x = x, y = y_top + 0.012, just = c(just, "bottom"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$footer, fontface = "bold"))
  }
  cab("FACULTAD", x_fac + 0.008, "left")
  cab("AVANCE", x_barra, "left")
  cabeceras <- c("%", "EFECTIVAS", "META", "FALTAN", "APLICADAS", "PREVISTAS")
  for (k in seq_along(cabeceras)) cab(cabeceras[[k]], x_num[[k]] + w_num - 0.008)

  alto_fac <- 0.030; alto_sexo <- 0.026
  y <- y_top - 0.014
  for (i in idx) {
    y <- y - alto_fac
    nombre <- .form_pdf_clean_text(as.character(facultades[["Facultad"]][[i]]))
    tope_txt <- pulso_pdf_chars(w_fac, factor = 118)
    if (nchar(nombre) > tope_txt) nombre <- paste0(substr(nombre, 1L, tope_txt - 3L), "...")
    grid::grid.text(nombre, x = x_fac + 0.008, y = y + alto_fac / 2, just = c("left", "centre"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$body, fontface = "bold"))
    aplicadas <- col("Aulas aplicadas", i)
    nombre_crudo <- as.character(facultades[["Facultad"]][[i]])
    previstas <- suppressWarnings(as.numeric(aulas_plan[[nombre_crudo]] %||% NA_real_))
    grid::grid.text(.marp_personas(aplicadas), x = x_num[[5L]] + w_num - 0.008,
                    y = y + alto_fac / 2, just = c("right", "centre"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$body, fontface = "bold"))
    grid::grid.text(.marp_personas(previstas), x = x_num[[6L]] + w_num - 0.008,
                    y = y + alto_fac / 2, just = c("right", "centre"),
                    gp = grid::gpar(col = tok$soft, fontsize = ty$body))
    pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = 0.5)

    for (s in list(list("Hombres", "hombres", tok$sexo_h), list("Mujeres", "mujeres", tok$sexo_m))) {
      y <- y - alto_sexo
      ef <- col(paste("Efectivas", s[[2L]]), i)
      meta <- col(paste("Muestra", s[[2L]]), i)
      faltan <- col(paste0("Faltantes ", s[[2L]], " muestra"), i)
      pct <- if (is.finite(meta) && meta > 0) ef / meta else NA_real_

      grid::grid.text(s[[1L]], x = x_sexo, y = y + alto_sexo / 2, just = c("left", "centre"),
                      gp = grid::gpar(col = tok$soft, fontsize = ty$footer))
      pulso_pdf_barra_progreso(x_barra, y + alto_sexo * 0.28, w_barra, alto_sexo * 0.44,
                               pct, tokens = tok, color = s[[3L]])
      grid::grid.text(.marp_pct(pct), x = x_num[[1L]] + w_num - 0.008, y = y + alto_sexo / 2,
                      just = c("right", "centre"),
                      gp = grid::gpar(col = tok$ink, fontsize = ty$body, fontface = "bold"))
      grid::grid.text(.marp_personas(ef), x = x_num[[2L]] + w_num - 0.008, y = y + alto_sexo / 2,
                      just = c("right", "centre"), gp = grid::gpar(col = tok$ink, fontsize = ty$body))
      grid::grid.text(.marp_personas(meta), x = x_num[[3L]] + w_num - 0.008, y = y + alto_sexo / 2,
                      just = c("right", "centre"), gp = grid::gpar(col = tok$ink, fontsize = ty$body))
      vale <- is.finite(faltan) && faltan > 0
      grid::grid.text(.marp_personas(faltan, faltante = TRUE), x = x_num[[4L]] + w_num - 0.008,
                      y = y + alto_sexo / 2, just = c("right", "centre"),
                      gp = grid::gpar(col = if (vale) tok$danger else tok$success,
                                      fontsize = ty$body, fontface = if (vale) "bold" else "plain"))
    }
    pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = 0.35)
  }
  invisible(NULL)
}
