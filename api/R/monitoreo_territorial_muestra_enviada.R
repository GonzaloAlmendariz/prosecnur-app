# =============================================================================
# monitoreo_territorial_muestra_enviada.R — la muestra viva contra la enviada (I4)
# =============================================================================
#
# Gonzalo (2026-11-01; ADR 0118 §3, enmienda): Hojas de ruta envía la muestra a
# Material y a Monitoreo, y los dos miden contra esa foto
# (`monitoreo_territorial_fuente_muestra.R`). Volver a sortear en Hojas queda
# permitido: este aviso dice en Insumos › Conexiones que la muestra de Hojas ya
# no es la enviada, con la causa —otra semilla, la misma semilla con otra
# configuración, o sin semilla para decidirlo—, cuándo se volvió a sortear
# (`sorteado_en`, si la muestra lo trae), cuándo se envió la que miden Material
# y Monitoreo, y qué UMP entran, salen o cambian de papel (titular ↔ reemplazo).
# Aquí no se corrige nada: sólo se compara. La fase es la misma con la que
# Monitoreo arma su contexto: la activa. Las fechas se guardan en UTC y se dicen
# en hora de Lima.
#
# Contrato (solo lectura):
#   GET /api/monitoreo/territorial/muestra-enviada
#     { ok, estado, phase, enviado_at, semilla_enviada, semilla_viva,
#       ump_enviadas, ump_vivas, entran: [id], salen: [id], cambian_rol: [id],
#       cambian, texto }   (`cambian` = UMP afectadas: entran ∪ salen ∪ cambian_rol)
#   `estado` ∈ igual · distinta · sin_envio · sin_muestra.
# =============================================================================

# El papel de cada manzana de una muestra: nombres = id_manzana, valor =
# "titular" o "reemplazo". Una manzana que aparece en los dos se queda con titular.
.mtme_roles <- function(sample) {
  if (!is.list(sample)) return(character(0))
  ids_de <- function(filas) {
    ids <- vapply(.hojas_ruta_envio_rows(filas), function(b) .hojas_ruta_envio_chr(b[["id_manzana"]]), "")
    unique(ids[nzchar(ids)])
  }
  tit <- ids_de(sample$blocks)
  rem <- setdiff(ids_de(sample$replacement_blocks), tit)
  stats::setNames(c(rep("titular", length(tit)), rep("reemplazo", length(rem))), c(tit, rem))
}

.mtme_fecha <- function(iso) {
  iso <- .monitoreo_scalar(iso, "")
  t <- suppressWarnings(as.POSIXct(sub("Z$", "", iso), tz = "UTC", format = "%Y-%m-%dT%H:%M:%OS"))
  d <- if (is.na(t)) suppressWarnings(as.Date(substr(iso, 1L, 10L))) else as.Date(format(t, tz = "America/Lima", "%Y-%m-%d"))
  if (is.na(d)) return("")
  meses <- c("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
             "setiembre", "octubre", "noviembre", "diciembre")
  sprintf("%d de %s", as.integer(format(d, "%d")), meses[as.integer(format(d, "%m"))])
}

