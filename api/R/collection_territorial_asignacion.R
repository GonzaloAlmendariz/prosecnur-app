# collection_territorial_asignacion.R — qué encuestador va a cada UMP de la campaña
# territorial (decisión I3 de Gonzalo, 2026-10-31; contrato en
# docs/qa/contrato-equipo-territorial-2026-10-31.md, revisado por guardian-contratos).
#
# El equipo NO vive aquí: es la lista de encuestadores de Monitoreo
# (`monitoreo_config$territorial$enumerator_roster`, decisión de Gonzalo «la de
# Monitoreo»), de la que sale el «P844 · Nombre» que Monitoreo ve en el campo. Material
# sólo guarda la asignación UMP → código, materializada por `id_manzana` sobre la FOTO
# enviada de la fase de la campaña (ADR 0118 §3). Un reemplazo hereda en lectura el
# código de su titular salvo que tenga uno propio. Sólo código y nombre: nunca el DNI.
#
# Clave de sesión aparte (`material_territorial_asignacion`, persistible) para no abrir
# la lista cerrada `.MCAMP_ENTRY_KEYS` ni mover `registry_revision`.

MATERIAL_TERRITORIAL_ASIGNACION_SCHEMA <- "material_territorial_asignacion/v1"

# El equipo de Monitoreo, sin DNI: list(code_format, equipo = list(list(codigo, nombre))).
# Con `code_format = "DNI"` el código ES el DNI: no se expone nadie y la asignación queda
# bloqueada (la UI lo explica); nunca sale un DNI de aquí.
.mta_equipo <- function(s) {
  # ADR 0122 §10: si el Planner declaró el equipo, la lista es la suya para el perfil
  # territorial (activos, sólo código y nombre); si no, el roster de Monitoreo de respaldo.
  # Con code_format DNI no se entrega a nadie, venga de donde venga.
  pl <- tryCatch(.planner_equipo_de(s, "territorial"), error = function(e) NULL)
  if (is.list(pl) && identical(pl$origen, "declarado")) {
    if (isTRUE(pl$bloqueado)) return(list(code_format = "DNI", equipo = list(), origen = "planner"))
    activos <- Filter(function(p) isTRUE(p$activo) && nzchar(p$codigo %||% ""), pl$personas %||% list())
    if (length(activos)) {
      return(list(code_format = pl$code_format %||% "PXXX", origen = "planner",
                  equipo = lapply(activos, function(p) list(codigo = p$codigo, nombre = p$nombre %||% ""))))
    }
  }
  raw <- ((s$monitoreo_config %||% list())$territorial %||% list())$enumerator_roster %||% list()
  ro <- tryCatch(.monitoreo_territorial_normalize_enumerator_roster(raw), error = function(e) NULL)
  if (is.null(ro)) return(list(code_format = "PXXX", equipo = list()))
  if (identical(ro$code_format, "DNI")) return(list(code_format = "DNI", equipo = list()))
  list(code_format = ro$code_format,
       equipo = lapply(ro$assignments, function(a) list(codigo = a$codigo_pulso, nombre = a$nombre)))
}

# La asignación guardada, normalizada al leer (lo que no tiene forma se ignora; nada se escribe).
.mta_guardada <- function(s) {
  x <- s$material_territorial_asignacion
  vacia <- list(schema = MATERIAL_TERRITORIAL_ASIGNACION_SCHEMA, campaign_id = NA_character_, fase = NA_character_,
                revision = 0L, asignacion = list(), sample_fingerprint = NA_character_, updated_at = NA_character_,
                estados = list(), estados_at = NA_character_)
  if (!is.list(x) || !identical(as.character(x$schema %||% ""), MATERIAL_TERRITORIAL_ASIGNACION_SCHEMA)) return(vacia)
  filas <- Filter(function(a) is.list(a) && nzchar(.hojas_ruta_envio_chr(a$id_manzana)) && nzchar(.hojas_ruta_envio_chr(a$codigo)),
                  x$asignacion %||% list())
  list(schema = MATERIAL_TERRITORIAL_ASIGNACION_SCHEMA,
       campaign_id = .hojas_ruta_envio_chr(x$campaign_id), fase = .hojas_ruta_envio_chr(x$fase),
       revision = max(0L, suppressWarnings(as.integer(x$revision %||% 0L)), na.rm = TRUE),
       asignacion = lapply(filas, function(a) list(id_manzana = .hojas_ruta_envio_chr(a$id_manzana), codigo = .hojas_ruta_envio_chr(a$codigo))),
       sample_fingerprint = .hojas_ruta_envio_chr(x$sample_fingerprint), updated_at = .hojas_ruta_envio_chr(x$updated_at),
       # C7: el Estado y las fechas que campo declara en el Excel (campo aditivo; sin él, vacío).
       estados = .mte_limpiar(x$estados), estados_at = .hojas_ruta_envio_chr(x$estados_at))
}

