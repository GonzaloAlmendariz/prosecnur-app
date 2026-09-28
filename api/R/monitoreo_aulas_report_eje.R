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
    list("Composición de lo recogido", if (.marp_hay_composicion(model$composicion)) 1L else 0L)
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
    pulso_pdf_portada(port, tokens = tok, ty = ty, geo = geo,
                      antetitulo = ante_portada, destacados = list(
      list(rotulo = "Avance de la muestra", valor = .marp_pct(t$avance)),
      list(rotulo = "Cuentan para la meta", valor = .marp_personas(t$conseguidas)),
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
                       rotulo_diario = "Encuestas que cuentan para la meta, por jornada")
    pie()
  }

  if (.marp_hay_composicion(model$composicion)) {
    nueva("Composición de lo recogido", "Referencial: sexo y carrera no son metas del estudio")
    .marp_eje_pagina_composicion(model$composicion, df, r, tok, ty, x0, ancho_util)
    pie()
  }
  invisible(output_file)
}

# La página que responde «¿se llega a la meta?»: la cifra global arriba y, por
# cada celda, su meta, lo conseguido y lo que falta. Debajo, la regla del
# ADR 0079 dicha en palabras, y al pie lo que no entra en ninguna meta.
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
  efectivas <- .marp_num(fm$efectivas, NA_real_)
  if (is.finite(efectivas) && efectivas > 0) {
    kpi(3L, "Encuestas efectivas", .marp_personas(efectivas),
        sprintf("%s cuentan para la meta", .marp_personas(t$conseguidas)))
  } else {
    kpi(3L, "Encuestas efectivas", .marp_personas(t$conseguidas), "")
  }
  n_celdas <- nrow(df)
  abiertas <- as.integer(.marp_num(t$facultades_abiertas, 0))
  kpi(4L, sprintf("%s que llegaron a la meta", r$Plural),
      .marp_personas(n_celdas - abiertas), sprintf("de %s", .marp_personas(n_celdas)))
  kpi(5L, "Faltan", .marp_personas(t$faltan, faltante = TRUE),
      if (abiertas == 1L) sprintf("en 1 %s", r$singular) else sprintf("en %d %s", abiertas, r$plural))

  # --- Meta por celda: una barra por celda, todas con la misma vara ---------
  y_sec <- 0.598
  pulso_pdf_rotulo_seccion(x0, y_sec, sprintf("Meta por %s", r$singular), tokens = tok, ty = ty,
                           ancho = 0.052)
  nota_fuera <- .marp_eje_nota_fuera_de_meta(fm, r)
  lineas_nota <- if (nzchar(nota_fuera)) strwrap(nota_fuera, width = pulso_pdf_chars(ancho, factor = 215)) else character(0)
  suelo_filas <- .MARP_MARCO$suelo + 0.060 + length(lineas_nota) * 0.024
  techo_filas <- y_sec - 0.022
  alto <- min(0.085, (techo_filas - suelo_filas) / max(1L, n_celdas))

  num <- function(k) suppressWarnings(as.numeric(df[[k]]))
  meta <- num("Muestra"); ef <- num("Efectivas"); falta <- num("Faltantes muestra")
  escala <- max(c(meta, ef, 1), na.rm = TRUE)
  x_bar <- x0 + 0.130
  w_bar <- 0.480
  x_num <- x0 + ancho
  rot <- .marp_rotulo_celda(df[["Facultad"]], model$eje)

  y <- techo_filas
  for (i in seq_len(n_celdas)) {
    yc <- y - alto / 2
    grid::grid.text(rot[[i]], x = x0, y = yc, just = c("left", "centre"),
                    gp = grid::gpar(col = tok$ink, fontsize = ty$body, fontface = "bold"))
    h_bar <- min(0.026, alto * 0.42)
    m <- if (is.finite(meta[[i]])) meta[[i]] else 0
    e <- if (is.finite(ef[[i]])) ef[[i]] else 0
    # El contorno es la meta; el relleno, lo conseguido hasta la meta; lo que
    # pasa de la meta se pinta aparte y más claro: existe, pero no cubre a
    # nadie más (ADR 0079).
    grid::grid.rect(x = x_bar, y = yc, width = w_bar * m / escala, height = h_bar,
                    just = c("left", "centre"),
                    gp = grid::gpar(fill = tok$tbl_header, col = tok$line, lwd = 0.6))
    grid::grid.rect(x = x_bar, y = yc, width = w_bar * min(e, m) / escala, height = h_bar,
                    just = c("left", "centre"), gp = grid::gpar(fill = tok$navy, col = NA))
    if (e > m && m > 0) {
      grid::grid.rect(x = x_bar + w_bar * m / escala, y = yc, width = w_bar * (e - m) / escala,
                      height = h_bar, just = c("left", "centre"),
                      gp = grid::gpar(fill = tok$success, col = NA))
    }
    avance <- if (m > 0) e / m else NA_real_
    grid::grid.text(sprintf("%s de %s", .marp_personas(e), .marp_personas(m)),
                    x = x_num - 0.215, y = yc, just = c("right", "centre"),
                    gp = grid::gpar(col = tok$ink, fontsize = ty$body))
    grid::grid.text(.marp_pct(avance), x = x_num - 0.120, y = yc, just = c("right", "centre"),
                    gp = grid::gpar(col = tok$navy, fontsize = ty$body, fontface = "bold"))
    f <- if (is.finite(falta[[i]])) falta[[i]] else max(0, m - e)
    grid::grid.text(if (f > 0) sprintf("faltan %s", .marp_personas(f, faltante = TRUE)) else "meta cumplida",
                    x = x_num, y = yc, just = c("right", "centre"),
                    gp = grid::gpar(col = if (f > 0) tok$soft else tok$success, fontsize = ty$body))
    y <- y - alto
    if (i < n_celdas) pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = pulso_pdf_pesos()$fila)
  }

  # La regla del ADR 0079, dicha: el total de lo que falta es una SUMA de
  # faltantes, no la meta menos lo conseguido.
  grid::grid.text(
    sprintf("Faltan %s en total: es la suma de lo que falta en cada %s. Lo que sobra en un %s no cubre lo que falta en otro.",
            .marp_personas(t$faltan, faltante = TRUE), r$singular, r$singular),
    x = x0, y = y - 0.030, just = c("left", "centre"),
    gp = grid::gpar(col = tok$soft, fontsize = ty$caption))

  # Nota al pie: lo que no entra en ninguna meta (decisión de Gonzalo,
  # 2026-09-28). Dicho con su desglose, no escondido y no en cero.
  if (length(lineas_nota)) {
    pulso_pdf_hairline(x0, x0 + ancho, .MARP_MARCO$suelo + 0.012 + length(lineas_nota) * 0.024,
                       tokens = tok, lwd = pulso_pdf_pesos()$fila)
    for (k in seq_along(lineas_nota)) {
      grid::grid.text(lineas_nota[[k]], x = x0,
                      y = .MARP_MARCO$suelo + 0.004 + (length(lineas_nota) - k) * 0.024,
                      just = c("left", "bottom"),
                      gp = grid::gpar(col = tok$faint, fontsize = ty$caption))
    }
  }
  invisible(NULL)
}

