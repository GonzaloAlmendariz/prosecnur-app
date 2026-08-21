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

# **Un color por ESLABON, no dos alternando.**
#
# La banda usaba `#1D4F8C` y `#2F6BB0` en ciclo, asi que el reemplazo 3 repetia
# el color del 1 y con once reservas la pista dejaba de distinguir. Gonzalo:
# «las columnas de titular deberian ser de un color, y las columnas de
# reemplazo uno, reemplazo dos, reemplazo tres y subsiguientes de otros colores
# para distinguirlos».
#
# El titular conserva el navy del resto del libro. Los reemplazos van
# aclarandose desde el: cuanto mas lejos de la cadena, mas claro, que es la
# jerarquia real —el primero entra antes que el ultimo—. La escala se calcula
# para la profundidad que tenga el estudio, asi que doce bloques dan doce tonos
# distintos y no seis repetidos.
.calf_mezcla <- function(hex, blanco, peso) {
  c1 <- grDevices::col2rgb(hex)[, 1]
  c2 <- grDevices::col2rgb(blanco)[, 1]
  grDevices::rgb(t(round(c1 * (1 - peso) + c2 * peso)), maxColorValue = 255)
}

# El tinte de un eslabon, garantizando que NO se confunda con el gris de «lo
# que trae la app».
#
# Mezclado al 93 % con blanco, el tinte quedaba a **3-6 por canal** del gris
# `#F2F4F7`: a la vista son el mismo color, asi que añadir la pista del eslabon
# borraba la de «esto no lo toques». Se comprobo mirando el PDF, donde
# `NUMERO DE INTENTOS` —que llena el agendador— parecia de la app.
#
# Se busca el tinte mas claro que siga estando a distancia del gris. Si ni el
# mas oscuro de la escala llega, se devuelve ese: mejor un tinte tenue que uno
# que miente.
.calf_tinte_distinguible <- function(tono, gris = "#F2F4F7", minimo = 12) {
  objetivo <- grDevices::col2rgb(gris)[, 1]
  for (peso in c(0.93, 0.9, 0.86, 0.82, 0.78)) {
    cand <- .calf_mezcla(tono, "#FFFFFF", peso)
    if (max(abs(grDevices::col2rgb(cand)[, 1] - objetivo)) >= minimo) return(cand)
  }
  .calf_mezcla(tono, "#FFFFFF", 0.78)
}

