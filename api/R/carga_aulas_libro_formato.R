# Formato del libro operativo de aulas.
#
# El libro se generaba con `openxlsx::write.xlsx(hojas, ...)`: un volcado. Medido
# sobre el libro de HSVG2026 recien generado —tres hojas, 842 x 241, 204 x 102 y
# 204 x 39—: CERO validaciones de datos, cero paneles congelados, cero anchos de
# columna, cero proteccion, cero formato condicional, cero autofiltro.
#
# Eso no es cosmetica. Sin lista desplegable, `STATUS MUESTRA` se escribe a mano
# 2 040 veces y el lector recibe «AGENDADA», «agendada», «Agendada» y «se
# agendo»; sin panel congelado, en la fila 300 de una hoja de 241 columnas nadie
# sabe que columna esta llenando. El vocabulario NO se inventa aqui: sale de lo
# observado en el estudio real de 2025 —`docs/qa/anatomia-excels-aulas-2026-08-16.md`—
# que es exactamente lo que el lector ya sabe traducir.
#
# Las listas viven en una hoja propia y no como literales del `dataValidation`:
# asi quedan a la vista de quien llena, y Excel no tiene el limite de 255
# caracteres de la lista inline —`EN RESERVA 1..11` lo rozaria—.

# Vocabulario observado en el estudio de 2025, con sus frecuencias:
# AGENDADA (119) · REEMPLAZADA (24) · EN RESERVA 1 (19) · REAGENDADA (8).
# `EN RESERVA n` se completa con la profundidad real de las cadenas del plan,
# no con un 1 fijo: un estudio con cadenas de once necesita las once.
AULAS_LIBRO_STATUS_MUESTRA_BASE <- c("AGENDADA", "REAGENDADA", "REEMPLAZADA")

# Llamada (123) · Correo Electronico (33). El «-» observado (14) NO entra: es
# como el equipo escribe «todavia nada aqui», y el lector ya lo trata como
# ausencia. Ofrecerlo en el desplegable lo convertiria en un valor.
AULAS_LIBRO_MEDIO_CONTACTO <- c("Llamada", "Correo Electrónico", "Presencial")

AULAS_LIBRO_DIA <- c("LUN", "MAR", "MIE", "JUE", "VIE", "SAB")

AULAS_LIBRO_STATUS_APLICACION <- c("APLICADA", "NO APLICADA")

#' Las opciones de `STATUS MUESTRA` para una profundidad de cadena dada.
#'
#' @param profundidad eslabones de la cadena mas larga del plan.
#' @export
aulas_libro_status_muestra <- function(profundidad = 1L) {
  n <- max(1L, suppressWarnings(as.integer(profundidad)))
  if (!is.finite(n)) n <- 1L
  # Sin el titular: `EN RESERVA k` describe a la reserva k, y el bloque 1 es el
  # titular. Con profundidad 12 (titular + 11) salen once reservas.
  reservas <- if (n > 1L) paste("EN RESERVA", seq_len(n - 1L)) else character(0)
  c(AULAS_LIBRO_STATUS_MUESTRA_BASE, reservas)
}

# Que campos del bloque de agenda llena la PERSONA y cuales trae la app.
#
# Sale de la misma spec que los titulos, por nombre de campo y no por posicion:
# si manana el bloque gana una columna, esto sigue apuntando a los mismos.
# La frontera ya estaba escrita en un comentario del generador —«a partir de
# aqui llena la persona que agenda»— pero no se veia en la hoja: las veinte
# columnas salian identicas y quien agenda tenia que adivinar donde escribir.
# `link` es la excepcion dentro del tramo de la persona: lo produce la app.
AULAS_LIBRO_CAMPOS_DE_LA_PERSONA <- c(
  "contact_medium", "contact_date", "contact_attempts", "sample_status",
  "scheduled_date", "scheduled_day", "scheduled_time", "notes"
)

#' Las columnas de una hoja de bloques que llena la app, por bloque.
#'
#' @param campos nombres de campo del bloque, en orden.
#' @param de_la_persona nombres que llena la persona.
#' @param bloques cuantos bloques tiene la hoja.
#' @param ancho columnas por bloque.
#' @param desplazamiento columnas antes del primer bloque.
#' @export
aulas_libro_columnas_de_la_app <- function(campos, de_la_persona, bloques,
                                           ancho = length(campos), desplazamiento = 1L) {
  propias <- which(!(campos %in% de_la_persona))
  unlist(lapply(seq_len(bloques), function(b) desplazamiento + (b - 1L) * ancho + propias))
}

