# Transporte HTTP hacia Google (Sheets API + OAuth) usado por Monitoreo.
#
# Por que vive aparte de monitoreo_engine.R: el engine esta congelado a
# crecimiento (agentic/manifest.json), asi que el transporte nuevo va en archivo
# propio y el engine solo lo llama.
#
# Por que existe: Plumber atiende en un solo hilo. Un handle sin `timeout` ni
# `connecttimeout` no cuelga solo la ruta que lo usa — cuelga el backend entero
# (se observo /api/system/health y la apertura del modulo respondiendo 500
# detras de una llamada a Google colgada). Mismo patron que los clientes de
# Kobo (.kobo_api_new_handle) y SurveyMonkey (.sm_api_new_handle).

# Total mas corto que el de Kobo/SurveyMonkey: aca no se descargan bases, son
# llamadas de control (metadata de la hoja, canje y refresh de token).
.monitoreo_google_timeout_seconds <- function(value = Sys.getenv("PROSECNUR_GOOGLE_TIMEOUT_SECONDS", unset = ""),
                                              default = 60,
                                              min_seconds = 5,
                                              max_seconds = 300) {
  seconds <- suppressWarnings(as.numeric(value %||% default))
  if (!is.finite(seconds) || seconds <= 0) seconds <- default
  min(max_seconds, max(min_seconds, seconds))
}

.monitoreo_google_connect_timeout_seconds <- function(timeout_seconds = .monitoreo_google_timeout_seconds(),
                                                      value = Sys.getenv("PROSECNUR_GOOGLE_CONNECT_TIMEOUT_SECONDS", unset = "")) {
  timeout_seconds <- .monitoreo_google_timeout_seconds(timeout_seconds)
  seconds <- suppressWarnings(as.numeric(value %||% min(10, timeout_seconds)))
  if (!is.finite(seconds) || seconds <= 0) seconds <- min(10, timeout_seconds)
  min(timeout_seconds, max(1, seconds))
}

# Aplica los limites a un handle ya construido. Todo camino de red hacia Google
# pasa por aca; lo verifica test-monitoreo-google-http.R.
.monitoreo_google_apply_timeouts <- function(handle) {
  timeout <- .monitoreo_google_timeout_seconds()
  curl::handle_setopt(
    handle,
    timeout = timeout,
    connecttimeout = .monitoreo_google_connect_timeout_seconds(timeout)
  )
  handle
}

# Handle de la Sheets API: bearer + JSON.
.monitoreo_google_handle <- function(token, method = "GET") {
  handle <- curl::new_handle(
    customrequest = method,
    httpheader = c(
      sprintf("Authorization: Bearer %s", token),
      "Accept: application/json",
      "Content-Type: application/json"
    )
  )
  .monitoreo_google_apply_timeouts(handle)
}

# Handle del endpoint de OAuth (canje de codigo y refresh): POST form-urlencoded
# sin Authorization; las credenciales viajan en el body.
.monitoreo_google_oauth_handle <- function() {
  handle <- curl::new_handle(
    post = TRUE,
    httpheader = c("Accept: application/json", "Content-Type: application/x-www-form-urlencoded")
  )
  .monitoreo_google_apply_timeouts(handle)
}
