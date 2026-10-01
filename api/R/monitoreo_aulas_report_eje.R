# El PDF de avance a cliente cuando las metas NO son por facultad.
#
# Gonzalo, 2026-09-28: «Necesito que en entregables el motor pdf también sea
# capaz de producir un avance para el cliente de la misma forma de
# Hostigamiento pero tomando en cuenta que este tipo de estudio es para una
# facultad y las metas por nivel curricular».
#
# POR QUÉ UN FLUJO PROPIO Y NO RÓTULOS NUEVOS SOBRE EL DE HSVG
#
# El documento de HSVG está construido sobre el supuesto de que la celda de la
# cuota ES una facultad: sus páginas «Metas por facultad» y «Avance por
# facultad y sexo» dibujan carriles de hombres y mujeres por celda, y cuentan
# cursos-horario aplicados por celda. Con el eje por PERSONA (ADR 0086–0088)
# ninguna de las dos cosas existe: el bloque de cuota no reparte sexo por celda
# y un aula no pertenece a un nivel. Relabelar «facultad» por «nivel» dejaba
# páginas de carriles vacíos, y con CCSS Perfil 2026-II el documento ni se
# generaba —`.marp_bloque_sexo` reventaba sin columnas de sexo—.
#
# Y HSVG está entregando: su documento no puede cambiar un byte. Así que el
# despacho es por el EJE que declara el bloque, y este archivo es el flujo
# entero del otro caso; el de HSVG no se toca.
#
# EL CONTENIDO NO SE RECALCULA
#
# Todo sale de `monitoreo_aulas_avance_cuota_del_plan()` —celdas, brecha,
# bolsas fuera de meta, composición—, el mismo bloque que publica el tablero.
# Aquí sólo se elige qué se muestra y con qué palabras.

# --- Modelo ------------------------------------------------------------------

#' ¿La celda de la cuota es algo distinto de la facultad?
#' @keywords internal
.marp_eje_no_es_facultad <- function(model) {
  clave <- .monitoreo_scalar((model$eje %||% list())$clave, "facultad")
  nzchar(clave) && !identical(clave, "facultad")
}

# Los rótulos del eje en las tres formas que usa el documento.
.marp_rotulos_eje <- function(eje) {
  sing <- .monitoreo_scalar((eje %||% list())$etiqueta, "Facultad")
  plur <- .monitoreo_scalar((eje %||% list())$etiqueta_plural, paste0(sing, "es"))
  list(Singular = sing, singular = tolower(sing), Plural = plur, plural = tolower(plur))
}

# «6» se dice «Nivel 6»; una carrera se dice por su nombre, sin mayúsculas
# sostenidas.
.marp_rotulo_celda <- function(valor, eje) {
  v <- trimws(as.character(valor))
  r <- .marp_rotulos_eje(eje)
  ifelse(grepl("^[0-9]+$", v), paste(r$Singular, v),
         vapply(v, .ana_bloque, character(1), USE.NAMES = FALSE))
}

# El ámbito del estudio: la facultad cuando el plan entero vive en una sola.
# Es el ENCABEZADO del documento, no un desglose —una fila al 100 % no es
# información—.
.marp_ambito_del_plan <- function(plan) {
  fac <- unique(trimws(vapply(plan %||% list(), function(u) .cai_txt(u$faculty), character(1))))
  fac <- fac[nzchar(fac)]
  if (length(fac) != 1L) return("")
  nombre <- .ana_bloque(fac)
  if (grepl("^facultad\\b", nombre, ignore.case = TRUE)) nombre else paste("Facultad de", nombre)
}