# Hoja de listas: una columna por vocabulario, con su titulo en la fila 1.
.calf_hoja_listas <- function(wb, listas, hoja = "Listas") {
  openxlsx::addWorksheet(wb, hoja)
  for (i in seq_along(listas)) {
    valores <- listas[[i]]
    openxlsx::writeData(wb, hoja, c(names(listas)[[i]], valores), startCol = i, startRow = 1)
  }
  openxlsx::setColWidths(wb, hoja, cols = seq_along(listas), widths = 22)
  invisible(wb)
}

# La referencia absoluta a la columna i de la hoja de listas, sin su titulo.
.calf_rango <- function(hoja, i, n) {
  col <- openxlsx::int2col(i)
  sprintf("'%s'!$%s$2:$%s$%d", hoja, col, col, n + 1L)
}

#' Aplica el formato del libro sobre un workbook ya escrito.
#'
#' @param wb workbook de openxlsx con las tres hojas ya volcadas.
#' @param filas_cabecera cuantas filas de cabecera tiene cada hoja, por nombre.
#' Ancho de cada columna por su contenido real.
#'
#' `openxlsx` no calcula anchos: o se le da un numero o deja el defecto. Se mide
#' el texto mas largo de cada columna —cabecera incluida— y se acota, porque una
#' columna de observaciones libre puede traer 300 caracteres y dejaria la hoja
#' inservible.
.calf_anchos <- function(wb, hoja, n_col) {
  datos <- openxlsx::readWorkbook(wb, sheet = hoja, colNames = FALSE,
                                  skipEmptyRows = FALSE, skipEmptyCols = FALSE)
  vapply(seq_len(n_col), function(i) {
    if (is.null(datos) || i > ncol(datos)) return(14)
    v <- as.character(datos[[i]])
    v <- v[!is.na(v) & nzchar(v)]
    if (!length(v)) return(11)
    # La cabecera va con `wrapText`, asi que su ancho no manda: se le pide la
    # palabra mas larga y no la frase entera, o «MATRICULADOS TOTAL DTI» pediria
    # 23 para una columna de numeros.
    largo <- max(nchar(v))
    min(42, max(9, largo + 2))
  }, numeric(1))
}

