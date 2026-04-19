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

# ---- Canonical familias draft ---------------------------------------------
# The canonical model lives as a list of rows in session. We bridge to
# prosecnur by writing an ephemeral xlsx only when crossing the package
# boundary (leer_familias_clasificar, exportar_*, ppra_adaptar_*).

.familias_rows_from_df <- function(df) {
  if (is.null(df) || nrow(df) == 0) return(list())
  chr_cols <- c("tipo","modo_so","parent","parent_label","list_norm",
                "parent_col","other_dummy_col","text_col",
                "parent_col_cands","other_dummy_cands","text_col_cands","dummy_cands")
  for (cc in intersect(chr_cols, names(df))) {
    df[[cc]] <- as.character(df[[cc]])
    df[[cc]][is.na(df[[cc]])] <- ""
  }
  if ("use" %in% names(df)) df$use <- isTRUE_vec(df$use)
  if ("q_order" %in% names(df)) df$q_order <- suppressWarnings(as.integer(df$q_order))
  rows <- vector("list", nrow(df))
  for (i in seq_len(nrow(df))) {
    r <- as.list(df[i, , drop = FALSE])
    r <- lapply(r, function(v) if (length(v) == 1) unname(v) else unname(v))
    rows[[i]] <- r
  }
  rows
}

isTRUE_vec <- function(x) {
  vapply(x, function(v) {
    if (is.logical(v)) isTRUE(v)
    else if (is.numeric(v)) isTRUE(v > 0)
    else {
      s <- tolower(trimws(as.character(v %||% "")))
      s %in% c("1","true","t","si","sí","yes","y")
    }
  }, logical(1))
}

# Generate the "suggestion" tibble that `escribir_plantilla_familias` would
# write to disk. We call it into a temp xlsx and read it back because the
# helpers that build the tibble are not exported from prosecnur.
.familias_suggest_tibble <- function(sid) {
  xls <- .require_xlsform_path(sid)
  dat <- .require_data_path(sid)
  s <- session_get(sid)
  inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(xls$path)
  data_df <- s$codif_data %||% .read_data_any(dat)
  session_set(sid, "codif_inst", inst)
  session_set(sid, "codif_data", data_df)
  tmp <- tempfile(fileext = ".xlsx")
  on.exit(unlink(tmp), add = TRUE)
  prosecnur::escribir_plantilla_familias(
    inst = inst, dat = list(raw = data_df), path = tmp
  )
  df <- readxl::read_excel(tmp, sheet = "familias")
  df
}

# Rehydrate a draft coming from the frontend into a tibble with the same
# shape as the xlsx "familias" sheet, then write it to an ephemeral xlsx
# so we can feed `leer_familias_clasificar`, which currently requires a
# path (see prosecnur/R/codificacion_flujo_hibrido.R:2416).
.familias_draft_to_xlsx <- function(draft, out_path) {
  rows <- draft$rows %||% list()
  expected <- c("use","q_order","tipo","modo_so","parent","parent_label","list_norm",
                "parent_col","other_dummy_col","text_col",
                "parent_col_cands","other_dummy_cands","text_col_cands","dummy_cands")
  mat <- lapply(expected, function(col) {
    vapply(rows, function(r) {
      v <- r[[col]]
      if (is.null(v)) "" else as.character(v)[[1]]
    }, character(1))
  })
  names(mat) <- expected
  df <- as.data.frame(mat, stringsAsFactors = FALSE)
  df$use <- tolower(trimws(df$use)) %in% c("true","1","t","si","sí","yes","y") |
            grepl("^TRUE$", df$use, ignore.case = TRUE)
  df$q_order <- suppressWarnings(as.integer(df$q_order))

  wb <- openxlsx::createWorkbook()
  openxlsx::addWorksheet(wb, "familias")
  openxlsx::writeData(wb, "familias", df, colNames = TRUE)
  openxlsx::saveWorkbook(wb, out_path, overwrite = TRUE)
  out_path
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
    plumber::pr_get("/api/codificacion/familias/draft", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      if (!is.null(s$codif_familias_draft)) {
        d <- s$codif_familias_draft
        return(list(
          ok = TRUE,
          rows = d$rows,
          source = d$source %||% "draft",
          updated_at = d$updated_at
        ))
      }
      df <- .familias_suggest_tibble(sid)
      rows <- .familias_rows_from_df(df)
      draft <- list(
        rows = rows,
        source = "suggestion",
        updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
      session_set(sid, "codif_familias_draft", draft)
      session_set(sid, "codif_familias_generated", TRUE)
      list(ok = TRUE, rows = rows, source = "suggestion", updated_at = draft$updated_at)
    })) |>
    plumber::pr_post("/api/codificacion/familias/draft", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      session_get(sid)
      body_raw <- req$postBody %||% (if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      rows <- parsed$rows
      if (is.null(rows)) stop_api(400, "E_MISSING_ROWS", "Body debe incluir 'rows' (lista de filas de familias)")
      if (!is.list(rows)) stop_api(400, "E_BAD_ROWS", "'rows' debe ser una lista JSON")
      draft <- list(
        rows = rows,
        source = "draft",
        updated_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC")
      )
      session_set(sid, "codif_familias_draft", draft)
      list(ok = TRUE, n_rows = length(rows), updated_at = draft$updated_at)
    })) |>
    plumber::pr_post("/api/codificacion/familias/commit", wrap_endpoint(function(req, res) {
      sid <- session_header(req)
      s <- session_get(sid)
      draft <- s$codif_familias_draft
      if (is.null(draft)) stop_api(409, "E_NO_DRAFT", "No hay draft de familias. Genera primero con GET /api/codificacion/familias/draft.")
      inst <- s$codif_inst %||% prosecnur::leer_instrumento_xlsform(.require_xlsform_path(sid)$path)
      data_df <- s$codif_data %||% .read_data_any(.require_data_path(sid))
      dat <- list(raw = data_df)

      fam_path <- file.path(s$dir, "downloads", sprintf("familias_draft_%s.xlsx", uuid::UUIDgenerate()))
      dir.create(dirname(fam_path), showWarnings = FALSE, recursive = TRUE)
      .familias_draft_to_xlsx(draft, fam_path)

      split <- prosecnur::leer_familias_clasificar(path = fam_path, inst = inst, dat = dat, verbose = FALSE)

      session_set(sid, "codif_familias_split", split)
      session_set(sid, "codif_familias_xlsx_path", fam_path)
      session_set(sid, "codif_inst", inst)
      session_set(sid, "codif_data", data_df)

      resumen <- tryCatch(split$resumen, error = function(e) NULL)
      list(
        ok = TRUE,
        n_select_one = nrow(split$select_one %||% data.frame()),
        n_select_multiple = nrow(split$select_multiple %||% data.frame()),
        n_integer = nrow(split$integer %||% data.frame()),
        n_text = nrow(split$text %||% data.frame()),
        n_huerfanos = nrow(split$textos_huerfanos %||% data.frame()),
        resumen = if (!is.null(resumen)) .familias_rows_from_df(resumen) else list()
      )
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
