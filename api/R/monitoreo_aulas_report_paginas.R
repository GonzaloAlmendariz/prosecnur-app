# Las páginas del reporte de avance de aulas que NO son la tabla por facultad.
#
# Viven aparte del renderizador porque cada una es un layout entero y el archivo
# del reporte ya cargaba con la tabla de diecisiete columnas. Todas dibujan
# sobre la página ACTUAL: quien las llama abre la página y pone cabecera y pie.

# `.form_pdf_clean_text()` es ESCALAR: le entra un vector y devuelve sólo su
# primer elemento, sin aviso. Pasado un vector de facultades, la página de metas
# salía con un único rótulo —«DERECHO»— y catorce carriles anónimos. Se ve
# mirando el PDF; el código no falla.
# --- El marco de la página ---------------------------------------------------
#
# Dónde empieza y dónde acaba el área de contenido. Estaban tecleados en cada
# función: SIETE techos entre 0,740 y 0,800 y CINCO suelos entre 0,095 y 0,135,
# para lo que son dos decisiones. No es que cada página quisiera un marco
# distinto —es que cada una se ajustó a ojo cuando le tocó, y los valores
# envejecieron por separado.
#
# Lo que una página añade —una leyenda al pie, un rótulo de sección arriba— se
# RESTA del marco de forma explícita, para que se vea qué lo desplaza y no
# parezca otro número elegido a ojo.
.MARP_MARCO <- list(
  techo = 0.800,    # bajo la regla del cromo, con aire
  suelo = 0.108,    # sobre la regla del pie, con aire
  leyenda = 0.032,  # lo que roba una leyenda tendida al pie
  seccion = 0.062   # lo que roba un rótulo de sección con su regla
)

.marp_limpiar <- function(x) {
  vapply(as.character(x), function(v) .form_pdf_clean_text(v), character(1), USE.NAMES = FALSE)
}

# --- Página de resumen -------------------------------------------------------
#
# Lo que un cliente mira primero, en el orden en que lo pregunta: cuánto se
# lleva, sobre cuánto, cuánto falta y en cuántas aulas se consiguió. Debajo, la
# tabla «Avance general» del libro tal cual, que es la que Gonzalo aprobó.

.marp_pagina_resumen <- function(model, tok, ty, geo, x0, ancho) {
  t <- model$total
  huecos <- 0.016

  # **Seis huecos, cinco tarjetas.** La primera vale por dos porque es la
  # respuesta a la pregunta del documento; las otras cuatro la sostienen. Con
  # los cinco del mismo tamaño, «Muestra del diseño» pesaba lo mismo que el
  # avance y la página no decía por dónde empezar a leerla.
  w_slot <- (ancho - huecos * 5) / 6
  y_kpi <- 0.672; h_kpi <- 0.170
  x_slot <- function(i) x0 + (i - 1L) * (w_slot + huecos)

  .marp_kpi_principal(x_slot(1L), y_kpi, w_slot * 2 + huecos, h_kpi, t, tok, ty, tok$navy)

  kpi <- function(i, rotulo, valor, nota, tono) {
    pulso_pdf_kpi(x_slot(i), y_kpi, w_slot, h_kpi, rotulo, valor, nota,
                  tokens = tok, ty = ty, tono = tono)
  }
  kpi(3L, "Encuestas efectivas", .marp_personas(t$conseguidas), "en plataforma", tok$navy)
  # **«Muestra del diseño» era un eco.** Su cifra y su nota ya estaban dentro de
  # la tarjeta del avance —«1.390 de 2.500»—, en la banda más visible del
  # documento. En su lugar, un hecho que no aparece en ninguna otra parte: cuántas
  # facultades han cerrado su cuota. Es lo que convierte «faltan 1.110» en una
  # noticia con forma.
  cerradas <- nrow(model$facultades) - .marp_num(t$facultades_abiertas, 0)
  kpi(4L, "Facultades que cerraron", .marp_personas(cerradas),
      sprintf("de %s", .marp_personas(nrow(model$facultades))), tok$navy)
  kpi(5L, "Faltan", .marp_personas(t$faltan, faltante = TRUE),
      if (identical(as.integer(t$facultades_abiertas), 1L)) "en 1 facultad"
      else sprintf("en %d facultades", as.integer(t$facultades_abiertas)),
      # Todas las tarjetas del mismo tono. El ámbar de «Faltan» era un juicio
      # sobre un hecho que la cifra ya da, y cinco filetes de tres colores
      # convierten la franja en un semáforo.
      tok$navy)
  previstas <- sum(suppressWarnings(as.numeric(model$aulas_planificadas %||% numeric(0))), na.rm = TRUE)
  kpi(6L, "Cursos-horario aplicados", .marp_personas(t$aulas_aplicadas),
      if (is.finite(previstas) && previstas > 0) sprintf("de %s previstos", .marp_personas(previstas))
      else "", tok$navy)

  # Donde estaba el medidor de ancho completo va el reparto por sexo. El
  # medidor repetía el 42,5 % que la tarjeta ya daba —el mismo dato dos veces y
  # en el elemento más pesado de la hoja—; esto es información que sólo estaba
  # enterrada en la tabla.
  .marp_bloque_sexo(model$general, tok, ty, x0, ancho, y = 0.556)

  .marp_tabla_general(model$general, tok, ty, x0, ancho, y_top = 0.470)
  invisible(NULL)
}

