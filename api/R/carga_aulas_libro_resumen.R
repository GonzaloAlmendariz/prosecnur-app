# La portada del libro de agendación.
#
# **Es lo que una tabla dinámica enseñaría, ya calculado.** `openxlsx` no genera
# pivots nativos, así que en vez de prometer una dinámica que no puedo escribir,
# el libro abre con los cortes que el equipo iba a construir a mano: cuánto
# operativo hay, cómo se reparte por facultad y en qué estado está.
#
# Va PRIMERA porque es la primera impresión del fichero y porque contesta sin
# desplazarse lo que las hojas de datos sólo contestan filtrando.

.calr_txt <- function(u, k) {
  v <- u[[k]]
  if (is.null(v) || !length(v)) return("")
  trimws(as.character(v)[1])
}

.calr_num <- function(u, k) {
  v <- suppressWarnings(as.numeric(u[[k]] %||% NA))
  if (!length(v)) NA_real_ else v[1]
}

#' Cortes del plan para la portada.
#'
#' @param unidades filas del plan (formato largo).
#' @return lista con `totales`, `por_facultad` y `por_estado`.
#' @export
aulas_libro_cortes <- function(unidades) {
  rol <- vapply(unidades, .calr_txt, character(1), "sample_role")
  fac <- vapply(unidades, .calr_txt, character(1), "faculty")
  fac[!nzchar(fac)] <- "Sin facultad"
  est <- vapply(unidades, function(u) {
    v <- .calr_txt(u, "sample_status")
    if (nzchar(v)) v else "Sin estado"
  }, character(1))
  eleg <- vapply(unidades, .calr_num, numeric(1), "eligible_n")
  meta <- vapply(unidades, .calr_num, numeric(1), "expected_valid")
  fecha <- vapply(unidades, function(u) substr(.calr_txt(u, "scheduled_date"), 1, 10), character(1))

  # El banco NO entra en los cortes por facultad: no está agendado y sumarlo
  # daría un operativo que nadie va a visitar. Se cuenta aparte, que es como lo
  # trata el resto del sistema.
  del_plan <- rol != "extra_reserve_pool"

  # **Lo esperado se cuenta sobre los TITULARES, no sobre la cadena entera.**
  #
  # Una reserva sólo entra a campo si su titular cae, así que sumar sus metas da
  # un esperado que nadie va a recoger: en el corte de prueba, 26 titulares
  # daban «4 154 encuestas esperadas» porque arrastraban 238 reservas. Las
  # reservas son respaldo y se cuentan como respaldo.
  titular <- rol == "titular"

  totales <- list(
    `Cursos-horario titulares` = sum(titular),
    `Reservas de cadena` = sum(rol == "chain_reserve"),
    `Aulas del banco` = sum(rol == "extra_reserve_pool"),
    `Facultades` = length(unique(fac[del_plan])),
    `Con fecha agendada` = sum(nzchar(fecha) & del_plan),
    `Alumnos elegibles (titulares)` = sum(eleg[titular & is.finite(eleg)]),
    `Encuestas esperadas (titulares)` = round(sum(meta[titular & is.finite(meta)]), 1)
  )

  claves <- sort(unique(fac[del_plan]))
  por_facultad <- data.frame(
    Facultad = claves,
    Titulares = vapply(claves, function(f) sum(del_plan & fac == f & rol == "titular"), integer(1)),
    Reservas = vapply(claves, function(f) sum(del_plan & fac == f & rol == "chain_reserve"), integer(1)),
    `Con fecha` = vapply(claves, function(f) sum(del_plan & fac == f & nzchar(fecha)), integer(1)),
    # Igual que arriba: de titulares. Una facultad con 22 reservas y 2 titulares
    # no espera 22 aulas de encuestas.
    Elegibles = vapply(claves, function(f) sum(eleg[titular & fac == f & is.finite(eleg)]), numeric(1)),
    Esperadas = vapply(claves, function(f) round(sum(meta[titular & fac == f & is.finite(meta)]), 1), numeric(1)),
    check.names = FALSE, stringsAsFactors = FALSE
  )
  # Por tamaño del operativo y no alfabético: la portada ordena por dónde hay
  # más trabajo, que es lo que se mira primero.
  por_facultad <- por_facultad[order(-por_facultad$Titulares, por_facultad$Facultad), , drop = FALSE]

  estados <- sort(unique(est[del_plan]))
  por_estado <- data.frame(
    Estado = estados,
    Aulas = vapply(estados, function(e) sum(del_plan & est == e), integer(1)),
    stringsAsFactors = FALSE
  )
  por_estado <- por_estado[order(-por_estado$Aulas), , drop = FALSE]

  list(totales = totales, por_facultad = por_facultad, por_estado = por_estado)
}

