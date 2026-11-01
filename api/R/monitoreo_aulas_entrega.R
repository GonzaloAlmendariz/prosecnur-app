# Monitoreo lee la entrega de Material (etapa 3 / X8; ADR 0122 §11).
#
# Hasta hoy Material escribía `s$monitoreo_aulas_plan` al entregar
# (collection_engine.R, `monitoring_plan = …`). Con el corte, Material sólo
# EXPONE la entrega (`collection_aulas_entrega_get`, lectura pura, con su sello
# `collection_handoff/v1` y `deployment_fingerprint`) y Monitoreo la aplica a su
# plan cuando alguien la trae.
#
# La regla de mezcla es la misma que tenía la escritura vieja, para que ninguna
# vista cambie:
#   - una unidad que ya está en el plan conserva su fila entera (estado,
#     agenda, parte, refuerzos, reemplazos activados) y sólo se le actualizan
#     los campos de la entrega y del acceso;
#   - una unidad nueva se agrega con la fila que arma Material;
#   - las filas que no vienen en la entrega (banco, refuerzos) se quedan.
# Sólo se aplica una entrega vigente: si el sello cambió desde el recibo, se
# dice y no se toca nada.

.MAE_CAMPOS_DE_ENTREGA <- c(
  "collection_unit_id", "collection_deployment_id", "collection_deployment_fingerprint",
  "access_id", "logical_collector_id", "provider_collector_id", "recipient_id",
  "operator_id", "access_kind", "link", "access_ref_hash"
)

.mae_ids <- function(fila) {
  ids <- vapply(c("collection_unit_id", "operational_code", "classroom_id"),
                function(k) .monitoreo_scalar(fila[[k]], ""), "")
  unique(ids[nzchar(ids)])
}

#' Aplica las unidades de una entrega al plan de Monitoreo (función pura).
#'
#' @param plan filas actuales de `monitoreo_aulas_plan` (lista).
#' @param unidades filas que proyecta Material (`collection_aulas_entrega_get()$unidades`).
#' @return lista `{plan, actualizadas, agregadas, conservadas}`.
#' @keywords internal
.monitoreo_aulas_aplicar_entrega <- function(plan, unidades) {
  plan <- if (is.list(plan)) Filter(is.list, unname(plan)) else list()
  actualizadas <- 0L; agregadas <- 0L
  for (u in unidades %||% list()) {
    if (!is.list(u)) next
    ids_u <- .mae_ids(u)
    hit <- which(vapply(plan, function(f) length(intersect(.mae_ids(f), ids_u)) > 0L, logical(1)))
    if (length(hit)) {
      i <- hit[[1]]
      for (k in .MAE_CAMPOS_DE_ENTREGA) if (!is.null(u[[k]])) plan[[i]][[k]] <- u[[k]]
      actualizadas <- actualizadas + 1L
    } else {
      plan[[length(plan) + 1L]] <- u
      agregadas <- agregadas + 1L
    }
  }
  list(plan = plan, actualizadas = actualizadas, agregadas = agregadas,
       conservadas = as.integer(length(plan) - actualizadas - agregadas))
}

# Sólo se compara una entrega de la misma muestra: vigente y sin `stale` ni
# `desactualizada` (contrato collection_aulas_entrega/v1).
.mae_comparable <- function(entrega) {
  isTRUE(entrega$vigente %||% TRUE) && !isTRUE(entrega$stale) && !isTRUE(entrega$desactualizada)
}

#' El estado de la entrega frente al plan de Monitoreo (lectura pura).
#' @keywords internal
monitoreo_aulas_entrega_estado <- function(sid) {
  entrega <- tryCatch(collection_aulas_entrega_get(sid), error = function(e) NULL)
  s <- session_get(sid)
  plan <- s[["monitoreo_aulas_plan"]] %||% list()
  sellos <- unique(vapply(Filter(is.list, plan), function(f) .monitoreo_scalar(f$collection_deployment_fingerprint, ""), ""))
  sellos <- sellos[nzchar(sellos)]
  fp <- if (is.list(entrega)) .monitoreo_scalar(entrega$deployment_fingerprint, "") else ""
  estado <- if (!is.list(entrega) || !isTRUE(entrega$entregada)) {
    "sin_entrega"
  } else if (!.mae_comparable(entrega)) {
    "desactualizada"
  } else if (nzchar(fp) && fp %in% sellos) {
    "aplicada"
  } else {
    "por_traer"
  }
  list(
    ok = TRUE,
    estado = estado,
    deployment_fingerprint = if (nzchar(fp)) fp else NULL,
    unidades = if (is.list(entrega)) length(entrega$unidades %||% list()) else 0L,
    entregada_en = if (is.list(entrega) && is.list(entrega$handoff)) .monitoreo_scalar(entrega$handoff$handed_off_at, "") else "",
    filas_del_plan = length(plan)
  )
}

#' Trae la entrega vigente de Material al plan de Monitoreo.
#' @keywords internal
monitoreo_aulas_traer_entrega <- function(sid) {
  entrega <- collection_aulas_entrega_get(sid)
  if (!isTRUE(entrega$entregada)) {
    stop_api(409, "E_COLLECTION_HANDOFF_STALE", "Material todavía no entregó los cursos-horario a Monitoreo.")
  }
  if (!.mae_comparable(entrega)) {
    stop_api(409, "E_COLLECTION_HANDOFF_STALE",
             "La entrega cambió después de su recibo: vuelve a entregar desde Material antes de traerla.")
  }
  s <- session_get(sid)
  r <- .monitoreo_aulas_aplicar_entrega(s[["monitoreo_aulas_plan"]] %||% list(), entrega$unidades)
  session_set(sid, "monitoreo_aulas_plan", r$plan)
  list(ok = TRUE, deployment_fingerprint = entrega$deployment_fingerprint,
       actualizadas = r$actualizadas, agregadas = r$agregadas, conservadas = r$conservadas)
}

mount_monitoreo_aulas_entrega <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/aulas/entrega", wrap_endpoint(function(req, res, ...) {
      monitoreo_aulas_entrega_estado(.monitoreo_session(req, res))
    })) |>
    plumber::pr_post("/api/monitoreo/aulas/entrega/traer", wrap_endpoint(function(req, res, ...) {
      monitoreo_aulas_traer_entrega(.monitoreo_session(req, res))
    }))
}
