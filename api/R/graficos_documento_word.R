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

# --- ADR 0094: el proyecto guarda decisiones, no defaults -------------------------------------------------------------

#' Claves de `documento_word` con default fijo en el proyecto
#'
#' Sólo `portada` y `apertura`: `como_leer` ausente es «auto» (lo decide el informe) y `redondeo` lo deduce siempre
#' `reporte_word_plan` del informe, así que un «estandar» elegido no es el default sino una decisión. `contacto` y
#' `meta_portada` no tienen valores de fábrica en el proyecto: lo que traigan es del analista.
#' @keywords internal
.graficos_documento_word_default_fijo <- function() .DOCUMENTO_WORD_DEFAULTS[c("portada", "apertura")]

#' Defaults de `documento_word` que el GET de la config publica para «Modificado» (decisión 5a)
#'
#' `como_leer = "auto"` es el valor que equivale a ausente; `redondeo` no va porque no tiene default fijo (se deduce del
#' informe).
#' @keywords internal
.graficos_documento_word_defaults_publicos <- function() {
  c(.graficos_documento_word_default_fijo(), list(como_leer = "auto"))
}

.dw_txt <- function(v) { v <- as.character(unlist(v) %||% "")[1]; if (is.na(v)) "" else trimws(v) }

#' Quita de `documento_word` lo que coincide con su default (al guardar y al leer)
#'
#' Sin validar: lo inválido lo descarta el lector (`.graficos_documento_word_validos`). Fuera `portada`/`apertura`
#' iguales al default, `como_leer` «auto», textos vacíos y contenedores vacíos; lo demás —incluidas las claves que esta
#' versión no conoce— se conserva.
#' @param x `documento_word` tal como viene.
#' @return Lista con sólo decisiones; `list()` si no queda ninguna.
#' @keywords internal
.graficos_documento_word_solo_decisiones <- function(x) {
  x <- .as_json_list(x)
  if (!is.list(x) || !length(x) || is.null(names(x))) return(list())
  fijo <- .graficos_documento_word_default_fijo()
  out <- list()
  for (k in names(x)) {
    v <- x[[k]]
    if (is.null(v) || (is.list(v) && !length(v))) next
    if (k %in% names(fijo) && identical(.dw_txt(v), fijo[[k]])) next
    if (identical(k, "como_leer") && !is.logical(unlist(v)) && identical(tolower(.dw_txt(v)), "auto")) next
    if (.graficos_is_obj(v)) {
      v <- v[!vapply(v, function(e) is.null(e) || (is.character(e) && length(e) == 1L && !nzchar(trimws(e))), logical(1))]
      if (!length(v)) next
    } else if (is.character(v) && length(v) == 1L && !nzchar(trimws(v))) {
      next
    }
    out[[k]] <- v
  }
  out
}

#' Lector tolerante de lo persistido: descarta con aviso lo que no es válido
#'
#' Un `documento_word` guardado con un valor fuera de lo admitido (`portada: "D"` de otra versión, un `.pulso` editado a
#' mano) no puede romper el GET ni el export: esa clave se descarta con aviso y el resto se conserva. El 400 queda para el
#' body del export (`.graficos_opciones_documento`).
#' @keywords internal
.graficos_documento_word_validos <- function(x) {
  x <- .as_json_list(x)
  if (!is.list(x) || !length(x) || is.null(names(x))) return(list())
  for (k in intersect(names(x), c(names(.DOCUMENTO_WORD_ENUMS), "como_leer"))) {
    ok <- tryCatch({ .graficos_opciones_documento(x[k]); TRUE }, api_error = function(e) {
      warning(sprintf("Se descartó la opción guardada del documento Word «%s»: %s", k, conditionMessage(e)), call. = FALSE)
      FALSE
    })
    if (!ok) x[[k]] <- NULL
  }
  x
}

#' Opciones del documento para el worker: lo guardado (tolerante) con el body encima, por clave
#'
#' Precedencia (contrato A6 §1): `.DOCUMENTO_WORD_DEFAULTS` (en `.word_documento`) → `cfg$documento_word` → body
#' `opciones_documento`. Una clave presente en el body manda sobre la guardada —también para volverla al default
#' (`como_leer: "auto"`, un texto vacío)—; las que el body no trae siguen las guardadas. El body se valida estricto.
#' @param persistido `cfg$documento_word`.
#' @param body `opciones_documento` del body (o `NULL`).
#' @return Lista para `opciones_documento` de `reporte_word_plan` (más `fuente`).
#' @keywords internal
.graficos_documento_word_mezclar <- function(persistido, body = NULL) {
  out <- .graficos_opciones_documento(.graficos_documento_word_validos(persistido))
  body <- .as_json_list(body)
  if (!is.list(body) || !length(body) || is.null(names(body))) return(out)
  b <- .graficos_opciones_documento(body)
  for (k in names(body)) if (!is.null(body[[k]])) out[[k]] <- b[[k]]
  out
}
