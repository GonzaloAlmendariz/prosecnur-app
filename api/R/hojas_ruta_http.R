# Transporte HTTP hacia la capa de manzanas (ArcGIS) usado por Hojas de ruta.
#
# Por que vive aparte de hojas_ruta_engine.R: el engine esta congelado a
# crecimiento (agentic/manifest.json), asi que el transporte nuevo va en archivo
# propio y el engine solo lo llama.
#
# Por que existe: Plumber atiende en un solo hilo. `.hojas_ruta_fetch_json()`
# llamaba a curl_fetch_memory() sin handle, o sea sin `timeout` ni
# `connecttimeout`, contra un servicio de terceros; un socket colgado ahi no
# cuelga solo el preview del mapa, cuelga el backend entero. Mismo patron que
# Kobo, SurveyMonkey, Google y Hugging Face.

# El fetch es paginado (count + paginas), asi que este limite es POR PETICION:
# un recorrido largo puede sumar mas en total, y esta bien — lo que no puede
# es que una sola pagina quede esperando para siempre.
.hojas_ruta_http_timeout_seconds <- function(value = Sys.getenv("PROSECNUR_HOJAS_RUTA_TIMEOUT_SECONDS", unset = ""),
                                             default = 60,
                                             min_seconds = 5,
                                             max_seconds = 300) {
  seconds <- suppressWarnings(as.numeric(value %||% default))
  if (!is.finite(seconds) || seconds <= 0) seconds <- default
  min(max_seconds, max(min_seconds, seconds))
}

.hojas_ruta_http_connect_timeout_seconds <- function(timeout_seconds = .hojas_ruta_http_timeout_seconds(),
                                                     value = Sys.getenv("PROSECNUR_HOJAS_RUTA_CONNECT_TIMEOUT_SECONDS", unset = "")) {
  timeout_seconds <- .hojas_ruta_http_timeout_seconds(timeout_seconds)
  seconds <- suppressWarnings(as.numeric(value %||% min(10, timeout_seconds)))
  if (!is.finite(seconds) || seconds <= 0) seconds <- min(10, timeout_seconds)
  min(timeout_seconds, max(1, seconds))
}

# Constructor unico del handle hacia la capa de manzanas.
.hojas_ruta_http_handle <- function() {
  handle <- curl::new_handle()
  timeout <- .hojas_ruta_http_timeout_seconds()
  curl::handle_setopt(
    handle,
    timeout = timeout,
    connecttimeout = .hojas_ruta_http_connect_timeout_seconds(timeout)
  )
  handle
}