#' La escala de color de los eslabones de una cadena.
#'
#' @param n cuantos bloques hay, titular incluido.
#' @return vector de colores; el primero es el titular.
#' @export
aulas_libro_colores_eslabon <- function(n = 1L) {
  n <- max(1L, suppressWarnings(as.integer(n)))
  if (!is.finite(n)) n <- 1L
  if (n == 1L) return("#002457")
  # Del azul medio al claro, sin llegar a perder el contraste con el blanco del
  # texto: el ultimo eslabon sigue leyendose.
  pasos <- seq(0, 0.55, length.out = n - 1L)
  c("#002457", vapply(pasos, function(p) .calf_mezcla("#1D4F8C", "#FFFFFF", p), character(1)))
}

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
  # **La hoja auxiliar no se enseña.**
  #
  # «Listas» existe para que los desplegables apunten a un rango y no a
  # literales; no es del equipo y verla en la barra invita a editarla, que es
  # justo lo que rompe las validaciones. Excel las resuelve igual contra una
  # hoja oculta.
  if (length(listas) && "Listas" %in% names(wb)) {
    openxlsx::sheetVisibility(wb)[which(names(wb) == "Listas")] <- FALSE
  }
  # **El libro abre por «Aulas Agendadas»**, que es la primera hoja desde que se
  # retiraron la portada y la hoja larga. Ya no es «abre por la portada»: es que
  # abre **donde se trabaja**, y eso es deliberado — quien recibe este fichero lo
  # abre para agendar, no para leer un resumen.
  if (length(names(wb))) openxlsx::activeSheet(wb) <- 1L

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
#' @param semaforos lista `list(hoja, cols, filas, desde)` de columnas de estado.
#' @param formatos lista `list(hoja, cols, filas, desde, tipo)` — `tipo` es
#'   `"fecha"` o `"numero"`.
#' @param columnas_repetidas lista `hoja -> n` de columnas que se repiten al
#'   imprimir; por defecto una.
#' @param combinar lista `list(hoja, fila, cols)` de bandas a combinar.
#' @export
aulas_libro_aplicar_formato <- function(wb, filas_cabecera, validaciones = list(),
                                        listas = list(), columnas_app = list(),
                                        agrupados = list(), semaforos = list(),
                                        formatos = list(),
                                        columnas_repetidas = list(),
                                        combinar = list(),
                                        descuadres = list(),
                                        tintes = list()) {
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
     # **Y si alguien imprime, que no salga una hoja sin cabecera.**
    #
    # Estas hojas son anchas y largas: en vertical se parten por columnas y cada
    # pagina posterior pierde la fila de titulos, asi que la segunda hoja de una
    # tabla de 951 filas es una lista de numeros sin nombre. Horizontal y con la
    # cabecera repetida en cada pagina.
    # `printTitleCols` ademas de `printTitleRows`: en horizontal la hoja se
    # parte por COLUMNAS, y sin repetir la que identifica la fila, las paginas
    # 2 y 3 son cifras sin saber de que aula son. Es el mismo problema que las
    # filas, en el otro eje.
    #
    # Cuantas se repiten lo dice quien conoce la hoja: en «Aulas Agendadas» la
    # primera es `ID MATCH` —un correlativo interno— y el codigo del aula esta
    # en la SEGUNDA, asi que repetir solo la primera dejaba las paginas con un
    # numero de orden y ningun curso-horario. Visto en el PDF.
    repetidas <- columnas_repetidas[[hoja]] %||% 1L
    openxlsx::pageSetup(wb, hoja, orientation = "landscape", fitToWidth = FALSE,
                        printTitleRows = seq_len(n_cab),
                        printTitleCols = seq_len(repetidas))
  }

  # Lo que trae la app va teñido; lo que llena la persona queda en blanco. Es
  # la unica pista de donde se escribe, y hasta ahora las veinte columnas del
  # bloque salian identicas.
  # La escala se calcula UNA vez y la comparten la banda de la cabecera y el
  # tinte de los datos: si cada una tuviera la suya, el bloque 3 podria salir de
  # un color arriba y de otro abajo.
  tonos <- aulas_libro_colores_eslabon(max(length(tintes), length(agrupados) + 1L))

  # **Y el color baja a las filas de datos, con una linea que separa bloques.**
  #
  # Con el color solo en la cabecera, quien esta veinte columnas dentro no sabe
  # en que eslabon escribe: la cabecera se queda arriba y las celdas son todas
  # blancas. Un tinte muy claro del mismo tono acompaña la columna hasta el
  # final, y un borde grueso en la primera columna de cada bloque dice donde
  # acaba uno y empieza el siguiente.
  #
  # **Va ANTES del gris de «lo que trae la app», y el orden importa.** Aplicado
  # despues, el tinte del bloque pisaba ese gris y se perdia la unica pista de
  # que columnas no hay que tocar. Las dos se necesitan y no compiten: una dice
  # de que eslabon es la columna, la otra si se escribe en ella. Gana la
  # segunda, que es la que evita que alguien edite lo que la app va a
  # sobrescribir.
  for (tb in tintes) {
    if (!length(tb$cols) || !tb$filas) next
    tono <- tonos[[min(tb$eslabon, length(tonos))]]
    tinte <- openxlsx::createStyle(fgFill = .calf_tinte_distinguible(tono))
    openxlsx::addStyle(wb, tb$hoja, tinte, rows = seq_len(tb$filas) + tb$desde,
                       cols = tb$cols, gridExpand = TRUE, stack = TRUE)
    borde <- openxlsx::createStyle(border = "left", borderColour = tono,
                                   borderStyle = "medium")
    openxlsx::addStyle(wb, tb$hoja, borde,
                       rows = seq_len(tb$filas + tb$desde),
                       cols = tb$cols[[1]], gridExpand = TRUE, stack = TRUE)
  }

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

  # **El estado se ve sin leerlo.**
  #
  # Las columnas de estado son las que se recorren buscando «que falta»: con 951
  # filas y el valor en texto, encontrar las que siguen por agendar era leer
  # celda a celda. El color lo dice de un vistazo y el texto se queda —el color
  # solo no sirve: hay quien no lo distingue, y el fichero se imprime en blanco
  # y negro—.
  #
  # Los tonos salen de lo que significa cada estado, no de una paleta: verde lo
  # cerrado, ambar lo que espera accion, gris lo que ya no se toca. La regla es
  # `contains` sobre el texto del vocabulario, asi que un estado nuevo no rompe
  # nada: simplemente no se tiñe.
  semaforo <- list(
    list(texto = "AGENDADA", estilo = openxlsx::createStyle(bgFill = "#E3F3E8", fontColour = "#155E2E")),
    list(texto = "REAGENDADA", estilo = openxlsx::createStyle(bgFill = "#E3F3E8", fontColour = "#155E2E")),
    list(texto = "APLICADA", estilo = openxlsx::createStyle(bgFill = "#E3F3E8", fontColour = "#155E2E")),
    list(texto = "EN RESERVA", estilo = openxlsx::createStyle(bgFill = "#E7EEF9", fontColour = "#1B4B8F")),
    list(texto = "REEMPLAZADA", estilo = openxlsx::createStyle(bgFill = "#EEF0F3", fontColour = "#5B6472")),
    list(texto = "NO APLICADA", estilo = openxlsx::createStyle(bgFill = "#FBEDE3", fontColour = "#8A4B1B"))
  )
  # **Los números se escriben como números y las fechas como fechas.**
  #
  # Todo salía como texto plano, así que Excel no podía ordenar por fecha ni
  # sumar una columna: «2026-08-11» y «2026-8-9» se ordenaban alfabéticamente y
  # los matriculados no admitían un total al pie. Ahora la columna lleva su
  # formato y el dato entra con el tipo que le toca.
  #
  # Esto se puede hacer **desde que el lector tolera el serial de Excel**: antes,
  # formatear una fecha la devolvía al plan como «46245». El orden importa —
  # primero que la relectura aguante, después la forma.
  formato_numero <- openxlsx::createStyle(numFmt = "#,##0", halign = "right")
  formato_fecha <- openxlsx::createStyle(numFmt = "dd/mm/yyyy", halign = "center")
  # `porcentaje` es para una razon 0-1: Excel la ENSEÑA como 46.7 %. `decimal`
  # es la misma cifra ya venida en 0-100, que con formato de porcentaje se
  # veria como 4670 %. Quien decide cual va es la escala medida de la columna
  # entera, en el generador; aqui solo hay dos estilos distintos.
  formato_pct <- openxlsx::createStyle(numFmt = "0.0%", halign = "right")
  formato_decimal <- openxlsx::createStyle(numFmt = "0.0", halign = "right")
  for (fm in formatos) {
    if (!length(fm$cols) || !fm$filas) next
    estilo <- switch(fm$tipo %||% "numero",
                     fecha = formato_fecha,
                     porcentaje = formato_pct,
                     decimal = formato_decimal,
                     formato_numero)
    openxlsx::addStyle(wb, fm$hoja, estilo, rows = seq_len(fm$filas) + fm$desde,
                       cols = fm$cols, gridExpand = TRUE, stack = TRUE)
  }

  # Sobre las columnas de ESTADO y sólo esas: colgarlo de las validaciones
  # teñía también «MEDIO DE CONTACTO» y «DÍA», que no llevan estos valores. No
  # rompía nada —ninguna celda casaba— pero dejaba reglas donde no significan.
  for (sem in semaforos) {
    if (!length(sem$cols) || !sem$filas) next
    for (col in sem$cols) {
      for (regla in semaforo) {
        openxlsx::conditionalFormatting(
          wb, sem$hoja, cols = col, rows = seq_len(sem$filas) + sem$desde,
          type = "contains", rule = regla$texto, style = regla$estilo
        )
      }
    }
  }

  # **El descuadre del parte se ve AL ESCRIBIRLO, no dos semanas despues.**
  #
  # `monitoreo_aulas_reconciliacion.R` comprueba lo mismo al IMPORTAR, y para
  # entonces la clase se acabo: quien llena la hoja en el aula no se entera de
  # que su cuenta no cuadra hasta que alguien sube el libro.
  #
  # **Pero tiñe la MITAD de lo que el motor reporta, y a proposito.** El motor
  # da por descuadre cualquier diferencia; aqui solo se tiñe **declarar MAS
  # efectivas de las que caben** —mas encuestas que gente disponible es
  # imposible—. Declarar de MENOS es posible y corriente: alguien presente que
  # no respondio y a quien nadie anoto como rechazo. Medido en el estudio, los
  # dos unicos partes descuadrados van en ese sentido (declaran 20 donde la
  # cuenta da 21), asi que teñirlos en rojo seria acusar al aplicador de un
  # error que probablemente no cometio.
  #
  # No bloquea nada: es un aviso, no una validacion. Un dato raro puede ser
  # correcto y la hoja no esta para discutir con quien estuvo en el aula.
  #
  # Rechazos y duplicados en blanco cuentan como cero —igual que en el motor:
  # son cuentas de eventos que, de no anotarse, no ocurrieron— y por eso van con
  # `N()`, que convierte el vacio en 0 sin romper la formula.
  descuadre <- openxlsx::createStyle(bgFill = "#FDE7E7", fontColour = "#8A1C1C")
  for (dc in descuadres) {
    if (!length(dc$efectivas) || !dc$filas) next
    fila1 <- dc$desde + 1L
    ef <- paste0(openxlsx::int2col(dc$efectivas), fila1)
    as <- paste0(openxlsx::int2col(dc$asistentes), fila1)
    re <- paste0(openxlsx::int2col(dc$rechazos), fila1)
    du <- paste0(openxlsx::int2col(dc$duplicados), fila1)
    openxlsx::conditionalFormatting(
      wb, dc$hoja, cols = dc$efectivas, rows = seq_len(dc$filas) + dc$desde,
      type = "expression",
      # Sin dato no hay descuadre que enseñar: una fila vacia se quedaria roja.
      rule = sprintf("AND(%s<>\"\",%s<>\"\",%s>%s-N(%s)-N(%s))",
                     ef, as, ef, as, re, du),
      style = descuadre
    )
  }

  # **La banda de grupo se combina en vez de dejar una franja hueca.**
  #
  # La fila de grupo escribe la etiqueta en su primera celda y rellena el resto
  # con vacios, asi que al imprimirla se ve una franja navy enorme con dos
  # palabras en la esquina y el resto en blanco. Combinadas, la etiqueta ocupa
  # su bloque y se lee como lo que es: el titulo de ese tramo de columnas.
  for (mg in combinar) {
    if (length(mg$cols) < 2L) next
    openxlsx::mergeCells(wb, mg$hoja, cols = mg$cols, rows = mg$fila)
  }

  # **De un golpe: donde acaba el titular y empieza cada reserva.**
  #
  # Los veinte titulos se repiten identicos en cada bloque, asi que la cabecera
  # de la columna 21 y la de la 41 se leen igual y no hay forma de saber en que
  # eslabon se esta. Una fila de banda encima —«TITULAR», «REEMPLAZO 1»— seria
  # lo natural, pero el lector espera los titulos en la PRIMERA fila y añadirla
  # romperia la relectura; el color da la misma pista sin tocar la estructura.
  #
  # El titular conserva el navy del resto del libro y las reservas alternan dos
  # tonos mas claros: el contraste con el texto blanco se mantiene en los tres.
  for (i in seq_along(agrupados)) {
    g <- agrupados[[i]]
    if (!length(g$cols)) next
    n_cab <- filas_cabecera[[g$hoja]] %||% 1L
    banda <- openxlsx::createStyle(
      # `i + 1L`: el primero de la escala es el titular, que no esta en
      # `agrupados` —solo se agrupan los reemplazos, el titular no se pliega—.
      textDecoration = "bold", fgFill = tonos[[i + 1L]],
      fontColour = "#FFFFFF", halign = "left", valign = "center", wrapText = TRUE,
      border = "TopBottomLeftRight", borderColour = "#FFFFFF"
    )
    openxlsx::addStyle(wb, g$hoja, banda, rows = seq_len(n_cab), cols = g$cols,
                       gridExpand = TRUE, stack = FALSE)
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