# Lo que no entra en ninguna meta, con su desglose. Se LEE del invariante del
# bloque (`total$invariante`), que ya garantiza que las bolsas suman el total.
.marp_fuera_de_meta <- function(bloque) {
  tot <- (bloque %||% list())$total %||% list()
  inv <- tot$invariante %||% list()
  partes <- inv$partes %||% list()
  n <- function(x) { v <- suppressWarnings(as.integer(x %||% 0L)); if (length(v) && !is.na(v[[1L]])) v[[1L]] else 0L }
  celdas_fuera <- Filter(function(f) identical(.monitoreo_scalar(f$estado, ""), "fuera_del_diseno"),
                         bloque$facultades %||% list())
  fuera_df <- data.frame(
    valor = vapply(celdas_fuera, function(f) .monitoreo_scalar(f$facultad, ""), character(1)),
    n = vapply(celdas_fuera, function(f) n(f$respuestas_validas), integer(1)),
    stringsAsFactors = FALSE
  )
  if (nrow(fuera_df)) {
    num <- suppressWarnings(as.numeric(fuera_df$valor))
    fuera_df <- fuera_df[order(ifelse(is.na(num), Inf, num), fuera_df$valor), , drop = FALSE]
  }
  en_meta <- n(partes$en_celdas)
  efectivas <- n(inv$total)
  list(
    efectivas = efectivas,
    en_meta = en_meta,
    fuera = max(0L, efectivas - en_meta),
    sin_celda = n(partes$sin_celda),
    sin_eje = n(partes$sin_eje),
    duplicadas = n(partes$duplicadas),
    fuera_universo = n(partes$fuera_universo),
    huerfanas = n(partes$huerfanas),
    celdas_fuera = fuera_df
  )
}

# Las celdas del diseño en su orden natural: por valor cuando son números
# (niveles 6, 7, 8, 9), por nombre si no. El orden por lo que falta es de una
# tabla que se busca; éste es el de un plan que se lee.
.marp_celdas_ordenadas <- function(df) {
  v <- as.character(df[["Facultad"]])
  num <- suppressWarnings(as.numeric(v))
  df[order(ifelse(is.na(num), Inf, num), v), , drop = FALSE]
}

# --- Plan del documento ------------------------------------------------------

#' Secciones del documento por eje, con sus hojas.
#' @keywords internal
.marp_plan_por_eje <- function(model) {
  r <- .marp_rotulos_eje(model$eje)
  ritmo <- model$ritmo
  hay_ritmo <- is.list(ritmo) && is.data.frame(ritmo$total) && nrow(ritmo$total) > 0L
  secciones <- list(
    list(paste("Avance por", r$singular), 1L),
    list("Ritmo del campo", if (hay_ritmo) 1L else 0L),
    list("Composición de lo obtenido", if (.marp_hay_composicion(model$composicion)) 1L else 0L)
  )
  secciones <- Filter(function(s) s[[2L]] > 0L, secciones)
  data.frame(
    seccion = vapply(secciones, function(s) s[[1L]], character(1)),
    hojas = vapply(secciones, function(s) as.integer(s[[2L]]), integer(1)),
    stringsAsFactors = FALSE
  )
}

.marp_hay_composicion <- function(comp) {
  is.list(comp) && identical(.monitoreo_scalar(comp$fuente, ""), "padron") &&
    .marp_num(comp$personas, 0) > 0 && length(comp$dimensiones %||% list()) > 0L
}

# --- Render ------------------------------------------------------------------