#' La muestra viva contra la foto enviada a Material (núcleo puro).
#'
#' @param envio la foto normalizada (`.hojas_ruta_envio_normalize`) o `NULL`.
#' @param viva la muestra viva de la fase (`workspace_outputs$sample`) o `NULL`.
#' @param phase fase de la ruta.
#' @return lista del contrato `muestra-enviada`.
#' @keywords internal
monitoreo_territorial_muestra_enviada_desde <- function(envio, viva, phase = "field") {
  base <- list(ok = TRUE, phase = phase, enviado_at = "", semilla_enviada = NA_integer_, semilla_viva = NA_integer_,
               ump_enviadas = 0L, ump_vivas = 0L, entran = list(), salen = list(), cambian_rol = list(),
               cambian = 0L, texto = "")
  if (is.null(envio)) return(utils::modifyList(base, list(estado = "sin_envio")))
  # Un envío por cuotas (ADR 0125 A1) no trae muestra de UMP: trae zonas. No hay
  # UMP que comparar, y `envio$sample` casaba por prefijo `sample_fingerprint`
  # (texto) y reventaba con 500 (D14). Lecturas con `[[`.
  if (identical(.monitoreo_scalar(envio[["kind"]], ""), "cuotas")) {
    return(utils::modifyList(base, list(
      estado = "cuotas", enviado_at = .monitoreo_scalar(envio[["enviado_at"]], ""),
      texto = "La muestra se envió por cuotas, por zona: no hay UMP que comparar con la muestra viva."
    )))
  }
  rol_env <- .mtme_roles(envio[["sample"]])
  rol_viv <- .mtme_roles(viva)
  enviadas <- names(rol_env)
  vivas <- names(rol_viv)
  semilla <- function(x) .hojas_ruta_envio_int(x$seed %||% x$config$seed)
  out <- utils::modifyList(base, list(
    enviado_at = .monitoreo_scalar(envio$enviado_at, ""),
    semilla_enviada = semilla(envio[["sample"]]),
    semilla_viva = if (is.list(viva)) semilla(viva) else NA_integer_,
    ump_enviadas = length(enviadas),
    ump_vivas = length(vivas)
  ))
  if (!length(vivas)) return(utils::modifyList(out, list(estado = "sin_muestra")))
  vigente <- .hojas_ruta_sample_fingerprint(viva)
  if (!is.na(vigente) && identical(vigente, envio$sample_fingerprint)) {
    return(utils::modifyList(out, list(estado = "igual")))
  }
  entran <- setdiff(vivas, enviadas)
  salen <- setdiff(enviadas, vivas)
  comunes <- intersect(vivas, enviadas)
  cambian_rol <- comunes[rol_viv[comunes] != rol_env[comunes]]
  cambian <- length(union(union(entran, salen), cambian_rol))
  sv <- out$semilla_viva
  se <- out$semilla_enviada
  causa <- if (is.na(sv) || is.na(se)) {
    "La muestra de Hojas de ruta cambió después del envío"
  } else if (sv != se) {
    sprintf("La muestra de Hojas de ruta se volvió a sortear después del envío (semilla %d; la enviada es la %d)", sv, se)
  } else {
    "La muestra de Hojas de ruta cambió después del envío (misma semilla, otra configuración)"
  }
  fecha <- .mtme_fecha(out$enviado_at)
  envio_txt <- if (nzchar(fecha)) sprintf("Material y Monitoreo miden la enviada el %s", fecha) else "Material y Monitoreo miden la enviada"
  resorteo <- .mtme_fecha(.monitoreo_scalar((viva %||% list())$sorteado_en, ""))
  if (nzchar(resorteo)) causa <- sprintf("%s, el %s", causa, resorteo)
  verbo <- function(k, uno, varios) sprintf("%d UMP %s", k, if (k == 1L) uno else varios)
  partes <- c(
    if (length(entran)) verbo(length(entran), "entra", "entran"),
    if (length(salen)) verbo(length(salen), "sale", "salen"),
    if (length(cambian_rol)) verbo(length(cambian_rol), "cambia de titular a reemplazo o al revés", "cambian de titular a reemplazo o al revés")
  )
  cambio_txt <- if (length(partes)) {
    paste(partes, collapse = ", ")
  } else {
    "las UMP y sus papeles son los mismos, pero cambió su recorrido (rango, viviendas, orden o método del sorteo)"
  }
  # Asignación directa: `modifyList` recursivo descarta las listas sin nombres.
  out$estado <- "distinta"
  out$entran <- as.list(entran)
  out$salen <- as.list(salen)
  out$cambian_rol <- as.list(cambian_rol)
  out$cambian <- as.integer(cambian)
  out$texto <- sprintf("%s. %s; en la de Hojas %s. Si la nueva es la que va a campo, reenvíala desde Hojas de ruta.",
                    causa, envio_txt, cambio_txt)
  out
}

.monitoreo_territorial_muestra_enviada_from_session <- function(sid) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  if (!identical(cfg$monitoreo_profile$family %||% "acreditacion", "territorial")) {
    stop_api(409, "E_MONITOREO_TERRITORIAL_REQUIRED", "La comparación de la muestra requiere un monitoreo territorial activo.")
  }
  # La misma fase con la que Monitoreo arma su contexto (la activa): si no, el
  # aviso y lo que se mide hablarían de fases distintas.
  phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase, "pilot")
  run <- (s$hojas_ruta_runs %||% list())[[phase]]
  viva <- if (is.list(run)) .hojas_ruta_list_get(run$workspace_outputs, "sample") else NULL
  monitoreo_territorial_muestra_enviada_desde(.mcamp_territorial_envio(s, phase), viva, phase = phase)
}

mount_monitoreo_territorial_muestra_enviada <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/territorial/muestra-enviada", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_territorial_muestra_enviada_from_session(sid)
    }))
}