#' @param validaciones lista de `list(hoja, cols, lista, filas)`.
#' @param listas vocabularios, en el orden de las columnas de la hoja «Listas».
#' @param columnas_app lista `hoja -> columnas` que llena la app, para teñirlas.
#' @param agrupados lista `list(hoja, cols)` de columnas plegables.
#' @export
aulas_libro_aplicar_formato <- function(wb, filas_cabecera, validaciones = list(),
                                        listas = list(), columnas_app = list(),
                                        agrupados = list()) {
  cabecera <- openxlsx::createStyle(
    textDecoration = "bold", fgFill = "#002457", fontColour = "#FFFFFF",
    halign = "left", valign = "center", wrapText = TRUE, border = "TopBottomLeftRight",
    borderColour = "#FFFFFF"
  )
  hojas <- names(filas_cabecera)
  if (length(listas)) .calf_hoja_listas(wb, listas)

  # Las dimensiones se leen UNA vez por hoja: `readWorkbook` sobre la de agenda
  # —842 x 241— no es gratis y se necesitaba en dos sitios.
  filas_datos <- list()
  for (hoja in hojas) {
    n_cab <- filas_cabecera[[hoja]]
    dims <- dim(openxlsx::readWorkbook(wb, sheet = hoja, colNames = FALSE, skipEmptyRows = FALSE, skipEmptyCols = FALSE))
    n_col <- if (is.null(dims)) 1L else dims[[2]]
    filas_datos[[hoja]] <- if (is.null(dims)) n_cab else dims[[1]]
    openxlsx::addStyle(wb, hoja, cabecera, rows = seq_len(n_cab), cols = seq_len(n_col),
                       gridExpand = TRUE, stack = TRUE)
    # El panel congela las cabeceras Y la primera columna: en una hoja de 241
    # columnas, perder de vista el `ID MATCH` es perder la fila.
    openxlsx::freezePane(wb, hoja, firstActiveRow = n_cab + 1L, firstActiveCol = 2L)
    # **Anchos por lo que cada columna lleva, no 18 para todas.**
    #
    # Con un ancho unico, «DIA» y «NOMBRE DEL CURSO» ocupaban lo mismo: el
    # primero desperdiciaba media columna y el segundo cortaba el titulo. Se
    # mide el contenido real —cabecera incluida— y se acota entre 9 y 42 para
    # que ninguna columna se coma la pantalla ni quede ilegible.
    openxlsx::setColWidths(wb, hoja, cols = seq_len(n_col),
                           widths = .calf_anchos(wb, hoja, n_col))
    openxlsx::setColWidths(wb, hoja, cols = 1, widths = 11)
    # El autofiltro sobre la ULTIMA fila de cabecera: con dos filas —la banda de
    # bloques y los titulos— Excel filtra por la de abajo, que es la que tiene
    # los nombres. Sin esto, buscar una facultad en 951 filas era desplazarse a
    # mano.
    if ((filas_datos[[hoja]] %||% 0L) > n_cab) {
      openxlsx::addFilter(wb, hoja, rows = n_cab, cols = seq_len(n_col))
    }
    # Las cabeceras respiran: dos lineas de titulo en 18 de ancho necesitan
    # alto, y con el alto por defecto se cortaban.
    openxlsx::setRowHeights(wb, hoja, rows = seq_len(n_cab), heights = 30)
  }

  # Lo que trae la app va teñido; lo que llena la persona queda en blanco. Es
  # la unica pista de donde se escribe, y hasta ahora las veinte columnas del
  # bloque salian identicas.
  de_la_app <- openxlsx::createStyle(fgFill = "#F2F4F7", fontColour = "#5B6472")
  for (hoja in names(columnas_app)) {
    cols <- columnas_app[[hoja]]
    n_cab <- filas_cabecera[[hoja]]
    if (!length(cols)) next
    ultima <- max(n_cab + 1L, filas_datos[[hoja]] %||% (n_cab + 1L))
    filas <- (n_cab + 1L):ultima
    openxlsx::addStyle(wb, hoja, de_la_app, rows = filas, cols = cols,
                       gridExpand = TRUE, stack = TRUE)
  }

  # **Los reemplazos se pliegan.**
  #
  # La hoja de agenda son 241 columnas: un titular y hasta once reservas, todas
  # con sus veinte campos. Quien agenda trabaja sobre el titular y sólo baja a
  # la cadena cuando un aula cae, pero tenía que recorrer la hoja entera para
  # llegar al siguiente bloque. Agrupados, los reemplazos se pliegan con un
  # clic y la hoja pasa a verse como lo que es: una fila por curso-horario.
  #
  # Se dejan VISIBLES al abrir (`hidden = FALSE`): esconder de entrada datos que
  # el equipo llena sería peor que la fila larga —nadie busca lo que no sabe que
  # está ahí—. El agrupado ofrece plegarlos, no lo decide por ellos.
  for (g in agrupados) {
    if (!length(g$cols)) next
    openxlsx::groupColumns(wb, g$hoja, cols = g$cols, hidden = FALSE)
  }

  for (v in validaciones) {
    if (!length(v$cols) || !v$filas) next
    # UNA llamada por columna. Con el vector entero, `openxlsx` escribe un
    # `sqref` rectangular desde la primera hasta la ultima —medido: `P2:IB842`,
    # unas 230 columnas— y el desplegable de STATUS MUESTRA caia sobre el
    # nombre del docente, el enlace y todo lo que hay en medio. Los eslabones
    # de la cadena estan a 20 columnas de distancia: no son contiguos y no
    # pueden pedirse como un rango.
    for (col in v$cols) {
      openxlsx::dataValidation(
        wb, v$hoja, cols = col, rows = seq_len(v$filas) + v$desde,
        type = "list", value = v$rango, allowBlank = TRUE, showErrorMsg = FALSE
      )
    }
  }
  invisible(wb)
}
