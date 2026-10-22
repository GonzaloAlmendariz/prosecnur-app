# Writers XLSX de los comparativos armonizados (contrato E4-E7, R4)
# ===============================================================
#
# Dos libros, una hoja cada uno, tablas apiladas, misma estética que
# frecuencias y cruces (`xlsx_theme.R`, monocromo Pulso). La geometría replica
# la maqueta aprobada por la OIGD («HSyVBG PUCP 2026_Lista y formato de
# entregables.xlsx», hojas «Comparativo simple 2024-2026» y «Comparativo
# cruces 2024-2026»):
#
#   Comparativo simple  períodos en columnas (N y %), filas = escala + Total,
#                       sin Total combinado entre períodos, % a dos decimales.
#   Comparativo cruces  Respuesta × período en filas (respuesta combinada en
#                       vertical), banner de cruces en columnas (n y %), y la
#                       subtabla de letras calculadas DENTRO de cada período.
#
# Los modelos llegan calculados desde `analitica_armonizada.R`; aquí sólo se
# dibuja. Las notas al pie usan el bloque `notas` de Analítica
# (`reporte_notas_pie.R`). Textos sin raya, sin punto medio y sin punto y coma,
# salvo la marca «—» de opción no ofrecida, que es la de la maqueta.
#
# Pie de cada pregunta (R4b): fuente y base, notas por cruce, marcas (n.c.,
# «—», n.a.), casos sin correspondencia en la escala,
# bases reducidas agrupadas por columna y, tras un renglón en blanco, la nota
# libre de la pregunta y las notas generales (`extras`). Cada pregunta abre
# página (salto manual) y la hoja se ajusta al ancho.

.COMPARATIVO_NA <- "n.a."
.COMPARATIVO_NC <- "n.c."
# Gonzalo, 2026-10-13: «Déjalo con n.a. como en la maqueta». La opción no ofrecida se marca
# igual que la maqueta; el manifest conserva la distinción (no_ofrecidas).
.COMPARATIVO_NO_OFRECIDA <- "n.a."

# Unidad de la serie: «Año» sólo si TODOS los rótulos de período son años de
# cuatro dígitos. Una serie de públicos («docentes», «egresados») o con rótulos
# libres es de «Medición», en el encabezado y en el pie.
.comparativo_unidad <- function(rotulos) {
  r <- trimws(as.character(unlist(rotulos, use.names = FALSE)))
  if (length(r) && all(grepl("^[0-9]{4}$", r))) {
    list(titulo = "Año", nombre = "año", ese = "ese año", cada = "cada año")
  } else {
    list(titulo = "Medición", nombre = "medición", ese = "esa medición", cada = "cada medición")
  }
}

.comparativo_linea_no_ofrecida_base <- function(rotulos) {
  paste0("n.a.: no aplica, la opción no se ofrecía ", .comparativo_unidad(rotulos)$ese, ".")
}

# Estilos del comparativo: los de cruces del tema más las tres variantes que
# la maqueta pide (marca gris en cursiva, % a dos decimales, total en negrita).
.comparativo_estilos <- function(pct_fmt = "0.0%") {
  st <- pulso_xlsx_styles("cruces")
  pal <- pulso_xlsx_palette()
  ft <- pulso_xlsx_font()
  cs <- function(...) openxlsx::createStyle(fontName = ft, fontSize = 10, valign = "center",
                                            fontColour = pal$ink, ...)
  for (fill in c("bg", "zebra")) {
    sfx <- if (fill == "bg") "" else "_z"
    st[[paste0("c_txt", sfx)]] <- cs(halign = "left", wrapText = TRUE, fgFill = pal[[fill]])
    st[[paste0("c_lbl", sfx)]] <- cs(halign = "center", fgFill = pal[[fill]])
    st[[paste0("c_int", sfx)]] <- cs(halign = "center", numFmt = "#,##0", fgFill = pal[[fill]])
    st[[paste0("c_pct", sfx)]] <- cs(halign = "center", numFmt = pct_fmt, fgFill = pal[[fill]])
    st[[paste0("c_marca", sfx)]] <- openxlsx::createStyle(
      fontName = ft, fontSize = 10, textDecoration = "italic", halign = "center",
      valign = "center", fontColour = pal$ink_soft, fgFill = pal[[fill]])
  }
  st$c_head <- openxlsx::createStyle(fontName = ft, fontSize = 10, textDecoration = "bold",
                                     halign = "center", valign = "center", wrapText = TRUE,
                                     fontColour = pal$ink, fgFill = pal$bg)
  st$c_bold <- openxlsx::createStyle(textDecoration = "bold")
  st$c_regla <- openxlsx::createStyle(border = "bottom", borderStyle = "thin",
                                      borderColour = pal$rule)
  st$c_top <- openxlsx::createStyle(border = "top", borderStyle = "thin",
                                    borderColour = pal$rule_strong)
  st$c_bottom <- openxlsx::createStyle(border = "bottom", borderStyle = "thin",
                                       borderColour = pal$rule_strong)
  st
}

.comparativo_put <- function(wb, hoja, fila, col, valor, estilo) {
  openxlsx::writeData(wb, hoja, valor, startRow = fila, startCol = col, colNames = FALSE)
  openxlsx::addStyle(wb, hoja, estilo, rows = fila, cols = col, stack = FALSE)
}

# Rótulo de sección: el eje de la matriz trae su numeración («3. Prevalencia
# general…», «2) Sociodemográficas»), que en el entregable no significa nada.
.comparativo_rotulo_seccion <- function(x) {
  x <- trimws(as.character(x %||% "")[1])
  if (is.na(x)) return("")
  toupper(trimws(sub("^[0-9]+(\\.[0-9]+)*\\s*[.)]\\s*", "", x, perl = TRUE)))
}

.comparativo_titulo <- function(wb, hoja, st, fila, texto, ncol, seccion = FALSE) {
  .comparativo_put(wb, hoja, fila, 1, texto, if (seccion) st$sec_title else st$q_title)
  if (ncol > 1L) openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncol)
  alto <- if (seccion) 28 else max(22, .calc_row_height(texto, col_width = min(220, 12 * ncol + 40), font_size = 11))
  openxlsx::setRowHeights(wb, hoja, rows = fila, heights = alto)
  fila + 1L
}

