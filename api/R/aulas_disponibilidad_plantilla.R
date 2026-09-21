# aulas_disponibilidad_plantilla.R — la plantilla vacía de disponibilidad, para
# que el coordinador no tenga que adivinar el formato que el lector exige.
#
# Gonzalo, 2026-09-21: «entiendo la necesidad de ese xlsx y me parece correcto,
# pero la app debe ser capaz de dar un formato para que el coordinador pueda
# llenarlo fácilmente, quizás que ya todas las columnas ya estén y él solo ponga
# el nombre del aplicador y la x por día y hora».
#
# La regla que hay detrás: **si la app exige un formato, la app lo da.** Pedir un
# `.xlsx` con una estructura concreta —fila de días, fila de franjas, nombres
# abajo— y no entregar esa estructura convierte cada importación en un intento.
# Y el fallo no avisa: una hoja con las columnas corridas se lee entera como
# ceros, así que el reparto sale sin nadie disponible y parece que no hay gente.
#
# **La forma la manda el lector, no este archivo.** Las tres filas que escribe
# aquí son exactamente las que `carga_disponibilidad_aplicadores.R` espera
# (fila 1 = día por columna, fila 2 = franja con sufijo AM/PM, fila 3+ = nombre
# y marcas), y hay un test que llena la plantilla y la lee de vuelta: si el
# lector cambia, ese test cae antes que el coordinador.
#
# La hoja se llama «Disponibilidad» y va PRIMERA a propósito: el lector prefiere
# una hoja cuyo nombre diga «final», si no «Disponibilidad», si no la primera.
# Las instrucciones viven en su propia hoja porque en la de datos desplazarían
# la fila 1 y romperían la lectura.

#' Las franjas de una hora, con el sufijo que el lector sabe leer.
#'
#' «8:00-9:00am», «11:00am-12:00pm», «12:00-1:00pm»: el cruce del mediodía lleva
#' el sufijo en la parte que lo necesita y no en la otra, que es como viene la
#' hoja real del operativo y lo que `.cdisp_candidatos()` desambigua.
#' @keywords internal
.adp_franja <- function(hora) {
  suf <- function(h) if (h < 12) "am" else "pm"
  doce <- function(h) if (h %% 12 == 0) 12 else h %% 12
  a <- hora; b <- hora + 1L
  if (suf(a) == suf(b)) {
    sprintf("%d:00-%d:00%s", doce(a), doce(b), suf(b))
  } else {
    sprintf("%d:00%s-%d:00%s", doce(a), suf(a), doce(b), suf(b))
  }
}