#' PDF de avance a cliente con la cuota por un eje que no es la facultad.
#'
#' Mismos argumentos que [monitoreo_aulas_advance_report_pdf()], que despacha
#' aquí cuando `model$eje` no es la facultad.
#' @keywords internal
.marp_documento_por_eje <- function(model, output_file, periodo = "", portada = list(),
                                    con_portada = TRUE) {
  tok <- pulso_pdf_tokens()
  ty <- pulso_pdf_type("cliente")
  geo <- pulso_pdf_geo("landscape")
  r <- .marp_rotulos_eje(model$eje)
  ambito <- .monitoreo_scalar(model$ambito, "")
  df <- .marp_celdas_ordenadas(model$facultades)

  pulso_pdf_abrir(output_file, geo = geo)
  on.exit(grDevices::dev.off(), add = TRUE)

  x0 <- 0.04
  ancho_util <- 1 - 2 * x0
  total_paginas <- sum(.marp_plan_por_eje(model)$hojas)
  # El chip de contexto de cada hoja es la FACULTAD: dice de qué estudio es la
  # página sin gastar una fila de tabla en decirlo.
  antetitulo <- if (nzchar(ambito)) ambito else "Avance del trabajo de campo"
  pag <- 0L
  nueva <- function(sec_titulo, sec_subtitulo = "") {
    grid::grid.newpage()
    pag <<- pag + 1L
    pulso_pdf_cromo(antetitulo, sec_titulo, sec_subtitulo, tokens = tok, ty = ty, geo = geo)
  }

  t <- model$total
  if (isTRUE(con_portada)) {
    port <- pulso_pdf_portada_normalizar(
      defectos = model$portada_defecto %||% list(titulo = "Avance del trabajo de campo"),
      usuario = portada
    )
    grid::grid.newpage()
    # La facultad ya es el subtítulo por defecto: repetirla encima es un eco.
    ante_portada <- if (identical(port$subtitulo, antetitulo)) "" else antetitulo
    pulso_pdf_portada(port, tokens = tok, ty = ty, geo = geo, reparto = "contenido",
                      antetitulo = ante_portada, destacados = list(
      list(rotulo = "Avance de la muestra", valor = .marp_pct(t$avance)),
      # «Efectivas» son las que aceptaron (430); éstas además forman parte del
      # estudio (Gonzalo, 2026-09-28). Dos cosas, dos nombres.
      list(rotulo = "Encuestas del estudio", valor = .marp_personas(t$conseguidas)),
      list(rotulo = "Faltan", valor = .marp_personas(t$faltan, faltante = TRUE))
    ))
    if (!nzchar(periodo) && nzchar(port$periodo)) periodo <- port$periodo
  }
  if (!nzchar(periodo)) periodo <- format(Sys.Date(), "%m-%Y")
  pie <- function() pulso_pdf_pie(pag, total_paginas, periodo, tokens = tok, ty = ty, geo = geo)

  nueva(paste("Avance por", r$singular))
  .marp_eje_pagina_avance(model, df, r, tok, ty, x0, ancho_util)
  pie()

  ritmo <- model$ritmo
  if (is.list(ritmo) && is.data.frame(ritmo$total) && nrow(ritmo$total)) {
    nueva("Ritmo del campo")
    # Las barras suman las que CUENTAN (324), no las efectivas (430) que el
    # resumen nombra: con el rótulo de HSVG, la misma palabra decía dos cifras.
    .marp_pagina_ritmo(ritmo, tok, ty, geo, x0, ancho_util,
                       rotulo_diario = "Encuestas del estudio por jornada")
    pie()
  }

  if (.marp_hay_composicion(model$composicion)) {
    nueva("Composición de lo obtenido")
    .marp_eje_pagina_composicion(model$composicion, df, r, tok, ty, x0, ancho_util)
    pie()
  }
  invisible(output_file)
}

