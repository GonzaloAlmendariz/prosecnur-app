.require_xlsform_path <- function(sid) {
  s <- session_get(sid)
  xls <- Filter(function(f) f$kind == "xlsform", s$files)
  if (length(xls) == 0) stop_api(409, "E_NO_XLSFORM", "Falta cargar el XLSForm en Fase 1.")
  xls[[length(xls)]]
}

.require_data_path <- function(sid) {
  s <- session_get(sid)
  d <- Filter(function(f) f$kind %in% c("data", "sav"), s$files)
  if (length(d) == 0) stop_api(409, "E_NO_DATA", "Falta cargar la base de datos en Fase 1.")
  d[[length(d)]]
}

.read_data_any <- function(meta) {
  switch(meta$ext,
    xlsx = readxl::read_excel(meta$path),
    xls  = readxl::read_excel(meta$path),
    csv  = utils::read.csv(meta$path, stringsAsFactors = FALSE),
    sav  = haven::read_sav(meta$path),
    stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Extensión no soportada: %s", meta$ext))
  )
}

.register_output_file <- function(sid, kind, path) {
  s <- session_get(sid)
  file_id <- uuid::UUIDgenerate()
  meta <- list(
    file_id = file_id, kind = kind,
    original_name = basename(path), path = path,
    size = as.integer(file.info(path)$size),
    ext = tools::file_ext(path),
    uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
  )
  files <- s$files
  files[[file_id]] <- meta
  session_set(sid, "files", files)
  meta
}

mount_codificacion <- function(pr) {
  pr |>
    plumber::pr_post("/api/codificacion/plantilla-familias", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      xls <- .require_xlsform_path(sid)
      dat <- .require_data_path(sid)
      inst <- prosecnur::leer_instrumento_xlsform(xls$path)
      data_df <- .read_data_any(dat)
      s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", sprintf("familias_%s.xlsx", uuid::UUIDgenerate()))
      prosecnur::escribir_plantilla_familias(inst = inst, dat = list(raw = data_df), path = out_path)
      meta <- .register_output_file(sid, "familias_template", out_path)
      session_set(sid, "codif_inst", inst)
      session_set(sid, "codif_data", data_df)
      session_set(sid, "codif_familias_generated", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/codificacion/familias/aplicar", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      if (is.null(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Falta file_id del xlsx de familias editado")
      fam_meta <- get_file(sid, file_id)
      s <- session_get(sid)
      inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(.require_xlsform_path(sid)$path)
      dat_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      dat <- if (is.data.frame(dat_df)) list(raw = dat_df) else dat_df

      split <- prosecnur::leer_familias_clasificar(path = fam_meta$path, inst = inst, dat = dat, verbose = FALSE)
      plantilla <- prosecnur::construir_plantilla_desde_familias(inst = inst, dat = dat, split = split)

      out_path <- file.path(s$dir, "downloads", sprintf("plantilla_codificacion_%s.xlsx", uuid::UUIDgenerate()))
      prosecnur::exportar_plantilla_codificacion_xlsx(plantilla, path_xlsx = out_path, inst = inst)
      meta <- .register_output_file(sid, "plantilla_codif_template", out_path)
      session_set(sid, "codif_familias_file_id", file_id)
      session_set(sid, "codif_plantilla_template", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/codificacion/plantilla-codigos/subir", wrap_endpoint(function(req, res, file_id = NULL) {
      sid <- session_header(req)
      if (is.null(file_id) || !nzchar(file_id)) stop_api(400, "E_MISSING_FILE_ID", "Falta file_id de la plantilla de códigos editada")
      meta <- get_file(sid, file_id)
      session_set(sid, "codif_plantilla_codigos_file_id", file_id)
      list(ok = TRUE, original_name = meta$original_name, size = meta$size)
    })) |>
    plumber::pr_post("/api/codificacion/aplicar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      xls <- .require_xlsform_path(sid)
      dat <- .require_data_path(sid)
      codes_fid <- s$codif_plantilla_codigos_file_id
      if (is.null(codes_fid)) stop_api(409, "E_NO_CODES", "Primero sube la plantilla de códigos editada")
      codes_meta <- get_file(sid, codes_fid)
      fam_fid <- s$codif_familias_file_id
      fam_path <- if (!is.null(fam_fid)) get_file(sid, fam_fid)$path else NULL

      data_out <- file.path(s$dir, "downloads", sprintf("data_adaptada_%s.xlsx", uuid::UUIDgenerate()))
      inst_out <- file.path(s$dir, "downloads", sprintf("instrumento_adaptado_%s.xlsx", uuid::UUIDgenerate()))

      prosecnur::ppra_adaptar_data(
        path_instrumento = xls$path,
        path_datos       = dat$path,
        path_plantilla   = codes_meta$path,
        out_path         = data_out,
        path_familias    = fam_path
      )
      prosecnur::ppra_adaptar_instrumento(
        path_instrumento_in  = xls$path,
        path_data_adaptada   = data_out,
        path_instrumento_out = inst_out,
        path_plantilla       = codes_meta$path
      )
      data_meta <- .register_output_file(sid, "data_adaptada", data_out)
      inst_meta <- .register_output_file(sid, "instrumento_adaptado", inst_out)
      session_set(sid, "codif_data_adaptada_fid", data_meta$file_id)
      session_set(sid, "codif_inst_adaptado_fid", inst_meta$file_id)
      session_set(sid, "codif_aplicado", TRUE)
      list(
        ok = TRUE,
        data_adaptada = list(file_id = data_meta$file_id, size = data_meta$size),
        instrumento_adaptado = list(file_id = inst_meta$file_id, size = inst_meta$size)
      )
    }))
}