.comparativo_notas <- function(wb, hoja, st, fila, lineas, ncol) {
  ancho <- min(60 + 13 * (max(1L, ncol) - 1L), 220)
  for (t in lineas) {
    if (!nzchar(t)) next
    .comparativo_put(wb, hoja, fila, 1, t, st$note)
    if (ncol > 1L) openxlsx::mergeCells(wb, hoja, rows = fila, cols = 1:ncol)
    openxlsx::setRowHeights(wb, hoja, rows = fila,
                            heights = max(14, .calc_row_height(t, col_width = ancho, font_size = 9)))
    fila <- fila + 1L
  }
  fila
}

# Texto de base de una pregunta, de lo declarado a lo calculado:
#   1. `base_texto` de la fila de la matriz;
#   2. `base_por_pregunta` de las notas (id de la fila, su etiqueta estándar o
#      cualquiera de sus variables) y `base_defecto`;
#   3. si nada lo declara, «total de encuestados» cuando en TODOS los períodos
#      comparables respondió la pregunta cada caso con peso > 0, y si no
#      «quienes respondieron la pregunta». Un indicador compuesto (ADR 0105)
#      deja NA a quien no se le preguntó: su base reducida cae en el segundo.
.comparativo_base <- function(notas, q, periodos = names(q$periodos)) {
  bt <- .notas_pie_texto(q$base_texto)
  if (nzchar(bt)) return(bt)
  notas <- .notas_pie_normalizar(notas)
  bpp <- notas$base_por_pregunta
  hit <- intersect(q$claves, names(bpp))
  if (length(hit)) return(.notas_pie_texto(bpp[[hit[[1]]]]))
  if (nzchar(notas$base_defecto)) return(notas$base_defecto)
  .comparativo_base_calculada(q, periodos)
}

.comparativo_base_calculada <- function(q, periodos) {
  comp <- Filter(function(pp) !identical(pp$estado, "n.c."), (q$periodos %||% list())[periodos])
  completa <- length(comp) > 0L && all(vapply(comp, function(pp) {
    n <- as.numeric(pp$N_sin_peso %||% (pp$total %||% list())$N_sin_peso %||% NA_real_)
    casos <- as.numeric(pp$casos %||% NA_real_)
    length(n) == 1L && length(casos) == 1L && !is.na(n) && !is.na(casos) && casos > 0 && n == casos
  }, logical(1)))
  if (completa) "total de encuestados" else "quienes respondieron la pregunta"
}

# «Fuente: …». Una fuente declarada en las notas se respeta tal cual. La por
# defecto («Pulso PUCP», también la que siembra el editor de notas) lleva el
# año del último período de la serie cuando su rótulo es un año.
.comparativo_fuente <- function(notas, rotulos, periodos) {
  f <- .notas_pie_texto((if (is.list(notas)) notas else list())$fuente)
  if (nzchar(f) && !identical(sub("\\.+$", "", f), .notas_pie_fuente_defecto)) {
    return(paste0("Fuente: ", .notas_pie_cerrar(f)))
  }
  ult <- if (length(periodos)) trimws(as.character(rotulos[[periodos[[length(periodos)]]]] %||% "")) else ""
  paste0("Fuente: ", .notas_pie_fuente_defecto,
         if (length(ult) == 1L && grepl("^[0-9]{4}$", ult)) paste0(" ", ult) else "", ".")
}

.comparativo_por_cruce <- function(notas, cruces) {
  pc <- .notas_pie_normalizar(notas)$por_cruce
  out <- vapply(cruces, function(x) {
    hit <- intersect(x$claves, names(pc))
    if (length(hit)) .notas_pie_texto(pc[[hit[[1]]]]) else ""
  }, character(1))
  unname(out[nzchar(out)])
}

# «n.c.: no comparable…». Una sola nota en minúscula se lee de corrido, como en
# la maqueta («n.c.: no comparable por diferencias en la redacción…»).
.comparativo_linea_nc <- function(partes) {
  partes <- unique(partes[nzchar(partes)])
  if (!length(partes)) return(paste0(.COMPARATIVO_NC, ": no comparable."))
  if (length(partes) == 1L && grepl("^[[:lower:]]", partes)) {
    return(paste0(.COMPARATIVO_NC, ": no comparable ", .notas_pie_cerrar(partes)))
  }
  paste0(.COMPARATIVO_NC, ": no comparable. ",
         paste(vapply(partes, .notas_pie_cerrar, character(1)), collapse = " "))
}

# «n.c.: 2026 sin variable declarada en la matriz.» Un período que la matriz
# declara comparable pero sin variable para la fila. `items` son
# list(periodo, elemento): elemento "" es la pregunta, si no la etiqueta del
# cruce. Los años con los mismos elementos se agrupan en una frase.
.comparativo_linea_sin_variable <- function(items, periodos, rotulos) {
  if (!length(items)) return("")
  per <- vapply(items, `[[`, character(1), "periodo")
  ele <- vapply(items, function(it) as.character(it$elemento %||% ""), character(1))
  anios <- periodos[periodos %in% per]
  clave <- vapply(anios, function(b) {
    e <- unique(ele[per == b])
    if (all(nzchar(e))) paste(e, collapse = "\001") else ""
  }, character(1))
  frases <- vapply(unique(clave), function(k) {
    quienes <- if (nzchar(k)) strsplit(k, "\001", fixed = TRUE)[[1]] else character(0)
    paste0(.notas_pie_unir_es(unname(rotulos[anios[clave == k]])),
           " sin variable declarada en la matriz",
           if (length(quienes)) paste0(" para ", .notas_pie_unir_es(quienes)) else "", ".")
  }, character(1))
  paste0(.COMPARATIVO_NC, ": ", paste(unname(frases), collapse = " "))
}

.comparativo_es_sin_variable <- function(pp) identical((pp %||% list())$motivo, "sin_variable")

# Letras de columna para la prueba de proporciones: A…Z, AA, AB…, como las
# columnas de Excel. `LETTERS` se acaba en la 26.ª categoría.
.comparativo_letras <- function(n) {
  n <- as.integer(n)
  if (is.na(n) || n <= 0L) return(character(0))
  openxlsx::int2col(seq_len(n))
}

.COMPARATIVO_HOJA_OMITIDAS <- "Preguntas omitidas"

.comparativo_motivo_corto <- function(m) {
  switch(m %||% "", mapa_roto = "Mapa roto", select_multiple = "Opción múltiple",
         sin_variable = "Sin variable en la matriz",
         variable_ausente = "Variable ausente en los datos",
         sin_armonizar = "Sin armonizar", m %||% "")
}

