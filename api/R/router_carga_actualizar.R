# Router de Carga › Actualizar una fuente (plan del revamp de Procesamiento,
# fila "Motor de Carga", puntos 1, 3 y 4). Delgado: lee el cuerpo, delega en
# `carga_actualizar_respuestas.R` y serializa.
#
#   POST /api/estudio/base/respuestas/vista-previa  {nombre, data_file_id}
#   POST /api/estudio/base/respuestas/actualizar    {nombre, data_file_id}
#   POST /api/estudio/base/respuestas/revertir      {nombre}
#
# La vista previa no escribe la sesión. Las tres rutas quedan fuera de la lista
# del modo público.

.carga_actualizar_campos <- function(req, con_archivo = TRUE) {
  parsed <- .carga_parse_json_body(req)
  nombre <- as.character(parsed$nombre %||% "")[1]
  if (is.na(nombre) || !nzchar(nombre)) stop_api(400, "E_MISSING_BASE", "Falta 'nombre'.")
  data_file_id <- as.character(parsed$data_file_id %||% "")[1]
  if (con_archivo && (is.na(data_file_id) || !nzchar(data_file_id))) {
    stop_api(400, "E_MISSING_DATA", "Falta 'data_file_id'.")
  }
  list(nombre = nombre, data_file_id = data_file_id)
}

mount_carga_actualizar <- function(pr) {
  pr |>
    plumber::pr_post("/api/estudio/base/respuestas/vista-previa", wrap_endpoint(function(req, res) {
      x <- .carga_actualizar_campos(req)
      carga_actualizar_vista_previa(session_header(req), x$nombre, x$data_file_id)
    })) |>
    plumber::pr_post("/api/estudio/base/respuestas/actualizar", wrap_endpoint(function(req, res) {
      x <- .carga_actualizar_campos(req)
      carga_actualizar_aplicar(session_header(req), x$nombre, x$data_file_id)
    })) |>
    plumber::pr_post("/api/estudio/base/respuestas/revertir", wrap_endpoint(function(req, res) {
      x <- .carga_actualizar_campos(req, con_archivo = FALSE)
      carga_actualizar_revertir(session_header(req), x$nombre)
    }))
}
