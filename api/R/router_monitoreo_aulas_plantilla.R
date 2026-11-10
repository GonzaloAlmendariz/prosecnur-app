# =============================================================================
# router_monitoreo_aulas_plantilla.R — la plantilla de disponibilidad, descargable
# =============================================================================
#
# Gonzalo, 2026-09-21: «la app debe ser capaz de dar un formato para que el
# coordinador pueda llenarlos fácilmente, quizás que ya todas las columnas ya
# estén y él solo ponga el nombre del aplicador y la x por día y hora».
#
# El motor (`aulas_disponibilidad_plantilla()`) existía y nadie lo llamaba: una
# capacidad sin consumidor no es una capacidad. Ésta es la puerta.
#
# Contrato:
#   POST /api/monitoreo/aulas/disponibilidad/plantilla
#     Cuerpo opcional `{dias, desde, hasta, filas}`. Devuelve un `file_id`
#     descargable por la vía de siempre.
#
# Los nombres YA CONOCIDOS se escriben en las primeras filas. Es la mitad del
# valor: la segunda vuelta —«¿qué pasa si quiero enviarte una actualizada?»—
# no obliga a reteclear a nadie, y quien la llene ve a quién ya está declarado.
#
# Vive en archivo propio porque `router_monitoreo.R` está congelado a
# crecimiento (`agentic/manifest.json`).
# =============================================================================

# Frontera testeable: decide el contenido de la plantilla desde la sesión y el
# cuerpo del pedido. Separada del handler para fijar el contrato sin plumber.
.monitoreo_aulas_plantilla_args <- function(sid, body = list()) {
  s <- session_get(sid)
  disp <- s[["monitoreo_aulas_disponibilidad"]] %||% list()
  nombres <- vapply(disp, function(a) {
    trimws(as.character((a %||% list())[["nombre"]] %||% "")[1])
  }, character(1))
  nombres <- unique(nombres[nzchar(nombres) & !is.na(nombres)])

  entero <- function(x, por_defecto) {
    v <- suppressWarnings(as.integer(x %||% NA)[1])
    if (is.na(v)) por_defecto else v
  }
  dias <- as.character(unlist(body[["dias"]] %||% list()))
  dias <- dias[nzchar(trimws(dias))]
  if (!length(dias)) {
    dias <- c("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado")
  }
  # Las filas en blanco se piden SOBRE los nombres conocidos, no incluyéndolos:
  # una plantilla con 8 declarados y 25 filas deja 25 huecos para gente nueva.
  huecos <- max(0L, entero(body[["filas"]], 25L))
  list(dias = dias,
       desde = entero(body[["desde"]], 7L),
       hasta = entero(body[["hasta"]], 22L),
       filas = length(nombres) + huecos,
       aplicadores = nombres)
}

mount_monitoreo_aulas_plantilla <- function(pr) {
  pr |>
    plumber::pr_post("/api/monitoreo/aulas/disponibilidad/plantilla",
                     wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      parsed <- .monitoreo_parse_body(req)
      args <- .monitoreo_aulas_plantilla_args(sid, parsed %||% list())
      s <- session_get(sid)
      dir.create(file.path(s$dir, "downloads"), showWarnings = FALSE, recursive = TRUE)
      out_name <- .export_filename(sid, "disponibilidad_aplicadores_PLANTILLA", "xlsx")
      out_path <- file.path(s$dir, "downloads",
                            sprintf("%s_%s", uuid::UUIDgenerate(), out_name))
      aulas_disponibilidad_plantilla(out_path, dias = args$dias,
                                     desde = args$desde, hasta = args$hasta,
                                     filas = args$filas,
                                     aplicadores = args$aplicadores)
      # ADR 0133 (fase 5): la plantilla se guarda en la carpeta del módulo que la pide;
      # desde Material de campo es `aulas_disponibilidad_plantilla`.
      meta <- .register_output_file(sid, "monitoreo_aulas_disponibilidad_plantilla", out_path)
      entregable_respuesta(list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name,
                                size = meta$size, aplicadores = length(args$aplicadores)), meta)
    })) |>
    # La carga de campo como .xlsx real (malla y detalle en dos hojas); la lógica
    # vive en monitoreo_aulas_carga_de_campo.R.
    plumber::pr_post("/api/monitoreo/aulas/carga-de-campo/excel",
                     wrap_endpoint(function(req, res, ...) {
      sid <- .monitoreo_session(req, res)
      monitoreo_aulas_carga_de_campo_excel(sid, .monitoreo_parse_body(req) %||% list())
    }))
}