#' Hoja «Preguntas omitidas»: cada pregunta o variable de cruce que salió del
#' comparativo, con su motivo. Sólo se escribe si hay alguna. Devuelve el
#' resumen de omitidas para el manifest.
#' @noRd
.comparativo_hoja_omitidas <- function(wb, omitidas, rotulos) {
  if (!length(omitidas)) return(list())
  hoja <- .COMPARATIVO_HOJA_OMITIDAS
  pulso_xlsx_new_sheet(wb, hoja)
  st <- .comparativo_estilos()
  unidad <- .comparativo_unidad(rotulos)
  enc <- c("Pregunta", "Uso", "Motivo", unidad$titulo, "Detalle")
  openxlsx::setColWidths(wb, hoja, cols = 1:5, widths = c(48, 16, 22, 14, 80))
  fila <- .comparativo_titulo(wb, hoja, st, 1L, "Preguntas omitidas del comparativo", 5L)
  for (k in seq_along(enc)) .comparativo_put(wb, hoja, fila, k, enc[k], st$header)
  out <- list()
  for (i in seq_along(omitidas)) {
    o <- omitidas[[i]]
    r <- fila + i
    sfx <- if (i %% 2L == 0L) "_z" else ""
    base <- if (length(o$base)) o$base else ""
    detalle <- .armz_motivo_omision(o, rotulos)
    vals <- c(o$titulo %||% o$fila, if (identical(o$tipo, "cruce")) "Variable de cruce" else "Pregunta",
              .comparativo_motivo_corto(o$motivo),
              if (nzchar(base) && base %in% names(rotulos)) rotulos[[base]] else base, detalle)
    for (k in seq_along(vals)) .comparativo_put(wb, hoja, r, k, vals[k], st[[paste0("c_txt", sfx)]])
    openxlsx::setRowHeights(wb, hoja, rows = r,
                            heights = max(15, .calc_row_height(detalle, col_width = 80, font_size = 10)))
    out[[i]] <- list(fila = o$fila, titulo = o$titulo %||% o$fila, tipo = o$tipo %||% "pregunta",
                     motivo = o$motivo %||% "sin_variable", base = if (nzchar(base)) base else NULL,
                     codigos = o$codigos %||% list(), detalle = detalle)
  }
  pulso_xlsx_box(wb, hoja, fila, fila + length(omitidas), 1L, 5L)
  out
}

.comparativo_sheet_setup <- function(wb, hoja) {
  pulso_xlsx_new_sheet(wb, hoja)
  openxlsx::pageSetup(wb, hoja, orientation = "landscape", fitToWidth = TRUE, fitToHeight = FALSE)
}

.comparativo_guardar <- function(wb, path) {
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  pulso_xlsx_ignore_number_warnings(path)
  invisible(path)
}

# «12 casos de 2024 y 3 de 2025 sin correspondencia en la escala.»
.comparativo_linea_sin_mapa <- function(sin_mapa, periodos, rotulos, prefijo = "") {
  ns <- vapply(periodos, function(b) as.numeric((sin_mapa[[b]] %||% list())$n_sin_mapa %||% 0), numeric(1))
  sel <- periodos[ns > 0]
  if (!length(sel)) return("")
  partes <- vapply(seq_along(sel), function(i) {
    n <- ns[[sel[i]]]
    sprintf("%s de %s", if (i == 1L) .armz_casos(n) else .armz_fmt_n(n), rotulos[[sel[i]]])
  }, character(1))
  paste0(prefijo, .notas_pie_unir_es(partes), " sin correspondencia en la escala.")
}

# «n.a.: no aplica, 2025 sin respuestas válidas (3 casos No sabe y No responde).»
# Los especiales se nombran con la etiqueta que traen en el instrumento de
# ESA base (o su código si no la tienen), no con un rótulo fijo.
.comparativo_linea_na_simple <- function(na_periodos, sin_mapa, rotulos) {
  if (!length(na_periodos)) return(character(0))
  partes <- vapply(na_periodos, function(b) {
    sm <- sin_mapa[[b]] %||% list()
    n <- as.numeric(sm$n_especial_sin_mapa %||% 0)
    etq <- as.character(unlist(sm$etiquetas_especiales %||% sm$codigos_especiales %||% list()))
    etq <- etq[!is.na(etq) & nzchar(etq)]
    paste0(rotulos[[b]], " sin respuestas válidas",
           if (n > 0) paste0(" (", .armz_casos(n),
                             if (length(etq)) paste0(" ", .notas_pie_unir_es(etq)) else "", ")") else "")
  }, character(1))
  paste0(.COMPARATIVO_NA, ": no aplica, ", .notas_pie_unir_es(unname(partes)), ".")
}

# «6 casos de 2025 sin categoría en Lugar de nacimiento (No sé / Prefiero no
# decir).» Los especiales de una variable de cruce no entran a ninguna columna
# pero sí al Total: el pie lo declara por año.
.comparativo_linea_especiales_cruce <- function(x, periodos, rotulos) {
  frases <- character(0)
  for (b in periodos) {
    sm <- (x$sin_mapa %||% list())[[b]]
    n <- as.numeric((sm %||% list())$n_especial_sin_mapa %||% 0)
    if (n <= 0) next
    etq <- unlist(sm$etiquetas_especiales %||% sm$codigos_especiales %||% list())
    frases <- c(frases, sprintf("%s de %s sin categoría en %s%s.", .armz_casos(n), rotulos[[b]],
                                x$etiqueta,
                                if (length(etq)) paste0(" (", .notas_pie_unir_es(etq), ")") else ""))
  }
  paste(frases, collapse = " ")
}

.comparativo_linea_no_ofrecida <- function(notas_decl = character(0), rotulos = NULL) {
  notas_decl <- unique(notas_decl[nzchar(notas_decl)])
  paste(c(.comparativo_linea_no_ofrecida_base(rotulos), vapply(notas_decl, .notas_pie_cerrar, character(1))),
        collapse = " ")
}

