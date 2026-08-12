# =============================================================================
# reporte_plan_prefijo_grupos.R — numerar los grupos sin saber de qué estudio
# =============================================================================
#
# El control se llamaba «Numerar OE» y anteponía literalmente `OE 1:`, `OE 2:`
# a las etiquetas de los grupos. Un estudio de acreditación en ingeniería numera
# sus objetivos educacionales así; el producto no tiene por qué saberlo. Peor:
# se encendía SOLO, buscando «objetivo educacional» en el título de la lámina.
# Un estudio que hable de dimensiones, ejes o competencias no tenía forma de
# pedir lo mismo, y uno que mencionara la palabra lo recibía sin pedirlo.
#
# La versión generalista tiene dos piezas:
#
#   1. El analista declara el prefijo. `prefijo_grupos = "OE"` da «OE 1: …»;
#      `"Dimensión"` da «Dimensión 1: …»; vacío, nada. Un solo campo: el texto
#      ES el interruptor, porque un bool más un texto son dos controles para
#      una decisión.
#
#   2. Si no lo declara pero las etiquetas YA vienen numeradas —«OE 2: Diseño»,
#      «Eje 3: Docencia»—, se toma ese mismo token y se completa el resto. Eso
#      es generalista de verdad: el criterio sale de los datos, no de un
#      vocabulario que el motor lleva escrito.
#
# Lo que se conserva por compatibilidad, y solo eso, vive en
# `.prefijo_grupos_legado()`.

#' Prefijo declarado por el analista, con el alias del control viejo.
#'
#' @param el Elemento del plan.
#' @return Cadena con el prefijo, `""` si se pidió apagarlo, o `NULL` si el
#'   analista no dijo nada y hay que deducirlo.
#' @keywords internal
.prefijo_grupos_declarado <- function(el) {
  p <- el$prefijo_grupos %||% NULL
  if (!is.null(p)) {
    p <- trimws(as.character(p)[1])
    if (is.na(p)) return("")
    return(p)
  }

  # Alias del control viejo: `numerar_oe = TRUE` era exactamente `"OE"`.
  viejo <- el$numerar_oe %||% NULL
  if (!is.null(viejo)) return(if (isTRUE(viejo)) "OE" else "")

  NULL
}

#' Token de numeración que las etiquetas ya traen puesto.
#'
#' Busca el patrón `<TOKEN> <n>:` al principio de las etiquetas. Exige que al
#' menos una lo tenga y que todas las que lo tengan usen el MISMO token: dos
#' vocabularios mezclados en una lámina no son una numeración a completar, son
#' dos cosas distintas, y unificarlas sería inventar.
#'
#' @param labels Etiquetas de los grupos visibles.
#' @return El token, o `NULL`.
#' @keywords internal
.prefijo_grupos_detectado <- function(labels) {
  labels <- .reporte_plan_clean_chr(labels)
  labels <- labels[nzchar(labels)]
  if (!length(labels)) return(NULL)

  m <- regmatches(labels, regexec(
    "^\\s*([\\p{L}]{1,14})\\s*[0-9]+\\s*[:.\\-]\\s*\\S", labels, perl = TRUE
  ))
  tokens <- vapply(m, function(x) if (length(x) == 2L) x[[2]] else NA_character_, character(1))
  tokens <- tokens[!is.na(tokens)]
  if (!length(tokens)) return(NULL)

  unicos <- unique(toupper(tokens))
  if (length(unicos) != 1L) return(NULL)
  tokens[[1]]
}

#' Retirada la detección por vocabulario.
#'
#' Hubo una rama que encendía la numeración sola si la lámina mencionaba
#' «objetivos educacionales», en su título, sus subtítulos, los nombres de las
#' variables o sus títulos. Se conservó un tiempo porque había entregables vivos
#' que dependían de ella, y emitía `[PULSO-AVISO]` para que se declararan.
#'
#' Ya no existe. Un estudio que quiera numerar sus grupos lo declara con
#' `prefijo_grupos`, y uno que sólo mencione la palabra deja de recibir una
#' numeración que nadie pidió. La detección **por los datos** sigue: si las
#' etiquetas ya vienen numeradas, se completa con su mismo token.
#'
#' @keywords internal
.prefijo_grupos_legado <- function(el, refs = character(0), labels = character(0)) NULL

#' Prefijo que se aplicará a esta lámina.
#'
#' @keywords internal
.prefijo_grupos_efectivo <- function(el, refs = character(0), labels = character(0)) {
  declarado <- .prefijo_grupos_declarado(el)
  if (!is.null(declarado)) return(declarado)

  detectado <- .prefijo_grupos_detectado(labels)
  if (!is.null(detectado)) return(detectado)

  .prefijo_grupos_legado(el, refs = refs, labels = labels) %||% ""
}

#' Antepone «<PREFIJO> <n>: » a cada etiqueta.
#'
#' Las que ya lo traen se normalizan en vez de duplicarse. El número sale de la
#' variable cuando ésta lo lleva en el nombre y no se repite; si no, es la
#' posición.
#'
#' @keywords internal
.prefijo_grupos_aplicar <- function(labels, prefijo, refs = NULL) {
  prefijo <- trimws(as.character(prefijo %||% "")[1])
  if (is.na(prefijo) || !nzchar(prefijo)) return(labels)

  nms <- names(labels)
  labels <- .reporte_plan_clean_chr(labels)
  if (!length(labels)) return(labels)

  ref_nums <- .reporte_plan_oe_numbers_from_refs(refs %||% names(labels) %||% character(0))
  use_ref_nums <- length(ref_nums) == length(labels) &&
    all(!is.na(ref_nums)) &&
    !anyDuplicated(ref_nums)

  ya_puesto <- paste0("^\\s*", .prefijo_grupos_escapar(prefijo), "\\s*([0-9]+)\\s*[:.\\-]\\s*(.*)$")

  out <- labels
  for (i in seq_along(out)) {
    lab <- out[i]
    if (!nzchar(lab)) next
    got <- regmatches(lab, regexec(ya_puesto, lab, ignore.case = TRUE, perl = TRUE))[[1]]
    if (length(got) == 3L) {
      out[i] <- paste0(prefijo, " ", got[2], ": ", trimws(got[3]))
    } else {
      n <- if (use_ref_nums) ref_nums[[i]] else i
      out[i] <- paste0(prefijo, " ", n, ": ", lab)
    }
  }
  if (!is.null(nms) && length(nms) == length(out)) names(out) <- nms
  out
}

#' @keywords internal
.prefijo_grupos_escapar <- function(x) {
  gsub("([.\\\\|()\\[\\]{}^$*+?])", "\\\\\\1", x, perl = TRUE)
}
