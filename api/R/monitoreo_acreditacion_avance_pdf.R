# El PDF de avance de campo del perfil de acreditación, el que se entrega al
# cliente periódicamente.
#
# Antes vivía como un cierre de mil líneas dentro de `monitoreo_engine.R` y se
# leía como una pantalla impresa: nueve páginas para seis públicos, porcentajes
# en anillos sin su frecuencia, la cifra total en la página ocho, botones «Ver detalle» y una página de «Corte y fuentes» que hablaba de
# «caso canónico» y del «Apps Script viejo». Checklist de la reescritura:
# `docs/qa/checklist-pdf-avance-acreditacion-2026-10-30.md`.
#
# EL CONTENIDO NO SE RECALCULA. Las cifras son las del modelo
# `monitoreo_acreditacion_client_report_model()` —el mismo que escribe las hojas
# del libro cliente—: completas reconciliadas contra las bases (las respuestas
# sin token válido ya no están ahí) y el día de cada respuesta en hora de Lima.
# Este archivo sólo decide cómo se leen.
#
# Lo que el cliente tiene que leer de un vistazo, en este orden: el avance de
# cada público en conteo y en porcentaje de su universo, el ritmo, y la fecha y
# hora del corte. Universo y no «invitados»: es la base del público, y no todo
# estudio de acreditación se recoge por correo (Gonzalo, 2026-10-30).
#
# «MÍNIMO ESPERADO», NO «META». En acreditación la cifra de referencia por
# público es el mínimo que el estudio necesita alcanzar, no un objetivo que el
# cliente persiga: a la DAA le interesa el progreso de cada público sobre su
# universo (Gonzalo, 2026-10-30). Por eso el porcentaje que manda es el del
# universo, y el mínimo va al lado, como referencia, con su propio nombre.

.acav_meses <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
                 "agosto", "setiembre", "octubre", "noviembre", "diciembre")
.acav_meses_cortos <- c("ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.",
                        "ago.", "set.", "oct.", "nov.", "dic.")

# es-PE pedido para el entregable: punto decimal y sin separador de miles.
.acav_n <- function(x) {
  x <- suppressWarnings(as.numeric(x))
  if (!length(x) || !is.finite(x[[1]])) return("-")
  formatC(round(x[[1]]), format = "d", big.mark = "")
}

.acav_pct <- function(num, den) {
  num <- suppressWarnings(as.numeric(num)); den <- suppressWarnings(as.numeric(den))
  if (!length(num) || !length(den) || !is.finite(num[[1]]) || !is.finite(den[[1]]) || den[[1]] <= 0) return("-")
  sprintf("%.1f%%", 100 * num[[1]] / den[[1]])
}

# Todo porcentaje va con su frecuencia: «15.6% (709 de 4542)».
.acav_pct_frec <- function(num, den) {
  pct <- .acav_pct(num, den)
  if (identical(pct, "-")) return("-")
  paste0(pct, " (", .acav_n(num), " de ", .acav_n(den), ")")
}

.acav_fecha_larga <- function(d) {
  d <- suppressWarnings(as.Date(d))
  if (!length(d) || is.na(d[[1]])) return("")
  sprintf("%d de %s de %s", as.integer(format(d[[1]], "%d")),
          .acav_meses[[as.integer(format(d[[1]], "%m"))]], format(d[[1]], "%Y"))
}

.acav_fecha_corta <- function(d) {
  d <- suppressWarnings(as.Date(d))
  out <- paste(as.integer(format(d, "%d")), .acav_meses_cortos[as.integer(format(d, "%m"))])
  out[is.na(d)] <- ""
  out
}