# «Tienen bases reducidas (menos de 30 casos) las columnas «Fuera del país»
# (2025 y 2026) y «Otras regiones» (2024).» Una columna por categoría de cruce,
# con los años en que su N sin ponderar queda bajo el umbral.
.comparativo_linea_reducidas <- function(items, umbral, rotulos, con_cruce = FALSE) {
  if (!length(items)) return("")
  umbral <- suppressWarnings(as.numeric(umbral)[1])
  if (is.na(umbral)) umbral <- 30
  items <- Filter(function(it) it$n > 0 && it$n < umbral, items)
  if (!length(items)) return("")
  clave <- vapply(items, function(it) paste(it$cruce, it$columna, sep = "\001"), character(1))
  grupos <- vapply(unique(clave), function(k) {
    sub <- items[clave == k]
    nombre <- paste0("«", sub[[1]]$columna, "»", if (con_cruce) paste0(" de ", sub[[1]]$cruce) else "")
    anios <- unique(vapply(sub, function(it) rotulos[[it$periodo]], character(1)))
    paste0(nombre, " (", .notas_pie_unir_es(anios), ")")
  }, character(1))
  u <- format(umbral, scientific = FALSE, trim = TRUE)
  paste0(
    if (length(grupos) == 1L) paste0("Tiene base reducida (menos de ", u, " casos) la columna ")
    else paste0("Tienen bases reducidas (menos de ", u, " casos) las columnas "),
    .notas_pie_unir_es(unname(grupos)), ". Sus porcentajes deben leerse con cautela.")
}

# Nota libre de la pregunta (por id, etiqueta o variable) y notas generales.
.comparativo_extras <- function(extras, claves) {
  np <- (extras %||% list())$notas_pregunta %||% list()
  hit <- intersect(claves, names(np))
  nota <- if (length(hit)) .notas_pie_cerrar(np[[hit[[1]]]]) else ""
  generales <- vapply(as.list((extras %||% list())$notas_generales %||% list()),
                      .notas_pie_cerrar, character(1))
  out <- c(nota, generales)
  out[nzchar(out)]
}

# Escribe el pie y, a continuación, las notas libres. Van pegadas, sin renglón
# en blanco: así lo fija el formato aprobado de HSyVbG (Fuente, Base y la nota
# de la pregunta en filas seguidas; «Lista y formato de entregables», 2026).
.comparativo_pie <- function(wb, hoja, st, fila, lineas, libres, ncol) {
  .comparativo_notas(wb, hoja, st, fila, c(lineas, libres), ncol)
}

# Salto de página antes de cada pregunta menos la primera, para no partirlas.
.comparativo_salto <- function(wb, hoja, fila) {
  if (fila > 1L) openxlsx::pageBreak(wb, hoja, i = fila - 1L, type = "row")
  invisible(fila)
}

.comparativo_resumen_sin_mapa <- function(q, periodos) {
  lapply(periodos, function(b) {
    sm <- (q$sin_mapa %||% list())[[b]]
    list(base = b,
         n_sin_mapa = as.integer(sm$n_sin_mapa %||% 0L),
         n_especial_sin_mapa = as.integer(sm$n_especial_sin_mapa %||% 0L),
         codigos_sin_mapa = sm$codigos_sin_mapa %||% list(),
         codigos_especiales = sm$codigos_especiales %||% list(),
         etiquetas_especiales = sm$etiquetas_especiales %||% list())
  })
}

# {<cruce>: {<base>: [códigos]}}: categorías de cada variable de cruce que no
# se ofrecían ese año, sólo en los años en que la pregunta y el cruce comparan.
.comparativo_resumen_no_ofrecidas_cruce <- function(q, cruces, periodos) {
  out <- list()
  for (x in cruces) {
    por_base <- list()
    for (b in periodos) {
      pp <- q$periodos[[b]]
      if (!identical(pp$estado, "ok")) next
      pc <- pp$cruces[[x$key]]
      if (!identical(pc$estado, "ok") || !length(pc$no_ofrecidas)) next
      por_base[[b]] <- as.list(pc$no_ofrecidas)
    }
    if (length(por_base)) out[[x$etiqueta]] <- por_base
  }
  out
}

.comparativo_resumen_no_ofrecidas <- function(q, periodos) {
  out <- lapply(periodos, function(b) as.list(q$no_ofrecidas[[b]] %||% character(0)))
  names(out) <- periodos
  out[lengths(out) > 0L]
}

# ---- Comparativo simple -----------------------------------------------------------

