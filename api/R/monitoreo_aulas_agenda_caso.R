# monitoreo_aulas_agenda_caso.R — una reserva que entra sin rechazo se declara B o C.
#
# Gonzalo, 2026-10-10: «siempre debería declarar que si se usa una reserva por
# motivos de no rechazo entonces o es un adicional situación B o es un refuerzo
# situación C; no debería inferirse».
#
# Hasta hoy `/aulas/agenda` aceptaba la reserva y después la sellaba sola como
# `adicional_inferido`, sin letra. Entre B (completar un curso-horario) y C
# (reforzar la facultad) sólo decide quien la eligió, así que la app no tiene
# de dónde sacar la letra: la pide en el mismo momento en que alguien la decide.
# Sin ella, el agendamiento no entra.
#
# A (reemplazo: el titular no concretó) sigue sin declararse: es un hecho del
# plan y `.marf_procedencia()` lo reconoce solo.

#' Traduce la letra del caso al vocabulario que el motor ya guarda.
#' @keywords internal
.maac_caso_origen <- function(x) {
  v <- tolower(trimws(.monitoreo_scalar(x, "")))
  switch(v, b = "complemento", c = "refuerzo", v)
}

#' Normaliza las declaraciones B/C que llegan en un pedido de agenda.
#'
#' @param updates filas del pedido (lista o data.frame).
#' @return las mismas filas con `activation_origin` en `complemento`/`refuerzo`
#'   cuando llegó como letra.
#' @keywords internal
.monitoreo_aulas_agenda_normalizar_caso <- function(updates) {
  if (is.data.frame(updates)) {
    if ("activation_origin" %in% names(updates)) {
      updates$activation_origin <- vapply(updates$activation_origin, .maac_caso_origen, character(1))
    }
    return(updates)
  }
  if (!is.list(updates)) return(updates)
  lapply(updates, function(u) {
    if (is.list(u) && !is.null(u$activation_origin)) u$activation_origin <- .maac_caso_origen(u$activation_origin)
    u
  })
}

#' Exige B o C a toda reserva que el pedido deja en juego sin rechazo de su titular.
#'
#' Sólo mira las filas que el pedido toca: lo que ya estaba en el plan no se
#' bloquea por un agendamiento ajeno. A las declaradas les estampa
#' `activated_at` si no lo traen, para que conste cuándo se decidió.
#'
#' @param plan plan ya actualizado por `monitoreo_aulas_update_agenda()`.
#' @param updates el pedido tal como llegó.
#' @param ahora sello de tiempo; por defecto el del sistema.
#' @param hoy fecha de referencia para decidir qué está en juego.
#' @return el plan, con el sello de tiempo de las declaradas.
#' @keywords internal
.monitoreo_aulas_agenda_exigir_caso <- function(plan, updates, ahora = NULL, hoy = Sys.Date()) {
  filas <- plan %||% list()
  upd <- if (is.data.frame(updates)) {
    lapply(seq_len(nrow(updates)), function(i) as.list(updates[i, , drop = FALSE]))
  } else updates %||% list()
  tocados <- unique(unlist(lapply(upd, function(u) {
    if (!is.list(u)) return(character(0))
    v <- vapply(c("operational_code", "classroom_id", "collection_unit_id"),
                function(k) .monitoreo_scalar(u[[k]], ""), character(1))
    v[nzchar(v)]
  })))
  if (!length(filas) || !length(tocados)) return(filas)
  df <- .marf_marco(filas, NULL, list())
  if (is.null(df) || !nrow(df)) return(filas)
  e <- .marf_estados(df, hoy)
  claves <- function(k) c(df$operational_code[k], df$classroom_id[k],
                          if ("collection_unit_id" %in% names(df)) df$collection_unit_id[k])
  sin_caso <- character(0)
  declaradas <- integer(0)
  for (i in which((e$aplicada | e$agendada) & df$sample_role != "titular")) {
    if (!any(claves(i) %in% tocados)) next
    pr <- .marf_procedencia(df, e, i)
    if (identical(pr$fuente, "declarada")) {
      declaradas <- c(declaradas, i)
    } else if (identical(pr$clase, "adicional")) {
      sin_caso <- c(sin_caso, df$operational_code[i])
    }
  }
  if (length(sin_caso)) {
    stop_api(
      422, "E_AULAS_RESERVA_SIN_CASO",
      sprintf(paste(
        "%s entra sin que su titular haya caído: declara si es B (complemento:",
        "completa un curso-horario) o C (refuerzo de la facultad) en activation_origin."),
        paste(sin_caso, collapse = ", "))
    )
  }
  ahora <- .monitoreo_scalar(ahora, format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"))
  for (i in declaradas) {
    for (k in seq_along(filas)) {
      cod <- .monitoreo_scalar(filas[[k]]$operational_code, "")
      aula <- .monitoreo_scalar(filas[[k]]$classroom_id, "")
      if (!(nzchar(cod) && identical(cod, df$operational_code[i])) &&
          !(nzchar(aula) && identical(aula, df$classroom_id[i]))) next
      if (!nzchar(.monitoreo_scalar(filas[[k]]$activated_at, ""))) filas[[k]]$activated_at <- ahora
      break
    }
  }
  filas
}
