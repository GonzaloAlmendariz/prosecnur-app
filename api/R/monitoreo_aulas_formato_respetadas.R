# El formato SÍ llega a las hojas del equipo; los valores no, nunca.
#
# Decisión de Gonzalo (2026-09-12): a «¿el formato debe viajar aunque la hoja
# sea respetada, o se acepta que esas dos hojas no se pinten?» contestó **«mi
# decisión es sí»** — que viaje.
#
# El problema que resuelve: «Aulas Agendadas» y «Aulas Aplicadas (Campo)» las
# llena el equipo, así que el publicador las declara `respetada` y **ni siquiera
# las mete al motor** — es la regla que impide borrarles el trabajo. Efecto
# colateral: el color nuevo y el desplegable nuevo se quedaban dentro de la app.
# El morado de «REFUERZO POR CONTACTAR», puesto el 2026-09-11, nunca llegó a la
# hoja donde se teclea ese estado, que es justo donde sirve.
#
# **La línea que este archivo NO cruza.** Escribir FORMATO sobre una hoja del
# equipo es seguro: cambia cómo se ve, no lo que dice. Escribir VALORES les
# borraría el trabajo, y ése es el accidente que la regla de dueño existe para
# impedir. El «sí» de Gonzalo es al formato; no convierte en buena idea lo otro.
# Por eso no basta con «tener cuidado»: cada request pasa por un filtro que
# sólo deja salir los que declaran tocar formato, y el que no lo declare se
# queda fuera aunque lo haya construido código nuestro.
#
# El filtro mira la MÁSCARA `fields`, no el tipo de request, porque el tipo no
# decide: el propio formateador del libro manda un `updateCells` con
# `fields = "userEnteredFormat(...)"` —formato puro— mientras que ese mismo
# tipo con `userEnteredValue` en la máscara arrasaría la hoja. Lo que distingue
# a uno de otro es la máscara y sólo la máscara.

# Lo que una máscara puede pedir sobre una hoja ajena. Cualquier otra cosa
# —`userEnteredValue` la primera— sale fuera.
.mafr_MASCARAS <- c(
  "userEnteredFormat",      # colores, tipografía, bordes, alineación
  "dataValidation",         # los desplegables
  "gridProperties",         # filas/columnas congeladas
  "pixelSize",              # anchos y altos
  "hiddenByUser"            # mostrar una columna que alguien escondió
)

# Tipos cuyo esquema NO tiene dónde meter un valor, así que no necesitan
# máscara: `setDataValidation` es `{range, rule}`, los bordes son bordes y una
# regla condicional es una regla. Se enumeran uno a uno y con su razón; «me
# suena inofensivo» no entra aquí.
.mafr_SIN_MASCARA <- c(
  "setDataValidation",              # los desplegables — la mitad del encargo
  "updateBorders",                  # bordes
  "addConditionalFormatRule",       # colores por regla
  "updateConditionalFormatRule",
  "deleteConditionalFormatRule",
  "addBanding", "updateBanding", "deleteBanding",
  "autoResizeDimensions"            # ancho al contenido
)

# Los tipos que escriben contenido SIN máscara que los acote: no hay forma de
# limitarlos a formato, así que no se admiten jamás.
.mafr_PROHIBIDOS <- c(
  "appendCells", "appendDimension", "pasteData", "cutPaste", "copyPaste",
  "deleteRange", "insertRange", "deleteDimension", "insertDimension",
  "deleteSheet", "duplicateSheet", "findReplace", "sortRange",
  "autoFill", "moveDimension", "randomizeRange", "trimWhitespace",
  "deleteDuplicates"
)

# Todas las máscaras `fields` que lleva un request, a cualquier profundidad.
.mafr_mascaras <- function(x) {
  if (!is.list(x)) return(character(0))
  out <- character(0)
  nombres <- names(x) %||% rep("", length(x))
  for (i in seq_along(x)) {
    if (identical(nombres[[i]], "fields")) {
      out <- c(out, as.character(x[[i]]))
    } else {
      out <- c(out, .mafr_mascaras(x[[i]]))
    }
  }
  out
}