#' Escribe el comparativo simple (hoja «Comparativo»).
#'
#' @param modelo Salida de `armonizada_modelo_frecuencias()`.
#' @param rotulos Rótulo por período (nombre = base), de `.armz_rotulos()`.
#' @param notas Bloque `notas` de Analítica.
#' @param extras `list(notas_pregunta = {<id|etiqueta|variable>: texto},
#'   notas_generales = [texto])`, del body del endpoint.
#' @return Resumen: filas escritas, marcas y casos sin mapa por pregunta.
#' @keywords internal
reporte_comparativo_simple <- function(modelo, path, rotulos, notas = NULL, extras = NULL) {
  wb <- openxlsx::createWorkbook()
  hoja <- "Comparativo"
  .comparativo_sheet_setup(wb, hoja)
  st <- .comparativo_estilos("0.00%")
  periodos <- modelo$periodos
  ncol <- 1L + 2L * length(periodos)
  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 58)
  openxlsx::setColWidths(wb, hoja, cols = 2:ncol, widths = 12.66)

  fila <- 1L
  seccion_previa <- NULL
  resumen <- list()
  # Gonzalo, 2026-10-15: sin la línea «Ponderación: … por …» de cada año.
  linea_fuente <- .comparativo_fuente(notas, rotulos, periodos)
  for (q in modelo$preguntas) {
    .comparativo_salto(wb, hoja, fila)
    sec <- .comparativo_rotulo_seccion(q$seccion)
    if (nzchar(sec) && !identical(sec, seccion_previa)) {
      fila <- .comparativo_titulo(wb, hoja, st, fila, sec, ncol, seccion = TRUE) + 1L
      seccion_previa <- sec
    }
    fila <- .comparativo_titulo(wb, hoja, st, fila, q$titulo, ncol)

    # Encabezado: período combinado sobre N y %.
    h1 <- fila; h2 <- fila + 1L
    # Como en la maqueta: la fila del período no lleva regla, la de N/% sí.
    .comparativo_put(wb, hoja, h1, 1, "", st$c_head)
    .comparativo_put(wb, hoja, h2, 1, "", st$header)
    seps <- integer(0)
    for (k in seq_along(periodos)) {
      c0 <- 2L * k
      seps <- c(seps, c0)
      .comparativo_put(wb, hoja, h1, c0, rotulos[[periodos[k]]], st$c_head)
      .comparativo_put(wb, hoja, h1, c0 + 1L, "", st$c_head)
      openxlsx::mergeCells(wb, hoja, rows = h1, cols = c0:(c0 + 1L))
      .comparativo_put(wb, hoja, h2, c0, "N", st$header)
      .comparativo_put(wb, hoja, h2, c0 + 1L, "%", st$header)
    }
    fila <- h2 + 1L

    etiquetas <- c(q$escala$etiquetas, "Total")
    nc_periodos <- character(0)
    na_periodos <- character(0)
    hay_no_ofrecida <- FALSE
    for (i in seq_along(etiquetas)) {
      es_total <- i == length(etiquetas)
      sfx <- if (i %% 2L == 0L && !es_total) "_z" else ""
      .comparativo_put(wb, hoja, fila, 1, etiquetas[i], st[[paste0("c_txt", sfx)]])
      for (k in seq_along(periodos)) {
        b <- periodos[k]; c0 <- 2L * k
        pp <- q$periodos[[b]]
        if (!identical(pp$estado, "ok")) {
          marca <- if (identical(pp$estado, "n.c.")) .COMPARATIVO_NC else .COMPARATIVO_NA
          if (identical(marca, .COMPARATIVO_NC)) nc_periodos <- c(nc_periodos, b) else na_periodos <- c(na_periodos, b)
          .comparativo_put(wb, hoja, fila, c0, marca, st[[paste0("c_marca", sfx)]])
          .comparativo_put(wb, hoja, fila, c0 + 1L, marca, st[[paste0("c_marca", sfx)]])
          next
        }
        if (!es_total && q$escala$codigos[i] %in% (pp$no_ofrecidas %||% character(0))) {
          hay_no_ofrecida <- TRUE
          .comparativo_put(wb, hoja, fila, c0, .COMPARATIVO_NO_OFRECIDA, st[[paste0("c_marca", sfx)]])
          .comparativo_put(wb, hoja, fila, c0 + 1L, .COMPARATIVO_NO_OFRECIDA, st[[paste0("c_marca", sfx)]])
          next
        }
        n <- if (es_total) pp$N else unname(pp$n[[i]])
        p <- if (es_total) 1 else unname(pp$pct[[i]])
        .comparativo_put(wb, hoja, fila, c0, n, st[[paste0("c_int", sfx)]])
        .comparativo_put(wb, hoja, fila, c0 + 1L, p, st[[paste0("c_pct", sfx)]])
      }
      if (es_total) {
        openxlsx::addStyle(wb, hoja, st$c_bold, rows = fila, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, st$c_top, rows = fila, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, st$c_bottom, rows = fila, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
      }
      fila <- fila + 1L
    }
    pulso_xlsx_box(wb, hoja, h1, fila - 1L, 1L, ncol, sep_cols = seps)

    nc_periodos <- unique(nc_periodos); na_periodos <- unique(na_periodos)
    sv_periodos <- nc_periodos[vapply(nc_periodos, function(b) .comparativo_es_sin_variable(q$periodos[[b]]), logical(1))]
    va_periodos <- nc_periodos[vapply(nc_periodos, function(b) .comparativo_es_variable_ausente(q$periodos[[b]]), logical(1))]
    va_items <- lapply(va_periodos, function(b) .comparativo_item_ausente(q$periodos[[b]], b))
    nc_decl <- setdiff(nc_periodos, c(sv_periodos, va_periodos))
    lineas <- c(
      linea_fuente,
      paste0("Base: ", .notas_pie_cerrar(.comparativo_base(notas, q, periodos))),
      if (length(nc_decl)) .comparativo_linea_nc(unname(q$notas[nc_decl])) else character(0),
      .comparativo_linea_sin_variable(lapply(sv_periodos, function(b) list(periodo = b, elemento = "")),
                                      periodos, rotulos),
      .comparativo_linea_variable_ausente(va_items, periodos, rotulos),
      if (hay_no_ofrecida) .comparativo_linea_no_ofrecida_base(rotulos[periodos]) else character(0),
      .comparativo_linea_na_simple(na_periodos, q$sin_mapa, rotulos),
      .comparativo_linea_sin_mapa(q$sin_mapa, periodos, rotulos)
    )
    fila <- .comparativo_pie(wb, hoja, st, fila, lineas, .comparativo_extras(extras, q$claves), ncol) + 1L
    resumen[[length(resumen) + 1L]] <- list(
      titulo = q$titulo, n_c = as.list(nc_periodos), n_a = as.list(na_periodos),
      sin_variable = as.list(sv_periodos),
      variable_ausente = .comparativo_resumen_ausente(va_items, q$etiqueta),
      no_ofrecidas = .comparativo_resumen_no_ofrecidas(q, periodos),
      sin_mapa = .comparativo_resumen_sin_mapa(q, periodos))
  }
  omitidas <- .comparativo_hoja_omitidas(wb, modelo$omitidas, rotulos[periodos])
  .comparativo_guardar(wb, path)
  list(hoja = hoja, n_preguntas = length(modelo$preguntas), preguntas = resumen, omitidas = omitidas)
}

# ---- Comparativo de cruces --------------------------------------------------------

.comparativo_linea_na <- function(items, rotulos) {
  if (!length(items)) return("")
  df <- do.call(rbind, lapply(items, as.data.frame, stringsAsFactors = FALSE))
  notas_decl <- unique(df$nota[nzchar(df$nota)])
  if (length(notas_decl) && all(nzchar(df$nota))) {
    return(paste0(.COMPARATIVO_NA, ": no aplica. ",
                  paste(vapply(notas_decl, .notas_pie_cerrar, character(1)), collapse = " ")))
  }
  frases <- character(0)
  for (b in unique(df$periodo)) {
    sub <- df[df$periodo == b, , drop = FALSE]
    for (cr in unique(sub$cruce)) {
      cats <- unique(sub$categoria[sub$cruce == cr])
      frases <- c(frases, sprintf("%s (%s) %s casos en %s.",
                                  .notas_pie_unir_es(paste0("«", cats, "»")), cr,
                                  if (length(cats) > 1L) "no tienen" else "no tiene",
                                  rotulos[[b]]))
    }
  }
  paste0(.COMPARATIVO_NA, ": no aplica. ", paste(frases, collapse = " "))
}

