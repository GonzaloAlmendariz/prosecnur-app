# Rutas del sorteo de Muestra general (ADR 0090). Router delgado: lee el
# archivo declarado, llama al engine (calc_muestra_general_marco.R) y guarda
# el estado. La exportación del listado llega con E6.

# Lee la hoja del marco traduciendo los errores de lectura a 400 accionables
# (mismo criterio que /marco/explorar-base: el usuario debe ver qué hojas hay).
.cm_general_leer_marco <- function(sid, file_id, hoja = "") {
  if (!nzchar(file_id)) {
    stop_api(400, "E_CALC_MUESTRA_FILE_REQUIRED", "Sube primero el archivo del marco.")
  }
  meta <- get_file(sid, file_id)
  tryCatch(
    .cm_aulas_read_table(meta$path, if (nzchar(hoja)) hoja else NULL),
    error = function(e) {
      if (inherits(e, "api_error")) stop(e)
      if (inherits(e, "cm_aulas_hoja_error")) {
        stop_api(400, "E_CALC_MUESTRA_EXPLORAR_HOJA", conditionMessage(e))
      }
      stop_api(400, "E_CALC_MUESTRA_EXPLORAR_ARCHIVO", conditionMessage(e))
    }
  )
}

mount_calc_muestra_general <- function(pr) {
  pr |>
    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/general/marco
    # Body: { componente_id, file_id, hoja?, columnas: { id, estrato?, tamano? } }
    # Declara el archivo de marco del componente y escribe N y N_h en él.
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/general/marco",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      componente_id <- calc_str(body$componente_id, "")
      file_id <- calc_str(body$file_id, "")
      hoja <- calc_str(body$hoja %||% body$sheet, "")
      datos <- .cm_general_leer_marco(sid, file_id, hoja)
      s <- session_get(sid)
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      out <- calc_muestra_general_declarar_marco(
        estudio, s$calc_muestra_general, componente_id, datos,
        file_id = file_id, hoja = hoja, columnas = body$columnas
      )
      session_set(sid, "calc_muestra_estudio", out$estudio)
      session_set(sid, "calc_muestra_general", out$estado)
      list(ok = TRUE, marco = out$marco, componente = out$componente, estudio = out$estudio)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/general/seleccionar
    # Body: { componente_id, metodo, semilla?, orden_por?, reservas_por_estrato? }
    # -----------------------------------------------------------------------
    # Serializador propio sin redondeo: el global deja 4 decimales y una π de
    # 0.0000371 (PPS sobre un marco grande) viajaba como 0 —peso infinito en
    # el cliente—. Medido el 2026-09-24.
    plumber::pr_post("/api/calc-muestra/general/seleccionar",
                     serializer = plumber::serializer_unboxed_json(na = "null", digits = NA),
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      componente_id <- calc_str(body$componente_id, "")
      s <- session_get(sid)
      estado <- .cm_general_estado(s$calc_muestra_general)
      marco <- estado$marcos[[componente_id]]
      if (is.null(marco)) {
        stop_api(409, "E_CALC_MUESTRA_GENERAL_SIN_MARCO",
                 "Declara primero el archivo de marco de este componente (Marco).")
      }
      datos <- .cm_general_leer_marco(sid, marco$file_id, marco$hoja %||% "")
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      orden_por <- calc_str(body$orden_por, "")
      out <- calc_muestra_general_seleccionar(
        estudio, estado, componente_id, datos,
        metodo = calc_str(body$metodo, "mas"),
        semilla = if (is.null(body$semilla)) NULL else calc_int(body$semilla, .CM_GENERAL_SEMILLA_DEFAULT, min = 1L),
        orden_por = if (nzchar(orden_por)) orden_por else NULL,
        reservas_por_estrato = calc_int(body$reservas_por_estrato, 0L, min = 0L, max = 10000L)
      )
      session_set(sid, "calc_muestra_general", out$estado)
      c(list(ok = TRUE), out$corrida)
    })) |>

    # -----------------------------------------------------------------------
    # GET /api/calc-muestra/general/corrida?componente_id=...
    # La corrida vigente completa (con unidades), para rehidratar la vista al
    # reabrir el proyecto. Sin redondeo, por lo mismo que /seleccionar.
    # -----------------------------------------------------------------------
    plumber::pr_get("/api/calc-muestra/general/corrida",
                    serializer = plumber::serializer_unboxed_json(na = "null", digits = NA),
                    wrap_endpoint(function(req, res, componente_id = "", ...) {
      sid <- session_header(req)
      estado <- .cm_general_estado(session_get(sid)$calc_muestra_general)
      corrida <- estado$corridas[[calc_str(componente_id, "")]]
      if (is.null(corrida)) {
        stop_api(404, "E_CALC_MUESTRA_GENERAL_SIN_CORRIDA",
                 "Este componente todavía no tiene un sorteo.")
      }
      c(list(ok = TRUE), corrida)
    })) |>

    # -----------------------------------------------------------------------
    # POST /api/calc-muestra/general/exportar
    # Body: { componente_id }. Libro de entrega de la corrida vigente
    # (Corrida, Memoria de cálculo, Estratos, Listado); mismo patrón de
    # descarga que /aulas/exportar (archivo registrado + file_id).
    # -----------------------------------------------------------------------
    plumber::pr_post("/api/calc-muestra/general/exportar",
                     wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body <- .cm_parse_body(req)
      componente_id <- calc_str(body$componente_id, "")
      s <- session_get(sid)
      estado <- .cm_general_estado(s$calc_muestra_general)
      corrida <- estado$corridas[[componente_id]]
      if (is.null(corrida)) {
        stop_api(404, "E_CALC_MUESTRA_GENERAL_SIN_CORRIDA",
                 "Este componente todavía no tiene un sorteo que exportar.")
      }
      estudio <- s$calc_muestra_estudio %||% calc_muestra_normalize_estudio(list())
      comp <- estudio$componentes[[.cm_general_buscar_componente(estudio, componente_id)]]
      resultado <- comp$resultado %||% calc_muestra_calcular_componente(comp)
      out_path <- tempfile("calc_muestra_general_", fileext = ".xlsx")
      calc_muestra_general_exportar_workbook(corrida, estado$marcos[[componente_id]] %||% list(),
                                             comp, resultado, out_path)
      out_name <- .export_filename(sid, "calc_muestra_sorteo", "xlsx")
      meta <- .register_output_file(sid, "calc_muestra_general_sorteo", out_path, original_name = out_name)
      list(ok = TRUE, export = list(file_id = meta$file_id, filename = meta$original_name, size = meta$size))
    }))
}