#' ¿Este request se puede mandar a una hoja que no es nuestra?
#'
#' @param req un request de `batchUpdate`.
#' @return `TRUE` sólo si declara tocar formato y nada más.
#' @keywords internal
.mafr_seguro <- function(req) {
  if (!is.list(req) || !length(req)) return(FALSE)
  tipo <- (names(req) %||% "")[1]
  if (!nzchar(tipo) || tipo %in% .mafr_PROHIBIDOS) return(FALSE)
  mascaras <- .mafr_mascaras(req)
  # **Algunos tipos no llevan máscara porque no la necesitan: su esquema no
  # tiene dónde meter un valor.** `setDataValidation` es `{range, rule}` y
  # nada más — no existe forma de que escriba una celda. Sin esta rama el
  # filtro tiraba los OCHO desplegables de cada hoja, que es justo la mitad de
  # lo que Gonzalo pidió que llegara.
  if (tipo %in% .mafr_SIN_MASCARA) return(TRUE)
  # **Sin máscara no pasa.** Un request que no declara qué toca podría tocarlo
  # todo, y «probablemente sea inofensivo» no es un criterio sobre la hoja
  # donde veintidós personas escriben a diario.
  if (!length(mascaras)) return(FALSE)
  for (m in mascaras) {
    # **Las comas de dentro de un paréntesis no separan campos.** Partir
    # «userEnteredFormat(backgroundColor,textFormat)» por comas da
    # «textFormat)» como si fuera una raíz suya, y el filtro rechazaba en bloque
    # el formato que sí queremos mandar. Se vacían los paréntesis —lo de dentro
    # ya está acotado por su raíz— y se parte lo que queda.
    plano <- m
    repeat {
      nuevo <- gsub("\\([^()]*\\)", "", plano)
      if (identical(nuevo, plano)) break
      plano <- nuevo
    }
    partes <- trimws(strsplit(plano, ",", fixed = TRUE)[[1]])
    partes <- partes[nzchar(partes)]
    if (!length(partes)) return(FALSE)
    for (p in partes) {
      if (!(sub("[.].*$", "", p) %in% .mafr_MASCARAS)) return(FALSE)
    }
  }
  TRUE
}

#' Deja pasar sólo los requests de formato.
#'
#' @param requests lista de requests.
#' @return la lista filtrada, con el atributo `descartados` (cuántos se cayeron).
#' @keywords internal
monitoreo_aulas_formato_seguro <- function(requests) {
  requests <- requests %||% list()
  ok <- vapply(requests, .mafr_seguro, logical(1))
  out <- requests[ok]
  attr(out, "descartados") <- as.integer(sum(!ok))
  out
}

#' Reenvía el formato a las hojas del equipo que la publicación respetó.
#'
#' La geometría sale de lo REMOTO, no de lo que la app produciría: la hoja del
#' equipo tiene las filas que ellos han escrito, y pintar sobre un rectángulo
#' imaginado dejaría bandas a media tabla.
#'
#' @param spreadsheet_id el documento.
#' @param respetadas nombres de las hojas del equipo que no se escribieron.
#' @param remotas sus values, ya leídos por el publicador.
#' @param tab_map nombre de hoja → `sheetId`.
#' @param con_daa si el libro lleva el bloque DAA (misma señal que el motor).
#' @return lista `{hojas, requests, descartados, error}`; `hojas` son las que de
#'   verdad recibieron formato.
#' @keywords internal
monitoreo_aulas_formato_a_respetadas <- function(spreadsheet_id, respetadas,
                                                 remotas = list(), tab_map = list(),
                                                 con_daa = FALSE) {
  vacio <- list(hojas = character(0), requests = 0L, descartados = 0L, error = "")
  respetadas <- as.character(unlist(respetadas %||% character(0), use.names = FALSE))
  if (!length(respetadas)) return(vacio)

  requests <- list()
  tocadas <- character(0)
  descartados <- 0L
  for (hoja in respetadas) {
    # **`tab_map[[hoja]]` NO es el id: es la ficha de la pestaña**, y el id vive
    # en su `sheet_id` (`.monitoreo_sheets_tab_map`). Pasarla entera metía la
    # lista dentro de cada `range` y los requests salían con un sheetId que no
    # puede leer ni Google ni un test — el reenvío parecía funcionar y no
    # tocaba nada.
    sheet_id <- suppressWarnings(as.integer(
      unlist((tab_map[[hoja]] %||% list())[["sheet_id"]])[1]))
    if (!length(sheet_id) || is.na(sheet_id)) next
    filas <- remotas[[hoja]] %||% list()
    if (!length(filas)) next
    brutos <- tryCatch(.malp_formato_requests(sheet_id, hoja, filas, con_daa = con_daa),
                       error = function(e) list())
    filtrados <- monitoreo_aulas_formato_seguro(brutos)
    descartados <- descartados + as.integer(attr(filtrados, "descartados") %||% 0L)
    if (!length(filtrados)) next
    requests <- c(requests, filtrados)
    tocadas <- c(tocadas, hoja)
  }
  if (!length(requests)) {
    return(list(hojas = character(0), requests = 0L, descartados = descartados, error = ""))
  }
  err <- ""
  tryCatch(
    .monitoreo_google_api(
      paste0(.monitoreo_sheets_api_base(spreadsheet_id), ":batchUpdate"),
      method = "POST", body = list(requests = unname(requests))),
    error = function(e) err <<- conditionMessage(e)
  )
  # Un fallo aquí NO tumba la publicación: la hoja del equipo sigue como estaba
  # y lo único que se pierde es el color. Se nombra para que no sea un silencio.
  if (nzchar(err)) {
    return(list(hojas = character(0), requests = length(requests),
                descartados = descartados, error = err))
  }
  list(hojas = tocadas, requests = length(requests),
       descartados = descartados, error = "")
}