# «De las 430 encuestas efectivas, 324 cuentan para la meta. Las 106 restantes
# no entran en ninguna: …». Cada bolsa sólo aparece si tiene algo.
.marp_eje_nota_fuera_de_meta <- function(fm, r) {
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
    partes <- c(partes, sprintf("%s %s de %s que el diseño no mide%s", .marp_personas(n(fm$sin_celda)),
                                if (n(fm$sin_celda) == 1L) "es" else "son", r$plural, detalle))
  }
  if (n(fm$sin_eje) > 0L) {
    partes <- c(partes, sprintf("%s %s %s identificado", .marp_personas(n(fm$sin_eje)),
                                if (n(fm$sin_eje) == 1L) "no tiene" else "no tienen", r$singular))
  }
  if (n(fm$fuera_universo) > 0L) {
    partes <- c(partes, sprintf("%s %s de fuera de la población del estudio",
                                .marp_personas(n(fm$fuera_universo)),
                                if (n(fm$fuera_universo) == 1L) "es" else "son"))
  }
  if (n(fm$huerfanas) > 0L) {
    partes <- c(partes, sprintf("%s no se %s asociar a un aula del estudio",
                                .marp_personas(n(fm$huerfanas)),
                                if (n(fm$huerfanas) == 1L) "pudo" else "pudieron"))
  }
  if (n(fm$duplicadas) > 0L) {
    partes <- c(partes, if (n(fm$duplicadas) == 1L) "1 es de una persona que respondió dos veces"
                else sprintf("%s son respuestas repetidas de personas que ya habían respondido",
                             .marp_personas(n(fm$duplicadas))))
  }
  lista <- if (length(partes) <= 1L) partes else
    paste0(paste(partes[-length(partes)], collapse = ", "), " y ", partes[[length(partes)]])
  sprintf("De las %s encuestas efectivas, %s cuentan para la meta. %s no %s en ninguna: %s.",
          .marp_personas(fm$efectivas), .marp_personas(fm$en_meta),
          if (fuera == 1L) "La restante" else sprintf("Las %s restantes", .marp_personas(fuera)),
          if (fuera == 1L) "entra" else "entran",
          lista)
}