# La página que responde «¿se llega a la meta?», con la gramática del resumen
# de HSVG (`.marp_pagina_resumen`): la franja de tarjetas, una barra por celda
# con su rótulo a la izquierda y su cifra a la derecha, y la tabla traspuesta
# «Avance general». Sin leyendas grises que narren lo que ya está dibujado
# (Gonzalo, 2026-09-28: «quita las notas grises que no sirven»). La regla del
# ADR 0079 no se narra: la columna TOTAL de «Faltantes» es la suma de las de
# cada celda, y se lee.
.marp_eje_pagina_avance <- function(model, df, r, tok, ty, x0, ancho) {
  t <- model$total
  fm <- model$fuera_de_meta %||% list()
  huecos <- 0.016
  w_slot <- (ancho - huecos * 4) / 5
  y_kpi <- 0.672; h_kpi <- 0.170
  x_slot <- function(i) x0 + (i - 1L) * (w_slot + huecos)

  .marp_kpi_principal(x_slot(1L), y_kpi, w_slot * 2 + huecos, h_kpi, t, tok, ty, tok$navy)
  kpi <- function(i, rotulo, valor, nota) {
    pulso_pdf_kpi(x_slot(i), y_kpi, w_slot, h_kpi, rotulo, valor, nota,
                  tokens = tok, ty = ty, tono = tok$navy)
  }
  # Las OBTENIDAS —las efectivas que forman parte del estudio—, no las 430
  # efectivas: ésas sólo se nombran en la nota al pie (Gonzalo, 2026-09-28).
  kpi(3L, "Encuestas obtenidas", .marp_personas(t$conseguidas), "")
  n_celdas <- nrow(df)
  abiertas <- as.integer(.marp_num(t$facultades_abiertas, 0))
  kpi(4L, sprintf("%s que llegaron a la meta", r$Plural),
      .marp_personas(n_celdas - abiertas), sprintf("de %s", .marp_personas(n_celdas)))
  kpi(5L, "Faltan", .marp_personas(t$faltan, faltante = TRUE),
      if (abiertas == 1L) sprintf("en 1 %s", r$singular) else sprintf("en %d %s", abiertas, r$plural))

  num <- function(k) suppressWarnings(as.numeric(df[[k]]))
  meta <- num("Muestra"); ef <- num("Efectivas"); falta <- num("Faltantes muestra")
  rot <- .marp_rotulo_celda(df[["Facultad"]], model$eje)

  # Una barra por celda, como Hombres/Mujeres en el resumen de HSVG.
  y_bar <- 0.586
  hueco_bar <- 0.040
  w_bar <- (ancho - hueco_bar * (n_celdas - 1L)) / max(1L, n_celdas)
  for (i in seq_len(n_celdas)) {
    x <- x0 + (i - 1L) * (w_bar + hueco_bar)
    avance <- if (is.finite(meta[[i]]) && meta[[i]] > 0) ef[[i]] / meta[[i]] else NA_real_
    grid::grid.text(rot[[i]], x = x, y = y_bar + 0.020, just = c("left", "bottom"),
                    gp = grid::gpar(col = tok$ink, fontsize = ty$body, fontface = "bold"))
    grid::grid.text(sprintf("%s de %s (%s)", .marp_personas(ef[[i]]), .marp_personas(meta[[i]]),
                            .marp_pct(avance)),
                    x = x + w_bar, y = y_bar + 0.020, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$soft, fontsize = ty$body))
    pulso_pdf_medidor(x, y_bar, w_bar, 0.014, .marp_num(avance, 0), tokens = tok,
                      tono = tok$navy, fondo = tok$tbl_header)
  }

  # «Avance general», traspuesta: una fila por concepto, una columna por celda.
  tabla <- data.frame(
    Indicadores = c("Encuestas del estudio", "Muestra", "Avance muestra", "Faltantes para la muestra"),
    Total = c(.marp_num(t$conseguidas), .marp_num(t$muestra), .marp_num(t$avance), .marp_num(t$faltan)),
    stringsAsFactors = FALSE, check.names = FALSE
  )
  for (i in seq_len(n_celdas)) {
    tabla[[rot[[i]]]] <- c(ef[[i]], meta[[i]],
                           if (is.finite(meta[[i]]) && meta[[i]] > 0) ef[[i]] / meta[[i]] else NA_real_,
                           falta[[i]])
  }
  lineas_nota <- .marp_eje_lineas_nota(.marp_eje_nota_fuera_de_meta(fm, r), ancho)
  .marp_eje_tabla_general(tabla, tok, ty, x0, ancho, y_top = 0.500,
                          suelo = .MARP_MARCO$suelo + .marp_eje_alto_nota(lineas_nota))
  .marp_eje_dibujar_nota(lineas_nota, tok, ty, x0, ancho)
  invisible(NULL)
}

