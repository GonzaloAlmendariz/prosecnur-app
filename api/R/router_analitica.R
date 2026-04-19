.analitica_fuentes <- function(sid) {
  s <- session_get(sid)
  if (isTRUE(s$codif_aplicado)
      && !is.null(s$codif_inst_adaptado_fid)
      && !is.null(s$codif_data_adaptada_fid)) {
    list(
      inst_path = get_file(sid, s$codif_inst_adaptado_fid)$path,
      data_meta = get_file(sid, s$codif_data_adaptada_fid),
      fuente = "adaptados"
    )
  } else {
    list(
      inst_path = .require_xlsform_path(sid)$path,
      data_meta = .require_data_path(sid),
      fuente = "originales"
    )
  }
}

.secciones_desde_instrumento <- function(rp_inst) {
  survey <- rp_inst$survey
  if (is.null(survey) || !"name" %in% names(survey)) return(NULL)
  grupo <- survey$group_name %||% rep("general", nrow(survey))
  grupo[is.na(grupo) | !nzchar(grupo)] <- "general"
  ok <- !is.na(survey$name) & nzchar(survey$name)
  tapply(survey$name[ok], grupo[ok], function(v) unique(v), simplify = FALSE) |>
    as.list()
}

.load_rp_data <- function(sid) {
  s <- session_get(sid)
  if (!is.null(s$rp_data) && !is.null(s$rp_inst)) {
    return(list(rp_inst = s$rp_inst, rp_data = s$rp_data))
  }
  stop_api(409, "E_ANALITICA_NO_PREP", "Primero corre el Paso 1 (Preparar datos para reporte).")
}

.zip_files <- function(zip_path, files, names_in_zip = NULL) {
  names_in_zip <- names_in_zip %||% basename(files)
  old <- getwd()
  td <- tempfile()
  dir.create(td)
  on.exit({ setwd(old); unlink(td, recursive = TRUE) }, add = TRUE)
  for (i in seq_along(files)) file.copy(files[i], file.path(td, names_in_zip[i]))
  setwd(td)
  zip::zip(zip_path, files = names_in_zip)
  zip_path
}

mount_analitica <- function(pr) {
  pr |>
    plumber::pr_post("/api/analitica/preparar", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      src <- .analitica_fuentes(sid)
      rp_inst <- prosecnur::reporte_instrumento(path = src$inst_path)
      dat_raw <- switch(src$data_meta$ext,
        xlsx = readxl::read_excel(src$data_meta$path),
        xls  = readxl::read_excel(src$data_meta$path),
        csv  = utils::read.csv(src$data_meta$path, stringsAsFactors = FALSE),
        sav  = haven::read_sav(src$data_meta$path),
        stop_api(400, "E_UNSUPPORTED_EXT", sprintf("Ext no soportada: %s", src$data_meta$ext))
      )
      rp_data <- prosecnur::reporte_data(dat_raw, instrumento = rp_inst)
      session_set(sid, "rp_inst", rp_inst)
      session_set(sid, "rp_data", rp_data)
      session_set(sid, "analitica_prep_ok", TRUE)
      session_set(sid, "analitica_fuente", src$fuente)
      list(
        ok = TRUE,
        fuente = src$fuente,
        n_filas = nrow(rp_data),
        n_columnas = ncol(rp_data)
      )
    })) |>
    plumber::pr_post("/api/analitica/codebook", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ctx <- .load_rp_data(sid); s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", sprintf("codebook_%s.xlsx", uuid::UUIDgenerate()))
      prosecnur::reporte_codebook(ctx$rp_data, path_xlsx = out_path)
      meta <- .register_output_file(sid, "codebook", out_path)
      session_set(sid, "analitica_codebook_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/frecuencias", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ctx <- .load_rp_data(sid); s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", sprintf("frecuencias_%s.xlsx", uuid::UUIDgenerate()))
      prosecnur::reporte_frecuencias(
        data = ctx$rp_data, instrumento = ctx$rp_inst,
        secciones = .secciones_desde_instrumento(ctx$rp_inst),
        path_xlsx = out_path
      )
      meta <- .register_output_file(sid, "frecuencias", out_path)
      session_set(sid, "analitica_frecuencias_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/cruces", wrap_endpoint(function(req, res, cruces = NULL, modo = "estandar") {
      sid <- session_header(req)
      if (is.null(cruces) || !nzchar(as.character(cruces[[1]] %||% ""))) {
        stop_api(400, "E_NO_CRUCES", "Indica al menos una variable de cruce (ej. 'servicio')")
      }
      ctx <- .load_rp_data(sid); s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", sprintf("cruces_%s.xlsx", uuid::UUIDgenerate()))
      cruces_val <- if (length(cruces) == 1) as.character(cruces[[1]]) else as.character(cruces)
      prosecnur::reporte_cruces(
        data = ctx$rp_data, instrumento = ctx$rp_inst,
        SECCIONES = NULL, cruces = cruces_val, modo = modo,
        path_xlsx = out_path
      )
      meta <- .register_output_file(sid, "cruces", out_path)
      session_set(sid, "analitica_cruces_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/spss", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      ctx <- .load_rp_data(sid); s <- session_get(sid)
      sav_path <- file.path(s$dir, "downloads", sprintf("datos_%s.sav", uuid::UUIDgenerate()))
      sps_path <- file.path(s$dir, "downloads", sprintf("niveles_%s.sps", uuid::UUIDgenerate()))
      prosecnur::reporte_spss(ctx$rp_data, path_sav = sav_path, path_sps = sps_path)
      zip_path <- file.path(s$dir, "downloads", sprintf("spss_%s.zip", uuid::UUIDgenerate()))
      .zip_files(zip_path, c(sav_path, sps_path), c("datos.sav", "niveles_medida.sps"))
      meta <- .register_output_file(sid, "spss_bundle", zip_path)
      session_set(sid, "analitica_spss_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    })) |>
    plumber::pr_post("/api/analitica/enumeradores", wrap_endpoint(function(req, res, col_enumerador = NULL) {
      sid <- session_header(req)
      if (is.null(col_enumerador) || !nzchar(as.character(col_enumerador))) {
        stop_api(400, "E_NO_COL_ENUM", "Indica col_enumerador (ej. 'Enumerator_name')")
      }
      ctx <- .load_rp_data(sid); s <- session_get(sid)
      out_path <- file.path(s$dir, "downloads", sprintf("enumeradores_%s.pdf", uuid::UUIDgenerate()))
      prosecnur::reporte_enumeradores(
        data = ctx$rp_data,
        col_enumerador = as.character(col_enumerador),
        output_file = out_path,
        quiet = TRUE
      )
      meta <- .register_output_file(sid, "enumeradores", out_path)
      session_set(sid, "analitica_enumeradores_ok", TRUE)
      list(ok = TRUE, file_id = meta$file_id, size = meta$size)
    }))
}
