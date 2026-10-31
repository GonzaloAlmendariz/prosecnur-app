# =============================================================================
# monitoreo_territorial_asignacion_planificada.R — asignado contra observado (B3)
# =============================================================================
#
# Material territorial guarda a qué encuestador se le asignó cada UMP de la foto
# enviada (`collection_territorial_asignacion.R`, contrato en
# docs/qa/contrato-equipo-territorial-2026-10-31.md). Monitoreo CONSULTA esa
# asignación —no la copia— y la cruza con lo que llegó del campo: el código
# Pulso de cada respuesta y la UMP a la que se atribuyó.
#
# Contrato (solo lectura):
#   GET /api/monitoreo/territorial/asignacion-planificada
#     { ok, estado, motivo, phase, code_format, resumen, por_ump: [ {
#       id_manzana, label, role, origen, codigo_planificado, nombre_planificado,
#       observados: [ { codigo, nombre, respuestas } ], respuestas, lectura } ] }
#   `estado` ∈ comparable · otra_muestra · sin_asignacion · sin_envio · sin_campana.
#   `lectura` ∈ coincide · coincide_con_otros · otro_encuestador · sin_respuestas.
#
# Reglas del contrato (B3 de guardian-contratos):
# - Sólo se compara si la asignación es de la MISMA muestra que está en campo: ni
#   `desactualizada` (la asignación se guardó sobre otra foto) ni `stale` (la foto
#   enviada ya no es la muestra vigente). Si no, «asignación de otra muestra».
# - Se compara por el código LIMPIO (`.monitoreo_territorial_clean_code`), nunca
#   por el texto de `responsible_display`.
# - La columna es `codigo_planificado`, para no chocar con `enumerator_assigned`.
# - Las respuestas anuladas por producción no cuentan como observadas.
# - Viaja código y nombre, nunca DNI.
#
# Sobre la muestra viva (cruce X5): lo OBSERVADO se atribuye a su UMP con el
# contexto territorial común (`.monitoreo_territorial_context`), que lee la
# muestra vigente de Hojas de ruta y llama a `.hojas_ruta_ensure_runs`. B3 no
# agrega esa dependencia: sólo compara cuando la foto enviada ES la muestra
# vigente (`stale = FALSE`), así que atribuir contra la viva equivale a hacerlo
# contra la foto. Sacar `ensure_runs` del contexto es deuda de todo Monitoreo
# territorial (pendientes, ítem 2c), no de esta comparación.
#
# Verificado sobre acnur_acg (1,693 filas, 164 UMP con respuestas): el cruce
# por `advance_block_id` = `id_manzana` y por código limpio funciona.
# =============================================================================

.mtap_chr <- function(df, col) {
  n <- if (is.data.frame(df)) nrow(df) else 0L
  if (!n || !col %in% names(df)) return(rep("", n))
  v <- as.character(df[[col]])
  v[is.na(v)] <- ""
  trimws(v)
}

# Estado de la comparación a partir de lo que devuelve la lectura de Material.
.mtap_estado <- function(asig) {
  if (is.null(asig)) {
    return(list(estado = "sin_campana", motivo = "No hay campaña territorial en Material de campo."))
  }
  if (isTRUE(asig$sin_fuente)) {
    return(list(estado = "sin_envio", motivo = "Material todavía no envió la muestra a campo."))
  }
  if (!length(asig$asignacion)) {
    return(list(estado = "sin_asignacion", motivo = "Material no tiene UMP asignadas a encuestadores."))
  }
  if (isTRUE(asig$desactualizada)) {
    return(list(estado = "otra_muestra",
                motivo = "La asignación se guardó sobre otra foto de la muestra: asignación de otra muestra."))
  }
  if (isTRUE(asig$stale)) {
    return(list(estado = "otra_muestra",
                motivo = "La muestra cambió desde el envío a campo: asignación de otra muestra."))
  }
  list(estado = "comparable", motivo = "")
}

