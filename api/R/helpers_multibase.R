# Helpers para ejecutar reportes estadísticos single-base sobre TODAS
# las bases de un estudio multi-base (v0.2+).
#
# Diseño:
#   - Las funciones del motor (`reporte_codebook`, `reporte_frecuencias`,
#     `reporte_cruces`, `reporte_enumeradores`, `reporte_spss`) SIGUEN
#     siendo single-base en su firma — reciben un data.frame y un
#     instrumento. No las tocamos.
#   - Este helper itera sobre `estudio_data_sources(sid)` llamando al
#     motor por cada base. Cada base produce un archivo con nombre
#     prefijado (`docentes__codebook.xlsx`, `estudiantes__codebook.xlsx`, …).
#   - Cuando hay >1 base, se empaquetan en un ZIP para que el endpoint
#     responda con un solo file_id descargable. Con 1 sola base, devuelve
#     el archivo directo (mismo comportamiento que la versión legacy).
#
# Uso típico desde un router:
#
#   result <- run_report_multibase(
#     sid = sid,
#     base_filename = "codebook",    # stem, se concatena con la extensión
#     ext = "xlsx",
#     kind_single = "analitica_codebook",      # kind del file store (1 base)
#     kind_multi  = "analitica_codebook_zip",  # kind del file store (N bases)
#     fn = function(rp_data, rp_inst, out_path) {
#       reporte_codebook(data = rp_data, path_xlsx = out_path)
#     }
#   )
#   # result es list(ok = TRUE, file_id = "...", n_bases = 3, bases = list(...))
#
# Si `fn` falla para una base, se propaga el error (no se generan los
# archivos parciales) — el analista debe ver el error y arreglarlo.

# Genera un path único dentro de la sesión para un archivo temporal.
.session_tmp <- function(sid, fname) {
  s <- session_get(sid)
  d <- file.path(s$dir, "downloads")
  dir.create(d, showWarnings = FALSE, recursive = TRUE)
  file.path(d, fname)
}

# Corre `fn` sobre cada base del estudio y registra cada output como
# file en el store. Devuelve una lista con info por base:
#   list(nombre, file_id, filename, size, path)
run_report_per_base <- function(sid, base_filename, ext, kind_single, fn) {
  ds <- estudio_data_sources(sid)
  is_ <- estudio_inst_sources(sid)
  if (length(ds) == 0L) {
    stop_api(409, "E_NO_RP_DATA",
             "El estudio no tiene bases. Agrega al menos una en Fase 1.")
  }

  lapply(names(ds), function(nombre) {
    # Si hay 1 sola base llamada "default", no prefijamos — preserva
    # nombres legacy (`codebook.xlsx`).
    solo_una <- length(ds) == 1L
    # "giz" es el nombre actual del demo default; "generic" se mantiene
    # como alias por compat con sesiones persistidas antes del rename.
    fname <- if (solo_una && nombre %in% c("default", "giz", "generic")) {
      .export_filename(sid, base_filename, ext)
    } else {
      .export_filename(sid, base_filename, ext, base = nombre)
    }
    # Uuid al path real para no colisionar si el analista genera varias
    # veces el mismo reporte dentro de la sesión.
    path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), fname))

    fn(ds[[nombre]], is_[[nombre]], path)

    if (!file.exists(path)) {
      stop_api(500, "E_REPORTE_FAILED",
               sprintf("La generación del reporte para la base '%s' no produjo archivo.", nombre))
    }

    meta <- .register_output_file(sid, kind_single, path, original_name = fname)
    list(
      nombre   = nombre,
      file_id  = meta$file_id,
      filename = fname,
      size     = meta$size,
      path     = path
    )
  })
}

# Empaqueta N archivos en un ZIP. Devuelve metadata del archivo zip.
.zip_outputs <- function(sid, outputs, zip_basename, kind_multi) {
  if (length(outputs) == 0L) {
    stop_api(500, "E_NO_OUTPUTS", "Sin archivos para empaquetar.")
  }
  zip_name <- .export_filename(sid, zip_basename, "zip")
  zip_path <- .session_tmp(sid, sprintf("%s_%s", uuid::UUIDgenerate(), zip_name))
  # `zip::zip` requiere rutas relativas; usamos el basename para que el
  # zip no contenga la jerarquía temp completa.
  files <- vapply(outputs, function(o) o$path, character(1))
  names_inside <- vapply(outputs, function(o) o$filename, character(1))
  # Truco: copiamos a un dir temporal con los nombres deseados antes de zipear.
  stage <- tempfile("zip_stage_")
  dir.create(stage, recursive = TRUE)
  on.exit(unlink(stage, recursive = TRUE, force = TRUE), add = TRUE)
  for (i in seq_along(files)) {
    file.copy(files[i], file.path(stage, names_inside[i]), overwrite = TRUE)
  }
  old_wd <- setwd(stage)
  on.exit(setwd(old_wd), add = TRUE)
  zip::zip(zipfile = zip_path, files = names_inside)
  setwd(old_wd)

  meta <- .register_output_file(sid, kind_multi, zip_path, original_name = zip_name)
  list(
    file_id  = meta$file_id,
    filename = basename(zip_path),
    size     = meta$size
  )
}

# Orquestador principal. Decide single vs multi según n_bases.
#
# Retorna una respuesta lista para devolver como JSON:
#   - Si n_bases == 1:
#       list(ok = TRUE, n_bases = 1, file_id = <xlsx>, filename = <>, size = N,
#            bases = list(list(nombre, file_id, size, filename)))
#   - Si n_bases > 1:
#       list(ok = TRUE, n_bases = N,
#            zip = list(file_id, filename, size),
#            bases = list(list(nombre, file_id, size, filename), ...))
#
# El frontend puede decidir qué mostrar:
#   - single → descargar `file_id` directo.
#   - multi → ofrecer el zip O descargas individuales por `bases[].file_id`.
run_report_multibase <- function(sid, base_filename, ext, kind_single, kind_multi, fn) {
  outputs <- run_report_per_base(sid, base_filename, ext, kind_single, fn)

  if (length(outputs) == 1L) {
    o <- outputs[[1]]
    return(list(
      ok       = TRUE,
      n_bases  = 1L,
      file_id  = o$file_id,
      filename = o$filename,
      size     = o$size,
      bases    = outputs
    ))
  }

  zip_meta <- .zip_outputs(sid, outputs, base_filename, kind_multi)
  list(
    ok       = TRUE,
    n_bases  = length(outputs),
    zip      = zip_meta,
    bases    = outputs
  )
}
