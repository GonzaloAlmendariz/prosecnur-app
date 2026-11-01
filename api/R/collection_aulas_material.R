# collection_aulas_material.R — Aulas en Material (etapa 3 del plan maestro; ADR 0122 §11, X8).
#
# Dos piezas:
#
#   - La ENTREGA, de solo lectura: el recibo `collection_handoff/v1` (sellado por
#     `deployment_fingerprint`) y la proyección de las unidades entregadas en el idioma
#     de Monitoreo. Es lo que Monitoreo consulta en vez de que Material le escriba
#     `monitoreo_aulas_plan` (X8). Proyecta desde cero (sin mezclar con el plan de
#     Monitoreo): mezclar y conservar lo operativo es del lector.
#   - Las PLANTILLAS del equipo de aulas, que son material de campo: el libro en blanco
#     (Aulas Agendadas / Aulas Aplicadas) armado con las unidades de la entrega de
#     Material, y la plantilla de disponibilidad de aplicadores. Mismos motores que usa
#     Monitoreo (`aulas_libro_generar`, `aulas_disponibilidad_plantilla`); aquí no hay
#     partes, control ni respuestas, que son de Monitoreo.
#
# Lectura pura: nada aquí escribe en la sesión salvo registrar el archivo generado.

#' La entrega de aulas de Material a Monitoreo, de solo lectura.
#' @keywords internal
collection_aulas_entrega_get <- function(sid) {
  s <- session_get(sid)
  current <- .collection_current(s)
  deployment <- current$deployment
  receipt <- if (is.list(deployment) && is.list(deployment$handoff)) deployment$handoff else NULL
  fp_vigente <- if (is.list(deployment)) tryCatch(.collection_deployment_fingerprint(deployment), error = function(e) NA_character_) else NA_character_
  entregada <- is.list(receipt) && identical(deployment$status, "handed_off")
  unidades <- if (entregada) {
    tryCatch(.collection_monitoring_handoff(list(), current$plan, deployment, receipt), error = function(e) list())
  } else list()
  list(
    ok = TRUE, schema = "collection_aulas_entrega/v1",
    entregada = entregada,
    estado = if (is.list(deployment)) as.character(deployment$status %||% "") else "",
    handoff = receipt,
    # El sello vigente coincide con el del recibo sólo si nada cambió desde la entrega.
    vigente = entregada && identical(receipt$deployment_fingerprint, fp_vigente),
    deployment_fingerprint = if (entregada) receipt$deployment_fingerprint else NULL,
    unidades = unidades
  )
}

# Nombres de aplicadores para la plantilla: el equipo del Planner (perfil aulas) si está
# declarado; si no, los que Monitoreo ya tiene declarados en su disponibilidad.
.mau_aplicadores <- function(sid) {
  s <- session_get(sid)
  pl <- tryCatch(.planner_equipo_de(s, "aulas"), error = function(e) NULL)
  if (is.list(pl) && identical(pl$origen, "declarado") && !isTRUE(pl$bloqueado)) {
    nombres <- vapply(Filter(function(p) isTRUE(p$activo), pl$personas %||% list()), function(p) as.character(p$nombre %||% ""), "")
    nombres <- unique(nombres[nzchar(nombres)])
    if (length(nombres)) return(nombres)
  }
  .monitoreo_aulas_plantilla_args(sid, list())$aplicadores
}

#' Plantilla del equipo de aulas generada por Material: `libro` (en blanco, desde la
#' entrega) o `disponibilidad`.
#' @keywords internal
collection_aulas_plantilla <- function(sid, pieza = "libro", body = list()) {
  pieza <- .mtf_txt(pieza)
  if (!pieza %in% c("libro", "disponibilidad")) {
    stop_api(422, "E_COLLECTION_CAMPAIGN_INVALID", "pieza es «libro» o «disponibilidad».")
  }
  s <- session_get(sid)
  dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
  if (identical(pieza, "disponibilidad")) {
    args <- .monitoreo_aulas_plantilla_args(sid, body %||% list())
    aplicadores <- .mau_aplicadores(sid)
    nombre <- .export_filename(sid, "disponibilidad_aplicadores_PLANTILLA", "xlsx")
    path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), nombre))
    aulas_disponibilidad_plantilla(path, dias = args$dias, desde = args$desde, hasta = args$hasta,
                                   filas = length(aplicadores) + max(0L, args$filas - length(args$aplicadores)),
                                   aplicadores = aplicadores)
    meta <- .register_output_file(sid, "aulas_disponibilidad_plantilla", path, original_name = nombre)
    return(list(ok = TRUE, pieza = pieza, file_id = meta$file_id, filename = meta$original_name, aplicadores = length(aplicadores)))
  }
  entrega <- collection_aulas_entrega_get(sid)
  if (!isTRUE(entrega$entregada) || !length(entrega$unidades)) {
    stop_api(409, "E_COLLECTION_HANDOFF_NOT_READY",
             "Todavía no hay una entrega de aulas a Monitoreo: entrega el material antes de sacar el libro del equipo.")
  }
  nombre <- .export_filename(sid, "libro_aulas_PLANTILLA", "xlsx")
  path <- file.path(s$dir, "downloads", sprintf("%s_%s", uuid::UUIDgenerate(), nombre))
  aulas_libro_generar(entrega$unidades, path)
  meta <- .register_output_file(sid, "aulas_libro_plantilla", path, original_name = nombre)
  list(ok = TRUE, pieza = pieza, file_id = meta$file_id, filename = meta$original_name,
       unidades = length(entrega$unidades), deployment_fingerprint = entrega$deployment_fingerprint)
}
