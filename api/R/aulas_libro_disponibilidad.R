# La hoja «Disponibilidad de aplicadores» del libro y del Google Sheets.
#
# Dictado de Gonzalo (2026-09-04): «el Sheets debería tener una forma muy
# elegante de poder mostrar la disponibilidad de cada encuestador en una hoja,
# para que el equipo de campo también pueda saber cuándo o a quién reclutar y no
# dependa enteramente de mí».
#
# Ese «no dependa enteramente de mí» es el requisito, no el adorno: la malla de
# oferta existía sólo dentro de la app, así que quien está en campo tenía que
# preguntarle a él «¿quién puede el jueves temprano?». La hoja contesta las dos
# preguntas por separado, porque son dos:
#
#   CUÁNDO reclutar  → la malla por día y tramo con su conteo. Un tramo en cero
#                      o en uno es donde el operativo se rompe si alguien falla.
#   A QUIÉN llamar   → los nombres de cada tramo, y debajo el resumen por
#                      persona con los días que cubre y su horario de punta a
#                      punta, que es lo que se mira para reasignar.
#
# Es hoja de la APP —se reescribe en cada publicación— y CONDICIONAL: sin
# disponibilidad cargada no se produce ni entra al juego de hojas, igual que
# «Asignación de aplicadores». Una hoja vacía diría «nadie tiene horario», que
# es distinto de «todavía no se cargó el libro de disponibilidad».
#
# La doble escritura sale del MISMO constructor de filas tipadas que la hoja de
# asignación (`aulas_libro_filas_asignacion`): el `.xlsx` les pone estilos por
# tipo de fila y Sheets recibe los valores planos, para que no existan dos
# verdades que puedan divergir.

.ald_DIAS <- c("lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo")

# La palabra bien escrita, que es la que va a la hoja. La clave del motor viene
# sin tilde («miercoles») porque es un identificador, no un rótulo.
.ald_ETIQUETA_DIA <- c(
  lunes = "Lunes", martes = "Martes", miercoles = "Miércoles", jueves = "Jueves",
  viernes = "Viernes", sabado = "Sábado", domingo = "Domingo"
)

.ald_txt <- function(x, alt = "") {
  v <- tryCatch(as.character(x %||% "")[1], error = function(...) "")
  if (length(v) == 0L || is.na(v)) alt else trimws(v)
}

.ald_CABECERA <- c("TRAMO", "DISPONIBLES", "QUIÉNES PUEDEN")

#' Las filas de la hoja de disponibilidad, tipadas.
#'
#' Mismo contrato que `aulas_libro_filas_asignacion`: una lista de
#' `list(tipo, celdas)` donde el tipo gobierna el estilo del `.xlsx` y el
#' formato del Sheets.
#'
#' @param disponibilidad el bloque de oferta del motor
#'   (`monitoreo_aulas_disponibilidad_bloque`), o la oferta cruda de la sesión.
#' @return lista de filas tipadas, o `NULL` si no hay oferta que enseñar.
#' @keywords internal
aulas_libro_filas_disponibilidad <- function(disponibilidad = list()) {
  bloque <- disponibilidad
  # Acepta las dos formas: el bloque ya armado o la oferta cruda de sesión. Sin
  # esto, el llamador tenía que saber cuál de las dos tenía en la mano.
  if (!is.list(bloque) || is.null(bloque[["dias"]])) {
    bloque <- monitoreo_aulas_disponibilidad_bloque(disponibilidad %||% list())
  }
  dias <- bloque[["dias"]] %||% list()
  if (!length(dias)) return(NULL)

  filas <- list()
  poner <- function(tipo, celdas) {
    filas[[length(filas) + 1L]] <<- list(tipo = tipo, celdas = as.character(celdas))
  }

  poner("titulo", "DISPONIBILIDAD DE APLICADORES")
  poner("nota", paste(
    "Quién puede estar en campo, por día y tramo de 30 minutos.",
    "Sale del libro de disponibilidad que el equipo llenó; la app no la inventa."
  ))
  poner("nota", paste(
    "Un tramo en 0 o en 1 es donde el operativo se cae si alguien falla:",
    "ahí es donde hace falta reclutar."
  ))
  poner("nota", "")

  # --- la malla, un bloque por día -------------------------------------------
  total_por_persona <- list()
  for (d in dias) {
    clave <- .ald_txt(d[["dia"]])
    franjas <- d[["franjas"]] %||% list()
    if (!length(franjas)) next
    poner("dia", .ald_ETIQUETA_DIA[[clave]] %||% clave)
    poner("cabecera", .ald_CABECERA)
    for (f in franjas) {
      quienes <- unlist(f[["nombres"]] %||% list())
      # El nombre se escribe como se escribe un nombre (dictado 2026-09-04).
      legibles <- vapply(quienes, aulas_nombre_aplicador, character(1))
      n <- as.integer(f[["disponibles"]] %||% length(quienes))
      poner("dato", c(
        sprintf("%s a %s", .ald_txt(f[["inicio"]]), .ald_txt(f[["fin"]])),
        as.character(n),
        # Punto medio y no coma: un nombre YA lleva la suya y la lista se leería
        # como el doble de personas de las que hay.
        paste(legibles, collapse = " · ")
      ))
      for (q in quienes) {
        prev <- total_por_persona[[q]] %||% list(dias = character(0), tramos = 0L)
        prev$dias <- unique(c(prev$dias, clave))
        prev$tramos <- prev$tramos + 1L
        total_por_persona[[q]] <- prev
      }
    }
    poner("nota", "")
  }

  # --- el resumen por persona, que es el «a quién llamar» ---------------------
  if (length(total_por_persona)) {
    poner("bloque", "QUÉ CUBRE CADA APLICADOR")
    poner("cabecera", c("APLICADOR", "DÍAS QUE CUBRE", "HORAS A LA SEMANA"))
    # Alfabético por el nombre LEGIBLE, que es el que se lee en la hoja.
    orden <- order(vapply(names(total_por_persona), aulas_nombre_aplicador, character(1)),
                   method = "radix")
    for (crudo in names(total_por_persona)[orden]) {
      info <- total_por_persona[[crudo]]
      etiquetas <- vapply(info$dias, function(k) .ald_ETIQUETA_DIA[[k]] %||% k, character(1))
      # En el orden de la semana y no en el de aparición: «lunes, jueves» se lee
      # y «jueves, lunes» hace dudar.
      etiquetas <- etiquetas[order(match(info$dias, .ald_DIAS), method = "radix")]
      poner("dato", c(
        aulas_nombre_aplicador(crudo),
        paste(tolower(etiquetas), collapse = " · "),
        # Los tramos son de media hora: dos tramos son una hora.
        sprintf("%.1f", info$tramos / 2)
      ))
    }
  }

  filas
}

