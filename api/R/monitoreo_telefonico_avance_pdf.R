# El PDF de avance de campo del perfil telefónico, el que se entrega al cliente.
#
# Se reescribió en la familia Pulso PDF de aulas y acreditación (A4 apaisado,
# portada navy, cromo con antetítulo, tarjetas, serie partida y un panel por
# grupo). Checklist: `docs/qa/checklist-pdf-avance-telefonico-2026-11-03.md`.
#
# EL CONTENIDO NO SE RECALCULA. Las cifras son las de
# `build_monitoreo_telefonico_report_model()` y su resumen
# `.mtpdf_report_facts()`: encuestas válidas de la base de respuestas, cuotas
# cruzadas con el barrido por la llave y cobertura de la base telefónica. Este
# archivo sólo decide cómo se leen.
#
# En telefónico la cifra de referencia de cada grupo es la cuota prevista del
# estudio (100 hogares por periodo de llegada en el RMS), así que manda el avance
# sobre lo previsto. El vocabulario de la base es el que ya fijó el perfil:
# registros contactados, no contactados, resultado de los contactados.
# Sin «cumplimiento», «de la meta», «mejor día» ni «margen»: la prueba
# `test-monitoreo-telefonico-pdf.R` los prohíbe.

# Estados que no son un contacto: la fila no se llamó. El resto de la lista
# cerrada de Status es el resultado de una llamada.
.mtav_sin_contacto <- c("no barrido", "nobarrido", "sin status", "sin estatus", "")

.mtav_grupos <- function(facts) {
  rows <- facts$quota_rows %||% data.frame()
  vacio <- data.frame(grupo = character(), previstas = numeric(), validas = numeric(),
                      registros = numeric(), contactados = numeric(), no_contactados = numeric(),
                      stringsAsFactors = FALSE)
  if (!nrow(rows)) return(vacio)
  num <- function(x) { x <- suppressWarnings(as.numeric(x)); x[!is.finite(x)] <- NA_real_; x }
  data.frame(
    grupo = as.character(rows$segment),
    previstas = num(rows$target),
    validas = .acav_num(rows$actual),
    registros = num(rows$universe),
    contactados = num(rows$swept),
    no_contactados = num(rows$pending),
    stringsAsFactors = FALSE
  )
}

.mtav_resultados <- function(status) {
  status <- .mtpdf_df(status)
  if (!nrow(status) || !all(c("Estatus", "Casos") %in% names(status))) {
    return(data.frame(resultado = character(), casos = numeric(), stringsAsFactors = FALSE))
  }
  clave <- tolower(trimws(as.character(status$Estatus)))
  out <- data.frame(resultado = as.character(status$Estatus), casos = .acav_num(status$Casos),
                    stringsAsFactors = FALSE)
  out <- out[!clave %in% .mtav_sin_contacto & out$casos > 0, , drop = FALSE]
  out[order(-out$casos, out$resultado), , drop = FALSE]
}