# La tabla traspuesta con N columnas. Misma factura que `.marp_tabla_general`
# —filetes sin relleno, cabeceras en versalitas, la fila de proporción en
# negrita—, que tiene sus tres columnas fijas (Total, Hombres, Mujeres).
.marp_eje_tabla_general <- function(tabla, tok, ty, x0, ancho, y_top, suelo) {
  pesos <- pulso_pdf_pesos()
  pulso_pdf_rotulo_seccion(x0, y_top + 0.044, "Avance general", tokens = tok, ty = ty,
                           ancho = 0.052)
  n_val <- ncol(tabla) - 1L
  w_rot <- 0.330
  w_col <- (ancho - w_rot) / n_val
  x_der <- x0 + w_rot + seq_len(n_val) * w_col
  alto <- .marp_reparto_de_filas(nrow(tabla), arriba = y_top - 0.030, abajo = suelo,
                                 alto_max = 0.040, alto_min = 0.028)$alto
  pulso_pdf_hairline(x0, x0 + ancho, y_top, tokens = tok, lwd = pesos$bloque)
  for (k in seq_len(n_val)) {
    grid::grid.text(pulso_pdf_versalitas(names(tabla)[[k + 1L]]), x = x_der[[k]],
                    y = y_top - 0.022, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
  }
  pulso_pdf_hairline(x0, x0 + ancho, y_top - 0.030, tokens = tok, lwd = pesos$columna)
  y <- y_top - 0.030 - alto
  for (i in seq_len(nrow(tabla))) {
    rotulo <- tabla[[1L]][[i]]
    destacada <- grepl("^Avance", rotulo)
    grid::grid.text(rotulo, x = x0, y = y + alto / 2, just = c("left", "centre"),
                    gp = grid::gpar(col = tok$ink, fontsize = ty$body,
                                    fontface = if (destacada) "bold" else "plain"))
    for (k in seq_len(n_val)) {
      v <- tabla[[k + 1L]][[i]]
      txt <- if (destacada) .marp_pct(v) else .marp_personas(v, faltante = grepl("^Faltantes", rotulo))
      grid::grid.text(txt, x = x_der[[k]], y = y + alto / 2, just = c("right", "centre"),
                      gp = grid::gpar(col = tok$ink, fontsize = ty$body,
                                      fontface = if (destacada) "bold" else "plain"))
    }
    pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = pesos$fila)
    y <- y - alto
  }
  invisible(NULL)
}

# La nota al pie de lo que no entra en ninguna meta: la ÚNICA nota del
# documento, porque es la única que dice algo que no está dibujado (decisión de
# Gonzalo, 2026-09-28).
.marp_eje_lineas_nota <- function(nota, ancho) {
  if (!nzchar(nota)) return(character(0))
  # «nivel 5: 56» no se parte entre renglones: quedaba «(nivel» colgando al
  # final de uno y «5: 56» abriendo el siguiente.
  pegada <- gsub("(\\(?[[:alpha:]]+) ([0-9]+: [0-9]+)", "\\1\u00a7\\2", nota)
  pegada <- gsub("([0-9]+:) ([0-9]+)", "\\1\u00a7\\2", pegada)
  gsub("\u00a7", " ", strwrap(pegada, width = pulso_pdf_chars(ancho, factor = 215)), fixed = TRUE)
}
.marp_eje_alto_nota <- function(lineas) if (length(lineas)) 0.020 + length(lineas) * 0.022 else 0
.marp_eje_dibujar_nota <- function(lineas, tok, ty, x0, ancho) {
  for (k in seq_along(lineas)) {
    grid::grid.text(lineas[[k]], x = x0,
                    y = .MARP_MARCO$suelo + 0.002 + (length(lineas) - k) * 0.022,
                    just = c("left", "bottom"),
                    gp = grid::gpar(col = tok$soft, fontsize = ty$caption))
  }
  invisible(NULL)
}