#' Los values de la hoja para el publicador de Sheets: filas planas.
#'
#' `NULL` cuando no hay oferta, que es la señal de «esta hoja no juega esta
#' publicación» que el publicador ya entiende para la de asignación.
#'
#' @param disponibilidad la oferta de la sesión.
#' @return lista de filas de celdas, o `NULL`.
#' @keywords internal
aulas_libro_valores_disponibilidad <- function(disponibilidad = list()) {
  filas <- aulas_libro_filas_disponibilidad(disponibilidad)
  if (is.null(filas)) return(NULL)
  ancho <- max(vapply(filas, function(f) length(f$celdas), integer(1)))
  lapply(filas, function(f) {
    celdas <- f$celdas
    if (length(celdas) < ancho) celdas <- c(celdas, rep("", ancho - length(celdas)))
    as.list(celdas)
  })
}

#' Escribe la hoja «Disponibilidad de aplicadores» sobre el workbook del libro.
#'
#' Hermana de `aulas_libro_hoja_asignacion`: mismos estilos por TIPO de fila,
#' para que las dos hojas de la app se lean como la misma familia.
#'
#' @param wb workbook de openxlsx ya en construcción.
#' @param disponibilidad la clave de sesión; `NULL` o vacía = no se escribe.
#' @return TRUE si la hoja se escribió; FALSE si no había oferta.
#' @keywords internal
aulas_libro_hoja_disponibilidad <- function(wb, disponibilidad) {
  filas <- aulas_libro_filas_disponibilidad(disponibilidad)
  if (is.null(filas)) return(invisible(FALSE))

  hoja <- "Disponibilidad de aplicadores"
  openxlsx::addWorksheet(wb, hoja)

  estilos <- list(
    titulo = openxlsx::createStyle(fontSize = 14, textDecoration = "bold"),
    nota = openxlsx::createStyle(fontColour = "#6B6560", fontSize = 10),
    dia = openxlsx::createStyle(textDecoration = "bold", fontColour = "#FFFFFF",
                                fgFill = "#A0464E", fontSize = 11),
    cabecera = openxlsx::createStyle(textDecoration = "bold", fgFill = "#F3EDEA",
                                     border = "bottom", borderColour = "#C9BEB8",
                                     fontSize = 10),
    bloque = openxlsx::createStyle(textDecoration = "bold", fontSize = 12)
  )

  for (i in seq_along(filas)) {
    f <- filas[[i]]
    openxlsx::writeData(wb, hoja, t(as.matrix(f$celdas)), startRow = i, colNames = FALSE)
    est <- estilos[[f$tipo]]
    if (!is.null(est)) {
      openxlsx::addStyle(wb, hoja, est, rows = i,
                         cols = seq_along(f$celdas), gridExpand = TRUE)
    }
  }

  # **El conteo se ve sin leerlo.** Un tramo con UNA persona es el que rompe el
  # día si esa falla, y es justo lo que la hoja existe para enseñar. Se tiñe la
  # columna del conteo y no la fila entera: la fila es información, el aviso es
  # el número.
  solo_uno <- openxlsx::createStyle(fontColour = "#8F3A42", textDecoration = "bold")
  for (i in seq_along(filas)) {
    f <- filas[[i]]
    if (!identical(f$tipo, "dato") || length(f$celdas) < 2L) next
    n <- suppressWarnings(as.integer(f$celdas[[2]]))
    if (!is.na(n) && n <= 1L) {
      openxlsx::addStyle(wb, hoja, solo_uno, rows = i, cols = 2L, stack = TRUE)
    }
  }

  openxlsx::setColWidths(wb, hoja, cols = 1:3, widths = c(18, 14, 72))
  openxlsx::freezePane(wb, hoja, firstActiveRow = 5L)
  invisible(TRUE)
}