#' Asignado contra observado por UMP (núcleo puro).
#'
#' @param auditoria data.frame o lista de registros de `response_audit` de la
#'   fase, con `advance_block_id` y `pulso_code`.
#' @param asig lo que devuelve `collection_territorial_asignacion_get()`, o
#'   `NULL` si no hay campaña.
#' @param anulado vector lógico, una entrada por fila de `auditoria`: si la
#'   respuesta fue anulada por producción.
#' @param phase fase de la ruta.
#' @return lista del contrato `asignacion-planificada`.
#' @keywords internal
monitoreo_territorial_asignacion_planificada_desde <- function(auditoria, asig, anulado = NULL, phase = "field",
                                                             estados = NULL) {
  est <- .mtap_estado(asig)
  code_format <- .monitoreo_scalar((asig %||% list())$code_format, "PXXX")
  base <- list(ok = TRUE, estado = est$estado, motivo = est$motivo, phase = phase, code_format = code_format)
  if (!identical(est$estado, "comparable")) {
    return(c(base, list(resumen = list(asignadas = length((asig %||% list())$asignacion)), por_ump = list())))
  }

  equipo <- asig$equipo %||% list()
  nombre_de <- stats::setNames(
    vapply(equipo, function(x) .monitoreo_scalar(x$nombre, ""), ""),
    .monitoreo_territorial_clean_code(vapply(equipo, function(x) .monitoreo_scalar(x$codigo, ""), ""), code_format)
  )

  auditoria <- .casos_ump_registros_df(auditoria)
  n <- nrow(auditoria)
  vivo <- if (length(anulado) == n) !(anulado %in% TRUE) else rep(TRUE, n)
  bloque <- .mtap_chr(auditoria, "advance_block_id")
  codigo <- .monitoreo_territorial_clean_code(.mtap_chr(auditoria, "pulso_code"), code_format)
  valida <- tolower(.mtap_chr(auditoria, "advance_valid")) %in% c("true", "1", "si", "sí")
  keep <- vivo & nzchar(bloque)
  bloque <- bloque[keep]; codigo <- codigo[keep]; valida <- valida[keep]

  # C7: el Estado que declara campo en el Excel de asignación (Material, lectura
  # pura). Es DECLARADO: no entra al avance. Sólo se usa si es de la misma
  # muestra (`stale` y `desactualizada` en FALSE), como la asignación.
  declarado <- list()
  # P2: los códigos del catálogo del estudio que cuentan como efectiva.
  codigos_efectiva <- character(0)
  if (is.list(estados) && !isTRUE(estados$stale) && !isTRUE(estados$desactualizada)) {
    for (c in estados$codigos %||% list()) {
      if (identical(.monitoreo_scalar(c$grupo, ""), "efectiva")) codigos_efectiva <- c(codigos_efectiva, .monitoreo_scalar(c$codigo, ""))
    }
    for (u in estados$unidades %||% list()) {
      id_u <- .monitoreo_scalar(u$id_manzana, "")
      if (nzchar(id_u)) declarado[[id_u]] <- u
    }
  }

  por_ump <- lapply(asig$asignacion, function(a) {
    id <- .monitoreo_scalar(a$id_manzana, "")
    plan <- .monitoreo_territorial_clean_code(.monitoreo_scalar(a$codigo, ""), code_format)
    suyos <- codigo[bloque == id]
    conteo <- if (length(suyos)) table(ifelse(nzchar(suyos), suyos, "")) else integer(0)
    observados <- lapply(names(conteo), function(c) list(
      codigo = c, nombre = unname(nombre_de[c]) %||% "", respuestas = as.integer(conteo[[c]])))
    observados <- observados[order(-vapply(observados, `[[`, 0L, "respuestas"))]
    codigos_vistos <- setdiff(names(conteo), "")
    lectura <- if (!length(suyos)) {
      "sin_respuestas"
    } else if (plan %in% codigos_vistos && length(codigos_vistos) == 1L) {
      "coincide"
    } else if (plan %in% codigos_vistos) {
      "coincide_con_otros"
    } else {
      "otro_encuestador"
    }
    nombre_plan <- unname(nombre_de[plan])
    d <- declarado[[id]] %||% list()
    estado_declarado <- .monitoreo_scalar(d$estado_declarado, "")
    # El contraste con Kobo: lo que campo dice contra lo que llegó. Sólo dos
    # señales, las que contradicen: «terminada» sin una sola respuesta y
    # «pendiente» con respuestas ya en Kobo.
    contraste <- if (identical(estado_declarado, "Finalizada") && !length(suyos)) {
      "finalizada_sin_respuestas"
    } else if (estado_declarado %in% c("Pendiente", "") && nzchar(estado_declarado) && length(suyos)) {
      "pendiente_con_respuestas"
    } else ""
    # P2: lo que campo transcribe del consolidado contra lo que llegó a Kobo.
    conteos <- d$conteos %||% list()
    declaradas <- if (length(codigos_efectiva) && length(conteos)) {
      sum(vapply(codigos_efectiva, function(k) suppressWarnings(as.integer(.monitoreo_scalar(conteos[[k]], 0L))), integer(1)), na.rm = TRUE)
    } else NA_integer_
    efectivas_kobo <- as.integer(sum(valida[bloque == id]))
    list(
      id_manzana = id,
      label = .monitoreo_scalar(a$label, id),
      role = .monitoreo_scalar(a$role, "titular"),
      origen = .monitoreo_scalar(a$origen, "explicita"),
      codigo_planificado = plan,
      nombre_planificado = if (length(nombre_plan) && !is.na(nombre_plan)) nombre_plan else "",
      observados = observados,
      respuestas = length(suyos),
      lectura = lectura,
      estado_declarado = estado_declarado,
      fecha_salida = .monitoreo_scalar(d$fecha_salida, ""),
      fecha_entrega = .monitoreo_scalar(d$fecha_entrega, ""),
      contraste = contraste,
      efectivas_declaradas = declaradas,
      efectivas_kobo = efectivas_kobo
    )
  })

  lecturas <- vapply(por_ump, `[[`, "", "lectura")
  asignadas_ids <- vapply(asig$asignacion, function(a) .monitoreo_scalar(a$id_manzana, ""), "")
  c(base, list(
    resumen = list(
      asignadas = length(por_ump),
      con_respuestas = as.integer(sum(lecturas != "sin_respuestas")),
      coinciden = as.integer(sum(lecturas == "coincide")),
      coinciden_con_otros = as.integer(sum(lecturas == "coincide_con_otros")),
      otro_encuestador = as.integer(sum(lecturas == "otro_encuestador")),
      sin_respuestas = as.integer(sum(lecturas == "sin_respuestas")),
      # UMP con respuestas que Material no asignó a nadie: se dicen, no se cruzan.
      sin_planificar = length(setdiff(unique(bloque), asignadas_ids)),
      con_estado_declarado = as.integer(sum(nzchar(vapply(por_ump, `[[`, "", "estado_declarado")))),
      contrastes = as.integer(sum(nzchar(vapply(por_ump, `[[`, "", "contraste")))),
      con_conteos = as.integer(sum(!is.na(vapply(por_ump, function(u) as.integer(u$efectivas_declaradas), integer(1))))),
      conteos_distintos = as.integer(sum(vapply(por_ump, function(u) {
        !is.na(u$efectivas_declaradas) && !identical(as.integer(u$efectivas_declaradas), u$efectivas_kobo)
      }, logical(1))))
    ),
    por_ump = por_ump
  ))
}