#' Escribe la portada en el workbook.
#'
#' @param wb workbook abierto.
#' @param unidades filas del plan.
#' @param hoja nombre de la hoja.
#' @return la fila siguiente a lo escrito.
#' @export
aulas_libro_escribir_resumen <- function(wb, unidades, hoja = "Resumen") {
  cortes <- aulas_libro_cortes(unidades)
  openxlsx::addWorksheet(wb, hoja, gridLines = FALSE)

  titulo <- openxlsx::createStyle(fontSize = 16, textDecoration = "bold", fontColour = "#002457")
  pie <- openxlsx::createStyle(fontSize = 9, fontColour = "#5B6472")
  seccion <- openxlsx::createStyle(fontSize = 11, textDecoration = "bold", fontColour = "#002457",
                                   border = "bottom", borderColour = "#C7D0DD")
  etiqueta <- openxlsx::createStyle(fontColour = "#5B6472")
  cifra <- openxlsx::createStyle(textDecoration = "bold", halign = "right", numFmt = "#,##0.#")
  cabecera <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#002457",
                                    fontColour = "#FFFFFF", halign = "left")
  numero <- openxlsx::createStyle(halign = "right", numFmt = "#,##0.#")

  openxlsx::writeData(wb, hoja, "Libro de agendación de aulas", startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, titulo, rows = 1, cols = 1)
  openxlsx::writeData(wb, hoja, paste("Generado por Prosecnur el",
                                      format(Sys.Date(), "%d/%m/%Y")),
                      startCol = 1, startRow = 2)
  openxlsx::addStyle(wb, hoja, pie, rows = 2, cols = 1)

  fila <- 4L
  openxlsx::writeData(wb, hoja, "El operativo", startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:2, gridExpand = TRUE)
  fila <- fila + 1L
  for (nombre in names(cortes$totales)) {
    openxlsx::writeData(wb, hoja, nombre, startCol = 1, startRow = fila)
    openxlsx::writeData(wb, hoja, cortes$totales[[nombre]], startCol = 2, startRow = fila)
    openxlsx::addStyle(wb, hoja, etiqueta, rows = fila, cols = 1)
    openxlsx::addStyle(wb, hoja, cifra, rows = fila, cols = 2)
    fila <- fila + 1L
  }

  fila <- fila + 1L
  openxlsx::writeData(wb, hoja, "Por facultad", startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:6, gridExpand = TRUE)
  fila <- fila + 1L
  openxlsx::writeData(wb, hoja, cortes$por_facultad, startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = 1:6, gridExpand = TRUE)
  n_fac <- nrow(cortes$por_facultad)
  if (n_fac) {
    openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n_fac), cols = 2:6,
                       gridExpand = TRUE, stack = TRUE)
  }
  fila <- fila + n_fac + 2L

  openxlsx::writeData(wb, hoja, "Por estado de muestra", startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:2, gridExpand = TRUE)
  fila <- fila + 1L
  openxlsx::writeData(wb, hoja, cortes$por_estado, startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = 1:2, gridExpand = TRUE)
  n_est <- nrow(cortes$por_estado)
  if (n_est) {
    openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n_est), cols = 2,
                       gridExpand = TRUE, stack = TRUE)
  }

  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 34)
  openxlsx::setColWidths(wb, hoja, cols = 2:6, widths = 13)
  # **La portada tiene que caber a lo ancho.**
  #
  # Convertida a PDF, la tabla por facultad se partia en dos paginas: «Elegibles»
  # y «Esperadas» caian sueltas en la segunda, con su cabecera pero sin saber de
  # que facultad eran. Seis columnas de 34+13x5 no entran en un A4 vertical.
  # `fitToWidth` la encaja en una pagina de ancho y deja crecer el alto, que es
  # lo que hace falta cuando la universidad tiene veinte facultades.
  #
  # Esto solo se ve ABRIENDO el fichero: el XML declaraba las seis columnas y
  # todo parecia correcto.
  openxlsx::pageSetup(wb, hoja, orientation = "portrait", fitToWidth = TRUE,
                      fitToHeight = FALSE)
  invisible(fila + n_est + 1L)
}
