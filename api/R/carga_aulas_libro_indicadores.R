# La hoja de indicadores del libro: como va el campo, hoy.
#
# Gonzalo la pidio asi: «podria tener una pestaña u hoja con indicadores, pero
# deben ser indicadores UTILES para el campo y para el analista, como la
# produccion, el avance diario, como vamos con la meta».
#
# **Es una hoja que no se llena, como las dos que se retiraron, y la diferencia
# esta en el contenido.** «Resumen» contaba lo que ya se sabia al planificar
# —cuantas aulas hay, como se reparten por facultad—; esto cuenta lo que cambia
# mientras el campo corre. Un numero que no se mueve de un dia para otro no
# tiene sitio aqui.
#
# Los dos lectores tienen preguntas distintas y las dos caben:
#   · el campo quiere saber **a quien empujar** —que aplicador rinde, que aulas
#     siguen sin cerrar, cuantas quedan—;
#   · el analista quiere saber **si se llega** —cuanto falta para la meta y a
#     que ritmo—.
#
# La produccion diaria sale de las RESPUESTAS, no de los partes: la fecha del
# parte dice cuando se aplico el aula, y la de la respuesta cuando entro la
# encuesta. Para «cuanto se produjo el martes» manda la segunda.

.cai_txt <- function(x) {
  v <- x
  if (is.null(v) || !length(v)) return("")
  trimws(as.character(v)[1])
}

.cai_num <- function(x) {
  v <- suppressWarnings(as.numeric(x %||% NA))
  if (!length(v) || !is.finite(v[1])) NA_real_ else v[1]
}

#' Indicadores de campo del libro.
#'
#' @param unidades filas del plan.
#' @param efectivas vector con nombre: efectivas por codigo operativo.
#' @param responses `data.frame` de respuestas, para la serie diaria.
#' @param validas vector logico por fila de `responses`: cuales son efectivas.
#'   Sin el, la serie contaria TODAS las respuestas y no cuadraria con la meta.
#' @param partes partes de campo, para la produccion por aplicador.
#' @return lista con `meta`, `diario` y `aplicadores`.
#' @export
aulas_libro_indicadores <- function(unidades, efectivas = NULL, responses = NULL,
                                    partes = list(), validas = NULL) {
  titulares <- Filter(function(u) identical(.cai_txt(u$sample_role), "titular"), unidades)
  metas <- vapply(titulares, function(u) .cai_num(u$expected_valid), numeric(1))
  meta_total <- sum(metas[is.finite(metas)])
  logrado <- if (is.null(efectivas)) NA_real_ else sum(efectivas, na.rm = TRUE)

  # Cuantas aulas ya llegaron a SU meta, que no es lo mismo que el total: se
  # puede ir al 90 % global con la mitad de las aulas sin cerrar.
  cerradas <- if (is.null(efectivas)) NA_integer_ else sum(vapply(titulares, function(u) {
    m <- .cai_num(u$expected_valid)
    i <- match(.cai_txt(u$operational_code), names(efectivas))
    e <- if (is.na(i)) 0 else efectivas[[i]]
    isTRUE(is.finite(m) && m > 0 && e >= m)
  }, logical(1)))

  meta <- list(
    aulas = length(titulares),
    meta_total = meta_total,
    logrado = logrado,
    # Un 0 de 0 no es 0 %.
    avance = if (is.finite(meta_total) && meta_total > 0 && is.finite(logrado)) {
      logrado / meta_total
    } else NA_real_,
    falta = if (is.finite(meta_total) && is.finite(logrado)) max(0, meta_total - logrado) else NA_real_,
    aulas_cerradas = cerradas
  )

  # **La serie diaria, con acumulado**: una barra por dia dice cuanto se
  # produjo; el acumulado dice si se llega.
  diario <- NULL
  if (is.data.frame(responses) && nrow(responses)) {
    col <- intersect(c("_submission_time", "submission_time", "fecha", "end"),
                     names(responses))
    if (length(col)) {
      dias <- substr(as.character(responses[[col[[1]]]]), 1, 10)
      # **Solo las EFECTIVAS.** Contando todas las respuestas, la serie
      # acumulaba 3 700 mientras el logrado eran 2 220, y la columna «falta
      # para la meta» acababa diciendo 47 cuando faltaban 1 527: dos cifras
      # distintas bajo la misma tabla. La meta se mide en efectivas, asi que la
      # serie tambien.
      if (!is.null(validas) && length(validas) == nrow(responses)) {
        dias <- dias[validas %in% TRUE]
      }
      dias <- dias[nzchar(dias) & !is.na(dias)]
      if (length(dias)) {
        t <- table(dias)
        n <- as.integer(t)
        diario <- data.frame(
          Dia = names(t), Respuestas = n, Acumulado = cumsum(n),
          stringsAsFactors = FALSE
        )
        diario$`Efectivas acumuladas` <- diario$Acumulado
        diario$Acumulado <- NULL
        names(diario)[names(diario) == "Respuestas"] <- "Efectivas del dia"
        diario$`Falta para la meta` <- if (is.finite(meta_total)) {
          pmax(0, meta_total - diario$`Efectivas acumuladas`)
        } else NA_real_
      }
    }
  }

  # **Produccion por aplicador**: el campo pregunta a quien empujar.
  aplicadores <- NULL
  if (length(partes)) {
    quien <- vapply(partes, function(p) .cai_txt(p$applied_by %||% p$applicator), character(1))
    ef <- vapply(partes, function(p) {
      v <- .cai_num(p$effective_surveys); if (is.finite(v)) v else 0
    }, numeric(1))
    ok <- nzchar(quien)
    if (any(ok)) {
      claves <- sort(unique(quien[ok]))
      aplicadores <- data.frame(
        Aplicador = claves,
        Aulas = vapply(claves, function(k) sum(quien == k), integer(1)),
        `Efectivas declaradas` = vapply(claves, function(k) sum(ef[quien == k]), numeric(1)),
        check.names = FALSE, stringsAsFactors = FALSE
      )
      aplicadores$`Media por aula` <- round(
        aplicadores$`Efectivas declaradas` / pmax(1, aplicadores$Aulas), 1
      )
      # Por produccion, no alfabetico: se mira primero quien va mas flojo.
      aplicadores <- aplicadores[order(aplicadores$`Media por aula`), , drop = FALSE]
    }
  }

  list(meta = meta, diario = diario, aplicadores = aplicadores)
}