# El corte es el momento en que se sincronizaron las respuestas, no el momento
# en que alguien pulsó «Generar PDF». Se publica en hora de Lima, que es la
# misma hora con la que el modelo asigna el día de cada respuesta.
.acav_corte <- function(model) {
  raw <- .monitoreo_scalar(model$synced_at %||% "", "")
  if (!nzchar(raw)) raw <- .monitoreo_scalar(model$generated_at %||% "", "")
  parsed <- .monitoreo_parse_time_vec(raw)
  if (!length(parsed) || is.na(parsed[[1]])) {
    return(list(fecha = as.Date(NA), hora = "", texto = "", periodo = ""))
  }
  fecha <- as.Date(format(parsed[[1]], "%Y-%m-%d", tz = "America/Lima"))
  hora <- format(parsed[[1]], "%H:%M", tz = "America/Lima")
  list(
    fecha = fecha,
    hora = hora,
    texto = paste0(.acav_fecha_larga(fecha), ", ", hora, " (hora de Lima)"),
    periodo = paste("Corte al", .acav_fecha_larga(fecha))
  )
}

# Nombre del estudio: el declarado, o el prefijo común de los títulos de las
# encuestas («Acreditación Institucional PUCP 2026 - Profesores» → antes del
# guion). Sin uno de los dos, el subtítulo queda vacío antes que inventado.
.acav_nombre_estudio <- function(model, sources) {
  declarado <- .monitoreo_scalar(model$study_title %||% model$client_report$study_title %||% "", "")
  if (nzchar(declarado)) return(declarado)
  fuentes <- unique(trimws(as.character(sources$Fuente %||% character())))
  fuentes <- fuentes[nzchar(fuentes) & !is.na(fuentes)]
  if (!length(fuentes)) return("")
  bases <- unique(trimws(sub("\\s+[-\u2013\u2014]\\s+[^-\u2013\u2014]*$", "", fuentes)))
  # Un solo prefijo y distinto del título entero: el guion sí separaba estudio
  # y público.
  if (length(bases) == 1L && nzchar(bases) && !bases %in% fuentes) return(bases)
  ""
}

.acav_df <- function(records) .monitoreo_workbook_df(records %||% list())

.acav_num <- function(x) {
  out <- suppressWarnings(as.numeric(x))
  out[!is.finite(out)] <- 0
  out
}

# Una fila por público con las cifras que lee el documento. El orden es el del
# universo: estable de un corte a otro, para que el cliente compare dos
# informes fila por fila.
.acav_publicos <- function(actors, con_meta) {
  if (!nrow(actors)) {
    return(data.frame(publico = character(), universo = numeric(), completas = numeric(),
                      parciales = numeric(), meta = numeric(), stringsAsFactors = FALSE))
  }
  meta_col <- if ("Meta" %in% names(actors)) actors$Meta else actors$`Referencia operativa`
  out <- data.frame(
    publico = as.character(actors$Actor),
    universo = .acav_num(actors$Universo),
    completas = .acav_num(actors$Efectivas),
    parciales = .acav_num(actors$Parciales),
    meta = if (isTRUE(con_meta)) .acav_num(meta_col) else rep(NA_real_, nrow(actors)),
    stringsAsFactors = FALSE
  )
  # Por pares (Gonzalo, 30/10): «Docentes Campus» y «Docentes CENTRUM» salen del
  # mismo padrón y se leen juntos. La familia es el nombre sin la sede; las
  # familias van por su universo total y, dentro, Campus antes que CENTRUM.
  sede <- ifelse(grepl("\\s+campus$", out$publico, ignore.case = TRUE), 1L,
                 ifelse(grepl("\\s+centrum$", out$publico, ignore.case = TRUE), 2L, 0L))
  familia <- trimws(sub("\\s+(campus|centrum)$", "", out$publico, ignore.case = TRUE))
  tamano_familia <- ave(out$universo, familia, FUN = function(x) sum(x, na.rm = TRUE))
  orden <- order(-tamano_familia, familia, sede, -out$universo, out$publico)
  out[orden, , drop = FALSE]
}

# Serie diaria: completas por día (hora de Lima) y su acumulado, sin huecos
# entre el primer y el último día con actividad.
.acav_serie <- function(daily_general) {
  if (!nrow(daily_general) || !"Fecha" %in% names(daily_general)) {
    return(data.frame(fecha = as.Date(character()), completas = numeric(), acumulado = numeric()))
  }
  fecha <- suppressWarnings(as.Date(as.character(daily_general$Fecha)))
  completas <- .acav_num(daily_general$Efectivas)
  ok <- !is.na(fecha)
  if (!any(ok)) return(data.frame(fecha = as.Date(character()), completas = numeric(), acumulado = numeric()))
  por_dia <- tapply(completas[ok], fecha[ok], sum)
  dias <- seq(min(fecha[ok]), max(fecha[ok]), by = "day")
  valores <- as.numeric(por_dia[as.character(dias)])
  valores[is.na(valores)] <- 0
  data.frame(fecha = dias, completas = valores, acumulado = cumsum(valores))
}

