# =============================================================================
# router_monitoreo_mailchimp.R — Monitoreo › Avance › Correo
#
#   GET  /api/monitoreo/mailchimp/estado       reporte por público y por envío
#   GET  /api/monitoreo/mailchimp/audiencias   audiencias de la cuenta conectada
#   POST /api/monitoreo/mailchimp/config       {list_id}: la audiencia del estudio
#   POST /api/monitoreo/mailchimp/sync         lee Mailchimp en un job (solo GET)
#
# El snapshot vive en `s$monitoreo_mailchimp` y viaja en el `.pulso` sin
# correos: solo tokens y conteos. La lectura está en
# `monitoreo_mailchimp_lectura.R` y el cálculo en `monitoreo_mailchimp_modelo.R`.
# =============================================================================

.mcm_snapshot_vacio <- function(list_id = "") {
  list(schema = "monitoreo_mailchimp_v1", list_id = list_id, leido_at = "", envios = list(),
       personas = .mcm_personas_vacias(), bajas = NULL, quejas = NULL, limpiados = NULL)
}

.mcm_snapshot <- function(sid) {
  snap <- session_get(sid)$monitoreo_mailchimp
  if (!is.list(snap) || !identical(snap$schema, "monitoreo_mailchimp_v1")) .mcm_snapshot_vacio() else snap
}

# El universo de Monitoreo ya cruzado: primero del tablero en caché (lo deja el
# warmup); si no hay, se arma con el cruce memoizado, como hace Consultas.
.mcm_case_rollup <- function(sid) {
  s <- session_get(sid)
  for (clave in c("monitoreo_dashboard_cache_queries_summary", "monitoreo_dashboard_cache_full", "monitoreo_dashboard_cache")) {
    rollup <- s[[clave]]$acreditacion_reports$internal_queries$case_rollup
    if (is.list(rollup) && length(rollup)) return(rollup)
  }
  data <- s$monitoreo_snapshot$data
  if (!is.data.frame(data) || !nrow(data)) return(list())
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  iq <- .monitoreo_acreditacion_queries_hidratadas(data, cfg$monitoreo_profile, NULL)
  iq$case_rollup %||% list()
}

monitoreo_mailchimp_estado <- function(sid) {
  snap <- .mcm_snapshot(sid)
  conectado <- nzchar(.connections_token_state("mailchimp", sid)$token)
  modelo <- monitoreo_mailchimp_modelo(snap, .mcm_case_rollup(sid))
  c(list(ok = TRUE, conectado = conectado, list_id = .mcm_chr(snap$list_id), leido_at = .mcm_chr(snap$leido_at)), modelo)
}

monitoreo_mailchimp_audiencias <- function(sid) {
  key <- .connections_token_state("mailchimp", sid)$token
  if (!nzchar(key)) return(list(ok = TRUE, conectado = FALSE, audiencias = list()))
  list(ok = TRUE, conectado = TRUE, audiencias = mailchimp_api_lists(key))
}

monitoreo_mailchimp_config <- function(sid, list_id) {
  list_id <- trimws(.mcm_chr(list_id))
  if (!grepl("^[A-Za-z0-9]{2,32}$", list_id)) {
    stop_api(400, "E_MONITOREO_MAILCHIMP_AUDIENCIA", "Elige una audiencia de Mailchimp válida.")
  }
  snap <- .mcm_snapshot(sid)
  # Otra audiencia es otro estudio: lo leído de la anterior ya no aplica.
  if (!identical(.mcm_chr(snap$list_id), list_id)) session_set(sid, "monitoreo_mailchimp", .mcm_snapshot_vacio(list_id))
  monitoreo_mailchimp_estado(sid)
}

monitoreo_mailchimp_sync_submit <- function(sid) {
  key <- .connections_token_require("mailchimp", sid)
  snap <- .mcm_snapshot(sid)
  if (!nzchar(.mcm_chr(snap$list_id))) {
    stop_api(400, "E_MONITOREO_MAILCHIMP_AUDIENCIA", "Elige primero la audiencia de Mailchimp del estudio.")
  }
  input <- list(mc_key = key, list_id = snap$list_id, previo = snap)
  .mc_job_submit(sid, "monitoreo.mailchimp_sync", "monitoreo_mailchimp_sync_job", input,
                 on_complete = .mcm_sync_hook(sid, snap$list_id))
}

# Al cosechar el job, en el proceso de la API: el resultado reemplaza el
# snapshot si la audiencia sigue siendo la misma.
.mcm_sync_hook <- function(sid, list_id) {
  function(j) {
    res <- j$result_data
    # En toda rama sale un resumen: si no, `result_public` conservaría el
    # snapshot completo del worker.
    if (!is.list(res) || !isTRUE(res$ok)) {
      return(list(ok = FALSE, error = if (is.list(res)) res$error else NULL))
    }
    if (!identical(.mcm_chr(.mcm_snapshot(sid)$list_id), list_id)) {
      return(list(ok = FALSE, error = list(code = "E_MONITOREO_MAILCHIMP_AUDIENCIA", status = 409L,
                                           message = "Cambió la audiencia mientras se leía: vuelve a actualizar.")))
    }
    res$ok <- NULL
    session_set(sid, "monitoreo_mailchimp", res)
    # Al navegador va un resumen, no el snapshot con cientos de miles de filas
    # de destinatarios: la vista vuelve a pedir /estado al terminar.
    list(ok = TRUE, envios = length(res$envios %||% list()), leido_at = .mcm_chr(res$leido_at))
  }
}

mount_monitoreo_mailchimp <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/mailchimp/estado", wrap_endpoint(function(req, res, ...) {
      monitoreo_mailchimp_estado(.monitoreo_session(req, res))
    })) |>
    plumber::pr_get("/api/monitoreo/mailchimp/audiencias", wrap_endpoint(function(req, res, ...) {
      monitoreo_mailchimp_audiencias(.monitoreo_session(req, res))
    })) |>
    plumber::pr_post("/api/monitoreo/mailchimp/config", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      monitoreo_mailchimp_config(sid, parsed$list_id %||% parsed$listId)
    })) |>
    plumber::pr_post("/api/monitoreo/mailchimp/sync", wrap_endpoint(function(req, res, ...) {
      monitoreo_mailchimp_sync_submit(.monitoreo_session(req, res))
    }))
}