.mta_campana <- function(s, campaign_id) {
  id <- .mcamp_id_arg(campaign_id %||% .MCAMP_TERRITORIAL_ID)
  hit <- .mcamp_list(s)$territorial
  if (is.null(hit) || !identical(hit$entry$id, id)) {
    stop_api(404, "E_COLLECTION_CAMPAIGN_NOT_FOUND", "La campaña no existe en este proyecto.", details = list(id = id))
  }
  hit
}

# UMP de la foto: titulares y reemplazos con su titular.
.mta_unidades <- function(envio) {
  if (is.null(envio)) return(list())
  c(lapply(.hojas_ruta_envio_rows(envio$sample$blocks), .mcamp_territorial_unidad, role = "titular"),
    lapply(.hojas_ruta_envio_rows(envio$sample$replacement_blocks), .mcamp_territorial_unidad, role = "reemplazo"))
}

#' Asignación UMP → encuestador de la campaña territorial (lectura pura).
#'
#' Sin foto responde con `sin_fuente = TRUE` y la asignación vacía (la lee también
#' Monitoreo); sin campaña, 404.
#' @keywords internal
collection_territorial_asignacion_get <- function(sid, campaign_id = NULL) {
  s <- session_get(sid)
  hit <- .mta_campana(s, campaign_id)
  fase <- .mcamp_territorial_fase_of(hit$entry)
  envio <- .mcamp_territorial_envio(s, fase)
  eq <- .mta_equipo(s)
  g <- .mta_guardada(s)
  propia <- identical(g$campaign_id, hit$entry$id) && identical(g$fase, fase)
  explicita <- if (propia) stats::setNames(vapply(g$asignacion, `[[`, "", "codigo"), vapply(g$asignacion, `[[`, "", "id_manzana")) else character(0)
  unidades <- .mta_unidades(envio)
  ids <- vapply(unidades, `[[`, "", "unit_id")
  asignacion <- lapply(unidades, function(u) {
    codigo <- unname(explicita[u$unit_id])
    origen <- "explicita"
    if (is.na(codigo) && identical(u$role, "reemplazo") && !is.na(u$titular_id)) {
      codigo <- unname(explicita[u$titular_id]); origen <- "heredada"
    }
    if (is.na(codigo)) return(NULL)
    list(id_manzana = u$unit_id, label = u$label, role = u$role, codigo = codigo, origen = origen)
  })
  asignacion <- Filter(Negate(is.null), asignacion)
  codigos_equipo <- vapply(eq$equipo, `[[`, "", "codigo")
  list(
    ok = TRUE, campaign_id = hit$entry$id, fase = fase,
    equipo = eq$equipo, code_format = eq$code_format,
    asignacion = asignacion,
    asignacion_revision = if (propia) g$revision else 0L,
    sample_fingerprint = if (propia) g$sample_fingerprint else NA_character_,
    sin_fuente = is.null(envio),
    stale = if (is.null(envio)) TRUE else .mcamp_territorial_stale(s, fase, envio),
    desactualizada = propia && !is.null(envio) && nzchar(g$sample_fingerprint) && !identical(g$sample_fingerprint, envio$sample_fingerprint),
    huerfanas = as.integer(sum(!names(explicita) %in% ids)),
    codigos_fuera_del_equipo = if (identical(eq$code_format, "DNI")) list() else as.list(sort(unique(setdiff(unname(explicita), codigos_equipo))))
  )
}