#' Escribe el comparativo de cruces (hoja «Comparativo cruces»).
#'
#' @param modelo Salida de `armonizada_modelo_cruces()`.
#' @param alpha Nivel de significancia de las letras.
#' @param show_sig Si FALSE no se escribe la subtabla de letras.
#' @param extras Notas libres, como en `reporte_comparativo_simple()`.
#' @keywords internal
reporte_comparativo_cruces <- function(modelo, path, rotulos, notas = NULL,
                                       alpha = 0.05, show_sig = TRUE, extras = NULL) {
  wb <- openxlsx::createWorkbook()
  archivo_estilos <- .xlsx_archivo_estilos()
  hoja <- "Comparativo cruces"
  .comparativo_sheet_setup(wb, hoja)
  st <- .comparativo_estilos("0.0%")
  notas_n <- .notas_pie_normalizar(notas)
  periodos <- modelo$periodos
  # El rótulo del cruce sale de la etiqueta estándar: sin marcado de Kobo.
  cruces <- lapply(modelo$cruces, function(x) {
    x$etiqueta <- .inst_sin_marcado(x$etiqueta)
    x
  })
  ncat <- vapply(cruces, function(x) length(x$escala$codigos), integer(1))
  ncol <- 4L + 2L * sum(ncat)
  nsig <- 2L + sum(ncat)
  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 30)
  unidad <- .comparativo_unidad(rotulos[periodos])
  # La columna del período cabe su rótulo más largo («egresados», «Medición»).
  openxlsx::setColWidths(wb, hoja, cols = 2, widths = max(8, 2 + max(nchar(c(
    unidad$titulo, unname(unlist(rotulos[periodos])))))))
  openxlsx::setColWidths(wb, hoja, cols = 3:ncol, widths = 13.5)
  openxlsx::freezePane(wb, hoja, firstActiveCol = 3)

  # Columna de inicio de cada cruce (n de su primera categoría).
  inicio <- 5L + c(0L, cumsum(2L * ncat))[seq_along(cruces)]
  inicio_sig <- 3L + c(0L, cumsum(ncat))[seq_along(cruces)]

  fila <- 1L
  seccion_previa <- NULL
  resumen <- list()
  # Gonzalo, 2026-10-15: sin la línea «Ponderación: … por …» de cada año.
  linea_fuente <- .comparativo_fuente(notas, rotulos, periodos)
  for (q in modelo$preguntas) {
    .comparativo_salto(wb, hoja, fila)
    sec <- .comparativo_rotulo_seccion(q$seccion)
    if (nzchar(sec) && !identical(sec, seccion_previa)) {
      fila <- .comparativo_titulo(wb, hoja, st, fila, sec, ncol, seccion = TRUE) + 1L
      seccion_previa <- sec
    }
    fila <- .comparativo_titulo(wb, hoja, st, fila, q$titulo, ncol)

    # Encabezado de tres filas: grupo, categoría, n/%.
    rg <- fila; rc <- fila + 1L; rn <- fila + 2L
    for (r in c(rg, rc, rn)) {
      openxlsx::addStyle(wb, hoja, st$header, rows = r, cols = 1:ncol, gridExpand = TRUE)
    }
    openxlsx::mergeCells(wb, hoja, rows = rg, cols = 1:4)
    .comparativo_put(wb, hoja, rn, 1, "Respuesta", st$header_A)
    .comparativo_put(wb, hoja, rn, 2, unidad$titulo, st$header)
    openxlsx::writeData(wb, hoja, "Total", startRow = rc, startCol = 3)
    openxlsx::mergeCells(wb, hoja, rows = rc, cols = 3:4)
    openxlsx::writeData(wb, hoja, t(c("n", "%")), startRow = rn, startCol = 3, colNames = FALSE)
    for (j in seq_along(cruces)) {
      x <- cruces[[j]]; c0 <- inicio[j]
      openxlsx::writeData(wb, hoja, x$etiqueta, startRow = rg, startCol = c0)
      openxlsx::mergeCells(wb, hoja, rows = rg, cols = c0:(c0 + 2L * ncat[j] - 1L))
      for (k in seq_len(ncat[j])) {
        ck <- c0 + 2L * (k - 1L)
        openxlsx::writeData(wb, hoja, x$escala$etiquetas[k], startRow = rc, startCol = ck)
        openxlsx::mergeCells(wb, hoja, rows = rc, cols = ck:(ck + 1L))
        openxlsx::writeData(wb, hoja, t(c("n", "%")), startRow = rn, startCol = ck, colNames = FALSE)
      }
    }
    openxlsx::setRowHeights(wb, hoja, rows = rc, heights = 30)
    fila <- rn + 1L

    etiquetas <- c(q$escala$etiquetas, "Total")
    nc_partes <- character(0)
    sv_items <- list()
    va_items <- list()
    na_items <- list()
    no_of_notas <- character(0)
    hay_no_ofrecida <- FALSE
    reducidas <- list()
    for (i in seq_along(etiquetas)) {
      es_total <- i == length(etiquetas)
      zebra <- (i %% 2L == 0L) && !es_total
      sfx <- if (zebra) "_z" else ""
      r0 <- fila
      .comparativo_put(wb, hoja, r0, 1, etiquetas[i], st[[paste0("c_txt", sfx)]])
      for (k in seq_along(periodos)) {
        b <- periodos[k]; rr <- r0 + k - 1L
        if (k > 1L) openxlsx::addStyle(wb, hoja, st[[paste0("c_txt", sfx)]], rows = rr, cols = 1)
        .comparativo_put(wb, hoja, rr, 2, rotulos[[b]], st[[paste0("c_lbl", sfx)]])
        pp <- q$periodos[[b]]
        celda <- function(col, n, N, p_override = NULL) {
          if (is.na(N) || N <= 0) {
            .comparativo_put(wb, hoja, rr, col, .COMPARATIVO_NA, st[[paste0("c_marca", sfx)]])
            .comparativo_put(wb, hoja, rr, col + 1L, .COMPARATIVO_NA, st[[paste0("c_marca", sfx)]])
          } else {
            .comparativo_put(wb, hoja, rr, col, if (es_total) N else n, st[[paste0("c_int", sfx)]])
            .comparativo_put(wb, hoja, rr, col + 1L, if (es_total) 1 else n / N, st[[paste0("c_pct", sfx)]])
          }
        }
        marca <- function(col, m) {
          .comparativo_put(wb, hoja, rr, col, m, st[[paste0("c_marca", sfx)]])
          .comparativo_put(wb, hoja, rr, col + 1L, m, st[[paste0("c_marca", sfx)]])
        }
        if (!identical(pp$estado, "ok")) {
          for (col in seq(3L, ncol - 1L, by = 2L)) marca(col, .COMPARATIVO_NC)
          if (i == 1L && .comparativo_es_sin_variable(pp)) {
            sv_items[[length(sv_items) + 1L]] <- list(periodo = b, elemento = "")
          } else if (i == 1L && .comparativo_es_variable_ausente(pp)) {
            va_items[[length(va_items) + 1L]] <- .comparativo_item_ausente(pp, b)
          } else if (i == 1L) {
            nc_partes <- c(nc_partes, if (nzchar(q$notas[[b]])) q$notas[[b]] else
              sprintf("La pregunta no es comparable en %s", rotulos[[b]]))
          }
          next
        }
        # La respuesta no se ofrecía ese año: toda su fila del año va en «n.a.».
        fila_no_ofrecida <- !es_total && q$escala$codigos[i] %in% (pp$no_ofrecidas %||% character(0))
        if (fila_no_ofrecida) hay_no_ofrecida <- TRUE
        if (fila_no_ofrecida) marca(3L, .COMPARATIVO_NO_OFRECIDA) else
          celda(3L, if (es_total) NA_real_ else unname(pp$total$n[i]), pp$total$N)
        for (j in seq_along(cruces)) {
          x <- cruces[[j]]; pc <- pp$cruces[[x$key]]
          for (kk in seq_len(ncat[j])) {
            ck <- inicio[j] + 2L * (kk - 1L)
            if (!identical(pc$estado, "ok")) {
              marca(ck, .COMPARATIVO_NC)
              next
            }
            col_no_ofrecida <- x$escala$codigos[kk] %in% (pc$no_ofrecidas %||% character(0))
            Nk <- unname(pc$N_vec[kk])
            # Lo que es de la COLUMNA (no ofrecida, sin casos, base reducida)
            # se registra una vez por año, aunque la primera respuesta de la
            # pregunta tampoco se ofreciera ese año.
            if (i == 1L) {
              if (col_no_ofrecida) {
                hay_no_ofrecida <- TRUE
                no_of_notas <- c(no_of_notas, x$notas[[b]] %||% "")
              } else if (Nk <= 0) {
                na_items[[length(na_items) + 1L]] <- list(
                  periodo = b, cruce = x$etiqueta, categoria = x$escala$etiquetas[kk],
                  nota = x$notas[[b]] %||% "")
              } else {
                reducidas[[length(reducidas) + 1L]] <- list(
                  cruce = x$etiqueta, columna = x$escala$etiquetas[kk], periodo = b,
                  n = unname(pc$N_sin_peso[kk]))
              }
            }
            if (fila_no_ofrecida || col_no_ofrecida) {
              marca(ck, .COMPARATIVO_NO_OFRECIDA)
              next
            }
            celda(ck, if (es_total) NA_real_ else unname(pc$n_mat[i, kk]), Nk)
          }
          if (i == 1L && .comparativo_es_sin_variable(pc)) {
            sv_items[[length(sv_items) + 1L]] <- list(periodo = b, elemento = x$etiqueta)
          } else if (i == 1L && .comparativo_es_variable_ausente(pc)) {
            va_items[[length(va_items) + 1L]] <- .comparativo_item_ausente(pc, b, x$etiqueta)
          } else if (i == 1L && !identical(pc$estado, "ok")) {
            nc_partes <- c(nc_partes, if (nzchar(x$notas[[b]])) paste0(x$etiqueta, ": ", x$notas[[b]]) else
              sprintf("%s no es comparable en %s", x$etiqueta, rotulos[[b]]))
          }
        }
      }
      r_fin <- r0 + length(periodos) - 1L
      if (length(periodos) > 1L) openxlsx::mergeCells(wb, hoja, rows = r0:r_fin, cols = 1)
      openxlsx::addStyle(wb, hoja, st$c_regla, rows = r_fin, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
      if (es_total) {
        openxlsx::addStyle(wb, hoja, st$c_bold, rows = r0:r_fin, cols = 1:2, gridExpand = TRUE, stack = TRUE)
        openxlsx::addStyle(wb, hoja, st$c_top, rows = r0, cols = 1:ncol, gridExpand = TRUE, stack = TRUE)
      }
      fila <- r_fin + 1L
    }
    pulso_xlsx_box(wb, hoja, rg, fila - 1L, 1L, ncol, sep_cols = c(3L, inicio))

    linea1 <- paste0(linea_fuente, " Base: ", .notas_pie_cerrar(.comparativo_base(notas, q, periodos)),
                     " Porcentajes por columna dentro de ", unidad$cada, ".")
    linea_na <- .comparativo_linea_na(na_items, rotulos)
    linea_red <- if (isTRUE(notas_n$base_reducida$activo)) {
      .comparativo_linea_reducidas(reducidas, notas_n$base_reducida$umbral, rotulos,
                                   con_cruce = length(cruces) > 1L)
    } else ""
    linea_nc <- if (length(nc_partes)) .comparativo_linea_nc(nc_partes) else ""
    linea_sv <- .comparativo_linea_sin_variable(sv_items, periodos, rotulos)
    linea_va <- .comparativo_linea_variable_ausente(va_items, periodos, rotulos)
    linea_no_of <- if (hay_no_ofrecida) .comparativo_linea_no_ofrecida(no_of_notas, rotulos[periodos]) else ""
    lineas_sm <- c(.comparativo_linea_sin_mapa(q$sin_mapa, periodos, rotulos),
                   vapply(cruces, function(x) .comparativo_linea_sin_mapa(
                     x$sin_mapa, periodos, rotulos, prefijo = paste0(x$etiqueta, ": ")), character(1)),
                   vapply(cruces, .comparativo_linea_especiales_cruce, character(1),
                          periodos = periodos, rotulos = rotulos))
    lineas <- c(linea1, .comparativo_por_cruce(notas, cruces), linea_nc, linea_sv, linea_va, linea_no_of,
                linea_na, lineas_sm, linea_red)
    libres <- .comparativo_extras(extras, q$claves)
    fila <- .comparativo_pie(wb, hoja, st, fila, lineas, if (isTRUE(show_sig) && length(cruces)) character(0) else libres,
                             ncol) + 1L

    if (isTRUE(show_sig) && length(cruces)) {
      fila <- .comparativo_titulo(wb, hoja, st, fila, "Comparaciones de proporciones de columna", nsig)
      sg <- fila; sc <- fila + 1L
      for (r in c(sg, sc)) openxlsx::addStyle(wb, hoja, st$header, rows = r, cols = 1:nsig, gridExpand = TRUE)
      openxlsx::mergeCells(wb, hoja, rows = sg, cols = 1:2)
      .comparativo_put(wb, hoja, sc, 1, "Respuesta", st$header_A)
      .comparativo_put(wb, hoja, sc, 2, unidad$titulo, st$header)
      for (j in seq_along(cruces)) {
        x <- cruces[[j]]; c0 <- inicio_sig[j]
        openxlsx::writeData(wb, hoja, x$etiqueta, startRow = sg, startCol = c0)
        if (ncat[j] > 1L) openxlsx::mergeCells(wb, hoja, rows = sg, cols = c0:(c0 + ncat[j] - 1L))
        hdr <- paste0(x$escala$etiquetas, " (", .comparativo_letras(ncat[j]), ")")
        openxlsx::writeData(wb, hoja, t(hdr), startRow = sc, startCol = c0, colNames = FALSE)
      }
      openxlsx::setRowHeights(wb, hoja, rows = sc, heights = 58)
      fila <- sc + 1L
      for (i in seq_along(q$escala$etiquetas)) {
        sfx <- if (i %% 2L == 0L) "_z" else ""
        r0 <- fila
        .comparativo_put(wb, hoja, r0, 1, q$escala$etiquetas[i], st[[paste0("c_txt", sfx)]])
        for (k in seq_along(periodos)) {
          b <- periodos[k]; rr <- r0 + k - 1L
          if (k > 1L) openxlsx::addStyle(wb, hoja, st[[paste0("c_txt", sfx)]], rows = rr, cols = 1)
          .comparativo_put(wb, hoja, rr, 2, rotulos[[b]], st[[paste0("c_lbl", sfx)]])
          pp <- q$periodos[[b]]
          for (j in seq_along(cruces)) {
            x <- cruces[[j]]
            pc <- if (identical(pp$estado, "ok")) pp$cruces[[x$key]] else list(estado = "n.c.")
            for (kk in seq_len(ncat[j])) {
              col <- inicio_sig[j] + kk - 1L
              no_of <- identical(pc$estado, "ok") &&
                (q$escala$codigos[i] %in% (pp$no_ofrecidas %||% character(0)) ||
                   x$escala$codigos[kk] %in% (pc$no_ofrecidas %||% character(0)))
              if (!identical(pc$estado, "ok")) {
                .comparativo_put(wb, hoja, rr, col, .COMPARATIVO_NC, st[[paste0("c_marca", sfx)]])
              } else if (no_of) {
                .comparativo_put(wb, hoja, rr, col, .COMPARATIVO_NO_OFRECIDA, st[[paste0("c_marca", sfx)]])
              } else {
                v <- pc$letras[i, kk]
                est <- if (identical(v, .COMPARATIVO_NA)) st[[paste0("c_marca", sfx)]] else st[[paste0("c_lbl", sfx)]]
                .comparativo_put(wb, hoja, rr, col, v, est)
              }
            }
          }
        }
        r_fin <- r0 + length(periodos) - 1L
        if (length(periodos) > 1L) openxlsx::mergeCells(wb, hoja, rows = r0:r_fin, cols = 1)
        openxlsx::addStyle(wb, hoja, st$c_regla, rows = r_fin, cols = 1:nsig, gridExpand = TRUE, stack = TRUE)
        fila <- r_fin + 1L
      }
      pulso_xlsx_box(wb, hoja, sg, fila - 1L, 1L, nsig, sep_cols = c(3L, inicio_sig))
      sig <- paste0(.notas_pie_significancia("z", alpha), " Las comparaciones se hacen dentro de ", unidad$cada, ".",
                    " Las letras usan el N ponderado, sin corrección por efecto de diseño.")
      # El pie de la subtabla va al ancho de la tabla principal, como en la
      # maqueta: a su propio ancho la nota de significancia ocupa cuatro renglones.
      fila <- .comparativo_pie(wb, hoja, st, fila, c(sig, linea_nc, linea_sv, linea_va, linea_no_of, linea_na), libres, ncol) + 1L
    }
    fila <- fila + 1L
    resumen[[length(resumen) + 1L]] <- list(
      titulo = q$titulo,
      n_c = as.list(unique(nc_partes)),
      sin_variable = lapply(sv_items, function(it) list(
        base = it$periodo, fila = if (nzchar(it$elemento)) it$elemento else q$etiqueta)),
      variable_ausente = .comparativo_resumen_ausente(va_items, q$etiqueta),
      n_a = lapply(na_items, function(it) it[c("periodo", "cruce", "categoria")]),
      n_reducidas = length(Filter(function(r) r$n > 0 && r$n < notas_n$base_reducida$umbral, reducidas)),
      no_ofrecidas = .comparativo_resumen_no_ofrecidas(q, periodos),
      no_ofrecidas_cruce = .comparativo_resumen_no_ofrecidas_cruce(q, cruces, periodos),
      sin_mapa = .comparativo_resumen_sin_mapa(q, periodos)
    )
    # Tabla cerrada: sus estilos salen del recorrido de openxlsx (H16).
    .xlsx_archivar_estilos(wb, archivo_estilos)
  }
  .xlsx_restaurar_estilos(wb, archivo_estilos)
  omitidas <- .comparativo_hoja_omitidas(wb, modelo$omitidas, rotulos[periodos])
  .comparativo_guardar(wb, path)
  list(hoja = hoja, n_preguntas = length(modelo$preguntas), preguntas = resumen, omitidas = omitidas)
}

# ---- Manifest ---------------------------------------------------------------

#' Manifest JSON del comparativo: períodos, rótulos, ponderación por período
#' (método, suma de pesos, n), marcas y casos sin mapa (`n_sin_mapa`,
#' `n_especial_sin_mapa`) por pregunta y período, avisos y huella del XLSX. Es
#' el artefacto `manifest`.
#' @keywords internal
reporte_comparativo_manifest <- function(path_json, tipo, path_xlsx, filename, periodos,
                                         rotulos, ponderacion, resumen) {
  man <- list(
    tipo = tipo,
    generado = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    entregable = list(filename = filename,
                      sha256 = tolower(digest::digest(file = path_xlsx, algo = "sha256")),
                      size = as.integer(file.info(path_xlsx)$size)),
    periodos = lapply(periodos, function(b) list(
      base = b, rotulo = unname(rotulos[[b]]),
      ponderacion = ponderacion[[b]] %||% list(pondera = FALSE, estado = "sin_ponderar"))),
    preguntas = resumen$preguntas,
    omitidas = resumen$omitidas %||% list(),
    avisos = resumen$avisos %||% list()
  )
  jsonlite::write_json(man, path_json, auto_unbox = TRUE, pretty = TRUE, null = "null")
  invisible(man)
}