# Frontera de sesión. La auditoría se pide igual que en `casos-ump` (la misma
# caché por sesión), así que pedir la comparación no recalcula la fase.
.monitoreo_territorial_asignacion_planificada_from_session <- function(sid) {
  s <- session_get(sid)
  snapshot <- s$monitoreo_snapshot %||% NULL
  data <- if (!is.null(snapshot) && is.data.frame(snapshot$data)) snapshot$data else data.frame()
  cfg <- monitoreo_normalize_config(s$monitoreo_config %||% list(), data)
  if (!identical(cfg$monitoreo_profile$family %||% "acreditacion", "territorial")) {
    stop_api(409, "E_MONITOREO_TERRITORIAL_REQUIRED", "La asignación planificada requiere un monitoreo territorial activo.")
  }
  phase <- .monitoreo_territorial_phase(cfg$territorial$active_route_phase, "pilot")
  # Material es el dueño de la asignación: se consulta su lectura pura. Sin
  # campaña territorial responde 404, que aquí es un estado, no un error.
  asig <- tryCatch(collection_territorial_asignacion_get(sid), error = function(e) NULL)
  est <- .mtap_estado(asig)
  if (!identical(est$estado, "comparable")) {
    return(monitoreo_territorial_asignacion_planificada_desde(data.frame(), asig, phase = phase))
  }
  data <- .monitoreo_territorial_filter_data_for_phase(data, cfg, phase = phase)
  key <- .casos_ump_cache_key(data, .monitoreo_scalar(snapshot$synced_at, ""), cfg, phase)
  hit <- .monitoreo_territorial_casos_ump_cache[[sid]]
  auditoria <- if (is.list(hit) && identical(hit$key, key)) {
    hit$auditoria
  } else {
    context <- .monitoreo_territorial_context_with_map_cache(
      sid, cfg, data, phase = phase, report_scope = "validation_summary",
      allow_stale = TRUE, prepare_missing = TRUE
    )
    reporte <- monitoreo_territorial_reportes(
      data, .casos_ump_config_sin_anulaciones(cfg), context,
      .monitoreo_kobo_schema_for_phase(sid, cfg, phase = phase),
      report_scope = "validation_summary"
    )
    valor <- .casos_ump_registros_df(reporte$response_audit %||% list())
    assign(sid, list(key = key, auditoria = valor), envir = .monitoreo_territorial_casos_ump_cache)
    valor
  }
  anulado <- .monitoreo_territorial_production_annulment_mask(auditoria, cfg$territorial %||% list(), phase)
  # C7: el Estado declarado por campo, también de Material y de solo lectura.
  estados <- tryCatch(collection_territorial_estado_get(sid), error = function(e) NULL)
  monitoreo_territorial_asignacion_planificada_desde(auditoria, asig, anulado = anulado, phase = phase, estados = estados)
}

mount_monitoreo_territorial_asignacion_planificada <- function(pr) {
  pr |>
    plumber::pr_get("/api/monitoreo/territorial/asignacion-planificada", wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      .monitoreo_territorial_asignacion_planificada_from_session(sid)
    }))
}
