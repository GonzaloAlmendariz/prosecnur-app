# =============================================================================
# router_monitoreo_cuotas.R — Monitoreo › Avance › Cuotas (T2)
#
#   GET  /api/monitoreo/cuotas            avance por categoría de cada cuota
#   POST /api/monitoreo/cuotas/proponer   metas = personas × cobertura
#   POST /api/monitoreo/cuotas            guarda la configuración de cuotas
#
# La configuración vive en `s$monitoreo_cuotas` y viaja en el `.pulso` (solo
# nombres de columna, categorías y metas). El cálculo está en
# `monitoreo_acreditacion_cuotas.R`.
# =============================================================================

.mcu_config <- function(sid) {
  cfg <- session_get(sid)$monitoreo_cuotas
  if (!is.list(cfg) || !identical(cfg$schema, "monitoreo_cuotas_v1")) list(schema = "monitoreo_cuotas_v1", cuotas = list()) else cfg
}

# Universo con llaves, memoizado por huella del snapshot: normalizar 45 mil
# llaves en cada GET sería pagar lo mismo una y otra vez.
.mcu_universo_cache <- new.env(parent = emptyenv())

.mcu_universo_sesion <- function(sid) {
  s <- session_get(sid)
  data <- s$monitoreo_snapshot$data
  campos <- s$monitoreo_config$monitoreo_profile$key_rules$universe_fields %||% list("Token", "CodPulso", "Código", "codigo", "id")
  if (!is.data.frame(data) || !nrow(data)) return(monitoreo_cuotas_universo(NULL))
  huella <- paste(sid, nrow(data), ncol(data), .mcm_chr(s$monitoreo_snapshot$synced_at), paste(unlist(campos), collapse = "|"), sep = "\r")
  hit <- .mcu_universo_cache[[sid]]
  if (is.list(hit) && identical(hit$huella, huella)) return(hit$universo)
  universo <- monitoreo_cuotas_universo(data, campos)
  assign(sid, list(huella = huella, universo = universo), envir = .mcu_universo_cache)
  universo
}

monitoreo_cuotas_estado <- function(sid) {
  rollup <- .mcm_case_rollup(sid)
  if (is.null(rollup)) {
    return(list(ok = TRUE, preparando = TRUE, publicos = list(), cuotas = list(), avisos = list(.mcm_preparando_aviso)))
  }
  modelo <- monitoreo_cuotas_modelo(
    .mcu_universo_sesion(sid),
    rollup,
    .mcu_config(sid)$cuotas,
    .mcu_metas_publico(session_get(sid)$monitoreo_config$goals)
  )
  c(list(ok = TRUE, preparando = FALSE), modelo)
}

monitoreo_cuotas_proponer_sesion <- function(sid, actor, variable, cobertura = NULL) {
  actor <- .mcm_chr(actor)
  variable <- .mcm_chr(variable)
  if (!nzchar(actor) || !nzchar(variable)) {
    stop_api(400, "E_MONITOREO_CUOTA_VARIABLE", "Elige el público y la variable de la cuota.")
  }
  metas <- .mcu_metas_publico(session_get(sid)$monitoreo_config$goals)
  monitoreo_cuotas_proponer(.mcu_universo_sesion(sid), actor, variable,
                            cobertura = cobertura %||% NA_real_, meta_publico = metas[[actor]] %||% NA_integer_)
}

# Limpia lo que llega del front: actor y variable de texto, cobertura 0–1 o NA,
# metas enteras no negativas por categoría.
.mcu_cuotas_entrada <- function(cuotas) {
  out <- list()
  for (q in cuotas %||% list()) {
    actor <- .mcm_chr(q$actor)
    variable <- .mcm_chr(q$variable)
    if (!nzchar(actor) || !nzchar(variable)) {
      stop_api(400, "E_MONITOREO_CUOTA_VARIABLE", "Cada cuota necesita público y variable.")
    }
    cobertura <- suppressWarnings(as.numeric(q$cobertura %||% NA)[1])
    if (!is.na(cobertura) && (cobertura <= 0 || cobertura > 1)) {
      stop_api(400, "E_MONITOREO_CUOTA_VARIABLE", "La cobertura es una proporción entre 0 y 1.")
    }
    metas_in <- q$metas %||% list()
    metas <- list()
    for (cat in names(metas_in)) {
      m <- suppressWarnings(as.integer(metas_in[[cat]])[1])
      metas[[cat]] <- if (is.na(m) || m < 0L) 0L else m
    }
    id <- .mcm_chr(q$id)
    if (!nzchar(id)) id <- paste0("cuota-", substr(digest::digest(paste(actor, variable, Sys.time())), 1, 8))
    out[[length(out) + 1L]] <- list(id = id, actor = actor, variable = variable, cobertura = cobertura,
                                    metas = metas, actualizada_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%S%z"))
  }
  ids <- vapply(out, function(q) q$id, character(1))
  if (anyDuplicated(ids)) stop_api(400, "E_MONITOREO_CUOTA_VARIABLE", "Hay dos cuotas con el mismo identificador.")
  out
}

monitoreo_cuotas_guardar <- function(sid, cuotas) {
  session_set(sid, "monitoreo_cuotas", list(schema = "monitoreo_cuotas_v1", cuotas = .mcu_cuotas_entrada(cuotas)))
  monitoreo_cuotas_estado(sid)
}

mount_monitoreo_cuotas <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/cuotas", wrap_endpoint(function(req, res, ...) {
      monitoreo_cuotas_estado(.monitoreo_session(req, res))
    })) |>
    plumber::pr_post("/api/monitoreo/cuotas/proponer", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      monitoreo_cuotas_proponer_sesion(sid, parsed$actor, parsed$variable, parsed$cobertura)
    })) |>
    plumber::pr_post("/api/monitoreo/cuotas", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      monitoreo_cuotas_guardar(sid, parsed$cuotas %||% list())
    }))
}
