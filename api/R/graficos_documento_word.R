# Opciones del documento Word del recetario (F6.0b.4; dirección F6 §8.4; inventario F6, parte A, A3).
#
# El job de Word llamaba a `reporte_word_plan` sin opciones: portada A, apertura B, «Cómo leer» automático, contacto y
# datos de portada de fábrica, siempre. Gonzalo: «Debe hacer todo lo que el recetario dice que hace». Aquí se valida lo
# que manda el editor (en el body o guardado en `config$documento_word`) y se entrega en la forma que espera
# `.word_documento()`.

#' Opciones válidas del documento y sus valores admitidos
#' @keywords internal
.DOCUMENTO_WORD_ENUMS <- list(portada = c("A", "B", "C"), apertura = c("B", "A"),
                              redondeo = c("estandar", "resto_mayor", "ambos"))

#' Normaliza las opciones del documento que manda el editor
#'
#' @param x Lista (del JSON del editor) con `portada`, `apertura`, `como_leer` (`"auto"`, `TRUE` o `FALSE`), `redondeo`,
#'   `titulo_corto`, `fuente`, `contacto` (`correo`, `direccion`, `web`) y `meta_portada` (`ante`, `sub`, `para`, `por`,
#'   `fecha`, `version`).
#' @return Lista para `opciones_documento` de `reporte_word_plan` (más `fuente`), sin las claves que no vinieron: lo que
#'   falta usa el valor por defecto del recetario. Un valor fuera de lo admitido es un error 400 con `E_BAD_DOCUMENTO_WORD`.
#' @keywords internal
.graficos_opciones_documento <- function(x) {
  x <- .as_json_list(x) %||% list()
  if (!is.list(x) || !length(x)) return(list())
  txt <- function(v) { v <- as.character(unlist(v) %||% "")[1]; if (is.na(v)) "" else trimws(v) }
  out <- list()
  for (k in names(.DOCUMENTO_WORD_ENUMS)) {
    if (is.null(x[[k]])) next
    v <- txt(x[[k]])
    if (!nzchar(v)) next
    if (!v %in% .DOCUMENTO_WORD_ENUMS[[k]]) {
      stop_api(400, "E_BAD_DOCUMENTO_WORD", sprintf("«%s» debe ser %s; llegó «%s».", k, paste(.DOCUMENTO_WORD_ENUMS[[k]], collapse = ", "), v))
    }
    out[[k]] <- v
  }
  if (!is.null(x$como_leer)) {
    v <- unlist(x$como_leer)[1]
    if (is.logical(v) && !is.na(v)) out$como_leer <- v
    else if (!identical(tolower(txt(v)), "auto")) stop_api(400, "E_BAD_DOCUMENTO_WORD", "«como_leer» debe ser auto, true o false.")
  }
  for (k in c("titulo_corto", "fuente")) if (nzchar(txt(x[[k]]))) out[[k]] <- txt(x[[k]])
  sub_lista <- function(l, claves) {
    l <- .as_json_list(l) %||% list()
    r <- lapply(claves, function(k) txt(l[[k]])); names(r) <- claves
    r[nzchar(unlist(r))]
  }
  contacto <- sub_lista(x$contacto, c("correo", "direccion", "web"))
  if (length(contacto)) out$contacto <- contacto
  meta <- sub_lista(x$meta_portada, c("ante", "sub", "para", "por", "fecha", "version"))
  if (length(meta)) out$meta_portada <- meta
  out
}

#' Campos de la config que el autosave del editor todavía no transporta y que no debe borrar
#'
#' El autosave manda el estado completo del editor y el backend lo guarda tal cual; `documento_word` (opciones del
#' documento Word, F6.0b.4) aún no viaja desde el frontend, así que cada autosave lo borraba (plan de integración F6,
#' contrato K3). Si la config entrante no lo trae, se conserva el de la config guardada.
#' @keywords internal
.graficos_conservar_campos_backend <- function(cfg, previa) {
  if (is.null(cfg[["documento_word"]]) && is.list(previa) && !is.null(previa[["documento_word"]])) {
    cfg[["documento_word"]] <- previa[["documento_word"]]
  }
  cfg
}
