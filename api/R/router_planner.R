# =============================================================================
# Endpoints HTTP del Planner (ADR 0122)
# =============================================================================
#
# Router delgado: valida la entrada, llama a planner_modelo.R y serializa con
# el mismo payload que devuelve la lectura. Sólo se monta fuera del modo
# público (ADR 0122 §9): el Planner trae el equipo y no se publica.

.planner_parse_body <- function(req) {
  body_raw <- req$postBody %||% "{}"
  if (!nzchar(trimws(body_raw))) return(list())
  tryCatch(
    jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
    error = function(e) stop_api(400, "E_PLANNER_JSON", "El cuerpo de la petición no es JSON válido.")
  )
}

mount_planner <- function(pr) {
  pr |>
    # Lectura pura: no escribe ni marca el proyecto como modificado.
    plumber::pr_get("/api/planner",
                    wrap_endpoint(function(req, res, ...) {
      .planner_payload(session_get(session_header(req)))
    })) |>

    # El modo que los perfiles fijan en cada módulo (§4). Lectura pura; la
    # consumen Cálculo, Material, Monitoreo, Hojas de ruta y el Home (P2).
    plumber::pr_get("/api/planner/modos",
                    wrap_endpoint(function(req, res, ...) {
      .planner_modos(session_get(session_header(req)))
    })) |>

    # Cronograma, ventana de campo y etapa operativa (piloto o campo) leídos
    # juntos de donde viven hoy, con aviso si no coinciden. Lectura pura.
    plumber::pr_get("/api/planner/calendario",
                    wrap_endpoint(function(req, res, ...) {
      .planner_calendario(session_get(session_header(req)))
    })) |>

    # Los catálogos de códigos (resultado de la visita y status del barrido)
    # para Material y Monitoreo. Lectura pura.
    plumber::pr_get("/api/planner/codigos",
                    wrap_endpoint(function(req, res, ...) {
      .planner_codigos(session_get(session_header(req)))
    })) |>

    # El equipo de un perfil (encuestadores, aplicadores) para Material y
    # Monitoreo: código y nombre, nunca el DNI. Lectura pura.
    plumber::pr_get("/api/planner/equipo/<perfil>",
                    wrap_endpoint(function(req, res, perfil, ...) {
      .planner_equipo_de(session_get(session_header(req)), .bit_texto(perfil, 40L))
    })) |>

    # La plantilla del equipo en Excel y su lectura de vuelta (planner_equipo_excel.R).
    # Leer es puro: devuelve las personas para revisar; guarda el PUT de abajo.
    plumber::pr_post("/api/planner/equipo-excel",
                     wrap_endpoint(function(req, res, ...) {
      .planner_equipo_excel(session_header(req))
    })) |>
    plumber::pr_post("/api/planner/equipo-excel/importar",
                     wrap_endpoint(function(req, res, ...) {
      input <- .planner_import_request(req)
      .planner_equipo_importar(session_header(req), file_raw = input$file_raw, content_base64 = input$content_base64)
    })) |>

    plumber::pr_put("/api/planner/<seccion>",
                    wrap_endpoint(function(req, res, seccion, ...) {
      sid <- session_header(req)
      body <- .planner_parse_body(req)
      .planner_declarar(sid, .bit_texto(seccion, 40L), body$valor, body$expected_revision)
      .planner_payload(session_get(sid))
    }))
}
