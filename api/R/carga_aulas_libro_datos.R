# La hoja larga del libro: una fila por unidad, para hacer dinámicas.
#
# **Una tabla dinámica necesita datos largos, y las hojas del libro son anchas.**
# «Aulas Agendadas» pone al titular y sus once reservas en la MISMA fila, con
# los veinte títulos repetidos doce veces; sobre eso no se puede pivotar, y
# Excel ni siquiera admite una tabla con nombres de columna duplicados.
#
# Por eso la dinámica no sale de la hoja que el equipo llena, sino de esta: cada
# unidad en su fila, columnas únicas, y declarada como Excel Table con nombre.
# Con eso, crear una dinámica es «Insertar → Tabla dinámica» sobre `datos_aulas`
# y crece sola cuando el plan crece.
#
# `openxlsx` no escribe pivots nativos —no hay `createTable` ni equivalente—, así
# que esto es lo más cerca que se llega sin fabricar el XML a mano: la tabla
# lista para que la dinámica se construya en dos clics.

.cald_txt <- function(u, k) {
  v <- u[[k]]
  if (is.null(v) || !length(v)) return("")
  trimws(as.character(v)[1])
}

.cald_num <- function(u, k) {
  v <- suppressWarnings(as.numeric(u[[k]] %||% NA))
  if (!length(v)) NA_real_ else v[1]
}

#' La tabla larga del plan, una fila por unidad.
#'
#' @param unidades filas del plan.
#' @return `data.frame` con columnas únicas y tipos ya resueltos.
#' @export
aulas_libro_hoja_datos <- function(unidades) {
  if (!length(unidades)) {
    return(data.frame(
      `Curso-horario` = character(0), Titular = character(0), Papel = character(0),
      check.names = FALSE, stringsAsFactors = FALSE
    ))
  }
  papel <- function(u) {
    switch(.cald_txt(u, "sample_role"),
           titular = "Titular",
           chain_reserve = "Reserva de cadena",
           extra_reserve_pool = "Banco de extras",
           "Sin declarar")
  }
  fecha <- function(u) {
    v <- substr(.cald_txt(u, "scheduled_date"), 1, 10)
    d <- suppressWarnings(as.Date(v, format = "%Y-%m-%d"))
    if (is.na(d)) NA else d
  }
  data.frame(
    `Curso-horario` = vapply(unidades, .cald_txt, character(1), "operational_code"),
    Titular = vapply(unidades, function(u) {
      t <- .cald_txt(u, "titular_operational_code")
      if (nzchar(t)) t else .cald_txt(u, "operational_code")
    }, character(1)),
    Papel = vapply(unidades, papel, character(1)),
    Orden = vapply(unidades, function(u) {
      n <- .cald_num(u, "replacement_order")
      if (is.finite(n)) as.integer(n) else 0L
    }, integer(1)),
    Facultad = vapply(unidades, .cald_txt, character(1), "faculty"),
    Curso = vapply(unidades, .cald_txt, character(1), "course_name"),
    Docente = vapply(unidades, .cald_txt, character(1), "teacher"),
    Matriculados = vapply(unidades, .cald_num, numeric(1), "enrolled_total"),
    Elegibles = vapply(unidades, .cald_num, numeric(1), "eligible_n"),
    Esperadas = vapply(unidades, .cald_num, numeric(1), "expected_valid"),
    Estado = vapply(unidades, .cald_txt, character(1), "sample_status"),
    `Fecha agendada` = as.Date(vapply(unidades, function(u) {
      d <- fecha(u); if (inherits(d, "Date")) as.numeric(d) else NA_real_
    }, numeric(1)), origin = "1970-01-01"),
    Hora = vapply(unidades, .cald_txt, character(1), "scheduled_time"),
    `Sesiones y aula` = vapply(unidades, .cald_txt, character(1), "label"),
    check.names = FALSE, stringsAsFactors = FALSE
  )
}

#' Escribe la hoja larga como Excel Table con nombre.
#'
#' @param wb workbook.
#' @param unidades filas del plan.
#' @param hoja nombre de la hoja.
#' @param tabla nombre de la tabla, el que aparece al crear la dinámica.
#' @export
aulas_libro_escribir_datos <- function(wb, unidades, hoja = "Datos",
                                       tabla = "datos_aulas") {
  datos <- aulas_libro_hoja_datos(unidades)
  openxlsx::addWorksheet(wb, hoja)
  openxlsx::writeDataTable(
    wb, hoja, datos, tableName = tabla, tableStyle = "TableStyleMedium2",
    withFilter = TRUE, bandedRows = TRUE
  )
  openxlsx::freezePane(wb, hoja, firstActiveRow = 2L, firstActiveCol = 2L)
  # Anchos por lo que lleva cada columna, como en las demas hojas.
  anchos <- vapply(names(datos), function(n) {
    v <- as.character(datos[[n]])
    v <- v[!is.na(v) & nzchar(v)]
    largo <- if (length(v)) max(nchar(v)) else 0L
    min(38, max(11, max(largo, nchar(n)) + 2))
  }, numeric(1))
  openxlsx::setColWidths(wb, hoja, cols = seq_along(anchos), widths = anchos)
  fecha <- openxlsx::createStyle(numFmt = "dd/mm/yyyy", halign = "center")
  numero <- openxlsx::createStyle(numFmt = "#,##0.#", halign = "right")
  n <- nrow(datos)
  if (n) {
    col <- function(nombre) which(names(datos) == nombre)
    openxlsx::addStyle(wb, hoja, fecha, rows = 2:(n + 1L), cols = col("Fecha agendada"),
                       gridExpand = TRUE, stack = TRUE)
    openxlsx::addStyle(wb, hoja, numero, rows = 2:(n + 1L),
                       cols = c(col("Matriculados"), col("Elegibles"), col("Esperadas")),
                       gridExpand = TRUE, stack = TRUE)
  }
  invisible(tabla)
}