#' La plantilla de disponibilidad, lista para llenar.
#'
#' @param path destino `.xlsx`.
#' @param dias días a cubrir, en el rótulo que el lector reconoce.
#' @param desde,hasta rango horario en horas de 24 (el `hasta` es el final de la
#'   última franja: `desde = 7, hasta = 22` da 15 franjas de 7am a 10pm).
#' @param filas cuántas filas de nombre dejar en blanco.
#' @param aplicadores nombres ya conocidos, si los hay: se escriben en las
#'   primeras filas para no volver a teclearlos.
#' @return la ruta escrita, invisible.
#' @export
aulas_disponibilidad_plantilla <- function(path,
                                           dias = c("Lunes", "Martes", "Miércoles",
                                                    "Jueves", "Viernes", "Sábado"),
                                           desde = 7L, hasta = 22L,
                                           filas = 25L,
                                           aplicadores = character(0)) {
  desde <- as.integer(desde)[1]; hasta <- as.integer(hasta)[1]
  if (!is.finite(desde) || !is.finite(hasta) || hasta <= desde) {
    stop_api(400, "E_DISPONIBILIDAD_PLANTILLA_RANGO",
             "El rango horario de la plantilla no es válido: «hasta» tiene que ser mayor que «desde».")
  }
  horas <- seq.int(desde, hasta - 1L)
  franjas <- vapply(horas, .adp_franja, character(1))

  fila_dias <- c("", unlist(lapply(dias, function(d) rep(d, length(franjas)))))
  fila_franjas <- c("Nombres", rep(franjas, length(dias)))
  nombres <- as.character(aplicadores)
  nombres <- nombres[nzchar(trimws(nombres))]
  cuerpo <- c(nombres, rep("", max(0L, as.integer(filas)[1] - length(nombres))))

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "Disponibilidad")
  openxlsx::writeData(wb, "Disponibilidad", as.data.frame(as.list(fila_dias), check.names = FALSE),
                      startRow = 1, colNames = FALSE)
  openxlsx::writeData(wb, "Disponibilidad", as.data.frame(as.list(fila_franjas), check.names = FALSE),
                      startRow = 2, colNames = FALSE)
  if (length(cuerpo)) {
    openxlsx::writeData(wb, "Disponibilidad",
                        as.data.frame(matrix(c(cuerpo, rep("", length(cuerpo) * length(fila_franjas) - length(cuerpo))),
                                             nrow = length(cuerpo)), stringsAsFactors = FALSE),
                        startRow = 3, colNames = FALSE)
  }
  # **Las cabeceras van GIRADAS, y no es estética.** Con seis días de quince
  # franjas la hoja tiene 90 columnas: a un ancho que quepa en pantalla,
  # «11:00am-12:00pm» sale cortado —«am-12:0»— y quien llena no sabe de qué hora
  # es la casilla. Medido el 2026-09-21 renderizando la plantilla: las quince
  # franjas ilegibles. Girar el rótulo deja la columna estrecha y el texto
  # entero; es lo que hace cualquier malla de horarios.
  cab <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#E7EEF9",
                               border = "bottom", borderColour = "#C9BEB8",
                               halign = "center", valign = "bottom",
                               fontSize = 9, textRotation = 90)
  openxlsx::addStyle(wb, "Disponibilidad", cab, rows = 1:2,
                     cols = seq_along(fila_franjas), gridExpand = TRUE)
  # El rótulo «Nombres» no se gira: es la cabecera de una columna ancha.
  openxlsx::addStyle(wb, "Disponibilidad",
                     openxlsx::createStyle(textDecoration = "bold", fgFill = "#E7EEF9",
                                           border = "bottom", borderColour = "#C9BEB8",
                                           halign = "left", valign = "bottom", fontSize = 9),
                     rows = 2, cols = 1)
  # Alto suficiente para que el rótulo girado quepa entero.
  openxlsx::setRowHeights(wb, "Disponibilidad", rows = 1, heights = 58)
  openxlsx::setRowHeights(wb, "Disponibilidad", rows = 2, heights = 86)
  openxlsx::addStyle(wb, "Disponibilidad",
                     openxlsx::createStyle(textDecoration = "bold"),
                     rows = 3:(2 + length(cuerpo)), cols = 1, gridExpand = TRUE)
  openxlsx::setColWidths(wb, "Disponibilidad", cols = 1, widths = 34)
  openxlsx::setColWidths(wb, "Disponibilidad", cols = 2:length(fila_franjas), widths = 5)
  # **El 1 en verde y el 0 en rojo** (Gonzalo, 2026-09-21: «cero y uno están
  # bien, me parece más limpio, pero que los ceros y los unos se pinten»).
  #
  # Una malla de 90 columnas de unos y ceros no se lee: el ojo no distingue un
  # 1 de un 0 a esa densidad, y quien la revisa antes de importar no puede ver
  # de un vistazo si una persona quedó con la fila entera en cero. Con color, el
  # bloque de disponibilidad se ve como una forma.
  #
  # Es formato CONDICIONAL y no celdas pintadas a mano: pintar exigiría escribir
  # un valor en las 90 columnas de cada fila, y entonces una fila sin tocar no se
  # distinguiría de una contestada «no disponible en nada». En blanco se queda
  # en blanco, y el color aparece al escribir.
  filas_grid <- 3:(2 + length(cuerpo))
  cols_grid <- 2:length(fila_franjas)
  openxlsx::conditionalFormatting(
    wb, "Disponibilidad", cols = cols_grid, rows = filas_grid,
    rule = "==1", type = "expression",
    style = openxlsx::createStyle(fontColour = "#1F6B4A", bgFill = "#E6F2EB",
                                  halign = "center", textDecoration = "bold"))
  openxlsx::conditionalFormatting(
    wb, "Disponibilidad", cols = cols_grid, rows = filas_grid,
    rule = "==0", type = "expression",
    style = openxlsx::createStyle(fontColour = "#8C2230", bgFill = "#FBECED",
                                  halign = "center"))
  # Congelar el nombre y las dos cabeceras: sin esto, a la tercera columna ya no
  # se sabe de quién es la fila ni de qué día es la franja.
  openxlsx::freezePane(wb, "Disponibilidad", firstActiveRow = 3, firstActiveCol = 2)

  openxlsx::addWorksheet(wb, "Cómo llenar")
  guia <- data.frame(x = c(
    "DISPONIBILIDAD DE APLICADORES",
    "",
    "1. Escribe un nombre por fila en la columna «Nombres».",
    "2. Escribe 1 en cada día y franja en la que esa persona puede aplicar, y 0 en la que no.",
    "   El 1 se pinta de verde y el 0 de rojo, para poder revisar la malla de un vistazo.",
    "3. Lo que dejes en blanco cuenta como no disponible. También valen X, «sí» y «no».",
    "4. Guarda el archivo e impórtalo desde Monitoreo → Carga de campo → Disponibilidad de aplicadores.",
    "",
    "No muevas ni renombres las dos primeras filas: la app las lee para saber",
    "a qué día y a qué hora corresponde cada columna.",
    "",
    "Franjas contiguas marcadas se unen solas: marcar 8-9, 9-10 y 10-11 equivale",
    "a decir que esa persona está libre de 8:00 a 11:00.",
    "",
    "Si una casilla trae algo que no se entiende, se cuenta como no disponible y",
    "la importación lo avisa con el nombre y la franja: no se descarta en silencio."
  ), stringsAsFactors = FALSE)
  openxlsx::writeData(wb, "Cómo llenar", guia, colNames = FALSE)
  openxlsx::addStyle(wb, "Cómo llenar",
                     openxlsx::createStyle(textDecoration = "bold", fontSize = 13),
                     rows = 1, cols = 1)
  openxlsx::setColWidths(wb, "Cómo llenar", cols = 1, widths = 95)

  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  invisible(path)
}