# Composición de lo recogido contra la población, por sexo y por carrera. Sin
# umbrales ni avisos de desvío: no son cuota (decisión 2 del eje declarable).
.marp_eje_pagina_composicion <- function(comp, df, r, tok, ty, x0, ancho) {
  dims <- Filter(function(d) length(d$filas %||% list()) > 0L, comp$dimensiones %||% list())
  if (!length(dims)) return(invisible(NULL))
  n_filas <- sum(vapply(dims, function(d) length(d$filas), integer(1)))
  techo <- .MARP_MARCO$techo - 0.006
  suelo <- .MARP_MARCO$suelo + .MARP_MARCO$leyenda + 0.050
  alto_sec <- 0.050
  alto <- min(0.062, (techo - suelo - alto_sec * length(dims) - 0.020 * (length(dims) - 1L)) / max(1L, n_filas))
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
    # Aire entre bloques: sin él, el rótulo de «Carrera» se pegaba a la última
    # regla de «Sexo».
    if (j > 1L) y <- y - 0.020
    pulso_pdf_rotulo_seccion(x0, y - 0.024, d$etiqueta %||% d$dimension, tokens = tok, ty = ty,
                             ancho = 0.052)
    grid::grid.text("POBLACIÓN", x = x_num - 0.110, y = y - 0.024, just = c("right", "bottom"),
                    gp = grid::gpar(col = tok$faint, fontsize = ty$eyebrow, fontface = "bold"))
    grid::grid.text("RECOGIDO", x = x_num, y = y - 0.024, just = c("right", "bottom"),
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
      grid::grid.text(sprintf("%s  ·  %s", pct_txt(pp), .marp_personas(f$poblacion)),
                      x = x_num - 0.110, y = yc, just = c("right", "centre"),
                      gp = grid::gpar(col = tok$soft, fontsize = ty$body))
      grid::grid.text(sprintf("%s  ·  %s", pct_txt(po), .marp_personas(f$obtenidas)),
                      x = x_num, y = yc, just = c("right", "centre"),
                      gp = grid::gpar(col = tok$navy, fontsize = ty$body, fontface = "bold"))
      y <- y - alto
      pulso_pdf_hairline(x0, x0 + ancho, y, tokens = tok, lwd = pulso_pdf_pesos()$fila)
    }
  }

  celdas <- trimws(as.character(df[["Facultad"]]))
  alcance <- if (length(celdas) > 1L && all(grepl("^[0-9]+$", celdas))) {
    sprintf("de los %s %s a %s", r$plural, celdas[[1L]], celdas[[length(celdas)]])
  } else ""
  base <- sprintf("Base: %s encuestas que cuentan para la meta, frente a %s estudiantes%s.",
                  .marp_personas(comp$personas),
                  .marp_personas(dims[[1L]]$poblacion_total),
                  if (nzchar(alcance)) paste0(" ", alcance) else "")
  grid::grid.text(base, x = x0, y = .MARP_MARCO$suelo + .MARP_MARCO$leyenda + 0.018,
                  just = c("left", "bottom"), gp = grid::gpar(col = tok$soft, fontsize = ty$caption))
  pulso_pdf_leyenda(x0, .MARP_MARCO$suelo + 0.004, list(
    list(texto = "Población del estudio", color = tok$line, forma = "barra"),
    list(texto = "Encuestas que cuentan para la meta", color = tok$navy, forma = "barra")
  ), tokens = tok, ty = ty, centrado = TRUE, ancho = ancho, fontsize = ty$body)
  invisible(NULL)
}