.acav_matriz_diaria <- function(daily_actor, dias, publicos) {
  m <- matrix(0, nrow = length(dias), ncol = length(publicos),
              dimnames = list(as.character(dias), publicos))
  if (!nrow(daily_actor) || !all(c("Fecha", "Actor") %in% names(daily_actor))) return(m)
  fecha <- as.character(suppressWarnings(as.Date(as.character(daily_actor$Fecha))))
  actor <- as.character(daily_actor$Actor)
  valor <- .acav_num(daily_actor$Efectivas)
  for (i in seq_along(valor)) {
    if (!is.na(fecha[[i]]) && fecha[[i]] %in% rownames(m) && actor[[i]] %in% colnames(m)) {
      m[fecha[[i]], actor[[i]]] <- m[fecha[[i]], actor[[i]]] + valor[[i]]
    }
  }
  m
}

.acav_dias_semana <- c("dom", "lun", "mar", "mié", "jue", "vie", "sáb")

# «29/10» con su día de la semana debajo, como se nombra una jornada en los
# demás avances de la casa. El día en curso dice hasta qué hora va: una barra
# de siete horas no se compara con una de veinticuatro.
.acav_etiquetas_de_dia <- function(fechas, en_curso_hasta = "") {
  out <- paste0(format(fechas, "%d/%m"), "\n", .acav_dias_semana[as.POSIXlt(fechas)$wday + 1L])
  if (nzchar(en_curso_hasta) && length(out)) {
    out[[length(out)]] <- paste0(format(fechas[[length(fechas)]], "%d/%m"), "\nhasta ", en_curso_hasta)
  }
  out
}