# «De las 430 encuestas efectivas, 324 cuentan para la meta. Las 106 restantes
# no entran en ninguna: …». Cada bolsa sólo aparece si tiene algo.
.marp_eje_nota_fuera_de_meta <- function(fm, r) {
  # Registro formal: es un entregable de investigación que lee el cliente
  # (Gonzalo, 2026-09-28: «más formal y académica»).
  fuera <- as.integer(.marp_num(fm$fuera, 0))
  if (fuera <= 0L) return("")
  n <- function(x) as.integer(.marp_num(x, 0))
  partes <- character(0)
  cf <- fm$celdas_fuera
  if (n(fm$sin_celda) > 0L) {
    detalle <- if (is.data.frame(cf) && nrow(cf)) {
      # `.marp_personas()` es escalar: sobre el vector repetía la primera cifra
      # en todas las celdas («nivel 10: 56» siendo 32).
      n_txt <- vapply(cf$n, .marp_personas, character(1))
      sprintf(" (%s)", paste(sprintf("%s: %s", tolower(.marp_rotulo_celda(cf$valor, list(etiqueta = r$Singular))),
                                     n_txt), collapse = "; "))
    } else ""
    partes <- c(partes, sprintf("%s %s a estudiantes de %s no contemplados en el diseño muestral%s",
                                .marp_personas(n(fm$sin_celda)),
                                if (n(fm$sin_celda) == 1L) "corresponde" else "corresponden",
                                r$plural, detalle))
  }
  if (n(fm$sin_eje) > 0L) {
    partes <- c(partes, sprintf("%s a estudiantes cuyo %s no pudo identificarse en el padrón",
                                .marp_personas(n(fm$sin_eje)), r$singular))
  }
  if (n(fm$fuera_universo) > 0L) {
    partes <- c(partes, sprintf("%s a personas ajenas a la población objetivo",
                                .marp_personas(n(fm$fuera_universo))))
  }
  if (n(fm$huerfanas) > 0L) {
    partes <- c(partes, sprintf("%s a %s que no pudieron asociarse a un aula del estudio",
                                .marp_personas(n(fm$huerfanas)),
                                if (n(fm$huerfanas) == 1L) "una respuesta" else "respuestas"))
  }
  if (n(fm$duplicadas) > 0L) {
    partes <- c(partes, if (n(fm$duplicadas) == 1L) "1 a una respuesta duplicada de un mismo estudiante"
                else sprintf("%s a respuestas duplicadas de estudiantes que ya habían respondido",
                             .marp_personas(n(fm$duplicadas))))
  }
  lista <- if (length(partes) <= 1L) partes else
    paste0(paste(partes[-length(partes)], collapse = ", "), " y ", partes[[length(partes)]])
  sprintf("De las %s encuestas efectivas, %s forman parte del estudio. %s no se %s a ninguna cuota: %s.",
          .marp_personas(fm$efectivas), .marp_personas(fm$en_meta),
          if (fuera == 1L) "La restante" else sprintf("Las %s restantes", .marp_personas(fuera)),
          if (fuera == 1L) "asigna" else "asignan",
          lista)
}

