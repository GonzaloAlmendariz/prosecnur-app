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

# Los CINCO estados TECLEABLES, en el orden del dictado del dueño (D-B13
# CERRADA, docs/qa/checklist-operativo-aulas-2026-08-31.md; poda textual
# 2026-09-01): «simplemente pon rechazo. Sin contactar, en contacto, agendada,
# reagendada y rechazo». Los estados de cadena del vocabulario de 2025 —«EN
# RESERVA k», «REEMPLAZADA», y los derivados REFUERZO/CERRADA— son de la APP:
# el código R n.k ya dice la posición en cadena y el desplegable no los ofrece.
# Lo ya escrito en libros vivos v3 se sigue LEYENDO con su clave de siempre
# (`monitoreo_aulas_estado_muestra`), y el regenerador conserva «REEMPLAZADA»
# como dato vivo del export: el desplegable no la ofrece pero la validación
# (allowBlank / strict = FALSE) la tolera.
#
# «SIN CONTACTAR» va primero porque es el estado INICIAL del plan: la siembra lo
# escribe en TODAS las filas —titulares y reservas— y el desplegable tiene que
# ofrecerlo byte a byte, o el chip sale con warning rojo sobre un dato correcto
# (B13a, reporte del dueño 2026-09-01). La forma es la legible sin guion bajo —
# la misma que `.capd_estado_legible` da al Plan del día.
AULAS_LIBRO_STATUS_MUESTRA_BASE <- c(
  "SIN CONTACTAR", "EN CONTACTO", "AGENDADA", "REAGENDADA", "RECHAZO"
)

# **Un color por ESLABON, y de una paleta que se VE distinta (B18).**
#
# Dos escalas fallaron antes de esta:
#   1. Dos azules alternando: el reemplazo 3 repetia el color del 1.
#   2. UN azul degradado hacia blanco por profundidad: numericamente unico,
#      visualmente el mismo color (pasos de ~17 RGB) — Gonzalo lo leyo como
#      «solo el titular y el reemplazo 1 tienen color diferente; luego todas
#      las demas tienen el mismo color que el reemplazo 1» — y la cola
#      (#99B0CB) daba 2.2 de contraste con el texto blanco: ilegible.
#
# El dictado (2026-09-01): «cada reemplazo deberia tener un color diferente —
# por lo menos cinco colores que se repitan y contrasten bien con el encabezado
# blanco». Paleta CICLICA de cinco tonos: dentro de cualquier ventana de cinco
# reemplazos consecutivos todos se distinguen (>=40 de distancia RGB por par) y
# todos sostienen el texto blanco en negrita (contraste WCAG >=3.0, el umbral
# de texto grande). Repetir esta permitido recien al agotar el ciclo — R6
# vuelve al color de R1, a cinco bloques de distancia.
#
# Los cinco: el azul acero historico del reemplazo, y cuatro companeros de la
# misma saturacion media —naranja quemado, verde jade, purpura y vino— todos
# medidos contra el blanco y entre si (test-carga-aulas-libro-color-eslabon.R
# los verifica computacionalmente, no por hex pineado).
AULAS_LIBRO_PALETA_ESLABON <- c(
  "#1D4F8C", # R1 azul acero (el reemplazo de siempre)
  "#B3541E", # R2 naranja quemado
  "#1F7A55", # R3 verde jade
  "#6B4FA3", # R4 purpura
  "#9C1F45"  # R5 vino
)

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
#' El titular conserva el navy del resto del libro; los reemplazos toman la
#' paleta ciclica de cinco (`AULAS_LIBRO_PALETA_ESLABON`, B18): R1..R5 tonos
#' distintos, R6 repite el de R1. Ya no se degrada hacia blanco por
#' profundidad: esa escala producia tonos «unicos» que el ojo leia como uno
#' solo y una cola sin contraste.
#'
#' @param n cuantos bloques hay, titular incluido.
#' @return vector de colores; el primero es el titular.
#' @export
aulas_libro_colores_eslabon <- function(n = 1L) {
  n <- max(1L, suppressWarnings(as.integer(n)))
  if (!is.finite(n)) n <- 1L
  if (n == 1L) return("#002457")
  ciclo <- length(AULAS_LIBRO_PALETA_ESLABON)
  reemplazos <- vapply(seq_len(n - 1L), function(k) {
    AULAS_LIBRO_PALETA_ESLABON[[((k - 1L) %% ciclo) + 1L]]
  }, character(1))
  c("#002457", reemplazos)
}

