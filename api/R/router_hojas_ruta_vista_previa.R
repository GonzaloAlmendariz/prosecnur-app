# Vista previa de la hoja de ruta (ficha de una UMP) y hoja del día (U15).
# Router delgado: valida el cuerpo, toma la muestra GUARDADA del run activo, llama
# al motor y registra el archivo para descargar (file_id). No guarda nada en el run.

.hojas_ruta_vp_requiere_muestra <- function(sid) {
  guardada <- .hojas_ruta_vp_muestra_guardada(sid)
  if (is.null(guardada)) {
    stop_api(409, "E_NO_SAMPLE", "Primero sortea las manzanas: la hoja de ruta se arma sobre la muestra guardada.")
  }
  guardada
}

mount_hojas_ruta_vista_previa <- function(pr) {
  pr |>
    plumber::pr_post("/api/hojas-ruta/ficha-ump", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      id <- trimws(as.character(parsed$id_manzana %||% "")[1])
      if (is.na(id) || !nzchar(id)) stop_api(400, "E_BAD_REQUEST", "Falta el id_manzana de la UMP.")
      formato <- tolower(trimws(as.character(parsed$formato %||% "png")[1]))
      if (!formato %in% c("png", "pdf")) stop_api(400, "E_BAD_REQUEST", "El formato debe ser «png» o «pdf».")
      guardada <- .hojas_ruta_vp_requiere_muestra(sid)
      found <- hojas_ruta_vp_buscar_bloque(guardada$sample, id)
      if (is.null(found)) {
        stop_api(404, "E_NOT_FOUND", sprintf("La manzana %s no está entre las titulares ni los reemplazos de la muestra.", id))
      }
      out <- hojas_ruta_ficha_ump(guardada$sample, found, tempfile(fileext = paste0(".", formato)), formato)
      nombre <- .hojas_ruta_vp_nombre_ficha(found$block, found$tipo, out$formato)
      meta <- .register_output_file(sid, "hojas_ruta_ficha_ump", out$path, original_name = nombre)
      list(
        ok = TRUE,
        file_id = meta$file_id,
        filename = meta$original_name,
        formato = out$formato,
        id_manzana = id,
        tipo = found$tipo
      )
    })) |>
    plumber::pr_post("/api/hojas-ruta/hoja-dia", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      parsed <- .hojas_ruta_parse_body(req)
      jornada <- toupper(trimws(as.character(parsed$jornada %||% "")[1]))
      if (is.na(jornada) || !nzchar(jornada)) stop_api(400, "E_BAD_REQUEST", "Falta la jornada (p. ej. «J03»).")
      guardada <- .hojas_ruta_vp_requiere_muestra(sid)
      # Los supuestos del cuerpo mandan; si no vienen, los guardados del plan (U14).
      supuestos <- parsed$supuestos %||% guardada$run$ui_state$plan_campo %||% list()
      modelo <- hojas_ruta_hoja_dia_modelo(guardada$sample, jornada, supuestos)
      if (is.null(modelo)) {
        stop_api(404, "E_NOT_FOUND", sprintf("La jornada %s no existe en el plan de campo con estos supuestos.", jornada))
      }
      out <- tempfile(fileext = ".pdf")
      hojas_ruta_hoja_dia_pdf(modelo, out)
      meta <- .register_output_file(sid, "hojas_ruta_hoja_dia", out, original_name = .hojas_ruta_hd_nombre(modelo))
      list(
        ok = TRUE,
        file_id = meta$file_id,
        filename = meta$original_name,
        jornada = modelo$jornada,
        rutas = as.list(vapply(modelo$rutas, `[[`, character(1), "id_manzana"))
      )
    }))
}
