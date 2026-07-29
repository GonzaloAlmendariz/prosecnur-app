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

# Limpia los enlaces que quedaron apuntando a algo que ya no existe.
#
# Se llama después de TODO borrado. Sin esto, borrar un hito dejaría entradas
# apuntando a un id fantasma: el ADR 0047 exige que no queden referencias rotas
# silenciosas, y "silenciosas" es la palabra clave — un enlace colgante no
# falla, simplemente no lleva a ninguna parte.
.bit_recolectar_vinculos <- function(sid) {
  .bit_persistir_grafo(sid, .bit_link_gc(session_get(sid)))
}

# Persiste las tres claves que pueden llevar enlaces.
#
# Los engines de vínculos trabajan sobre el objeto de sesión completo porque un
# enlace cruza entidades; acá se baja a disco lo que cambió. Solo se escribe lo
# que existe: `session_set` marca el proyecto como sucio, y crear una clave
# vacía marcaría el .pulso como modificado sin que nada haya cambiado.
.bit_persistir_grafo <- function(sid, s) {
  if (is.list(s$plan_trabajo)) session_set(sid, "plan_trabajo", s$plan_trabajo)
  if (length(s$diseno_estudio_bitacora %||% list())) {
    session_set(sid, "diseno_estudio_bitacora", s$diseno_estudio_bitacora)
  }
  if (is.list(s$bitacora_canvas)) session_set(sid, "bitacora_canvas", s$bitacora_canvas)
  invisible(TRUE)
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
      list(id = f$id, label = f$label, modulo = f$modulo, seccion = f$seccion,
           modulos = as.list(f$evidencia))
    }),
    bitacora = .diseno_bitacora_entries(s),
    avisos = .bit_avisos_payload(s),
    vinculos = .bit_vinculos_payload(s),
    canvas = .bit_canvas_leer(s),
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
      .bit_recolectar_vinculos(sid)
      .bit_estado_payload(sid)
    })) |>

    # --- Avisos --------------------------------------------------------------
    #
    # Reclamar ANTES de presentar. La implementación natural —mostrar el aviso y
    # después persistir que sonó— deja una ventana en la que recargar la app lo
    # vuelve a disparar. El cliente manda las claves, recibe cuáles le tocan a
    # ÉL, y recién entonces las muestra.
    plumber::pr_post("/api/bitacora/avisos/reclamar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      resultado <- .bit_aviso_reclamar(sid, body$claves %||% list())
      list(
        ok = TRUE,
        schema = BITACORA_AVISOS_SCHEMA,
        reclamadas = resultado$reclamadas,
        avisos = .bit_avisos_payload(session_get(sid))
      )
    })) |>

    plumber::pr_post("/api/bitacora/avisos/posponer",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      .bit_aviso_posponer(sid, body$clave, body$hasta)
      list(ok = TRUE, schema = BITACORA_AVISOS_SCHEMA, avisos = .bit_avisos_payload(session_get(sid)))
    })) |>

    plumber::pr_post("/api/bitacora/avisos/descartar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      .bit_aviso_descartar(sid, body$clave)
      list(ok = TRUE, schema = BITACORA_AVISOS_SCHEMA, avisos = .bit_avisos_payload(session_get(sid)))
    })) |>

    # --- Entradas ------------------------------------------------------------
    #
    # El alta y la edición siguen en `/api/bitacora` (router_diseno_estudio.R),
    # que no cambia su contrato. Acá van las operaciones que el ADR 0047 agrega.
    plumber::pr_post("/api/bitacora/entradas/<id>/archivar",
                     wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      entradas <- .bit_entrada_archivar(
        .diseno_bitacora_entries(session_get(sid)),
        .bit_id_de_ruta(id),
        calc_bool(body$archivar, TRUE)
      )
      .diseno_bitacora_save(sid, entradas)
      .bit_estado_payload(sid)
    })) |>

    # Borrado PERMANENTE. La ruta normal es archivar; esto existe para lo que el
    # usuario confirma explícitamente.
    plumber::pr_delete("/api/bitacora/entradas/<id>",
                       wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      entradas <- .bit_entrada_purgar(
        .diseno_bitacora_entries(session_get(sid)),
        .bit_id_de_ruta(id)
      )
      .diseno_bitacora_save(sid, entradas)
      .bit_recolectar_vinculos(sid)
      .bit_estado_payload(sid)
    })) |>

    # Exporta EXACTAMENTE lo filtrado. El filtro se resuelve en el servidor para
    # que no haya dos implementaciones que puedan divergir entre lo que se ve y
    # lo que se descarga.
    plumber::pr_post("/api/bitacora/entradas/exportar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      filtro <- body$filtro %||% .bit_prefs_leer(session_get(sid))$bitacora
      entradas <- .bit_entradas_filtrar(.diseno_bitacora_entries(session_get(sid)), filtro)
      markdown <- .bit_entradas_markdown(entradas)
      list(
        ok = TRUE,
        schema = "bitacora_export_md_v1",
        total = length(entradas),
        markdown = markdown
      )
    })) |>

    # --- Lienzo --------------------------------------------------------------
    plumber::pr_post("/api/bitacora/canvas",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      canvas <- .bit_canvas_crear(.bit_canvas_leer(session_get(sid)), body$title)
      .bit_canvas_guardar(sid, canvas)
      .bit_estado_payload(sid)
    })) |>

    # Guarda el lienzo COMPLETO. El autosave del cliente ya viene con debounce,
    # así que a esa cadencia reemplazar es más robusto que parchear: un parche
    # perdido dejaría el lienzo desfasado sin que nadie lo note.
    plumber::pr_post("/api/bitacora/canvas/<id>",
                     wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      canvas <- .bit_canvas_reemplazar(
        .bit_canvas_leer(session_get(sid)),
        .bit_id_de_ruta(id),
        body$lienzo %||% body
      )
      .bit_canvas_guardar(sid, canvas)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_delete("/api/bitacora/canvas/<id>",
                       wrap_endpoint(function(req, res, id, ...) {
      sid <- session_header(req)
      canvas <- .bit_canvas_borrar(.bit_canvas_leer(session_get(sid)), .bit_id_de_ruta(id))
      .bit_canvas_guardar(sid, canvas)
      .bit_recolectar_vinculos(sid)
      .bit_estado_payload(sid)
    })) |>

    # --- Vínculos ------------------------------------------------------------
    #
    # Se guarda en UN solo sentido; la vista inversa la arma un índice derivado
    # que viaja en el payload. No hay endpoint de lectura propio a propósito:
    # un índice que se pide aparte podría quedar desfasado del grafo que
    # describe.
    plumber::pr_post("/api/bitacora/vinculos",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      s <- .bit_link_agregar(
        session_get(sid),
        body$origen_tipo %||% body$origenTipo,
        .bit_texto(body$origen_id %||% body$origenId, 200L),
        body$vinculo %||% list(
          target_type = body$destino_tipo %||% body$destinoTipo,
          target_id = body$destino_id %||% body$destinoId,
          relation = body$relacion
        )
      )
      .bit_persistir_grafo(sid, s)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_delete("/api/bitacora/vinculos",
                       wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      s <- .bit_link_quitar(
        session_get(sid),
        body$origen_tipo %||% body$origenTipo,
        .bit_texto(body$origen_id %||% body$origenId, 200L),
        body$destino_tipo %||% body$destinoTipo,
        .bit_texto(body$destino_id %||% body$destinoId, 200L)
      )
      .bit_persistir_grafo(sid, s)
      .bit_estado_payload(sid)
    })) |>

    plumber::pr_post("/api/bitacora/preferencias",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      prefs <- .bit_prefs_aplicar_parche(session_get(sid), body$preferencias %||% body)
      .bit_prefs_guardar(sid, prefs)
      .bit_estado_payload(sid)
    })) |>

    # --- Portabilidad --------------------------------------------------------

    plumber::pr_get("/api/bitacora/portabilidad/exportar",
                    wrap_endpoint(function(req, res, ...) {
      .bit_port_exportar(session_get(session_header(req)))
    })) |>

    # Revisa y NO escribe. Devuelve el plan y el token que lo ata a este estado.
    plumber::pr_post("/api/bitacora/portabilidad/revisar",
                     wrap_endpoint(function(req, res, ...) {
      body <- .bit_parse_body(req)
      .bit_port_revisar(session_get(session_header(req)), body$documento %||% body)
    })) |>

    plumber::pr_post("/api/bitacora/portabilidad/aplicar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .bit_parse_body(req)
      s <- .bit_port_aplicar(session_get(sid), body$documento %||% list(), body$token)
      .bit_persistir_grafo(sid, s)
      .bit_estado_payload(sid)
    }))
}