# Dictado del dueño (2026-08-31): «la forma de contacto solo debería ser o por
# teléfono o por correo». Antes ofrecia lo observado en 2025 —Llamada (123),
# Correo Electronico (33), Presencial— pero el vocabulario del desplegable lo
# fija quien dirige el operativo, no la frecuencia historica. Los valores
# viejos ya escritos en libros existentes se siguen LEYENDO igual: ningun
# lector valida `contact_medium` contra esta lista (el campo viaja como texto
# libre en `carga_aulas_agendadas.R` y `monitoreo_aulas_universitarias.R`), y
# el «-» observado sigue fuera por lo mismo de siempre: es «todavia nada
# aqui», no un valor. Esta constante es la UNICA lista: la consumen el xlsx
# (hoja «Listas») y los desplegables del Sheets publicado.
AULAS_LIBRO_MEDIO_CONTACTO <- c("Teléfono", "Correo")

AULAS_LIBRO_DIA <- c("LUN", "MAR", "MIE", "JUE", "VIE", "SAB")

AULAS_LIBRO_STATUS_APLICACION <- c("APLICADA", "NO APLICADA")

# B22: el desplegable de «RECIBIÓ CORREO» — exactamente Sí y No, con el «No»
# como default sembrado en reemplazos y extras (dictado 2026-09-01). UNA lista
# para las dos capas, como el resto de vocabularios de este archivo: la
# consumen la hoja «Listas» del xlsx y los ONE_OF_LIST del Sheets publicado.
AULAS_LIBRO_RECIBIO_CORREO <- c("Sí", "No")

# B23: el desplegable de «STATUS DE LLAMADA», en el orden del dictado
# (2026-09-01, con el libro en uso): «Efectiva / Contactar después / No
# contesta / Apagado / Colgó / Rechazo. Ah también, una opción de Contactado
# por WhatsApp». Es el resultado de CADA llamada — otro eje que STATUS
# MUESTRA — y se siembra VACIO: lo teclea el equipo. UNA lista para xlsx y
# Sheets, como sus hermanas.
AULAS_LIBRO_STATUS_LLAMADA <- c(
  "Efectiva", "Contactar después", "No contesta", "Apagado", "Colgó",
  "Rechazo", "Contactado por WhatsApp"
)

# El desplegable NO absoluto de «MOMENTO DE LA CLASE» (B15, dictado 2026-09-01):
# tres momentos tecleables y texto libre permitido — el docente puede responder
# «a las 9:30, tras el control de lectura» y eso sigue siendo un dato valido.
# En el xlsx la validacion ya es allowBlank + sin error duro (el patron de todo
# el libro) y en Sheets viaja como ONE_OF_LIST strict = FALSE. UNA lista para
# las dos capas, como el resto de vocabularios de este archivo.
AULAS_LIBRO_MOMENTO_CLASE <- c(
  "Al inicio de la clase", "En el receso", "Al final de la clase"
)

