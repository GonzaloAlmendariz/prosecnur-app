# =============================================================================
# reporte_word_rotulo.R — forma del rótulo de figuras y tablas del Word (R1, Renzo Segura / Arte, 2026-10-27)
# =============================================================================
#
# Estándar de la casa («al igual que en Derecho»): «Gráfico N° 49: título» y «Tabla N° 2: título», con TODO el rótulo en
# cursiva y la negrita, el color y el centrado de siempre. El número sigue siendo el campo SEQ cuyo identificador es la
# etiqueta («Gráfico», «Tabla»): el índice de gráficos (TOC \c "Gráfico") lo sigue llenando Word. La cursiva vive en el
# estilo de carácter «Número de rótulo» (reporte_word_identidad.R), que llevan todos los runs del rótulo, así la
# posedición se hace desde Inicio > Estilos.
#
# Prefijo y cursiva son parámetros de la identidad del Word. Un cliente vuelve al formato anterior desde su estilo
# (`estilo_cliente.rotulo_figura = {prefijo: "Gráfico ", prefijo_tabla: "Tabla ", cursiva: false}`): el worker del Word lo
# pone en `options(prosecnur.word_rotulo = )` (graficos_estilo_cliente_worker.R) y lo repone al salir.

#' Rótulo del Word por defecto (R1)
#' @keywords internal
.WORD_ROTULO_DEFAULT <- list(prefijo = "Gráfico N° ", prefijo_tabla = "Tabla N° ", cursiva = TRUE)

#' Largo máximo de un prefijo de rótulo declarado por el cliente
#' @keywords internal
.WORD_ROTULO_PREFIJO_MAX <- 40L

#' Rótulo vigente: el default con lo que el estilo del cliente declare encima (lo inválido se ignora)
#' @return `list(prefijo, prefijo_tabla, cursiva)`.
#' @keywords internal
.word_rotulo_conf <- function() {
  conf <- .WORD_ROTULO_DEFAULT
  o <- getOption("prosecnur.word_rotulo")
  if (!is.list(o)) return(conf)
  for (k in c("prefijo", "prefijo_tabla")) {
    v <- o[[k]]
    if (is.character(v) && length(v) == 1L && !is.na(v) && nzchar(trimws(v))) conf[[k]] <- v
  }
  cur <- o$cursiva
  if (is.logical(cur) && length(cur) == 1L && !is.na(cur)) conf$cursiva <- cur
  conf
}

#' Texto que va antes del número (campo SEQ) en el rótulo de una etiqueta
#' @param etiqueta Identificador del SEQ: «Gráfico» o «Tabla»; otro, «<etiqueta> ».
#' @keywords internal
.word_rotulo_prefijo <- function(etiqueta) {
  conf <- .word_rotulo_conf()
  if (identical(etiqueta, "Gráfico")) conf$prefijo else if (identical(etiqueta, "Tabla")) conf$prefijo_tabla else paste0(etiqueta, " ")
}

#' Valida `estilo_cliente.rotulo_figura` (estricto: 400 `E_BAD_ESTILO_CLIENTE` vía `.ec_bad`)
#' @keywords internal
.word_rotulo_validar_estilo <- function(x) {
  if (is.null(x)) return(invisible(NULL))
  r <- .as_json_list(x)
  if (!.graficos_is_obj(r)) .ec_bad("«estilo_cliente.rotulo_figura» debe ser un objeto.")
  fuera <- setdiff(names(r), names(.WORD_ROTULO_DEFAULT))
  if (length(fuera)) .ec_bad("Clave desconocida en «rotulo_figura»: ", paste(fuera, collapse = ", "), ".")
  for (k in c("prefijo", "prefijo_tabla")) {
    v <- r[[k]]
    if (is.null(v)) next
    v <- unlist(v)
    if (!is.character(v) || length(v) != 1L || is.na(v) || !nzchar(trimws(v)) || nchar(v) > .WORD_ROTULO_PREFIJO_MAX) {
      .ec_bad(sprintf("«rotulo_figura.%s» debe ser un texto de 1 a %d caracteres.", k, .WORD_ROTULO_PREFIJO_MAX))
    }
  }
  if (!is.null(r$cursiva)) {
    v <- unlist(r$cursiva)
    if (!is.logical(v) || length(v) != 1L || is.na(v)) .ec_bad("«rotulo_figura.cursiva» debe ser true o false.")
  }
  invisible(NULL)
}

#' Lo que el worker del Word aplica de `estilo_cliente.rotulo_figura` (`list()` si nada difiere del default)
#' @keywords internal
.word_rotulo_resolver <- function(x) {
  r <- .as_json_list(x)
  if (!.graficos_is_obj(r) || !length(r)) return(list())
  out <- list()
  for (k in c("prefijo", "prefijo_tabla")) if (!is.null(r[[k]])) out[[k]] <- as.character(unlist(r[[k]]))[1]
  if (!is.null(r$cursiva)) out$cursiva <- isTRUE(as.logical(unlist(r$cursiva))[1])
  out
}