# La tarjeta que manda: la cifra grande, su medidor y las dos metas en palabras.
.marp_kpi_principal <- function(x, y, w, h, t, tok, ty, tono) {
  pulso_pdf_panel(x, y, w, h, tokens = tok, fill = tok$canvas, col = NA, r = 0.006)
  grid::grid.rect(x = x, y = y + h - 0.0032, width = w, height = 0.0032,
                  just = c("left", "bottom"), gp = grid::gpar(fill = tono, col = NA))
  pad <- 0.018
  grid::grid.text(pulso_pdf_versalitas("Avance de la muestra", ancho = w - 2 * pad,
                                       fontsize = ty$eyebrow),
                  x = x + pad, y = y + h - 0.030, just = c("left", "top"),
                  gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
  grid::grid.text(.marp_pct(t$avance), x = x + pad, y = y + 0.074, just = c("left", "bottom"),
                  gp = grid::gpar(col = tok$navy, fontsize = 34, fontface = "bold"))
  grid::grid.text(sprintf("%s de %s", .marp_personas(t$conseguidas), .marp_personas(t$muestra)),
                  x = x + w - pad, y = y + 0.082, just = c("right", "bottom"),
                  gp = grid::gpar(col = tok$soft, fontsize = ty$body))
  pulso_pdf_medidor(x + pad, y + 0.046, w - 2 * pad, 0.014, .marp_num(t$avance, 0),
                    tokens = tok, tono = tono, fondo = tok$tbl_header)
  sm <- .marp_num(t$sobremuestra, NA_real_)
  if (is.finite(sm) && sm > 0) {
    grid::grid.text(
      sprintf("Sobremuestra: %s de %s", .marp_pct(.marp_num(t$conseguidas, 0) / sm),
              .marp_personas(sm)),
      x = x + pad, y = y + 0.020, just = c("left", "bottom"),
      gp = grid::gpar(col = tok$faint, fontsize = ty$caption))
  }
  invisible(NULL)
}

# Reparto por sexo: dos medidores con su cifra. Se lee de «Avance general», que
# ya trae las tres columnas; aquí no se recalcula nada.
.marp_bloque_sexo <- function(general, tok, ty, x0, ancho, y) {
  if (!is.data.frame(general) || !nrow(general)) return(invisible(NULL))
  ind <- names(general)[[1L]]
  fila <- function(rotulo, col) {
    i <- which(as.character(general[[ind]]) == rotulo)
    if (!length(i)) return(NA_real_)
    suppressWarnings(as.numeric(general[[col]][[i[[1L]]]]))
  }
  datos <- list(
    list(rotulo = "Hombres", color = tok$sexo_h, avance = fila("Avance muestra", "Hombres"),
         ef = fila("Efectivas", "Hombres"), meta = fila("Muestra", "Hombres")),
    list(rotulo = "Mujeres", color = tok$sexo_m, avance = fila("Avance muestra", "Mujeres"),
         ef = fila("Efectivas", "Mujeres"), meta = fila("Muestra", "Mujeres"))
  )
  if (!any(vapply(datos, function(d) is.finite(d$avance), logical(1)))) return(invisible(NULL))

  # Sin bajada. Decía «cada sexo tiene su propia cuota: cubrir de más en uno no
  # cubre lo que falta en el otro», que es explicarle al cliente algo que sabe
  # mejor que nadie: es su propio diseño muestral. Las dos barras y sus dos
  # denominadores ya lo dicen sin una línea de texto.
  pulso_pdf_rotulo_seccion(x0, y + 0.072, "Reparto por sexo", tokens = tok, ty = ty,
                           ancho = 0.058)
  w <- (ancho - 0.040) / 2
  for (k in seq_along(datos)) {
    d <- datos[[k]]
    x <- x0 + (k - 1L) * (w + 0.040)
    grid::grid.text(d$rotulo, x = x, y = y + 0.020, just = c("left", "bottom"),
                    gp = grid::gpar(col = tok$ink, fontsize = ty$body, fontface = "bold"))
    grid::grid.text(sprintf("%s  ·  %s de %s", .marp_pct(d$avance),
                            .marp_personas(d$ef), .marp_personas(d$meta)),
                    x = x + w, y = y + 0.020, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$soft, fontsize = ty$body))
    pulso_pdf_medidor(x, y, w, 0.014, d$avance, tokens = tok, tono = d$color,
                      fondo = tok$tbl_header)
  }
  invisible(NULL)
}

