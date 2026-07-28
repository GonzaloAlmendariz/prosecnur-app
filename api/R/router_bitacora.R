# =============================================================================
# Endpoints HTTP del subsistema Bitácora (ADR 0047)
# =============================================================================
#
# Router DELGADO: valida entrada, llama al engine y serializa. Toda la lógica de
# dominio vive en bitacora_cronograma.R, bitacora_fases.R y bitacora_modelo.R.
#
# Convive con `/api/plan-trabajo/*` y `/api/bitacora` (GET/POST/DELETE de
# entradas), que NO cambian su contrato: los consume `.diseno_estudio_state`
# y los componentes actuales. Lo que se agrega acá es aditivo.

.bit_parse_body <- function(req) {
  body_raw <- req$postBody %||% "{}"
  if (!nzchar(trimws(body_raw))) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BITACORA_JSON", "El cuerpo de la petición no es JSON válido.")
  )
}

# El plan puede no existir todavía (proyecto que nunca abrió el cronograma):
# se trabaja sobre un plan vacío en vez de fallar. Crear la primera fase no
# debería exigir haber importado nada.
.bit_plan_actual <- function(s) {
  plan <- s$plan_trabajo %||% NULL
  if (is.null(plan) || !is.list(plan)) plan <- .plan_empty_plan()
  plan
}

.bit_guardar_plan <- function(sid, plan) {
  # Un solo `session_set` por operación lógica: si fueran dos, un fallo entre
  # ambos dejaría el grafo a medias.
  session_set(sid, "plan_trabajo", plan)
  invisible(plan)
}

# --- Payload consolidado -----------------------------------------------------
#
# Un solo round-trip para las cuatro secciones. Con un fetch por subsistema, el
# índice de retroenlaces se recalcularía una vez por llamada y el arranque del
# módulo pagaría cinco viajes en una app cuyo warm start es una preocupación
# arquitectónica declarada.
.bit_estado_payload <- function(sid) {
  s <- session_get(sid)
  # Defensivo: una sesión efímera creada antes del ADR 0047 no pasó por
  # `load_pulso` y por lo tanto no migró.
  s <- .bitacora_migrar_estado(s)
  plan <- .bit_plan_actual(s)

  list(
    ok = TRUE,
    schema = "bitacora_estado_v1",
    generated_at = .bit_now_iso(),
    hoy_servidor = .bit_cron_hoy_servidor(),
    plan = plan,
    fases = .bit_cron_vista_fases(s, plan),
    catalogo_fases = lapply(.bit_fases_catalogo(), function(f) {
      list(id = f$id, label = f$label, modulos = as.list(f$modulos))
    }),
    bitacora = .diseno_bitacora_entries(s),
    preferencias = .bit_prefs_leer(s),
    contadores = list(
      tareas = length(Filter(function(t) !nzchar(calc_str(t$archived_at, "")), plan$tasks %||% list())),
      archivadas = length(Filter(function(t) nzchar(calc_str(t$archived_at, "")), plan$tasks %||% list())),
      entradas = length(.diseno_bitacora_entries(s))
    )
  )
}

.bit_id_de_ruta <- function(id) {
  out <- .bit_texto(id, 160L)
  if (!nzchar(out)) stop_api(400, "E_BITACORA_ID", "Falta el identificador de la actividad.")
  out
}

mount_bitacora <- function(pr) {
  pr |>
    plumber::pr_get("/api/bitacora/estado",
                    wrap_endpoint(function(req, res, ...) {
      .bit_estado_payload(session_header(req))
    })) |>

    # Siembra las fases del estudio con rangos vacíos. Es la salida del estado
    # vacío: el usuario pone fechas en vez de armar un Excel.
    plumber::pr_post("/api/bitacora/cronograma/sembrar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      fases <- body$fases %||% BITACORA_FASES
      plan <- .bit_cron_sembrar_fases(.bit_plan_actual(session_get(sid)), fases)
      .bit_guardar_plan(sid, plan)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_post("/api/bitacora/cronograma/tareas",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      plan <- .bit_cron_crear(.bit_plan_actual(session_get(sid)), body$tarea %||% body)
      .bit_guardar_plan(sid, plan)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_post("/api/bitacora/cronograma/tareas/<id>",
                     wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      plan <- .bit_cron_editar(.bit_plan_actual(session_get(sid)), .bit_id_de_ruta(id), body$tarea %||% body)
      .bit_guardar_plan(sid, plan)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_post("/api/bitacora/cronograma/tareas/<id>/archivar",
                     wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      archivar <- calc_bool(body$archivar, TRUE)
      plan <- .bit_cron_archivar(.bit_plan_actual(session_get(sid)), .bit_id_de_ruta(id), archivar)
      .bit_guardar_plan(sid, plan)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_post("/api/bitacora/cronograma/tareas/<id>/duplicar",
                     wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      plan <- .bit_cron_duplicar(.bit_plan_actual(session_get(sid)), .bit_id_de_ruta(id))
      .bit_guardar_plan(sid, plan)
      .bit_estado_payload(sid)
    })) |>

    # Borrado permanente. La ruta normal es archivar; esto existe para lo que el
    # usuario confirma explícitamente en la UI.
    plumber::pr_delete("/api/bitacora/cronograma/tareas/<id>",
                       wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      plan <- .bit_cron_borrar(.bit_plan_actual(session_get(sid)), .bit_id_de_ruta(id))
      .bit_guardar_plan(sid, plan)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_post("/api/bitacora/preferencias",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      prefs <- .bit_prefs_aplicar_parche(session_get(sid), body$preferencias %||% body)
      .bit_prefs_guardar(sid, prefs)
      .bit_estado_payload(sid)
    }))
}
