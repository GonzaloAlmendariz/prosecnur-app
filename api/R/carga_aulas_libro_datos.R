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
aulas_libro_hoja_datos <- function(unidades, partes = list(), control = list()) {
  if (!length(unidades)) {
    return(data.frame(
      `Curso-horario` = character(0), Titular = character(0), Papel = character(0),
      check.names = FALSE, stringsAsFactors = FALSE
    ))
  }
  # **Los hechos de campo y de control tambien entran, o la dinamica no sirve.**
  #
  # Con solo las columnas del plan se puede contar aulas por facultad, pero no
  # se puede preguntar cuantas efectivas hubo por facultad ni que proporcion
  # supero el umbral — que es a lo que se hace una dinamica en este estudio.
  #
  # De un aula con varios intentos manda el ULTIMO que registro algo: es el que
  # cuenta como aplicacion. Los anteriores viven en la hoja de campo, que es
  # donde se sigue el historial; aqui hay una fila por aula.
  por_aula <- list()
  for (pt in partes) {
    if (!is.list(pt)) next
    cod <- .cald_txt(pt, "operational_code")
    if (!nzchar(cod)) cod <- .cald_txt(pt, "classroom_id")
    if (!nzchar(cod)) next
    previo <- por_aula[[cod]]
    i_nuevo <- .cald_num(pt, "intento")
    i_previo <- if (is.null(previo)) -Inf else .cald_num(previo, "intento")
    if (is.null(previo) || !is.finite(i_previo) ||
        (is.finite(i_nuevo) && i_nuevo >= i_previo)) por_aula[[cod]] <- pt
  }
  ctl_aula <- list()
  for (r in control) {
    if (!is.list(r)) next
    cod <- .cald_txt(r, "operational_code")
    if (!nzchar(cod)) cod <- .cald_txt(r, "classroom_id")
    if (nzchar(cod)) ctl_aula[[cod]] <- r
  }
  reg <- function(mapa) function(u) {
    mapa[[.cald_txt(u, "operational_code")]] %||% list()
  }
  del_parte <- reg(por_aula)
  del_control <- reg(ctl_aula)
  tx <- function(f, k) vapply(unidades, function(u) .cald_txt(f(u), k), character(1))
  nm <- function(f, k) vapply(unidades, function(u) .cald_num(f(u), k), numeric(1))

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
    # **Vacio, no cero, para quien no tiene orden de reemplazo.**
    #
    # `Orden` es la posicion DENTRO de una cadena, asi que solo la tienen las
    # reservas encadenadas. Un titular no reemplaza a nadie y un extra del banco
    # no cuelga de ninguna cadena. Medido en el estudio: 243 de 269 filas
    # llevaban un 0 que no significa nada —170 titulares y 73 del banco— contra
    # 26 con orden de verdad. En una dinamica ese 0 es un valor real: contamina
    # cualquier promedio y hace que filtrar por «Orden = 0» devuelva titulares y
    # banco mezclados. Vacio, Excel lo excluye de los calculos y lo agrupa como
    # «(en blanco)», que es lo que es.
    Orden = vapply(unidades, function(u) {
      n <- .cald_num(u, "replacement_order")
      if (is.finite(n)) as.integer(n) else NA_integer_
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

    # Del parte de campo. **Los cuatro hechos que las DOS hojas registran van
    # con el nombre de su hoja detras**: el cruce de las dos fuentes ya midio
    # que discrepan —el revisor corrige cuentas del parte— y una columna sola
    # llamada «Asistentes» obligaria a elegir en silencio cual gana.
    `Asistentes (parte)` = nm(del_parte, "observed_students"),
    `% asistencia (parte)` = nm(del_parte, "attendance_pct"),
    Rechazos = nm(del_parte, "refusals"),
    Duplicados = nm(del_parte, "duplicates"),
    Efectivas = nm(del_parte, "effective_surveys"),
    `Aplicador (parte)` = tx(del_parte, "applied_by"),
    `Estado de aplicacion (parte)` = tx(del_parte, "application_status"),

    # De la base de control.
    `Asistentes (control)` = nm(del_control, "observed_students"),
    `% asistencia (control)` = nm(del_control, "attendance_pct"),
    Enviadas = nm(del_control, "sent_total"),
    `Cortas` = nm(del_control, "short_total"),
    `Largas` = nm(del_control, "long_total"),
    `Umbral 70T` = nm(del_control, "threshold_total"),
    `Umbral 70P` = nm(del_control, "threshold_population"),
    `Valido total` = nm(del_control, "valid_total"),
    `Valido poblacion` = nm(del_control, "valid_population"),
    Cuota = nm(del_control, "quota_pct"),
    `Faltantes de cuota` = nm(del_control, "quota_missing"),
    Mujeres = nm(del_control, "women_n"),
    Hombres = nm(del_control, "men_n"),
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
                                       tabla = "datos_aulas", partes = list(),
                                       control = list()) {
  datos <- aulas_libro_hoja_datos(unidades, partes, control)
  openxlsx::addWorksheet(wb, hoja)
  openxlsx::writeDataTable(
    wb, hoja, datos, tableName = tabla, tableStyle = "TableStyleMedium2",
    withFilter = TRUE, bandedRows = TRUE
  )
  openxlsx::freezePane(wb, hoja, firstActiveRow = 2L, firstActiveCol = 2L)
  # La hoja larga no pasa por el formateador comun —no tiene bloques ni
  # validaciones—, asi que su ajuste de impresion se declara aqui: horizontal,
  # con la cabecera y la columna del codigo repetidas en cada pagina. Sin la
  # columna, la segunda pagina son cifras sin saber de que aula.
  openxlsx::pageSetup(wb, hoja, orientation = "landscape", fitToWidth = FALSE,
                      printTitleRows = 1L, printTitleCols = 1L)
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
    # **Las veinte columnas de campo y control tambien llevan su formato.**
    #
    # Se quedaron sin el al añadirlas: los porcentajes salian como «0.61» y los
    # conteos alineados a la izquierda. Aqui importa mas que en las otras hojas
    # porque una tabla dinamica hereda el formato de su columna de origen: un
    # promedio de «% asistencia» heredaba el 0.61.
    cuentas <- c(
      "Asistentes (parte)", "Rechazos", "Duplicados", "Efectivas",
      "Asistentes (control)", "Enviadas", "Cortas", "Largas",
      "Umbral 70T", "Umbral 70P", "Faltantes de cuota", "Mujeres", "Hombres"
    )
    openxlsx::addStyle(wb, hoja, numero, rows = 2:(n + 1L),
                       cols = c(col("Matriculados"), col("Elegibles"), col("Esperadas"),
                                unlist(lapply(cuentas, col))),
                       gridExpand = TRUE, stack = TRUE)

    # `Umbral 70T`/`70P` son CUENTAS y `Valido total`/`Valido poblacion`
    # veredictos 0/1, no porcentajes: lo dice su medicion, no su nombre. Solo
    # estas tres son razones, y su escala la decide la columna entera.
    pct <- openxlsx::createStyle(numFmt = "0.0%", halign = "right")
    dec <- openxlsx::createStyle(numFmt = "0.0", halign = "right")
    for (nombre in c("% asistencia (parte)", "% asistencia (control)", "Cuota")) {
      i <- col(nombre)
      if (!length(i)) next
      estilo <- if (identical(.calg_escala_pct(datos[[nombre]]), "porcentaje")) pct else dec
      openxlsx::addStyle(wb, hoja, estilo, rows = 2:(n + 1L), cols = i,
                         gridExpand = TRUE, stack = TRUE)
    }
  }
  invisible(tabla)
}