#' Escribe la hoja de indicadores en el workbook.
#'
#' @param wb workbook abierto.
#' @param ind salida de `aulas_libro_indicadores()`.
#' @param hoja nombre de la hoja.
#' @export
aulas_libro_escribir_indicadores <- function(wb, ind, hoja = "Cómo va el campo") {
  openxlsx::addWorksheet(wb, hoja, gridLines = FALSE)

  titulo <- openxlsx::createStyle(fontSize = 16, textDecoration = "bold",
                                  fontColour = "#002457")
  pie <- openxlsx::createStyle(fontSize = 9, fontColour = "#5B6472")
  seccion <- openxlsx::createStyle(fontSize = 11, textDecoration = "bold",
                                   fontColour = "#002457", border = "bottom",
                                   borderColour = "#C7D0DD")
  etiqueta <- openxlsx::createStyle(fontColour = "#5B6472")
  cifra <- openxlsx::createStyle(textDecoration = "bold", halign = "right",
                                 numFmt = "#,##0.#")
  pct <- openxlsx::createStyle(textDecoration = "bold", halign = "right",
                               numFmt = "0.0%")
  cabecera <- openxlsx::createStyle(textDecoration = "bold", fgFill = "#002457",
                                    fontColour = "#FFFFFF", halign = "left")
  numero <- openxlsx::createStyle(halign = "right", numFmt = "#,##0.#")

  openxlsx::writeData(wb, hoja, "Cómo va el campo", startCol = 1, startRow = 1)
  openxlsx::addStyle(wb, hoja, titulo, rows = 1, cols = 1)
  openxlsx::writeData(wb, hoja, paste("Al", format(Sys.Date(), "%d/%m/%Y")),
                      startCol = 1, startRow = 2)
  openxlsx::addStyle(wb, hoja, pie, rows = 2, cols = 1)

  m <- ind$meta %||% list()
  fila <- 4L
  openxlsx::writeData(wb, hoja, "Cómo vamos con la meta", startCol = 1, startRow = fila)
  openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:2, gridExpand = TRUE)
  fila <- fila + 1L
  # El porcentaje va con su estilo propio: escrito como cifra saldria «0.6».
  filas_meta <- list(
    list("Encuestas de la meta", m$meta_total, cifra),
    list("Efectivas conseguidas", m$logrado, cifra),
    list("Avance", m$avance, pct),
    list("Faltan", m$falta, cifra),
    # Que la suma vaya al 59 % no dice cuantas aulas quedan por cerrar: se puede
    # ir alto con la mitad de las aulas a medias.
    list("Aulas que llegaron a SU meta", m$aulas_cerradas, cifra),
    list("Aulas del operativo", m$aulas, cifra)
  )
  for (f in filas_meta) {
    openxlsx::writeData(wb, hoja, f[[1]], startCol = 1, startRow = fila)
    valor <- f[[2]]
    if (is.null(valor) || !length(valor) || !is.finite(suppressWarnings(as.numeric(valor)))) {
      # Sin respuestas leidas todavia no hay avance que dar, y un 0 diria que
      # se lleva cero.
      openxlsx::writeData(wb, hoja, "—", startCol = 2, startRow = fila)
    } else {
      openxlsx::writeData(wb, hoja, as.numeric(valor), startCol = 2, startRow = fila)
      openxlsx::addStyle(wb, hoja, f[[3]], rows = fila, cols = 2)
    }
    openxlsx::addStyle(wb, hoja, etiqueta, rows = fila, cols = 1)
    fila <- fila + 1L
  }

  if (!is.null(ind$aplicadores) && nrow(ind$aplicadores)) {
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, "Producción por aplicador", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:4, gridExpand = TRUE)
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, ind$aplicadores, startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = 1:4, gridExpand = TRUE)
    n <- nrow(ind$aplicadores)
    openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n), cols = 2:4,
                       gridExpand = TRUE, stack = TRUE)
    # **La barra en un tono CLARO, o tapa el numero.** Con el navy del libro, la
    # cifra quedaba en negro sobre azul oscuro y no se leia: la barra ayuda a
    # comparar de un vistazo, pero el numero es el dato. Visto en el PDF.
    openxlsx::conditionalFormatting(
      wb, hoja, cols = 4, rows = (fila + 1L):(fila + n),
      type = "databar", style = c("#DCE6F2", "#C2D4E8"), gradient = FALSE, border = FALSE
    )
    fila <- fila + n + 2L
  }

  if (!is.null(ind$diario) && nrow(ind$diario)) {
    openxlsx::writeData(wb, hoja, "Avance diario", startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, seccion, rows = fila, cols = 1:4, gridExpand = TRUE)
    fila <- fila + 1L
    openxlsx::writeData(wb, hoja, ind$diario, startCol = 1, startRow = fila)
    openxlsx::addStyle(wb, hoja, cabecera, rows = fila, cols = 1:4, gridExpand = TRUE)
    n <- nrow(ind$diario)
    openxlsx::addStyle(wb, hoja, numero, rows = (fila + 1L):(fila + n), cols = 2:4,
                       gridExpand = TRUE, stack = TRUE)
    openxlsx::conditionalFormatting(
      wb, hoja, cols = 2, rows = (fila + 1L):(fila + n),
      # Mismo motivo que arriba: el numero por encima de la barra.
      type = "databar", style = c("#DCE6F2", "#C2D4E8"), gradient = FALSE, border = FALSE
    )
    fila <- fila + n + 1L
  }

  openxlsx::setColWidths(wb, hoja, cols = 1, widths = 30)
  openxlsx::setColWidths(wb, hoja, cols = 2:4, widths = 20)
  openxlsx::pageSetup(wb, hoja, orientation = "portrait", fitToWidth = TRUE,
                      fitToHeight = FALSE)
  invisible(fila)
}