#' Las opciones de `STATUS MUESTRA` para una profundidad de cadena dada.
#'
#' B13b: los cinco tecleables a CUALQUIER profundidad. `EN RESERVA k` salió del
#' desplegable —la posición en cadena ya la dice el código R n.k— así que la
#' lista no depende de cuántos eslabones tenga el estudio. El parámetro se
#' conserva por contrato de llamada (el generador y el Sheets pasan la
#' profundidad real) y por si un vocabulario futuro vuelve a necesitarla.
#'
#' @param profundidad eslabones de la cadena mas larga del plan (hoy no cambia
#'   la lista).
#' @export
aulas_libro_status_muestra <- function(profundidad = 1L) {
  AULAS_LIBRO_STATUS_MUESTRA_BASE
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
  # B30: el lugar CONFIRMADO «se llena manual» (dictado 2026-09-02) y no tiene
  # desplegable, asi que el tinte gris de columna-de-la-app seria su UNICA
  # señal — y diria justo lo contrario. La celda queda blanca: «escribe aqui».
  "scheduled_venue",
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
    # **Bordes en toda la tabla, cabecera y datos.**
    #
    # Gonzalo, mirando el libro al lado del Sheets que el equipo usa: «todas las
    # tres primeras hojas deberia tener bordes negros sus tablas». Sin ellos una
    # rejilla de 241 columnas se lee como una nube de valores: el ojo no tiene
    # donde apoyarse para seguir una fila hasta el final, que es exactamente lo
    # que hace quien agenda.
    #
    # Van con `stack = TRUE` para no pisar el color de banda de cada bloque ni
    # el semaforo de estados, que se aplican despues. El gris muy oscuro y no
    # negro puro: a 241 columnas el negro satura la hoja.
    if (n_col > 0 && filas_datos[[hoja]] > 0) {
      openxlsx::addStyle(
        wb, hoja,
        openxlsx::createStyle(border = "TopBottomLeftRight", borderColour = "#3C4149"),
        rows = seq_len(filas_datos[[hoja]]), cols = seq_len(n_col),
        gridExpand = TRUE, stack = TRUE
      )
    }
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
    # **Se repite la fila de TITULOS, no la banda de grupo.**
    #
    # Repitiendo las dos, las columnas repetidas arrastraban tambien la banda
    # del PRIMER tramo, asi que una pagina con columnas de «CONTROL - CUENTA»
    # salia rotulada «INFORMACIÓN DEL CURSO». Estaba declarado como limitacion
    # y no lo es: basta con no repetir esa fila. La banda aparece en la primera
    # pagina de su tramo, que es donde significa algo, y en las demas no hay
    # rotulo — mejor sin rotulo que con uno que miente.
    openxlsx::pageSetup(wb, hoja, orientation = "landscape", fitToWidth = FALSE,
                        printTitleRows = n_cab,
                        printTitleCols = seq_len(repetidas))
  }

  # Lo que trae la app va teñido; lo que llena la persona queda en blanco. Es
  # la unica pista de donde se escribe, y hasta ahora las veinte columnas del
  # bloque salian identicas.
  # La escala se calcula UNA vez y la comparten la banda de la cabecera y el
  # tinte de los datos: si cada una tuviera la suya, el bloque 3 podria salir de
  # un color arriba y de otro abajo.
  # Sobre el ESLABON mas alto, no sobre cuantas entradas hay: dos hojas con tres
  # bloques cada una dan seis entradas y la escala salia de seis pasos, con los
  # tonos mas juntos de lo necesario. Lo que decide cuantos colores hacen falta
  # es la profundidad de la cadena.
  eslabon_max <- if (length(tintes)) {
    con_eslabon <- Filter(function(t) is.null(t$tono), tintes)
    if (length(con_eslabon)) {
      max(vapply(con_eslabon, function(t) as.integer(t$eslabon %||% 1L), integer(1)))
    } else 1L
  } else 1L
  tonos <- aulas_libro_colores_eslabon(max(eslabon_max, length(agrupados) + 1L))

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
    # `tono` explicito para los grupos que NO son eslabones de una cadena: los
    # cuatro tramos de la «Base de control» son areas tematicas —curso, campo,
    # cuenta, cuotas— y meterlos en la escala de eslabones cambiaria los colores
    # del titular y sus reemplazos, que es una jerarquia distinta.
    tono <- tb$tono %||% tonos[[min(tb$eslabon, length(tonos))]]
    # **La banda de esta hoja tambien lleva el color de su eslabon.** En «Aulas
    # Aplicadas (Campo)» los tres bloques salian con el mismo navy: la banda
    # decia «TITULAR» y «REEMPLAZO 1», pero el color no distinguia, y el color
    # es lo que se ve al desplazarse. Se pinta aqui porque el bucle de
    # `agrupados` solo cubre la agenda.
    if (isTRUE(tb$pinta_banda)) {
      banda_bloque <- openxlsx::createStyle(
        textDecoration = "bold", fgFill = tono, fontColour = "#FFFFFF",
        halign = "left", valign = "center", wrapText = TRUE,
        border = "TopBottomLeftRight", borderColour = "#FFFFFF"
      )
      openxlsx::addStyle(wb, tb$hoja, banda_bloque, rows = 1L, cols = tb$cols,
                         gridExpand = TRUE, stack = FALSE)
    }
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
    # `ID MATCH` es de la app tambien —es el correlativo con el que se enlazan
    # las filas— y salia en blanco, que en esta hoja significa «escribe aqui».
    # Va con el mismo gris que el resto de lo que no se toca.
    cols <- unique(c(1L, cols))
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
  #
  # B13b: «EN CONTACTO» y «RECHAZO» entran al semaforo con los cinco
  # tecleables. EN CONTACTO en ambar claro —gestion en curso, espera accion,
  # distinto del verde de lo pactado—; RECHAZO en el rojo suave que ya usa el
  # descuadre del parte: terminal, y no es un logro. «EN RESERVA» y
  # «REEMPLAZADA» se QUEDAN aunque el desplegable ya no las ofrezca: los libros
  # vivos v3 las traen escritas y la regla es `contains` sobre la celda, no
  # sobre la lista de hoy (mismo criterio que «Llamada» en la paleta de medio).
  semaforo <- list(
    list(texto = "AGENDADA", estilo = openxlsx::createStyle(bgFill = "#E3F3E8", fontColour = "#155E2E")),
    list(texto = "REAGENDADA", estilo = openxlsx::createStyle(bgFill = "#E3F3E8", fontColour = "#155E2E")),
    list(texto = "APLICADA", estilo = openxlsx::createStyle(bgFill = "#E3F3E8", fontColour = "#155E2E")),
    list(texto = "EN CONTACTO", estilo = openxlsx::createStyle(bgFill = "#FDF3D8", fontColour = "#7A5B12")),
    list(texto = "RECHAZO", estilo = openxlsx::createStyle(bgFill = "#FDE7E7", fontColour = "#8A1C1C")),
    list(texto = "EN RESERVA", estilo = openxlsx::createStyle(bgFill = "#E7EEF9", fontColour = "#1B4B8F")),
    list(texto = "REEMPLAZADA", estilo = openxlsx::createStyle(bgFill = "#EEF0F3", fontColour = "#5B6472")),
    list(texto = "NO APLICADA", estilo = openxlsx::createStyle(bgFill = "#FBEDE3", fontColour = "#8A4B1B"))
  )
  # **El medio de contacto: dos vías que se reparten distinto.**
  #
  # Una llamada se hace en el momento y un correo espera respuesta, así que
  # quien reparte el día necesita separarlas de un vistazo. Los tonos salen de
  # la misma familia que el semáforo —fondo claro, texto del mismo tono— para
  # que la hoja no acabe con dos lenguajes de color.
  # «Teléfono» lleva el tono que llevaba «Llamada» —es la misma via con el
  # nombre que dicto el dueño— y las dos reglas viejas se QUEDAN: los libros de
  # 2025 traen «Llamada» y «Presencial» escritos, y la regla es `contains`
  # sobre lo que hay en la celda, no sobre lo que ofrece el desplegable de hoy.
  paleta_medio <- list(
    list(texto = "Teléfono", estilo = openxlsx::createStyle(bgFill = "#FBEDE3", fontColour = "#8A4B1B")),
    list(texto = "Llamada", estilo = openxlsx::createStyle(bgFill = "#FBEDE3", fontColour = "#8A4B1B")),
    list(texto = "Correo", estilo = openxlsx::createStyle(bgFill = "#E7EEF9", fontColour = "#1B4B8F")),
    list(texto = "Presencial", estilo = openxlsx::createStyle(bgFill = "#EFEAF6", fontColour = "#553C86"))
  )

  # **El día: seis colores porque la columna se lee en vertical.**
  #
  # El agendador no lee un día, lee la COLUMNA entera buscando cuántas caen el
  # martes. Con un solo tono para todos hay que ir palabra por palabra. La lista
  # del desplegable es de tres letras (`AULAS_LIBRO_DIA`), y la regla es
  # `contains`, así que casa igual si alguien escribe «Martes» a mano.
  paleta_dia <- list(
    list(texto = "LUN", estilo = openxlsx::createStyle(bgFill = "#E7EEF9", fontColour = "#1B4B8F")),
    list(texto = "MAR", estilo = openxlsx::createStyle(bgFill = "#FBEDE3", fontColour = "#8A4B1B")),
    list(texto = "MIE", estilo = openxlsx::createStyle(bgFill = "#E3F3E8", fontColour = "#155E2E")),
    list(texto = "JUE", estilo = openxlsx::createStyle(bgFill = "#FDF3D8", fontColour = "#7A5B12")),
    list(texto = "VIE", estilo = openxlsx::createStyle(bgFill = "#EFEAF6", fontColour = "#553C86")),
    list(texto = "SAB", estilo = openxlsx::createStyle(bgFill = "#EEF0F3", fontColour = "#5B6472"))
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

  # **Cada columna con su paleta, no una sola para todas.**
  #
  # Antes se teñían sólo las de ESTADO, y con razón: colgar el semáforo de las
  # validaciones pintaba también «MEDIO DE CONTACTO» y «DÍA» con reglas que
  # ninguna de sus celdas casa. No rompía nada, pero dejaba reglas donde no
  # significan, y sobre todo dejaba esas dos columnas en blanco.
  #
  # Gonzalo, comparando con el Sheets que el equipo usa de verdad: «chips
  # desplegables para los status y días de la semana». En su hoja el medio de
  # contacto y el día TAMBIÉN van con color, y son justo las dos columnas que
  # el agendador recorre a ojo para repartir su día.
  #
  # Cada entrada de `semaforos` puede traer sus propias `reglas`; sin ellas cae
  # al semáforo de estados, que es lo que hacían todas hasta ahora.
  for (sem in semaforos) {
    if (!length(sem$cols) || !sem$filas) next
    reglas <- switch(sem$paleta %||% "estado",
                     medio = paleta_medio, dia = paleta_dia, semaforo)
    for (col in sem$cols) {
      for (regla in reglas) {
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
