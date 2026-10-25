# Un trabajo a la vez por clave (M7 de Meta B, L38): «un sync a la vez».
# =======================================================================
#
# El front apaga «Actualizar» mientras corre un sync, pero dos pestañas o una
# llamada directa a la API lanzaban un segundo job sobre el mismo snapshot de
# Monitoreo. La deduplicación es OPT-IN: sólo el job_submit que pasa
# `dedupe_key` la usa; reportes, PDF y el resto no cambian.
#
# La clave es (sesión, dedupe_key). Si ya hay un job vivo con esa clave,
# job_submit no lanza otro: devuelve el `job_id` del vivo con el atributo
# `ya_en_curso = TRUE` (no 409: el front sigue el progreso del job que ya
# corre). La clave se libera sola:
#   - terminado, fallido o cancelado: el status deja de ser "running";
#   - huérfano (proceso muerto sin poll): se cosecha con job_poll, que aplica
#     su resultado si lo hay, y deja de contar;
#   - colgado (vivo pero más viejo que el tope): se cancela y deja de contar.
# Tope por defecto 30 min; ajustable con
# `options(prosecnurapp.jobs_dedupe_tope_secs = <segundos>)`.

.JOBS_DEDUPE_TOPE_SECS <- 1800

.jobs_dedupe_tope_secs <- function() {
  v <- suppressWarnings(as.numeric(getOption("prosecnurapp.jobs_dedupe_tope_secs", .JOBS_DEDUPE_TOPE_SECS))[1])
  if (length(v) != 1L || is.na(v) || v <= 0) .JOBS_DEDUPE_TOPE_SECS else v
}

.jobs_dedupe_clave_valida <- function(dedupe_key) {
  is.character(dedupe_key) && length(dedupe_key) == 1L && !is.na(dedupe_key) && nzchar(dedupe_key)
}

#' El job vivo de la sesión con esa clave, o NULL; de paso libera huérfanos y colgados
#' @keywords internal
.jobs_dedupe_en_curso <- function(sid, dedupe_key, ahora = Sys.time()) {
  if (!.jobs_dedupe_clave_valida(dedupe_key)) return(NULL)
  tope <- .jobs_dedupe_tope_secs()
  for (id in ls(.jobs)) {
    j <- .jobs[[id]]
    if (!identical(j$sid, sid) || !identical(j$dedupe_key, dedupe_key)) next
    if (!identical(j$status, "running")) next
    vivo <- isTRUE(tryCatch(j$rx$is_alive(), error = function(e) FALSE))
    if (!vivo) {
      # Huérfano: el proceso murió y nadie polleó. Se cosecha (el resultado no se pierde) y la clave queda libre.
      tryCatch(job_poll(id), error = function(e) NULL)
      next
    }
    edad <- as.numeric(difftime(ahora, j$started_at, units = "secs"))
    if (is.finite(edad) && edad > tope) {
      message(sprintf("[jobs] %s (%s) lleva %d s vivo, más que el tope de %d s: se cancela para liberar «%s».",
                      id, as.character(j$kind %||% "?"), as.integer(edad), as.integer(tope), dedupe_key))
      job_cancel(id)
      next
    }
    return(id)
  }
  NULL
}

#' Respuesta de job_submit cuando la clave está ocupada: el id del vivo, marcado, y los insumos del pedido limpiados
#' @keywords internal
.jobs_dedupe_reusar <- function(job_id, sid, kind, on_cleanup = NULL) {
  # Los insumos de ESTE pedido (RDS de fuentes, config y tokens) ya se escribieron y ningún worker los leerá:
  # se limpian con el mismo on_cleanup que el job habría corrido (ADR 0005).
  if (is.function(on_cleanup)) {
    tryCatch(on_cleanup(list(id = NA_character_, sid = sid, kind = kind, status = "deduplicado")),
             error = function(e) message(sprintf("[jobs] on_cleanup del pedido deduplicado falló: %s", conditionMessage(e))))
  }
  message(sprintf("[jobs] kind=%s ya en curso (%s): se reutiliza.", kind, job_id))
  structure(job_id, ya_en_curso = TRUE)
}

#' TRUE si job_submit devolvió un job que ya corría (clave deduplicada)
#' @keywords internal
job_ya_en_curso <- function(job_id) {
  isTRUE(attr(job_id, "ya_en_curso", exact = TRUE))
}

#' El JobStart que devuelve un endpoint que lanza un job: `{ok, job_id, kind, ya_en_curso}`
#' @keywords internal
job_respuesta_inicio <- function(job_id, kind, ...) {
  c(list(ok = TRUE, job_id = as.character(job_id)[1], kind = kind, ya_en_curso = job_ya_en_curso(job_id)), list(...))
}