# Composición de lo obtenido contra la población, por sexo y por carrera. Sin
# umbrales ni avisos de desvío: no son cuota (decisión 2 del eje declarable).
.marp_eje_pagina_composicion <- function(comp, df, r, tok, ty, x0, ancho) {
  dims <- Filter(function(d) length(d$filas %||% list()) > 0L, comp$dimensiones %||% list())
  if (!length(dims)) return(invisible(NULL))
  n_filas <- sum(vapply(dims, function(d) length(d$filas), integer(1)))
  # **Una dimensión sin población declarada se DICE, no se pinta en cero.**
  # El motor devuelve la población vacía cuando no la puede leer de la config, y
  # esta página la escribía como «0 (0,0 %)» en todas sus filas: idéntico a una
  # medición que diera cero, en un documento que va al cliente. Es la otra mitad
  # del principio que el bloque ya aplica a lo obtenido («sin padrón no hay
  # composición y eso se declara en vez de publicar ceros»).
  sin_pob <- vapply(dims, function(d) .marp_num(d$poblacion_total, 0) <= 0, logical(1))
  lineas_nota <- .marp_eje_lineas_nota(.marp_eje_nota_sin_poblacion(dims[sin_pob]), ancho)
  techo <- .MARP_MARCO$techo - 0.006
  # El suelo sube sólo cuando hay nota: sin ella la página conserva su reparto
  # de siempre y ningún documento ya emitido cambia de factura.
  suelo <- .MARP_MARCO$suelo + .marp_eje_alto_nota(lineas_nota)
  alto_sec <- 0.050
  alto <- min(0.070, (techo - suelo - alto_sec * length(dims) - 0.020 * (length(dims) - 1L)) / max(1L, n_filas))
  x_bar <- x0 + 0.290
  w_bar <- 0.370
  x_num <- x0 + ancho

  etiqueta_cat <- function(dim, v) {
    if (identical(dim, "sexo")) {
      k <- toupper(substr(trimws(v), 1L, 1L))
      if (k %in% c("F", "W")) return("Mujeres")
      if (k %in% c("M", "H")) return("Hombres")
    }
    .ana_bloque(v)
  }

  y <- techo
  for (j in seq_along(dims)) {
    d <- dims[[j]]
    hay_pob <- !sin_pob[[j]]
    # Aire entre bloques: sin él, el rótulo de «Carrera» se pegaba a la última
    # regla de «Sexo».
    if (j > 1L) y <- y - 0.020
    pulso_pdf_rotulo_seccion(x0, y - 0.024, d$etiqueta %||% d$dimension, tokens = tok, ty = ty,
                             ancho = 0.052)
    grid::grid.text("POBLACIÓN", x = x_num - 0.110, y = y - 0.024, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
    grid::grid.text("OBTENIDO", x = x_num, y = y - 0.024, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
    y <- y - alto_sec
    pcts <- unlist(lapply(d$filas, function(f) c(.marp_num(f$poblacion_pct, 0), .marp_num(f$obtenidas_pct, 0))))
    escala <- max(c(pcts, 1), na.rm = TRUE)
    for (f in d$filas) {
      yc <- y - alto / 2
      grid::grid.text(etiqueta_cat(d$dimension, f$categoria), x = x0, y = yc, just = c("left", "centre"),
                      gp = grid::gpar(col = tok$ink, fontsize = ty$body))
      h_bar <- min(0.014, alto * 0.24)
      pp <- .marp_num(f$poblacion_pct, 0); po <- .marp_num(f$obtenidas_pct, 0)
      grid::grid.rect(x = x_bar, y = yc + h_bar * 0.6, width = w_bar * pp / escala, height = h_bar,
                      just = c("left", "centre"), gp = grid::gpar(fill = tok$line, col = NA))
      grid::grid.rect(x = x_bar, y = yc - h_bar * 0.6, width = w_bar * po / escala, height = h_bar,
                      just = c("left", "centre"), gp = grid::gpar(fill = tok$navy, col = NA))
      pct_txt <- function(p) sprintf("%.1f %%", p)
      grid::grid.text(if (hay_pob) sprintf("%s (%s)", .marp_personas(f$poblacion), pct_txt(pp))
                      else .marp_personas(NA_real_),
                      x = x_num - 0.110, y = yc, just = c("right", "centre"),
                      gp = grid::gpar(col = tok$soft, fontsize = ty$body))
      grid::grid.text(sprintf("%s (%s)", .marp_personas(f$obtenidas), pct_txt(po)),
                      x = x_num, y = yc, just = c("right", "centre"),
                      gp = grid::gpar(col = tok$navy, fontsize = ty$body, fontface = "bold"))
      y <- y - alto
      pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = pulso_pdf_pesos()$fila)
    }
  }
  .marp_eje_dibujar_nota(lineas_nota, tok, ty, x0, ancho)

  invisible(NULL)
}

# El texto de la nota, cuando alguna dimensión no trae población. Dice QUÉ falta
# y DÓNDE se declara, porque «sin cifra» a secas manda a buscar el defecto al
# documento en vez de a la configuración del proyecto.
.marp_eje_nota_sin_poblacion <- function(dims) {
  if (!length(dims)) return("")
  nombres <- vapply(dims, function(d) .monitoreo_scalar(d$etiqueta %||% d$dimension, ""), character(1))
  nombres <- nombres[nzchar(nombres)]
  if (!length(nombres)) return("")
  lista <- if (length(nombres) == 1L) nombres else
    paste0(paste(nombres[-length(nombres)], collapse = ", "), " y ", nombres[[length(nombres)]])
  sprintf(paste0("El proyecto no declara la composición de la población para %s, ",
                 "de modo que esa columna queda sin cifra."), lista)
}