#' Guarda la asignación UMP → encuestador. Valida contra la foto de la fase de la
#' campaña y contra el equipo de Monitoreo; con la foto desactualizada no se asigna
#' (como F2b no genera). Devuelve cuántas asignaciones viejas se descartaron.
#' @keywords internal
collection_territorial_asignacion_put <- function(sid, campaign_id = NULL, asignacion = list(), expected_revision = NULL,
                                                  estados = NULL) {
  s <- session_get(sid)
  hit <- .mta_campana(s, campaign_id)
  fase <- .mcamp_territorial_fase_of(hit$entry)
  envio <- .mcamp_territorial_envio(s, fase)
  if (is.null(envio)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_SIN_FUENTE", "La muestra enviada desde Hojas de ruta ya no está: vuelve a enviarla.",
             details = list(id = hit$entry$id, fase = fase))
  }
  if (.mcamp_territorial_stale(s, fase, envio)) {
    stop_api(409, "E_COLLECTION_TERRITORIAL_DESACTUALIZADA",
             "La muestra cambió en Hojas de ruta desde el envío: reenvíala antes de asignar encuestadores.",
             details = list(id = hit$entry$id, fase = fase))
  }
  g <- .mta_guardada(s)
  propia <- identical(g$campaign_id, hit$entry$id) && identical(g$fase, fase)
  actual <- if (propia) g$revision else 0L
  if (!is.null(expected_revision) && length(expected_revision)) {
    esperada <- suppressWarnings(as.integer(unlist(expected_revision)[1]))
    if (is.na(esperada) || !identical(esperada, actual)) {
      stop_api(409, "E_COLLECTION_TERRITORIAL_ASIGNACION_STALE", "La asignación cambió desde que se abrió la pantalla.",
               details = list(expected = if (is.na(esperada)) NULL else esperada, current = actual))
    }
  }
  eq <- .mta_equipo(s)
  codigos <- vapply(eq$equipo, `[[`, "", "codigo")
  ids <- vapply(.mta_unidades(envio), `[[`, "", "unit_id")
  filas <- if (is.data.frame(asignacion)) lapply(seq_len(nrow(asignacion)), function(i) as.list(asignacion[i, , drop = FALSE])) else Filter(is.list, asignacion %||% list())
  limpias <- list(); malas <- list()
  for (a in filas) {
    id <- .hojas_ruta_envio_chr(a$id_manzana)
    crudo <- .hojas_ruta_envio_chr(a$codigo)
    if (!nzchar(crudo)) next  # vacío = sin asignar
    codigo <- .monitoreo_territorial_clean_code(crudo, eq$code_format)
    if (!id %in% ids) { malas[[length(malas) + 1L]] <- list(id_manzana = id, motivo = "no está en la muestra enviada"); next }
    if (!codigo %in% codigos) { malas[[length(malas) + 1L]] <- list(id_manzana = id, codigo = crudo, motivo = "no está en el equipo de Monitoreo"); next }
    limpias[[id]] <- list(id_manzana = id, codigo = codigo)
  }
  if (length(malas)) {
    stop_api(422, "E_COLLECTION_TERRITORIAL_ASIGNACION_INVALIDA",
             sprintf("%d asignación(es) no se pueden guardar: la UMP no está en la muestra enviada o el código no está en el equipo de Monitoreo.", length(malas)),
             details = list(invalidas = malas))
  }
  previas <- if (propia) vapply(g$asignacion, `[[`, "", "id_manzana") else character(0)
  ahora <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  # C7: `estados` llega sólo al aplicar un Excel leído; sin él (el selector de la app) se
  # conserva lo declarado, salvo que sea de otra muestra.
  if (is.null(estados)) {
    misma <- propia && identical(g$sample_fingerprint, envio$sample_fingerprint)
    est <- if (misma) g$estados else list(); est_at <- if (misma) g$estados_at else NA_character_
  } else {
    filas_e <- if (is.data.frame(estados)) lapply(seq_len(nrow(estados)), function(i) as.list(estados[i, , drop = FALSE])) else estados
    est <- Filter(function(e) e$id_manzana %in% ids, .mte_limpiar(filas_e)); est_at <- ahora
  }
  nuevo <- list(schema = MATERIAL_TERRITORIAL_ASIGNACION_SCHEMA, campaign_id = hit$entry$id, fase = fase,
                revision = actual + 1L, asignacion = unname(limpias), sample_fingerprint = envio$sample_fingerprint,
                updated_at = ahora, estados = unname(est), estados_at = est_at)
  session_set(sid, "material_territorial_asignacion", nuevo)
  r <- collection_territorial_asignacion_get(sid, hit$entry$id)
  r$descartadas <- as.integer(sum(!previas %in% ids))
  r
}
