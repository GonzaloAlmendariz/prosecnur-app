# =============================================================================
# Cálculo de muestra declara la representatividad en el Planner (ADR 0121 F4)
# =============================================================================
#
# Desde el ADR 0122 el universo y las variables de cuota se declaran en el
# Planner, y Cálculo de muestra es quien sabe cuáles usa su escenario. Este
# endpoint los manda por la puerta que el Planner abrió para esto
# (`.planner_declarar_representatividad`): sólo universo y variables; las
# celdas con meta se quedan en el escenario. Cálculo no cambia cómo reparte —
# la afijación por N variables está sin decidir (ADR 0121, «Lo que no decide»).
#
# Router delgado: el contenido lo arma `.cmrep_bloque()` a partir de la misma
# traducción que lee el tablero, y la escritura es del Planner, que exige la
# revisión vigente (409 E_PLANNER_DESACTUALIZADO).

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
  plan <- tryCatch(.monitoreo_aulas_df(aulas[["plan"]] %||% list(), "plan"), error = function(e) NULL)
  rep <- monitoreo_aulas_representatividad_declarada(aulas, plan = plan)
  if (!is.list(rep) || !length(rep$variables)) return(NULL)
  uni <- if (is.list(universo) && length(universo)) universo else rep$universo
  if (is.list(uni)) {
    # Quien declara confirma el universo: deja de ser una deducción.
    uni$inferido <- FALSE
    uni$motivo <- "Declarado desde Cálculo de muestra."
  }
  list(schema = "representatividad_v1", universo = uni, variables = rep$variables)
}

.cmrep_parse_body <- function(req) {
  body_raw <- req$postBody %||% "{}"
  if (!nzchar(trimws(body_raw))) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_PLANNER_JSON", "El cuerpo de la petición no es JSON válido.")
  )
}

mount_calc_muestra_representatividad <- function(pr) {
  pr |>
    # Vista previa: lo que se declararía, sin escribir nada.
    plumber::pr_get("/api/calc-muestra/representatividad",
                    wrap_endpoint(function(req, res, ...) {
      bloque <- .cmrep_bloque(session_get(session_header(req)))
      list(ok = TRUE, disponible = !is.null(bloque), representatividad = bloque)
    })) |>

    plumber::pr_post("/api/calc-muestra/representatividad/declarar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cmrep_parse_body(req)
      bloque <- .cmrep_bloque(session_get(sid), body$universo)
      if (is.null(bloque)) {
        stop_api(409, "E_NO_CALC_MUESTRA_AULAS",
                 "El escenario todavía no fija metas: no hay variables de cuota que declarar.")
      }
      .planner_declarar_representatividad(
        sid,
        .bit_texto(body$tipo %||% "aulas", 40L),
        .bit_texto(body$poblacion_id %||% "principal", 80L),
        bloque,
        body$expected_revision
      )
      list(ok = TRUE, representatividad = bloque, planner = .planner_payload(session_get(sid)))
    }))
}
