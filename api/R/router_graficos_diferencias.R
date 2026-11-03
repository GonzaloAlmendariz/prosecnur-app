# Router de Diferencias entre grupos (ADR 0126 §5)
#
# Delgado: valida, llama al motor (graficos_significancia_informe.R y compañía) y serializa. La regla del estudio se
# guarda en `graficos_config$significancia` de la base activa.

#' Datos e instrumento de la base activa para la prueba
#' @keywords internal
.sig_fuente_sesion <- function(sid) {
  src <- .graficos_processing_sources(sid)
  if (!length(src$data_sources)) stop_api(409, "E_NO_DATA", "Carga una base antes de revisar diferencias.")
  activa <- .graficos_active_base_name(sid)
  nombre <- if (nzchar(activa) && activa %in% names(src$data_sources)) activa else names(src$data_sources)[[1]]
  list(data = src$data_sources[[nombre]], inst = src$inst_sources[[nombre]] %||% NULL, base = nombre)
}

#' Contexto (regla y familia) de la sesión, con una regla propuesta encima si viene
#' @keywords internal
.sig_contexto_sesion <- function(sid, regla = NULL) {
  f <- .sig_fuente_sesion(sid)
  cfg <- .graficos_config_get(sid)
  if (is.list(regla)) {
    propuesta <- .sig_regla_propuesta(f$data)
    cfg$significancia <- .sig_regla_normalizar(regla, base = propuesta)
  }
  ac <- tryCatch(.analitica_get_config(sid), error = function(e) list())
  if (is.list(cfg$significancia)) .sig_regla_validar_base(.sig_regla_normalizar(cfg$significancia), f$data)
  ctx <- .sig_contexto_estudio(f$data, f$inst, cfg, ac)
  list(ctx = ctx, fuente = .sig_fuente(f$data, f$inst), cfg = cfg, analitica = ac, data = f$data)
}

#' Columnas candidatas a conglomerado y estrato (las que tienen entre 2 y 500 valores distintos)
#' @keywords internal
.sig_columnas_candidatas <- function(data) {
  if (!is.data.frame(data)) return(list())
  out <- list()
  for (nm in names(data)) {
    if (grepl("[/.]", nm)) next
    k <- length(unique(stats::na.omit(data[[nm]])))
    if (k < 2L || k > 500L) next
    out[[length(out) + 1L]] <- list(name = nm, n_valores = k,
                                    conocida = tolower(nm) %in% c(.SIG_CONGLOMERADOS_CONOCIDOS, .SIG_ESTRATOS_CONOCIDOS))
  }
  out
}

#' Respuesta de la regla: guardada o propuesta, más el aviso de celdas que cambian
#' @keywords internal
.sig_respuesta_regla <- function(sc) {
  ctx <- sc$ctx
  cambios <- tryCatch(.sig_cambios_tablas(sc$fuente, ctx$regla, ctx$familia, sc$analitica),
                      error = function(e) list(celdas_total = 0L, celdas_cambian = 0L, ganan_marca = 0L,
                                               pierden_marca = 0L, cambian_letras = 0L, error = conditionMessage(e)))
  list(ok = TRUE, regla = .sig_regla_json(ctx$regla), origen = ctx$origen, cambios_tablas = cambios,
       nota = .sig_texto_linea_marcas(ctx$regla, hay_fragiles = identical(ctx$regla$fragiles, "contorno")),
       familia = as.integer(ctx$m %||% 0L))
}

#' Lee el cuerpo JSON de una petición (la regla)
#' @keywords internal
.sig_leer_regla_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
  if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
  Encoding(body_raw) <- "UTF-8"
  parsed <- tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
                     error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
  regla <- parsed$regla %||% parsed
  if (!is.list(regla)) stop_api(400, "E_BAD_JSON", "Falta la regla.")
  regla
}

mount_graficos_diferencias <- function(pr) {
  pr |>
    plumber::pr_get("/api/graficos/diferencias/regla", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      sc <- .sig_contexto_sesion(sid)
      list(ok = TRUE, regla = .sig_regla_json(sc$ctx$regla), origen = sc$ctx$origen,
           propuesta = .sig_regla_json(.sig_regla_propuesta(sc$data)),
           columnas = .sig_columnas_candidatas(sc$data), familia = as.integer(sc$ctx$m %||% 0L))
    })) |>
    plumber::pr_post("/api/graficos/diferencias/regla/vista-previa", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      .sig_respuesta_regla(.sig_contexto_sesion(sid, .sig_leer_regla_body(req)))
    })) |>
    plumber::pr_post("/api/graficos/diferencias/regla", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      sc <- .sig_contexto_sesion(sid, .sig_leer_regla_body(req))
      cfg <- .graficos_config_get(sid)
      cfg$significancia <- sc$ctx$regla
      .graficos_config_set(sid, cfg)
      c(.sig_respuesta_regla(sc), list(saved_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")))
    })) |>
    plumber::pr_get("/api/graficos/diferencias/informe", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      sc <- .sig_contexto_sesion(sid)
      c(list(ok = TRUE, regla = .sig_regla_json(sc$ctx$regla)), .sig_informe_json(sc$cfg$plan, sc$fuente, sc$ctx))
    })) |>
    plumber::pr_get("/api/graficos/diferencias", wrap_endpoint(function(req, res, slide = "") {
      sid <- session_header(req)
      slide <- as.character(slide %||% "")[1]
      if (is.na(slide) || !nzchar(slide)) stop_api(400, "E_SIG_SIN_LAMINA", "Falta `slide`.")
      sc <- .sig_contexto_sesion(sid)
      s <- .sig_slide_por_id(sc$cfg$plan, slide)
      if (is.null(s)) stop_api(404, "E_SIG_SIN_LAMINA", sprintf("No existe la lámina «%s» en el plan.", slide))
      list(ok = TRUE, regla = .sig_regla_json(sc$ctx$regla), lamina = .sig_lamina_json(s, sc$fuente, sc$ctx))
    }))
}
