# =============================================================================
# Cálculo de muestra declara la representatividad del estudio (ADR 0121, 0123 Q1)
# =============================================================================
#
# El universo y las variables de cuota son de Cálculo de muestra (ADR 0123 §2):
# se guardan en su clave propia, `calc_muestra_representatividad`, y Monitoreo
# los recibe en la foto sellada `design_targets` al importar el plan. Ya no se
# escriben en el Planner. Sólo universo y variables: las celdas con meta se
# quedan en el escenario. Cálculo no cambia cómo reparte —la afijación por N
# variables está sin decidir (ADR 0121, «Lo que no decide»).
#
# Router delgado: el contenido lo arma `.cmrep_bloque()` a partir de la misma
# traducción que lee el tablero.

#' Universo y variables del escenario vigente, listos para declarar.
#'
#' @param s la sesión.
#' @param universo universo que manda quien declara, o `NULL` para el deducido
#'   del plan.
#' @return lista `{schema, universo, variables}`; `NULL` si el diseño todavía
#'   no fija metas.
#' @keywords internal
.cmrep_bloque <- function(s, universo = NULL) {
  cfg <- s[["monitoreo_config"]] %||% list()
  aulas <- if (is.list(cfg[["aulas_universitarias"]])) cfg[["aulas_universitarias"]] else list()
  # Se declara desde la traducción fresca del escenario, no desde lo que ya
  # viajó en la foto o lo que dice el Planner: si no, la primera declaración se
  # copiaría a sí misma y el escenario nuevo nunca llegaría.
  aulas$representatividad_planner <- NULL
  if (is.list(aulas$design_targets)) aulas$design_targets$representatividad <- NULL
  plan <- tryCatch(.monitoreo_aulas_df(aulas[["plan"]] %||% list(), "plan"), error = function(e) NULL)
  # El plan ya no viaja en la config: sin él, el universo se deduce de las
  # facultades con meta en el diseño (una = esa facultad; varias = universidad).
  # Sólo con el eje «facultad»: en CCSS el campo `facultad` del contrato v1
  # trae niveles y la deducción diría «universidad» de una sola facultad.
  eje_facultad <- identical(.monitoreo_scalar(monitoreo_aulas_eje(aulas)$clave, "facultad"), "facultad")
  if ((!is.data.frame(plan) || !nrow(plan)) && eje_facultad) {
    fac <- vapply((aulas$design_targets %||% list())$facultades %||% list(),
                  function(f) .monitoreo_scalar(f$facultad, ""), "")
    fac <- fac[nzchar(fac)]
    if (length(fac)) plan <- data.frame(faculty = fac, stringsAsFactors = FALSE)
  }
  rep <- monitoreo_aulas_representatividad_declarada(aulas, plan = plan)
  if (!is.list(rep) || !length(rep$variables)) return(NULL)
  uni <- if (is.list(universo) && length(universo)) universo else rep$universo
  if (is.list(uni)) {
    # Quien declara confirma el universo: deja de ser una deducción.
    uni$inferido <- FALSE
    uni$motivo <- "Declarado desde Cálculo de muestra."
  }
  list(schema = "representatividad_v1", universo = uni, variables = rep$variables,
       # El sorteo sobre el que se declara: al importar, Monitoreo sólo la copia a
       # la foto si es el mismo (monitoreo_aulas_from_calc).
       selection_run_id = .monitoreo_scalar(aulas$selection_run_id, ""),
       frame_hash = .monitoreo_scalar(aulas$frame_hash, ""))
}

# ¿Lo guardado es del sorteo que hoy tiene Monitoreo? (NA sin nada guardado).
.cmrep_sorteo_vigente <- function(s) {
  guardada <- s[["calc_muestra_representatividad"]]
  if (!is.list(guardada)) return(NA)
  decl <- .monitoreo_scalar(guardada$selection_run_id, "")
  vigente <- .monitoreo_scalar(((s[["monitoreo_config"]] %||% list())[["aulas_universitarias"]] %||% list())$selection_run_id, "")
  !nzchar(decl) || identical(decl, vigente)
}

# ¿La foto que mide Monitoreo ya trae lo que Cálculo guardó?
.cmrep_en_la_foto <- function(s) {
  guardada <- s[["calc_muestra_representatividad"]]
  if (!is.list(guardada)) return(NA)
  dt <- ((s[["monitoreo_config"]] %||% list())[["aulas_universitarias"]] %||% list())[["design_targets"]]
  foto <- if (is.list(dt)) dt[["representatividad"]] else NULL
  is.list(foto) && identical(.monitoreo_scalar(foto$declarado_en, ""), .monitoreo_scalar(guardada$declarado_en, ""))
}

#' Guarda universo y variables en la clave de Cálculo (ADR 0123 Q1).
#' @return el bloque guardado, o `NULL` si el escenario no fija metas.
#' @keywords internal
.cmrep_declarar <- function(sid, universo = NULL) {
  bloque <- .cmrep_bloque(session_get(sid), universo)
  if (is.null(bloque)) return(NULL)
  if (!is.list(bloque$universo) || !nzchar(.monitoreo_scalar(bloque$universo$nivel, ""))) {
    stop_api(409, "E_CALC_MUESTRA_SIN_UNIVERSO",
             "No se puede deducir el universo del estudio: indica si es la universidad o una facultad.")
  }
  bloque$declarado_en <- format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  session_set(sid, "calc_muestra_representatividad", bloque)
  bloque
}

.cmrep_parse_body <- function(req) {
  body_raw <- req$postBody %||% "{}"
  if (!nzchar(trimws(body_raw))) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_BAD_JSON", "El cuerpo de la petición no es JSON válido.")
  )
}

mount_calc_muestra_representatividad <- function(pr) {
  pr |>
    # Vista previa: lo que se declararía, sin escribir nada.
    plumber::pr_get("/api/calc-muestra/representatividad",
                    wrap_endpoint(function(req, res, ...) {
      s <- session_get(session_header(req))
      bloque <- .cmrep_bloque(s)
      list(ok = TRUE, disponible = !is.null(bloque), representatividad = bloque,
           declarada = s[["calc_muestra_representatividad"]] %||% NULL,
           en_la_foto = .cmrep_en_la_foto(s),
           # Lo guardado se hizo sobre el sorteo que hoy mide Monitoreo; si no,
           # hay que volver a guardar (reimportar no lo trae).
           sorteo_vigente = .cmrep_sorteo_vigente(s))
    })) |>

    plumber::pr_post("/api/calc-muestra/representatividad/declarar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cmrep_parse_body(req)
      bloque <- .cmrep_declarar(sid, body$universo)
      if (is.null(bloque)) {
        stop_api(409, "E_NO_CALC_MUESTRA_AULAS",
                 "El escenario todavía no fija metas: no hay variables de cuota que declarar.")
      }
      list(ok = TRUE, representatividad = bloque, declarada = bloque)
    }))
}