#' PDF de avance de campo del perfil de acreditación (entregable al cliente).
#'
#' Misma familia que el avance de cursos-horario (`monitoreo_aulas_report_pdf.R`):
#' A4 apaisado, portada, cromo con antetítulo, tarjetas, la serie partida del
#' ritmo y un panel por público. Lo que cambia es el contenido: los públicos de
#' la encuesta en línea en lugar de facultades.
#'
#' @param model modelo de `monitoreo_acreditacion_client_report_model()`; lee
#'   `actors`, `daily_general`, `daily_actor`, `sources` y `synced_at`.
#' @param output_file ruta del PDF.
#' @param include_targets si el documento publica el mínimo esperado por público
#'   («Incluir metas» en Salidas). El avance se lee siempre contra el universo.
#' @param title título del documento.
#' @return `output_file`, invisible.
monitoreo_acreditacion_client_report_pdf <- function(model, output_file, include_targets = FALSE, title = NULL) {
  tk <- pulso_pdf_tokens()
  ty <- pulso_pdf_type("cliente")
  geo <- pulso_pdf_geo("landscape")
  pesos <- pulso_pdf_pesos()
  m <- geo$margin
  right <- 1 - m
  ancho <- right - m
  techo <- 0.800
  suelo <- 0.108

  actors <- .acav_df(model$actors)
  sources <- .acav_df(model$sources)
  meta_total_bruta <- if (nrow(actors)) sum(.acav_num(actors$Meta %||% actors$`Referencia operativa`)) else 0
  con_meta <- isTRUE(include_targets) && meta_total_bruta > 0
  pub <- .acav_publicos(actors, con_meta)
  serie <- .acav_serie(.acav_df(model$daily_general))
  matriz <- .acav_matriz_diaria(.acav_df(model$daily_actor), serie$fecha, pub$publico)
  corte <- .acav_corte(model)
  estudio <- .acav_nombre_estudio(model, sources)
  titulo <- .monitoreo_scalar(title %||% "", "")
  if (!nzchar(titulo)) titulo <- "Avance del trabajo de campo"
  antetitulo <- if (nzchar(estudio)) estudio else "Encuesta en línea"

  total_uni <- sum(pub$universo)
  total_comp <- sum(pub$completas)
  total_parc <- sum(pub$parciales)
  total_meta <- if (con_meta) sum(pub$meta) else NA_real_
  den_total <- total_uni
  n_dias <- nrow(serie)
  inicio <- if (n_dias) serie$fecha[[1]] else as.Date(NA)
  # El último día está «en curso» si el corte cae ese mismo día: sus completas
  # son las registradas hasta la hora del corte, no las de un día cerrado.
  ultimo_en_curso <- n_dias > 0 && !is.na(corte$fecha) &&
    identical(as.character(serie$fecha[[n_dias]]), as.character(corte$fecha))
  dias_cerrados <- if (ultimo_en_curso) n_dias - 1L else n_dias
  # El promedio se toma sobre días completos: un día en curso lo bajaría sin
  # que el ritmo haya cambiado.
  promedio <- if (dias_cerrados > 0) sum(serie$completas[seq_len(dias_cerrados)]) / dias_cerrados else NA_real_
  etiquetas <- .acav_etiquetas_de_dia(serie$fecha, if (ultimo_en_curso) corte$hora else "")
  # En un panel «hasta 11:40» no cabe y se monta sobre la fecha vecina.
  etiquetas_panel <- .acav_etiquetas_de_dia(serie$fecha)

  tx <- function(label, x, y, size = ty$body, col = tk$ink, face = "plain",
                 just = c("left", "center"), lineheight = 1.1) {
    grid::grid.text(as.character(label), x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                    just = just, gp = grid::gpar(fontsize = size, col = col, fontface = face,
                                                 lineheight = lineheight))
  }
  caja <- function(x, y, w, h, fill, col = NA, lwd = pesos$fila) {
    grid::grid.rect(x = grid::unit(x, "npc"), y = grid::unit(y, "npc"),
                    width = grid::unit(w, "npc"), height = grid::unit(h, "npc"),
                    just = c("left", "bottom"), gp = grid::gpar(fill = fill, col = col, lwd = lwd))
  }
  regla <- function(x0, x1, y, col = tk$rule, lwd = pesos$fila) {
    grid::grid.lines(x = grid::unit(c(x0, x1), "npc"), y = grid::unit(c(y, y), "npc"),
                     gp = grid::gpar(col = col, lwd = lwd))
  }

  # --- Plan del documento: el folio «02 / 06» necesita el total desde la
  # primera hoja, así que las hojas se cuentan antes de dibujar.
  rejilla <- .marp_rejilla_de_paneles(nrow(pub))
  # Cinco o seis públicos caben en una hoja de tres por dos; la rejilla de aulas
  # (dos columnas) los partiría en dos hojas con un cuadrante vacío cada una.
  if (nrow(pub) %in% 5:6) rejilla <- list(columnas = 3L, hojas = 1L, por_hoja = nrow(pub))
  hay_paneles <- n_dias > 0 && nrow(pub) > 1L
  hojas_paneles <- if (hay_paneles) split(seq_len(nrow(pub)), ceiling(seq_len(nrow(pub)) / rejilla$por_hoja)) else list()
  # Veinte días caben en una hoja. Si hay que abrir otra, el reparto es parejo:
  # 14 + 4 dejaba la segunda hoja con cuatro filas colgando.
  cabida_tabla <- 20L
  n_hojas_tabla <- max(1L, ceiling(n_dias / cabida_tabla))
  filas_tabla <- max(1L, ceiling(n_dias / n_hojas_tabla))
  hojas_tabla <- if (n_dias) split(seq_len(n_dias), ceiling(seq_len(n_dias) / filas_tabla)) else list(integer())
  total_paginas <- 1L + (if (n_dias) 1L else 0L) + length(hojas_paneles) + length(hojas_tabla)

  corte_corto <- if (!is.na(corte$fecha)) paste("Corte", format(corte$fecha, "%d/%m/%Y"), corte$hora) else ""
  pag <- 0L
  nueva <- function(sec_titulo, sec_subtitulo = "") {
    grid::grid.newpage()
    pag <<- pag + 1L
    pulso_pdf_cromo(antetitulo, sec_titulo, sec_subtitulo, tokens = tk, ty = ty, geo = geo,
                    derecha = corte_corto)
  }
  pie <- function() pulso_pdf_pie(pag, total_paginas, corte$periodo, tokens = tk, ty = ty, geo = geo)

  dir.create(dirname(output_file), recursive = TRUE, showWarnings = FALSE)
  pulso_pdf_abrir(output_file, geo)
  dev <- grDevices::dev.cur()
  on.exit(if (dev %in% grDevices::dev.list()) grDevices::dev.off(dev), add = TRUE)

  # --- Portada -------------------------------------------------------------
  # Sin número ni pie, como la de aulas. Las tres cifras que el cliente busca
  # antes de pasar de página, y el corte en la ficha de la banda.
  portada <- pulso_pdf_portada_normalizar(defectos = list(
    titulo = titulo,
    subtitulo = estudio,
    cliente = .monitoreo_scalar(model$client_name %||% model$client_report$client_name %||% "", ""),
    periodo = if (!is.na(inicio)) paste("Desde el", .acav_fecha_larga(inicio)) else "",
    corte = corte$texto
  ))
  grid::grid.newpage()
  # Rótulos cortos: en versalitas con aire, uno largo no cabe en su columna y se
  # monta sobre el filete. Las tres cifras se leen juntas: 1148 de 45120, 2.5%.
  destacados <- list(
    list(rotulo = "Completas", valor = .acav_n(total_comp)),
    list(rotulo = "Universo", valor = .acav_n(total_uni)),
    list(rotulo = "Del total", valor = .acav_pct(total_comp, total_uni))
  )
  pulso_pdf_portada(portada, tokens = tk, ty = ty, geo = geo, antetitulo = "Monitoreo de la encuesta en línea",
                    destacados = destacados, reparto = "contenido")

  # --- Resumen del avance ----------------------------------------------------
  nueva("Resumen del avance")
  kpis <- c(
    list(
      list("Avance sobre el universo", .acav_pct(total_comp, total_uni), paste(.acav_n(total_comp), "de", .acav_n(total_uni)), TRUE),
      list("Encuestas completas", .acav_n(total_comp), "", FALSE)
    ),
    if (con_meta) list(
      list("Mínimo esperado", .acav_n(total_meta), "", FALSE),
      list("Cumplimiento del mínimo", .acav_pct(total_comp, total_meta), paste(.acav_n(total_comp), "de", .acav_n(total_meta)), FALSE),
      list("Faltan para el mínimo", .acav_n(max(0, total_meta - total_comp)), "", FALSE)
    ) else list(
      list("Universo", .acav_n(total_uni), "", FALSE)
    ),
    list(list("Respuestas parciales*", .acav_n(total_parc), "", FALSE))
  )
  hueco <- 0.014
  w_principal <- if (length(kpis) > 5L) 0.215 else 0.250
  w_resto <- (ancho - w_principal - hueco * (length(kpis) - 1L)) / (length(kpis) - 1L)
  kx <- m
  ky <- 0.660; kh <- 0.140
  for (k in seq_along(kpis)) {
    w <- if (k == 1L) w_principal else w_resto
    pulso_pdf_kpi(kx, ky, w, kh, kpis[[k]][[1]], kpis[[k]][[2]], kpis[[k]][[3]],
                  tokens = tk, ty = ty, destacado = isTRUE(kpis[[k]][[4]]))
    if (k == 1L) {
      fr <- if (den_total > 0) total_comp / den_total else 0
      pulso_pdf_medidor(kx + 0.135, ky + 0.050, w - 0.153, 0.012, fr, tokens = tk, tono = tk$navy)
    }
    kx <- kx + w + hueco
  }

  pulso_pdf_rotulo_seccion(m, 0.600, "Avance por público",
                           "",
                           tokens = tk, ty = ty)
  cols <- list(
    publico = m + 0.008,
    universo = m + 0.285,
    completas = m + 0.375,
    barra0 = m + 0.405,
    barra1 = if (con_meta) m + 0.560 else m + 0.700,
    pct = if (con_meta) m + 0.572 else m + 0.712,
    minimo = m + 0.745,
    pct_min = m + 0.820,
    faltan = right - 0.008
  )
  hy <- 0.530; hh <- 0.040
  caja(m, hy - hh / 2, ancho, hh, tk$tbl_header)
  regla(m, right, hy + hh / 2, col = tk$tbl_frame, lwd = pesos$bloque)
  regla(m, right, hy - hh / 2, col = tk$tbl_frame, lwd = pesos$columna)
  # Mayúsculas sin aire: espaciados, «Faltan» y «Tasa de respuesta» se pisan.
  enc <- function(label, x, just = "right") tx(toupper(label), x, hy, size = ty$eyebrow,
                                               col = tk$soft, face = "bold", just = c(just, "center"))
  enc("Público", cols$publico, "left")
  enc("Universo", cols$universo)
  enc("Completas", cols$completas)
  enc("Avance sobre el universo", cols$barra0, "left")
  if (con_meta) {
    enc("Mínimo\nesperado", cols$minimo)
    enc("Cumplimiento\ndel mínimo", cols$pct_min)
    enc("Faltan para\nel mínimo", cols$faltan)
  }
  filas <- rbind(pub, data.frame(publico = "Total", universo = total_uni, completas = total_comp,
                                 parciales = total_parc, meta = total_meta, stringsAsFactors = FALSE))
  fila_h <- min(0.054, (hy - hh / 2 - suelo - 0.010) / max(1L, nrow(filas)))
  fy <- hy - hh / 2
  for (i in seq_len(nrow(filas))) {
    f <- filas[i, , drop = FALSE]
    es_total <- i == nrow(filas)
    cy <- fy - fila_h / 2
    if (es_total) {
      caja(m, fy - fila_h, ancho, fila_h, tk$tbl_zebra)
      regla(m, right, fy, col = tk$tbl_frame, lwd = pesos$columna)
    }
    cara <- if (es_total) "bold" else "plain"
    den <- f$universo
    tx(f$publico, cols$publico, cy, size = ty$body + 0.4, col = tk$ink, face = cara)
    tx(.acav_n(f$universo), cols$universo, cy, size = ty$body, face = cara, just = c("right", "center"))
    tx(.acav_n(f$completas), cols$completas, cy, size = ty$body, col = tk$navy, face = "bold", just = c("right", "center"))
    pulso_pdf_barra_progreso(cols$barra0, cy - 0.007, cols$barra1 - cols$barra0, 0.014,
                             if (is.finite(den) && den > 0) f$completas / den else 0, tokens = tk)
    tx(.acav_pct(f$completas, den), cols$pct, cy + 0.008, size = ty$body, col = tk$ink, face = "bold")
    tx(paste(.acav_n(f$completas), "de", .acav_n(den)), cols$pct, cy - 0.010, size = ty$caption, col = tk$soft)
    if (con_meta) {
      tx(.acav_n(f$meta), cols$minimo, cy, size = ty$body, face = cara, just = c("right", "center"))
      tx(.acav_pct(f$completas, f$meta), cols$pct_min, cy + 0.008, size = ty$body, face = cara, just = c("right", "center"))
      tx(paste(.acav_n(f$completas), "de", .acav_n(f$meta)), cols$pct_min, cy - 0.010, size = ty$caption,
         col = tk$soft, just = c("right", "center"))
      tx(.acav_n(max(0, f$meta - f$completas)), cols$faltan, cy, size = ty$body, face = cara, just = c("right", "center"))
    }
    fy <- fy - fila_h
    regla(m, right, fy, col = if (es_total) tk$tbl_frame else tk$rule, lwd = if (es_total) pesos$bloque else pesos$fila)
  }
  # El documento informa; lo único que se aclara va como asterisco al pie de su
  # cifra (Gonzalo, 2026-10-30: nada de párrafos sobre cómo se cuentan).
  tx("* Iniciadas y no terminadas; no se suman a las completas.", m, fy - 0.022, size = ty$caption, col = tk$soft)
  pie()

  # --- Ritmo del campo -------------------------------------------------------
  if (n_dias) {
    nueva("Ritmo del campo")
    ritmo <- list(
      list("Completas acumuladas", .acav_n(total_comp),
           paste(.acav_pct(total_comp, total_uni), "de un universo de", .acav_n(total_uni))),
      list(if (ultimo_en_curso) "Promedio por día*" else "Promedio por día", if (!is.finite(promedio)) "-" else if (promedio == round(promedio)) .acav_n(promedio) else sprintf("%.1f", promedio),
           ""),
      list(if (ultimo_en_curso) "Día en curso" else "Último día", .acav_n(serie$completas[[n_dias]]),
           paste0(format(serie$fecha[[n_dias]], "%d/%m"), if (ultimo_en_curso) paste0(", hasta las ", corte$hora) else "")),
      list("Mejor día", .acav_n(max(serie$completas)),
           format(serie$fecha[[which.max(serie$completas)]], "%d/%m"))
    )
    kw <- (ancho - hueco * (length(ritmo) - 1L)) / length(ritmo)
    for (k in seq_along(ritmo)) {
      pulso_pdf_kpi(m + (k - 1L) * (kw + hueco), 0.665, kw, 0.135, ritmo[[k]][[1]], ritmo[[k]][[2]],
                    ritmo[[k]][[3]], tokens = tk, ty = ty)
    }
    if (ultimo_en_curso) {
      tx(paste0("* Sin el día en curso (", format(serie$fecha[[n_dias]], "%d/%m"), ", hasta las ", corte$hora, ")."),
         m, 0.084, size = ty$caption, col = tk$soft)
    }
    metas <- if (con_meta) stats::setNames(total_meta, "Mínimo esperado") else numeric(0)
    pulso_pdf_serie_partida(m + 0.030, suelo + 0.040, ancho - 0.030, 0.455,
                            dias = etiquetas, diarias = serie$completas, acumulado = serie$acumulado,
                            metas = metas, tokens = tk, ty = ty, geo = geo,
                            rotulo_acumulado = if (con_meta) "Completas acumuladas y mínimo esperado" else "Completas acumuladas",
                            rotulo_diario = "Encuestas completas por día",
                            formato = .acav_n)
    pie()
  }

  # --- Avance diario de cada público ------------------------------------------
  # El mismo gráfico que el de cursos-horario (hostigamiento): el acumulado es
  # una línea contra el mínimo esperado y las completas del día son barras, un
  # panel por público y cada uno con su escala.
  for (h in seq_along(hojas_paneles)) {
    nueva("Avance diario por público",
          if (length(hojas_paneles) > 1L) sprintf("%d de %d", h, length(hojas_paneles)) else "")
    idx <- hojas_paneles[[h]]
    columnas <- rejilla$columnas
    banda_rotulo <- 0.044; banda_fechas <- 0.034; aire <- 0.022; leyenda <- 0.050
    hueco_x <- 0.030
    w <- (ancho - hueco_x * (columnas - 1L)) / columnas
    filas_p <- max(1L, ceiling(rejilla$por_hoja / columnas))
    disponible <- techo - (suelo + leyenda) - aire * (filas_p - 1L)
    hp <- max(0.120, min(0.330, disponible / filas_p - banda_rotulo - banda_fechas))
    paso <- hp + banda_rotulo + banda_fechas + aire
    for (k in seq_along(idx)) {
      p <- pub[idx[[k]], , drop = FALSE]
      c0 <- (k - 1L) %% columnas
      r0 <- (k - 1L) %/% columnas
      px <- m + c0 * (w + hueco_x) + 0.026
      py <- techo - banda_rotulo - hp - r0 * paso
      # Sólo el nombre: las cifras del público ya están en la tabla del resumen.
      tx(p$publico, px, py + hp + 0.022, size = ty$body, col = tk$navy, face = "bold", just = c("left", "bottom"))
      diarias <- as.numeric(matriz[, p$publico])
      pulso_pdf_serie_partida(px, py, w - 0.026, hp, dias = etiquetas_panel, diarias = diarias,
                              acumulado = cumsum(diarias),
                              metas = if (con_meta) stats::setNames(p$meta, "") else numeric(0),
                              tokens = tk, ty = ty, geo = geo, compacto = TRUE, formato = .acav_n)
    }
    pulso_pdf_leyenda(m, suelo + 0.004, c(
      list(list(texto = "Acumulado", color = tk$success, forma = "linea"),
           list(texto = "Completas del día", color = tk$navy, forma = "barra")),
      if (con_meta) list(list(texto = "Mínimo esperado", color = tk$danger, forma = "linea", lty = 2)) else list()
    ), tokens = tk, ty = ty, centrado = TRUE, ancho = ancho, fontsize = ty$body)
    pie()
  }

  # --- Completas por día y público -------------------------------------------
  for (b in seq_along(hojas_tabla)) {
    ultima <- b == length(hojas_tabla)
    nueva("Encuestas completas por día y público",
          if (length(hojas_tabla) > 1L) sprintf("%d de %d", b, length(hojas_tabla)) else "")
    if (n_dias && nrow(pub)) {
      publicos <- pub$publico
      n_pub <- length(publicos)
      fecha_w <- 0.120
      cw <- (ancho - fecha_w) / (n_pub + 2)
      xs_col <- m + fecha_w + cw * seq_len(n_pub + 2) - 0.008
      hy <- 0.770; hh <- 0.050; fila <- 0.030
      caja(m, hy - hh / 2, ancho, hh, tk$tbl_header)
      regla(m, right, hy + hh / 2, col = tk$tbl_frame, lwd = pesos$bloque)
      regla(m, right, hy - hh / 2, col = tk$tbl_frame, lwd = pesos$columna)
      tx(pulso_pdf_versalitas("Día"), m + 0.008, hy, size = ty$eyebrow, col = tk$soft, face = "bold")
      cabeceras <- c(publicos, "Total del día", "Acumulado")
      for (j in seq_along(cabeceras)) {
        tx(paste(strwrap(cabeceras[[j]], width = 14), collapse = "\n"), xs_col[[j]], hy, size = ty$caption,
           col = tk$soft, face = "bold", just = c("right", "center"), lineheight = 1.0)
      }
      ry <- hy - hh / 2
      for (i in hojas_tabla[[b]]) {
        cy <- ry - fila / 2
        if (i %% 2 == 0) caja(m, ry - fila, ancho, fila, tk$tbl_zebra)
        en_curso <- ultimo_en_curso && i == n_dias
        dia <- paste(.acav_dias_semana[as.POSIXlt(serie$fecha[[i]])$wday + 1L], format(serie$fecha[[i]], "%d/%m"))
        tx(paste0(dia, if (en_curso) "*" else ""), m + 0.008, cy, size = ty$body)
        vals <- c(matriz[i, ], serie$completas[[i]], serie$acumulado[[i]])
        for (j in seq_along(vals)) {
          tx(.acav_n(vals[[j]]), xs_col[[j]], cy, size = ty$body, col = if (j > n_pub) tk$navy else tk$ink,
             face = if (j > n_pub) "bold" else "plain", just = c("right", "center"))
        }
        ry <- ry - fila
        regla(m, right, ry, col = tk$rule, lwd = pesos$fila)
      }
      if (ultima) {
        cy <- ry - fila / 2
        caja(m, ry - fila, ancho, fila, tk$tbl_zebra)
        regla(m, right, ry, col = tk$tbl_frame, lwd = pesos$columna)
        tx("Total", m + 0.008, cy, size = ty$body, face = "bold")
        tots <- c(colSums(matriz), sum(serie$completas))
        for (j in seq_along(tots)) {
          tx(.acav_n(tots[[j]]), xs_col[[j]], cy, size = ty$body, col = tk$navy, face = "bold", just = c("right", "center"))
        }
        ry <- ry - fila
        regla(m, right, ry, col = tk$tbl_frame, lwd = pesos$bloque)
        if (ultimo_en_curso) {
          tx(paste0("* Día en curso: completas registradas hasta las ", corte$hora, "."),
             m, ry - 0.022, size = ty$caption, col = tk$soft)
        }
      }
    } else {
      tx("Aún no hay encuestas completas registradas.", m, 0.700, size = ty$body, col = tk$soft)
    }
    pie()
  }

  grDevices::dev.off(dev)
  invisible(output_file)
}