#' PDF de avance de campo del perfil telefónico (entregable al cliente).
#'
#' @param model modelo de `build_monitoreo_telefonico_report_model()`.
#' @param path ruta del PDF.
#' @param include_targets si el documento publica las encuestas previstas por
#'   grupo («Incluir metas» en Salidas).
#' @param portada campos escritos en Salidas (`monitoreo_aulas_portada_desde_body`).
#' @return `path`, invisible.
monitoreo_telefonico_advance_report_pdf <- function(model, path, include_targets = FALSE, portada = list()) {
  tk <- pulso_pdf_tokens()
  ty <- pulso_pdf_type("cliente")
  geo <- pulso_pdf_geo("landscape")
  pesos <- pulso_pdf_pesos()
  m <- geo$margin
  right <- 1 - m
  ancho <- right - m
  techo <- 0.800
  suelo <- 0.108

  facts <- .mtpdf_report_facts(model)
  labels <- unlist(model$quota_labels %||% list())
  dimension <- .mtpdf_text(facts$primary_quota_dimension, "")
  rotulo_grupo <- if (nzchar(dimension) && !is.null(labels) && dimension %in% names(labels)) labels[[dimension]] else dimension
  if (!nzchar(rotulo_grupo)) rotulo_grupo <- "Grupo"
  grupos <- .mtav_grupos(facts)
  hay_grupos <- nrow(grupos) > 1L
  con_meta <- isTRUE(include_targets) && isTRUE(facts$has_targets) && sum(grupos$previstas, na.rm = TRUE) > 0

  total_validas <- .acav_num(facts$total_valid)[[1]]
  total_previstas <- if (con_meta) sum(grupos$previstas, na.rm = TRUE) else NA_real_
  # Válidas que no cruzan con ningún grupo del barrido: no se reparten ni se
  # callan, van como asterisco en el total.
  sin_grupo <- if (hay_grupos) max(0, total_validas - sum(grupos$validas)) else 0
  # Lo que falta se suma grupo por grupo: el exceso de uno no cubre la cuota de
  # otro (52 de 50 y 41 de 50 dejan 9 por recoger, no 7).
  faltan_grupo <- ifelse(is.finite(grupos$previstas), pmax(0, grupos$previstas - grupos$validas), 0)
  total_faltan <- if (con_meta) {
    if (hay_grupos) sum(faltan_grupo) else max(0, total_previstas - total_validas)
  } else NA_real_

  serie <- .acav_serie(data.frame(Fecha = facts$daily_dates, Efectivas = facts$daily_values))
  n_dias <- nrow(serie)
  daily_actor <- .mtpdf_df(model$daily_actor)
  matriz <- .acav_matriz_diaria(daily_actor, serie$fecha, grupos$grupo)
  # Los paneles por grupo sólo si el diario por grupo explica las válidas por
  # grupo: con otra dimensión de cuota (sexo, sede) el actor no es el grupo.
  hay_paneles <- hay_grupos && n_dias > 0 && nrow(daily_actor) > 0 &&
    all(abs(colSums(matriz) - grupos$validas) < 0.5)
  if (!hay_paneles) matriz <- matriz[, integer(0), drop = FALSE]

  corte <- .acav_corte(model)
  defectos_estudio <- .monitoreo_scalar(model$study_title %||% "", "")
  ultimo_en_curso <- n_dias > 0 && !is.na(corte$fecha) &&
    identical(as.character(serie$fecha[[n_dias]]), as.character(corte$fecha))
  dias_cerrados <- if (ultimo_en_curso) n_dias - 1L else n_dias
  # Sobre días completos: un día en curso bajaría el promedio sin que el ritmo cambie.
  promedio <- if (dias_cerrados > 0) sum(serie$completas[seq_len(dias_cerrados)]) / dias_cerrados else NA_real_
  etiquetas <- .acav_etiquetas_de_dia(serie$fecha, if (ultimo_en_curso) corte$hora else "")
  etiquetas_panel <- .acav_etiquetas_de_dia(serie$fecha)
  inicio <- if (n_dias) serie$fecha[[1]] else as.Date(NA)
  fin <- if (n_dias) serie$fecha[[n_dias]] else as.Date(NA)

  portada <- pulso_pdf_portada_normalizar(defectos = list(
    titulo = "Avance del trabajo de campo",
    subtitulo = defectos_estudio,
    periodo = if (n_dias) paste("Del", .acav_fecha_larga(inicio), "al", .acav_fecha_larga(fin)) else "",
    corte = corte$texto
  ), usuario = portada %||% list())
  antetitulo <- if (nzchar(portada$subtitulo)) portada$subtitulo else "Encuesta telefónica"

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
  encabezado <- function(x0, x1, hy, hh) {
    caja(x0, hy - hh / 2, x1 - x0, hh, tk$tbl_header)
    regla(x0, x1, hy + hh / 2, col = tk$tbl_frame, lwd = pesos$bloque)
    regla(x0, x1, hy - hh / 2, col = tk$tbl_frame, lwd = pesos$columna)
  }
  enc <- function(label, x, hy, just = "right") {
    tx(toupper(label), x, hy, size = ty$eyebrow, col = tk$soft, face = "bold",
       just = c(just, "center"), lineheight = 1.0)
  }
  fila_kpis <- function(kpis, y = 0.660, h = 0.140, w_principal = NA_real_) {
    hueco <- 0.014
    n <- length(kpis)
    if (!is.finite(w_principal)) w_principal <- (ancho - hueco * (n - 1L)) / n
    w_resto <- if (n > 1L) (ancho - w_principal - hueco * (n - 1L)) / (n - 1L) else ancho
    kx <- m
    for (k in seq_along(kpis)) {
      w <- if (k == 1L) w_principal else w_resto
      pulso_pdf_kpi(kx, y, w, h, kpis[[k]]$rotulo, kpis[[k]]$valor, kpis[[k]]$nota %||% "",
                    tokens = tk, ty = ty, destacado = isTRUE(kpis[[k]]$destacado))
      if (is.finite(kpis[[k]]$medidor %||% NA_real_)) {
        pulso_pdf_medidor(kx + 0.135, y + 0.050, w - 0.153, 0.012, kpis[[k]]$medidor, tokens = tk, tono = tk$navy)
      }
      kx <- kx + w + hueco
    }
  }

  # --- Plan del documento: el folio necesita el total desde la primera hoja.
  rejilla <- .marp_rejilla_de_paneles(nrow(grupos))
  if (nrow(grupos) %in% 5:6) rejilla <- list(columnas = 3L, hojas = 1L, por_hoja = nrow(grupos))
  hojas_paneles <- if (hay_paneles) split(seq_len(nrow(grupos)), ceiling(seq_len(nrow(grupos)) / rejilla$por_hoja)) else list()
  cabida_tabla <- 20L
  n_hojas_tabla <- max(1L, ceiling(n_dias / cabida_tabla))
  filas_tabla <- max(1L, ceiling(n_dias / n_hojas_tabla))
  hojas_tabla <- if (n_dias) split(seq_len(n_dias), ceiling(seq_len(n_dias) / filas_tabla)) else list()
  hay_cobertura <- isTRUE(facts$has_global_coverage)
  total_paginas <- 1L + (if (n_dias) 1L else 0L) + length(hojas_paneles) +
    (if (hay_cobertura) 1L else 0L) + length(hojas_tabla)

  corte_corto <- if (!is.na(corte$fecha)) paste("Corte", format(corte$fecha, "%d/%m/%Y"), corte$hora) else ""
  pag <- 0L
  nueva <- function(sec_titulo, sec_subtitulo = "") {
    grid::grid.newpage()
    pag <<- pag + 1L
    pulso_pdf_cromo(antetitulo, sec_titulo, sec_subtitulo, tokens = tk, ty = ty, geo = geo,
                    derecha = corte_corto)
  }
  pie <- function() pulso_pdf_pie(pag, total_paginas, corte$periodo, tokens = tk, ty = ty, geo = geo)

  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  pulso_pdf_abrir(path, geo)
  dev <- grDevices::dev.cur()
  on.exit(if (dev %in% grDevices::dev.list()) grDevices::dev.off(dev), add = TRUE)

  # --- Portada -------------------------------------------------------------
  grid::grid.newpage()
  destacados <- if (con_meta) list(
    list(rotulo = "Válidas", valor = .acav_n(total_validas)),
    list(rotulo = "Previstas", valor = .acav_n(total_previstas)),
    list(rotulo = "Avance", valor = .acav_pct(total_validas, total_previstas))
  ) else list(
    list(rotulo = "Válidas", valor = .acav_n(total_validas)),
    list(rotulo = "Días de campo", valor = .acav_n(n_dias))
  )
  pulso_pdf_portada(portada, tokens = tk, ty = ty, geo = geo, antetitulo = "Monitoreo de la encuesta telefónica",
                    destacados = destacados, reparto = "contenido")

  # --- Resumen del avance ----------------------------------------------------
  nueva("Resumen del avance")
  asterisco_total <- if (sin_grupo > 0) "*" else ""
  kpis <- if (con_meta) list(
    list(rotulo = "Avance sobre lo previsto", valor = .acav_pct(total_validas, total_previstas),
         nota = paste(.acav_n(total_validas), "de", .acav_n(total_previstas)), destacado = TRUE,
         medidor = if (total_previstas > 0) total_validas / total_previstas else 0),
    list(rotulo = "Encuestas válidas", valor = .acav_n(total_validas)),
    list(rotulo = "Encuestas previstas", valor = .acav_n(total_previstas)),
    if (total_faltan > 0) {
      list(rotulo = "Faltan", valor = .acav_n(total_faltan))
    } else {
      list(rotulo = "Por encima de lo previsto", valor = .acav_n(max(0, total_validas - total_previstas)))
    },
    list(rotulo = "Días de campo", valor = .acav_n(n_dias),
         nota = if (n_dias) paste(.acav_fecha_corta(inicio), "a", .acav_fecha_corta(fin)) else "")
  ) else list(
    list(rotulo = "Encuestas válidas", valor = .acav_n(total_validas), destacado = TRUE),
    list(rotulo = "Días de campo", valor = .acav_n(n_dias),
         nota = if (n_dias) paste(.acav_fecha_corta(inicio), "a", .acav_fecha_corta(fin)) else "")
  )
  fila_kpis(kpis, w_principal = if (con_meta) 0.250 else NA_real_)

  if (hay_grupos) {
    pulso_pdf_rotulo_seccion(m, 0.600, paste("Encuestas válidas por", tolower(rotulo_grupo)),
                             tokens = tk, ty = ty)
    cols <- if (con_meta) list(
      grupo = m + 0.008, previstas = m + 0.300, validas = m + 0.400,
      barra0 = m + 0.440, barra1 = m + 0.700, pct = m + 0.712, faltan = right - 0.008
    ) else list(
      grupo = m + 0.008, validas = m + 0.400, barra0 = m + 0.440, barra1 = m + 0.700, pct = m + 0.712
    )
    hy <- 0.530; hh <- 0.040
    encabezado(m, right, hy, hh)
    enc(rotulo_grupo, cols$grupo, hy, "left")
    if (con_meta) enc("Previstas", cols$previstas, hy)
    enc("Válidas", cols$validas, hy)
    enc(if (con_meta) "Avance sobre lo previsto" else "Participación en el total", cols$barra0, hy, "left")
    if (con_meta) enc("Faltan", cols$faltan, hy)
    filas <- rbind(grupos[, c("grupo", "previstas", "validas")],
                   data.frame(grupo = paste0("Total", asterisco_total), previstas = total_previstas,
                              validas = total_validas, stringsAsFactors = FALSE))
    fila_h <- min(0.054, (hy - hh / 2 - suelo - 0.030) / max(1L, nrow(filas)))
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
      den <- if (con_meta) f$previstas else total_validas
      tx(f$grupo, cols$grupo, cy, size = ty$body + 0.4, face = cara)
      if (con_meta) tx(.acav_n(f$previstas), cols$previstas, cy, face = cara, just = c("right", "center"))
      tx(.acav_n(f$validas), cols$validas, cy, col = tk$navy, face = "bold", just = c("right", "center"))
      pulso_pdf_barra_progreso(cols$barra0, cy - 0.007, cols$barra1 - cols$barra0, 0.014,
                               if (is.finite(den) && den > 0) f$validas / den else 0, tokens = tk)
      tx(.acav_pct(f$validas, den), cols$pct, cy + 0.008, face = "bold")
      tx(paste(.acav_n(f$validas), "de", .acav_n(den)), cols$pct, cy - 0.010, size = ty$caption, col = tk$soft)
      if (con_meta) {
        faltan <- if (es_total) total_faltan else if (is.finite(f$previstas)) max(0, f$previstas - f$validas) else NA_real_
        tx(.acav_n(faltan), cols$faltan, cy, face = cara, just = c("right", "center"))
      }
      fy <- fy - fila_h
      regla(m, right, fy, col = if (es_total) tk$tbl_frame else tk$rule, lwd = if (es_total) pesos$bloque else pesos$fila)
    }
    if (sin_grupo > 0) {
      tx(sprintf("* Incluye %s %s sin %s identificado en la base telefónica.",
                 .acav_n(sin_grupo), if (sin_grupo == 1) "encuesta válida" else "encuestas válidas",
                 tolower(rotulo_grupo)),
         m, fy - 0.022, size = ty$caption, col = tk$soft)
    }
  }
  pie()

  # --- Ritmo del campo -------------------------------------------------------
  if (n_dias) {
    nueva("Ritmo del campo")
    pico <- which.max(serie$completas)
    ritmo <- list(
      list(rotulo = "Válidas acumuladas", valor = .acav_n(total_validas),
           nota = if (con_meta) paste(.acav_pct(total_validas, total_previstas), "de", .acav_n(total_previstas), "previstas") else ""),
      list(rotulo = if (ultimo_en_curso) "Promedio por día*" else "Promedio por día",
           valor = if (!is.finite(promedio)) "-" else if (promedio == round(promedio)) .acav_n(promedio) else sprintf("%.1f", promedio)),
      list(rotulo = if (ultimo_en_curso) "Día en curso" else "Último día", valor = .acav_n(serie$completas[[n_dias]]),
           nota = paste0(format(serie$fecha[[n_dias]], "%d/%m"), if (ultimo_en_curso) paste0(", hasta las ", corte$hora) else "")),
      list(rotulo = "Día con más encuestas", valor = .acav_n(serie$completas[[pico]]),
           nota = format(serie$fecha[[pico]], "%d/%m"))
    )
    fila_kpis(ritmo, y = 0.665, h = 0.135)
    if (ultimo_en_curso) {
      tx(paste0("* Sin el día en curso (", format(serie$fecha[[n_dias]], "%d/%m"), ", hasta las ", corte$hora, ")."),
         m, 0.092, size = ty$caption, col = tk$soft)
    }
    pulso_pdf_serie_partida(m + 0.030, suelo + 0.040, ancho - 0.030, 0.455,
                            dias = etiquetas, diarias = serie$completas, acumulado = serie$acumulado,
                            metas = if (con_meta) stats::setNames(total_previstas, "Previstas") else numeric(0),
                            tokens = tk, ty = ty, geo = geo,
                            rotulo_acumulado = if (con_meta) "Válidas acumuladas y encuestas previstas" else "Válidas acumuladas",
                            rotulo_diario = "Encuestas válidas por día",
                            formato = .acav_n)
    pie()
  }

  # --- Avance diario de cada grupo -------------------------------------------
  for (h in seq_along(hojas_paneles)) {
    nueva(paste("Avance diario por", tolower(rotulo_grupo)),
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
      g <- grupos[idx[[k]], , drop = FALSE]
      c0 <- (k - 1L) %% columnas
      r0 <- (k - 1L) %/% columnas
      px <- m + c0 * (w + hueco_x) + 0.026
      py <- techo - banda_rotulo - hp - r0 * paso
      tx(g$grupo, px, py + hp + 0.022, col = tk$navy, face = "bold", just = c("left", "bottom"))
      diarias <- as.numeric(matriz[, g$grupo])
      pulso_pdf_serie_partida(px, py, w - 0.026, hp, dias = etiquetas_panel, diarias = diarias,
                              acumulado = cumsum(diarias),
                              metas = if (con_meta && is.finite(g$previstas)) stats::setNames(g$previstas, "") else numeric(0),
                              tokens = tk, ty = ty, geo = geo, compacto = TRUE, formato = .acav_n)
    }
    pulso_pdf_leyenda(m, suelo + 0.004, c(
      list(list(texto = "Acumulado", color = tk$success, forma = "linea"),
           list(texto = "Válidas del día", color = tk$navy, forma = "barra")),
      if (con_meta) list(list(texto = "Previstas", color = tk$danger, forma = "linea", lty = 2)) else list()
    ), tokens = tk, ty = ty, centrado = TRUE, ancho = ancho, fontsize = ty$body)
    pie()
  }

  # --- Cobertura de la base telefónica ---------------------------------------
  if (hay_cobertura) {
    nueva("Cobertura de la base telefónica")
    total_reg <- .acav_num(facts$total)[[1]]
    contactados <- .acav_num(facts$swept)[[1]]
    no_contactados <- .acav_num(facts$pending)[[1]]
    kpis_base <- c(
      list(
        list(rotulo = "Registros en la base", valor = .acav_n(total_reg)),
        list(rotulo = "Registros contactados", valor = .acav_n(contactados),
             nota = .acav_pct_frec(contactados, total_reg)),
        list(rotulo = "No contactados", valor = .acav_n(no_contactados),
             nota = .acav_pct_frec(no_contactados, total_reg))
      ),
      if (isTRUE(facts$has_phone_effectiveness)) list(
        list(rotulo = "Contactos efectivos", valor = .acav_n(facts$phone_effective),
             nota = paste(.acav_pct(facts$phone_effective, contactados), "de contactados")),
        list(rotulo = "Contactos no efectivos", valor = .acav_n(facts$phone_non_effective),
             nota = paste(.acav_pct(facts$phone_non_effective, contactados), "de contactados"))
      ) else list()
    )
    fila_kpis(kpis_base)

    resultados <- .mtav_resultados(model$status)
    hay_resultados <- nrow(resultados) > 0
    x_der <- if (hay_resultados) m + 0.585 else right
    if (hay_grupos && isTRUE(facts$has_category_coverage)) {
      x1 <- x_der - (if (hay_resultados) 0.035 else 0)
      pulso_pdf_rotulo_seccion(m, 0.600, paste("Registros contactados por", tolower(rotulo_grupo)), tokens = tk, ty = ty)
      cols <- list(grupo = m + 0.008, registros = m + 0.215, barra0 = m + 0.240,
                   barra1 = x1 - 0.200, pct = x1 - 0.188, no = x1 - 0.008)
      hy <- 0.530; hh <- 0.040
      encabezado(m, x1, hy, hh)
      enc(rotulo_grupo, cols$grupo, hy, "left")
      enc("Registros", cols$registros, hy)
      enc("Contactados", cols$barra0, hy, "left")
      enc("No\ncontactados", cols$no, hy)
      filas <- rbind(grupos[, c("grupo", "registros", "contactados", "no_contactados")],
                     data.frame(grupo = "Total", registros = total_reg, contactados = contactados,
                                no_contactados = no_contactados, stringsAsFactors = FALSE))
      fila_h <- min(0.054, (hy - hh / 2 - suelo - 0.010) / max(1L, nrow(filas)))
      fy <- hy - hh / 2
      for (i in seq_len(nrow(filas))) {
        f <- filas[i, , drop = FALSE]
        es_total <- i == nrow(filas)
        cy <- fy - fila_h / 2
        if (es_total) {
          caja(m, fy - fila_h, x1 - m, fila_h, tk$tbl_zebra)
          regla(m, x1, fy, col = tk$tbl_frame, lwd = pesos$columna)
        }
        cara <- if (es_total) "bold" else "plain"
        tx(f$grupo, cols$grupo, cy, size = ty$body + 0.4, face = cara)
        tx(.acav_n(f$registros), cols$registros, cy, face = cara, just = c("right", "center"))
        pulso_pdf_barra_progreso(cols$barra0, cy - 0.007, cols$barra1 - cols$barra0, 0.014,
                                 if (is.finite(f$registros) && f$registros > 0) f$contactados / f$registros else 0, tokens = tk)
        tx(.acav_pct(f$contactados, f$registros), cols$pct, cy + 0.008, face = "bold")
        tx(paste(.acav_n(f$contactados), "de", .acav_n(f$registros)), cols$pct, cy - 0.010, size = ty$caption, col = tk$soft)
        tx(.acav_n(f$no_contactados), cols$no, cy, face = cara, just = c("right", "center"))
        fy <- fy - fila_h
        regla(m, x1, fy, col = if (es_total) tk$tbl_frame else tk$rule, lwd = if (es_total) pesos$bloque else pesos$fila)
      }
    } else {
      x_der <- m
    }
    if (hay_resultados) {
      pulso_pdf_rotulo_seccion(x_der, 0.600, "Resultado de los contactados", tokens = tk, ty = ty)
      hy <- 0.530; hh <- 0.040
      encabezado(x_der, right, hy, hh)
      enc("Resultado", x_der + 0.008, hy, "left")
      enc("Registros", right - 0.110, hy)
      enc("De contactados", right - 0.008, hy)
      fila_h <- min(0.040, (hy - hh / 2 - suelo - 0.010) / nrow(resultados))
      fy <- hy - hh / 2
      for (i in seq_len(nrow(resultados))) {
        cy <- fy - fila_h / 2
        tx(resultados$resultado[[i]], x_der + 0.008, cy)
        tx(.acav_n(resultados$casos[[i]]), right - 0.110, cy, col = tk$navy, face = "bold", just = c("right", "center"))
        tx(.acav_pct(resultados$casos[[i]], contactados), right - 0.008, cy, just = c("right", "center"))
        fy <- fy - fila_h
        regla(x_der, right, fy)
      }
    }
    pie()
  }

  # --- Encuestas válidas por día ---------------------------------------------
  for (b in seq_along(hojas_tabla)) {
    ultima <- b == length(hojas_tabla)
    nueva(if (hay_paneles) paste("Encuestas válidas por día y", tolower(rotulo_grupo)) else "Encuestas válidas por día",
          if (length(hojas_tabla) > 1L) sprintf("%d de %d", b, length(hojas_tabla)) else "")
    nombres <- colnames(matriz)
    n_g <- length(nombres)
    fecha_w <- 0.120
    cw <- (ancho - fecha_w) / (n_g + 2)
    xs_col <- m + fecha_w + cw * seq_len(n_g + 2) - 0.008
    hy <- 0.770; hh <- 0.050; fila <- 0.030
    encabezado(m, right, hy, hh)
    tx(pulso_pdf_versalitas("Día"), m + 0.008, hy, size = ty$eyebrow, col = tk$soft, face = "bold")
    marca <- if (n_g && sin_grupo > 0) "*" else ""
    cabeceras <- c(nombres, paste0("Total del día", marca), "Acumulado")
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
      tx(paste0(dia, if (en_curso) { if (nzchar(marca)) "**" else "*" } else ""), m + 0.008, cy)
      vals <- c(if (n_g) matriz[i, ] else numeric(0), serie$completas[[i]], serie$acumulado[[i]])
      for (j in seq_along(vals)) {
        tx(.acav_n(vals[[j]]), xs_col[[j]], cy, col = if (j > n_g) tk$navy else tk$ink,
           face = if (j > n_g) "bold" else "plain", just = c("right", "center"))
      }
      ry <- ry - fila
      regla(m, right, ry)
    }
    if (ultima) {
      cy <- ry - fila / 2
      caja(m, ry - fila, ancho, fila, tk$tbl_zebra)
      regla(m, right, ry, col = tk$tbl_frame, lwd = pesos$columna)
      tx("Total", m + 0.008, cy, face = "bold")
      tots <- c(if (n_g) colSums(matriz) else numeric(0), sum(serie$completas))
      for (j in seq_along(tots)) {
        tx(.acav_n(tots[[j]]), xs_col[[j]], cy, col = tk$navy, face = "bold", just = c("right", "center"))
      }
      ry <- ry - fila
      regla(m, right, ry, col = tk$tbl_frame, lwd = pesos$bloque)
      notas <- c(
        if (nzchar(marca)) sprintf("* Incluye %s %s sin %s identificado en la base telefónica.",
                                   .acav_n(sin_grupo), if (sin_grupo == 1) "encuesta válida" else "encuestas válidas",
                                   tolower(rotulo_grupo)),
        if (ultimo_en_curso) paste0(if (nzchar(marca)) "** " else "* ", "Día en curso: encuestas registradas hasta las ", corte$hora, ".")
      )
      for (k in seq_along(notas)) tx(notas[[k]], m, ry - 0.022 - (k - 1L) * 0.022, size = ty$caption, col = tk$soft)
    }
    pie()
  }

  grDevices::dev.off(dev)
  invisible(path)
}