# La tabla traspuesta: una fila por concepto, columnas Total / Hombres / Mujeres.
# «Aulas asignadas» NO entra: el reparto interno de quién va a qué aula no es
# asunto del cliente, y es la única fila de la tabla del libro que lo es.
.marp_tabla_general <- function(general, tok, ty, x0, ancho, y_top) {
  pesos <- pulso_pdf_pesos()
  if (!is.data.frame(general) || !nrow(general)) return(invisible(NULL))
  ind <- names(general)[[1L]]
  filas <- general[!(as.character(general[[ind]]) %in% "Aulas asignadas"), , drop = FALSE]
  if (!nrow(filas)) return(invisible(NULL))

  # La procedencia —«las mismas cifras de la hoja Avance de campo del libro»— es
  # una garantía INTERNA, para que tres superficies no puedan discrepar. Al
  # cliente no le dice nada: él no ve el libro.
  pulso_pdf_rotulo_seccion(x0, y_top + 0.044, "Avance general", tokens = tok, ty = ty,
                           ancho = 0.052)

  w_rot <- 0.330
  w_col <- (ancho - w_rot) / 3
  xs <- c(x0, x0 + w_rot, x0 + w_rot + w_col, x0 + w_rot + 2 * w_col, x0 + ancho)
  # El renglón, por la misma regla que el resto de tablas: con 0,040 tecleados,
  # las diez filas de «Avance general» cruzaban la regla del pie.
  alto <- .marp_reparto_de_filas(nrow(filas), arriba = y_top - 0.030,
                                 abajo = .MARP_MARCO$suelo, alto_max = 0.040,
                                 alto_min = 0.028)$alto

  # Sin banda de relleno: dos hairlines bastan para acotar el encabezado y dejan
  # la tabla más liviana que un bloque de color.
  pulso_pdf_hairline(x0, x0 + ancho, y_top, tokens = tok, lwd = pesos$bloque)
  for (k in 2:4) {
    grid::grid.text(pulso_pdf_versalitas(names(general)[[k]]), x = xs[k + 1L],
                    y = y_top - 0.022, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }
  grid::grid.text(pulso_pdf_versalitas(ind), x = x0, y = y_top - 0.022,
                  just = c("left", "bottom"),
                  gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
  pulso_pdf_hairline(x0, x0 + ancho, y_top - 0.030, tokens = tok, lwd = pesos$columna)

  proporciones <- AULAS_AVANCE_PROPORCIONES$general %||% character(0)
  y <- y_top - 0.030 - alto
  for (i in seq_len(nrow(filas))) {
    rotulo <- as.character(filas[[ind]][[i]])
    # Sin fondos. Una fila se distingue por su aire y por su regla, no por un
    # rectángulo gris: el relleno convierte la tabla en una rejilla y una rejilla
    # se lee peor que una lista. Lo que era fondo tenue ahora es negrita, que ya
    # bastaba para decir «esta fila es un porcentaje».
    destacada <- rotulo %in% proporciones
    grid::grid.text(rotulo, x = x0, y = y + alto / 2, just = c("left", "centre"),
                    gp = grid::gpar(col = tok$ink, fontsize = ty$body,
                                    fontface = if (destacada) "bold" else "plain"))
    for (k in 2:4) {
      v <- filas[[k]][[i]]
      txt <- if (destacada) .marp_pct(v) else .marp_personas(v, faltante = grepl("^Faltantes", rotulo))
      grid::grid.text(txt, x = xs[k + 1L], y = y + alto / 2, just = c("right", "centre"),
                      gp = grid::gpar(col = tok$ink, fontsize = ty$body,
                                      fontface = if (destacada) "bold" else "plain"))
    }
    pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = pesos$fila)
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

  # Las dos cajas se rotulan cada una en su sitio: como llevan una sola serie,
  # no hay nada que distinguir dentro y la leyenda al pie sobraba.
  pulso_pdf_serie_partida(x0 + 0.030, 0.215, ancho - 0.030, 0.575,
                          dias = etiquetas, diarias = serie$efectivas,
                          acumulado = serie$acumulado, metas = metas,
                          tokens = tok, ty = ty, geo = geo,
                          rotulo_acumulado = "Acumulado del campo",
                          rotulo_diario = "Encuestas efectivas por jornada")



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

#' Cuántas columnas para `n` paneles, y cuántos caben por hoja.
#'
#' La rejilla se ADAPTA al número de paneles en vez de ser siempre de tres por
#' dos. Con un estudio de dos facultades, la rejilla fija dibujaba dos paneles
#' pequeños arriba a la izquierda y dejaba el 80 % de la hoja en blanco: la
#' superficie tiene que contener su propio vacío, y una página casi vacía no lo
#' contiene, lo exhibe.
#' @keywords internal
.marp_rejilla_de_paneles <- function(n) {
  columnas <- if (n <= 2L) n else if (n <= 4L) 2L else 3L
  list(columnas = max(1L, columnas), por_hoja = max(1L, columnas * 2L))
}

.marp_paneles_por_facultad <- function(paneles, tok, ty, geo, x0, ancho,
                                       columnas = .marp_rejilla_de_paneles(length(paneles))$columnas) {
  # **Tres columnas y no cuatro.** Con cuatro cabían ocho facultades por hoja,
  # pero cada panel medía 0,21 npc de ancho —siete centímetros en A4 apaisado—
  # y sus cifras salían a 4,6 pt: ilegibles proyectadas o impresas. A tres
  # columnas el panel crece un tercio y el documento gana una hoja, que es un
  # cambio que Gonzalo autorizó explícitamente: «no importa usar más página con
  # tal de que se vea bien».
  # **Cada fila ocupa tres bandas, y las tres se declaran.** El rótulo de la
  # facultad y su cifra por encima del trazado, el trazado, y las fechas por
  # debajo. La versión anterior sólo contaba el trazado y estimaba el resto en un
  # «hueco» único: el título de la segunda fila caía sobre las fechas de la
  # primera. Lo que no se declara, se pisa.
  .BANDA_ROTULO <- 0.058   # nombre de la facultad + «147 de 363 · 40,5 %»
  .BANDA_FECHAS <- 0.034   # «07/09 / lun» bajo el eje
  .AIRE_ENTRE_FILAS <- 0.022
  techo <- .MARP_MARCO$techo
  suelo <- .MARP_MARCO$suelo + .MARP_MARCO$leyenda

  hueco_x <- 0.026
  w <- (ancho - hueco_x * (columnas - 1L)) / columnas
  filas <- max(1L, ceiling(length(paneles) / columnas))
  disponible <- techo - suelo - .AIRE_ENTRE_FILAS * (filas - 1L)
  h <- min(0.420, disponible / filas - .BANDA_ROTULO - .BANDA_FECHAS)
  h <- max(h, 0.120)
  paso_fila <- h + .BANDA_ROTULO + .BANDA_FECHAS + .AIRE_ENTRE_FILAS
  y_primera <- techo - .BANDA_ROTULO - h

  for (k in seq_along(paneles)) {
    p <- paneles[[k]]
    i <- (k - 1L) %% columnas
    j <- (k - 1L) %/% columnas
    px <- x0 + i * (w + hueco_x)
    py <- y_primera - j * paso_fila

    conseguidas <- if (nrow(p$serie)) p$serie$acumulado[[nrow(p$serie)]] else 0
    meta <- suppressWarnings(as.numeric(p$meta))
    avance <- if (length(meta) && is.finite(meta) && meta > 0) conseguidas / meta else NA_real_

    nombre <- .form_pdf_clean_text(p$facultad)
    tope <- pulso_pdf_chars(w, factor = 112)
    if (nchar(nombre) > tope) nombre <- paste0(substr(nombre, 1L, tope - 3L), "...")
    grid::grid.text(nombre, x = px, y = py + h + 0.034, just = c("left", "bottom"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$body, fontface = "bold"))
    grid::grid.text(
      sprintf("%s de %s  ·  %s", .marp_personas(conseguidas),
              if (is.finite(meta)) .marp_personas(meta) else "-", .marp_pct(avance)),
      x = px, y = py + h + 0.012, just = c("left", "bottom"),
      gp = grid::gpar(col = tok$soft, fontsize = ty$caption))

    # Una sola meta por panel: la de la muestra. La sobremuestra se lee en las
    # tarjetas y en las tablas, no aquí.
    metas <- if (is.finite(meta) && meta > 0) stats::setNames(meta, "") else numeric(0)
    pulso_pdf_serie_diaria(px, py, w, h,
                           dias = .marp_etiquetas_de_dia(p$serie),
                           diarias = p$serie$efectivas, acumulado = p$serie$acumulado,
                           metas = metas, tokens = tok, ty = ty, geo = geo,
                           compacto = TRUE)
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

  cortes <- if (n >= .MARP_UMBRAL_DOS_FILAS) {
    mitad <- ceiling(n / 2)
    list(seq_len(mitad), seq.int(mitad + 1L, n))
  } else list(seq_len(n))

  # **Misma escala, altos distintos.** La regla de Gonzalo es que todas las
  # facultades se midan con la misma vara, y eso se cumple manteniendo constante
  # los npc por encuesta. Lo que NO hay que mantener constante es el alto de la
  # caja: con las dos filas igual de altas, la de abajo —cuyas facultades no
  # pasan de cien— salía con tres cuartos de aire vacío mientras la de arriba
  # iba apretada. Cada fila recibe el alto que le corresponde por su techo, así
  # que un centímetro sigue valiendo lo mismo en las dos.
  rejillas <- lapply(cortes, function(idx) {
    .ppd_eje_bonito(max(c(meta_h[idx], meta_m[idx], ef_h[idx], ef_m[idx], 1), na.rm = TRUE),
                    pasos = 4L)
  })
  # Aire sobre el carril más alto: sin él, el porcentaje del que llega al techo
  # se dibuja fuera de la caja y no aparece en el documento.
  topes <- vapply(rejillas, function(r) max(r) * 1.10, numeric(1))

  # La banda bajo cada fila creció al añadir la inicial de serie (H / M) entre
  # el eje y el nombre de la facultad: el trazado cede ese espacio en vez de
  # empujar los rótulos sobre el pie, que es lo que pasó al añadirla.
  # Techo menos el rótulo de sección de la leyenda, suelo más la leyenda misma.
  .MARP_ALTO_TRAZADO <- 0.460   # lo que queda entre la leyenda y el pie
  .MARP_ALTO_MINIMO <- 0.092    # una fila nunca baja de aquí, aunque su techo sea ínfimo
  altos <- .MARP_ALTO_TRAZADO * topes / sum(topes)
  altos <- pmax(altos, .MARP_ALTO_MINIMO)
  if (sum(altos) > .MARP_ALTO_TRAZADO) altos <- altos * (.MARP_ALTO_TRAZADO / sum(altos))

  # Bajo cada fila: la inicial de serie y hasta tres renglones de nombre.
  hueco_rotulos <- 0.104
  y_fila <- numeric(length(cortes))
  techo <- 0.740
  for (f in seq_along(cortes)) {
    y_fila[[f]] <- techo - altos[[f]]
    techo <- y_fila[[f]] - hueco_rotulos
  }

  for (f in seq_along(cortes)) {
    idx <- cortes[[f]]
    pulso_pdf_barras_meta(
      x0 + 0.030, y_fila[[f]], ancho - 0.030, altos[[f]],
      categorias = nombres[idx],
      series = list(
        list(nombre = "Hombres", inicial = "H", color = tok$sexo_h,
             meta = meta_h[idx], valor = ef_h[idx]),
        list(nombre = "Mujeres", inicial = "M", color = tok$sexo_m,
             meta = meta_m[idx], valor = ef_m[idx])
      ),
      tope = topes[[f]], tokens = tok, ty = ty, rejilla = rejillas[[f]][-1])
  }

  pulso_pdf_leyenda(x0, 0.775, list(
    list(texto = "Hombres", color = tok$sexo_h, forma = "barra"),
    list(texto = "Mujeres", color = tok$sexo_m, forma = "barra"),
    list(texto = "Cuota del diseño", color = tok$faint, forma = "contorno")
  ), tokens = tok, ty = ty, centrado = TRUE, ancho = ancho)
  invisible(NULL)
}

# --- Página «Avance por facultad y sexo» ------------------------------------
#
# La tabla con la barra dentro, que es como se lee en la app. La versión de
# diecisiete columnas sigue al final del documento: ésta responde «¿cómo va?» de
# un vistazo, aquélla responde «¿cuánto exactamente?».

# --- Cómo se reparten n filas entre hojas ------------------------------------
#
# Dos reglas, en orden, y las MISMAS para todas las tablas del documento:
#
#   1. Si todo cabe apretando el renglón hasta el mínimo legible, cabe. Una hoja
#      llena se lee mejor que dos medio vacías, y una tabla partida obliga a
#      recordar la primera mitad mientras se lee la segunda.
#   2. Si de verdad no cabe, las filas se reparten PAREJAS entre las hojas que
#      hagan falta, en vez de llenar la primera y dejar la última coja.
#
# Vivía escrita dos veces —una en la tabla de detalle y otra aquí—, y la segunda
# copia se quedó sin la regla 1: quince facultades que cabían en una hoja salían
# repartidas en dos de ocho y siete, con media página en blanco en cada una.

#' @param n filas a repartir.
#' @param arriba,abajo los npc donde empieza y acaba el área de tabla.
#' @param alto_max,alto_min renglón cómodo y renglón mínimo legible.
#' @return lista con `por_hoja`, `hojas` y el `alto` de fila resultante.
#' @keywords internal
.marp_reparto_de_filas <- function(n, arriba, abajo, alto_max, alto_min) {
  n <- max(1L, as.integer(n))
  util <- max(alto_min, arriba - abajo)
  alto <- if (n * alto_min <= util) min(alto_max, util / n) else alto_max
  por_hoja <- max(1L, floor(util / alto))
  hojas <- max(1L, ceiling(n / por_hoja))
  por_hoja <- ceiling(n / hojas)
  list(por_hoja = por_hoja, hojas = hojas, alto = alto)
}

.MARP_TABLA_AVANCE <- list(arriba = 0.763, abajo = .MARP_MARCO$suelo,
                           alto_max = 0.046, alto_min = 0.036)

.marp_reparto_avance <- function(n) {
  do.call(.marp_reparto_de_filas, c(list(n = n), .MARP_TABLA_AVANCE))
}

# **Una fila por facultad, no tres.** La versión anterior daba a cada facultad un
# renglón de nombre y dos de sexo, y quince facultades se comían TRES hojas
# diciendo exactamente los mismos números que «Detalle por facultad» dice en una.
# Lo único que aportaba sobre el detalle era la barra; lo que costaba era la
# forma. Con los dos sexos en columnas —cada uno con su barra y su porcentaje—
# las quince entran en una hoja y el documento pasa de seis páginas de facultades
# a cuatro.
.marp_pagina_avance_visual <- function(facultades, idx, tok, ty, x0, ancho,
                                       aulas_plan = numeric(0),
                                       filas_por_hoja = length(idx)) {
  pesos <- pulso_pdf_pesos()
  col <- function(k, i) suppressWarnings(as.numeric(facultades[[k]][[i]]))

  w_fac <- 0.240
  w_sexo <- 0.155          # barra + porcentaje, una columna por sexo
  w_num <- 0.070
  x_fac <- x0
  x_h <- x_fac + w_fac
  x_m <- x_h + w_sexo + 0.012
  x_num <- (x_m + w_sexo + 0.020) + (seq_len(4L) - 1L) * w_num

  y_top <- 0.795
  banda <- function(desde, hasta, texto) {
    grid::grid.text(pulso_pdf_versalitas(texto), x = (desde + hasta) / 2, y = y_top + 0.016,
                    just = c("centre", "bottom"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$eyebrow, fontface = "bold"))
    pulso_pdf_hairline(desde, hasta, y_top + 0.010, tokens = tok, lwd = pesos$fila)
  }
  banda(x_h, x_h + w_sexo, "Hombres")
  banda(x_m, x_m + w_sexo, "Mujeres")
  banda(x_num[[1L]], x_num[[4L]] + w_num, "Totales de la facultad")

  pulso_pdf_hairline(x0, x0 + ancho, y_top, tokens = tok, lwd = pesos$bloque)
  cab <- function(txt, x, just = "right") {
    grid::grid.text(pulso_pdf_versalitas(txt), x = x, y = y_top - 0.024,
                    just = c(just, "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }
  cab("Facultad", x_fac, "left")
  cab("Avance", x_h, "left")
  cab("Avance", x_m, "left")
  for (k in seq_along(c("Efectivas", "Meta", "Faltan", "Aulas"))) {
    cab(c("Efectivas", "Meta", "Faltan", "Aulas")[[k]], x_num[[k]] + w_num)
  }
  pulso_pdf_hairline(x0, x0 + ancho, y_top - 0.032, tokens = tok, lwd = pesos$columna)

  alto <- .marp_reparto_avance(filas_por_hoja)$alto
  y <- y_top - 0.032
  for (i in idx) {
    y <- y - alto
    nombre <- .form_pdf_clean_text(as.character(facultades[["Facultad"]][[i]]))
    tope_txt <- pulso_pdf_chars(w_fac, factor = 118) - 1L
    if (nchar(nombre) > tope_txt) nombre <- paste0(substr(nombre, 1L, tope_txt - 3L), "...")
    grid::grid.text(nombre, x = x_fac, y = y + alto / 2, just = c("left", "centre"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$body, fontface = "bold"))

    for (s in list(list("hombres", tok$sexo_h, x_h), list("mujeres", tok$sexo_m, x_m))) {
      ef <- col(paste("Efectivas", s[[1L]]), i)
      meta <- col(paste("Muestra", s[[1L]]), i)
      pct <- if (is.finite(meta) && meta > 0) ef / meta else NA_real_
      w_barra <- w_sexo - 0.048
      pulso_pdf_barra_progreso(s[[3L]], y + alto * 0.34, w_barra, alto * 0.30,
                               pct, tokens = tok, color = s[[2L]], fondo = tok$canvas)
      grid::grid.text(.marp_pct(pct), x = s[[3L]] + w_sexo, y = y + alto / 2,
                      just = c("right", "centre"),
                      gp = grid::gpar(col = tok$ink, fontsize = ty$body))
    }

    faltan <- col("Faltantes muestra", i)
    cerrada <- is.finite(faltan) && faltan <= 0
    previstas <- suppressWarnings(as.numeric(
      aulas_plan[[as.character(facultades[["Facultad"]][[i]])]] %||% NA_real_))
    cifras <- list(
      list(.marp_personas(col("Efectivas", i)), tok$ink, "plain"),
      list(.marp_personas(col("Muestra", i)), tok$ink, "plain"),
      list(.marp_personas(faltan, faltante = TRUE),
           if (cerrada) tok$success else tok$ink, if (cerrada) "bold" else "plain"),
      list(if (is.finite(previstas) && previstas > 0) {
             sprintf("%s / %s", .marp_personas(col("Aulas aplicadas", i)),
                     .marp_personas(previstas))
           } else .marp_personas(col("Aulas aplicadas", i)), tok$soft, "plain")
    )
    for (k in seq_along(cifras)) {
      grid::grid.text(cifras[[k]][[1L]], x = x_num[[k]] + w_num, y = y + alto / 2,
                      just = c("right", "centre"),
                      gp = grid::gpar(col = cifras[[k]][[2L]], fontsize = ty$body,
                                      fontface = cifras[[k]][[3L]]))
    }
    pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = pesos$fila)
  }
  invisible(NULL)
}

# --- La tabla de detalle, una hoja por meta ----------------------------------
#
# Dibuja UN juego de columnas sobre las filas indicadas. El llamador decide qué
# columnas: hoy son dos hojas —muestra y sobremuestra— que comparten facultad,
# las tres de «Efectivas» y las aulas, porque son el contexto contra el que se
# lee cualquiera de las dos metas y quien tenga delante una sola hoja tiene que
# poder leerla sola.

.marp_tabla_detalle <- function(df, filas, columnas, tok, ty, x0,
                                y_tabla, alto_fila, criterio = NULL) {
  pesos <- pulso_pdf_pesos()
  anchos <- vapply(columnas, function(c) c$w, numeric(1))
  xs <- cumsum(c(x0, anchos))
  ancho_total <- sum(anchos)

  # Banda de grupo: «Hom.» y «Muj.» aparecen bajo «Efectivas» y bajo la meta, y
  # sin el grupo no se sabe cuál es cuál. Los tramos se DERIVAN del campo
  # `grupo` de cada columna —columnas contiguas con el mismo grupo forman una
  # banda—, nunca de índices contados a mano.
  etiquetas <- vapply(columnas, function(c) c$grupo, character(1))
  i <- 1L
  while (i <= length(etiquetas)) {
    if (!nzchar(etiquetas[[i]])) { i <- i + 1L; next }
    j <- i
    while (j < length(etiquetas) && identical(etiquetas[[j + 1L]], etiquetas[[i]])) j <- j + 1L
    grid::grid.text(pulso_pdf_versalitas(etiquetas[[i]]),
                    x = (xs[i] + xs[j + 1L]) / 2, y = y_tabla + 0.050,
                    just = c("centre", "bottom"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$eyebrow, fontface = "bold"))
    pulso_pdf_hairline(xs[i], xs[j + 1L], y_tabla + 0.044, tokens = tok, lwd = 0.8)
    i <- j + 1L
  }

  pulso_pdf_hairline(x0, x0 + ancho_total, y_tabla + 0.030, tokens = tok, lwd = pesos$bloque)
  for (i in seq_along(columnas)) {
    c <- columnas[[i]]
    grid::grid.text(pulso_pdf_versalitas(c$rotulo),
                    x = if (c$num) xs[i + 1L] - 0.006 else xs[i] + 0.006,
                    y = y_tabla + 0.010, just = c(if (c$num) "right" else "left", "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }
  pulso_pdf_hairline(x0, x0 + ancho_total, y_tabla, tokens = tok, lwd = pesos$columna)

  y <- y_tabla - alto_fila
  for (n in seq_along(filas)) {
    fila <- df[filas[[n]], , drop = FALSE]
    # Sin zebra: quince rectángulos grises alternos hacen ruido y no ayudan a
    # seguir el renglón —para eso está la hairline bajo cada fila—.
    for (i in seq_along(columnas)) {
      c <- columnas[[i]]
      v <- fila[[c$campo]]
      es_falta <- startsWith(c$campo, "Faltantes")
      if (identical(c$campo, "Facultad")) {
        nombre <- .form_pdf_clean_text(as.character(v))
        tope <- pulso_pdf_chars(c$w, factor = 118) - 1L
        # Elipsis en TRES PUNTOS ASCII: el device PDF no tiene el U+2026 y R lo
        # sustituye con aviso, así que en el documento salía otro carácter.
        if (nchar(nombre) > tope) nombre <- paste0(substr(nombre, 1L, tope - 3L), "...")
        grid::grid.text(nombre, x = xs[i], y = y + alto_fila / 2,
                        just = c("left", "centre"),
                        gp = grid::gpar(col = tok$ink, fontsize = ty$body))
        next
      }
      falta <- suppressWarnings(as.numeric(v))
      cerrada <- es_falta && is.finite(falta) && falta <= 0
      grid::grid.text(.marp_personas(v, faltante = es_falta),
                      x = xs[i + 1L] - 0.004, y = y + alto_fila / 2,
                      just = c("right", "centre"),
                      gp = grid::gpar(col = if (cerrada) tok$success else tok$ink,
                                      fontsize = ty$body,
                                      fontface = if (cerrada) "bold" else "plain"))
    }
    pulso_pdf_hairline(x0, xs[length(xs)], y, tokens = tok, lwd = pesos$fila)
    y <- y - alto_fila
  }

  if (!is.null(criterio)) {
    # ENVUELTO, no `grid.text`: es una frase larga y sin envoltura se salía por
    # el borde derecho —«…que el diseño fijó por fa»—.
    .form_pdf_text(
      paste0("Se cuentan ", criterio$numerador, " contra ", criterio$denominador,
             ". ", criterio$no_cubre),
      x = x0, y = max(0.095, y - 0.014), w = ancho_total,
      chars = pulso_pdf_chars(ancho_total), fontsize = ty$caption,
      col = tok$faint, line_h = 0.020)
  }
  invisible(NULL)
}

# --- Página de cierre: cómo se mide ------------------------------------------
#
# El criterio vivía como un párrafo al pie de la última tabla, donde competía
# con la fila final y no lo leía nadie. Es la parte del documento que sostiene
# todas las demás: define qué cuenta como encuesta y contra qué se mide. En un
# entregable de consultoría eso no es una nota al pie, es la página de cierre.
#
# No es sobreexplicar —la regla que Gonzalo fijó el 2026-09-11—: un cliente sabe
# lo que es su propia cuota, pero no tiene por qué saber qué filtros aplica el
# estudio para dar una respuesta por efectiva, ni con qué corte se cerró la
# medición. Eso es procedencia, y la procedencia viaja con el número.

.marp_pagina_criterio <- function(model, tok, ty, x0, ancho) {
  pesos <- pulso_pdf_pesos()
  criterio <- model$criterio %||% list()
  ritmo <- model$ritmo

  mayuscula <- function(txt) {
    if (!nzchar(txt)) return(txt)
    paste0(toupper(substr(txt, 1L, 1L)), substr(txt, 2L, nchar(txt)))
  }

  bloques <- list(
    list("Qué cuenta como encuesta efectiva",
         mayuscula(paste0(criterio$numerador %||% "", "."))),
    list("Contra qué se mide",
         mayuscula(paste0(criterio$denominador %||% "", "."))),
    list("Por qué los faltantes no se netean",
         paste("La cuota es de cada facultad y de cada sexo. Cubrir de más en una no cubre",
               "lo que falta en otra, así que el total de faltantes suma los de cada celda",
               "en vez de netearlos."))
  )
  if (nzchar(criterio$no_cubre %||% "")) {
    bloques[[length(bloques) + 1L]] <- list("La sobremuestra", criterio$no_cubre)
  }

  w_rotulo <- 0.250
  w_texto <- ancho - w_rotulo - 0.030

  # **Los cuatro rótulos se espacian o no se espacia ninguno.** Dejando que cada
  # uno decida por su cuenta, «LA SOBREMUESTRA» salía con aire y «POR QUÉ LOS
  # FALTANTES NO SE NETEAN» sin él, en la misma columna y a la misma altura: una
  # discrepancia que se lee como error de composición, no como adaptación.
  cabe_espaciado <- all(vapply(bloques, function(b) {
    identical(pulso_pdf_versalitas(b[[1L]], ancho = w_rotulo, fontsize = ty$eyebrow),
              pulso_pdf_versalitas(b[[1L]]))
  }, logical(1)))

  # El alto se reparte entre los bloques que haya, para que la página cierre
  # llena tanto con tres definiciones como con cinco.
  y_alto <- 0.760; y_bajo <- 0.290
  paso <- (y_alto - y_bajo) / length(bloques)
  y <- y_alto
  for (k in seq_along(bloques)) {
    b <- bloques[[k]]
    # La primera no lleva regla: una hairline pegada bajo el cromo se lee como
    # una segunda línea de cabecera.
    if (k > 1L) pulso_pdf_hairline(x0, x0 + ancho, y + paso * 0.30, tokens = tok, lwd = pesos$fila)
    grid::grid.text(if (cabe_espaciado) pulso_pdf_versalitas(b[[1L]]) else toupper(b[[1L]]),
                    x = x0, y = y, just = c("left", "top"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$eyebrow, fontface = "bold"))
    .form_pdf_text(b[[2L]], x = x0 + w_rotulo + 0.030, y = y + 0.006, w = w_texto,
                   chars = pulso_pdf_chars(w_texto, factor = 118), fontsize = ty$body,
                   col = tok$ink, line_h = 0.026)
    y <- y - paso
  }

  # La procedencia del corte, al pie y en su propia franja.
  pulso_pdf_hairline(x0, x0 + ancho, y + paso * 0.30, tokens = tok, lwd = pesos$columna)
  dias <- length(ritmo$dias %||% character(0))
  datos <- list(
    list("Corte de los datos", model$portada_defecto$corte %||% ""),
    list("Periodo de campo", model$portada_defecto$periodo %||% ""),
    list("Jornadas con aplicación", if (dias) format(dias, big.mark = ",") else "")
  )
  datos <- Filter(function(d) nzchar(d[[2L]]), datos)
  if (length(datos)) {
    w_col <- ancho / length(datos)
    for (k in seq_along(datos)) {
      x <- x0 + (k - 1L) * w_col
      grid::grid.text(pulso_pdf_versalitas(datos[[k]][[1L]], ancho = w_col - 0.020,
                                           fontsize = ty$eyebrow),
                      x = x, y = y - 0.010, just = c("left", "top"),
                      gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
      grid::grid.text(datos[[k]][[2L]], x = x, y = y - 0.046, just = c("left", "top"),
                      gp = grid::gpar(col = tok$ink, fontsize = ty$body))
    }
  }
  invisible(NULL)
}
