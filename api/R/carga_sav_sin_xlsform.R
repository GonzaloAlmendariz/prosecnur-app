# =============================================================================
# Base .sav sin XLSForm (contrato E4-E7, rebanada R1).
#
# Una medición vieja (p. ej. HSyVBG 2024/2025) solo existe como .sav: no hay
# XLSForm, pero el .sav trae etiquetas de variable y de valor. Aquí se sintetiza
# un XLSForm mínimo (survey + choices + settings) desde esas etiquetas, se guarda
# en el almacén de archivos como kind `xlsform` y la base se registra en el
# estudio con `estudio_add_base()`, igual que una carga manual. Como el XLSForm
# queda persistido como archivo, `.pulso_rebuild_estudio_runtime_sources()` lo
# re-deriva al reabrir el `.pulso` sin lógica adicional.
#
# Reglas de tipo (una fila de survey por cada columna del .sav, así ninguna
# columna se pierde, incluida `factor_ponderacion`):
#   - con etiquetas de valor -> select_one con su lista: códigos tal cual,
#     etiquetas del .sav; los especiales 80-99 se conservan como opciones.
#     Excepción: si TODAS las etiquetas son especiales (80-99) y la variable
#     tiene valores observados sin etiqueta (una edad con 99 = No responde), es
#     numérica: forzarla a select_one dejaría sus valores reales fuera de la lista.
#   - numérica sin etiquetas -> integer si todos los valores son enteros, si no
#     decimal (`.panel_infer_type` decide la familia).
#   - texto -> text; fechas -> date/datetime.
# =============================================================================

.CARGA_SAV_ESPECIALES <- 80:99

# Lista de choices de una variable: nombre estable y único dentro del form.
.carga_sav_list_name <- function(var, usados) {
  base <- paste0("l_", .slug_code(var))
  nombre <- base
  i <- 2L
  while (nombre %in% usados) {
    nombre <- paste0(base, "_", i)
    i <- i + 1L
  }
  nombre
}

# Etiqueta de variable del .sav (attr `label` de haven); si no hay, el nombre.
.carga_sav_var_label <- function(x, var) {
  lab <- attr(x, "label", exact = TRUE)
  lab <- if (is.null(lab) || !length(lab)) "" else as.character(lab)[1]
  if (is.na(lab) || !nzchar(trimws(lab))) var else enc2utf8(lab)
}

# ¿Las etiquetas son solo códigos especiales y hay valores reales sin etiqueta?
.carga_sav_solo_especiales_con_valores <- function(x, codes) {
  num_codes <- suppressWarnings(as.numeric(codes))
  if (!length(num_codes) || anyNA(num_codes)) return(FALSE)
  if (!all(num_codes %in% .CARGA_SAV_ESPECIALES)) return(FALSE)
  vals <- unique(as.character(haven::zap_labels(x)))
  vals <- vals[!is.na(vals) & nzchar(vals)]
  length(setdiff(vals, as.character(codes))) > 0L
}

# Tipo XLSForm de una columna sin etiquetas de valor.
.carga_sav_tipo_plano <- function(x) {
  x <- haven::zap_labels(x)
  tipo <- .panel_infer_type(x)
  if (identical(tipo, "decimal") && is.numeric(x)) {
    v <- x[is.finite(x)]
    if (!length(v) || all(abs(v - round(v)) < 1e-9)) tipo <- "integer"
  }
  tipo
}

# Sintetiza survey/choices/settings desde un data.frame leído con haven.
# Devuelve list(survey, choices, settings, resumen) con data.frames planos.
carga_sav_sintetizar_xlsform <- function(df, titulo = "base_sav") {
  if (!is.data.frame(df) || !ncol(df)) {
    stop_api(422, "E_BASE_SAV_SIN_VARIABLES",
             "El .sav no trae variables con las que sintetizar el instrumento.")
  }
  survey_rows <- list()
  choice_rows <- list()
  usados <- character(0)
  n_select <- 0L
  for (var in names(df)) {
    x <- df[[var]]
    label <- .carga_sav_var_label(x, var)
    labs <- attr(x, "labels", exact = TRUE)
    pares <- .panel_choice_rows_from_labels(labs, "")
    usar_lista <- nrow(pares) > 0L &&
      !.carga_sav_solo_especiales_con_valores(x, pares$name)
    if (usar_lista) {
      list_name <- .carga_sav_list_name(var, usados)
      usados <- c(usados, list_name)
      pares$list_name <- list_name
      choice_rows[[length(choice_rows) + 1L]] <- pares
      survey_rows <- .panel_append_survey_row(
        survey_rows, var, paste("select_one", list_name), label, list_name
      )
      n_select <- n_select + 1L
    } else {
      survey_rows <- .panel_append_survey_row(
        survey_rows, var, .carga_sav_tipo_plano(x), label, ""
      )
    }
  }
  survey <- do.call(rbind, survey_rows)
  survey$list_name <- NULL
  choices <- if (length(choice_rows)) {
    do.call(rbind, choice_rows)[, c("list_name", "name", "label")]
  } else {
    data.frame(list_name = character(0), name = character(0), label = character(0),
               stringsAsFactors = FALSE)
  }
  settings <- data.frame(
    form_title = as.character(titulo),
    form_id = .slug_code(titulo),
    version = "sintetizado_sav",
    stringsAsFactors = FALSE
  )
  list(
    survey = survey,
    choices = choices,
    settings = settings,
    resumen = list(
      n_variables = as.integer(nrow(survey)),
      n_select_one = n_select,
      n_listas = as.integer(length(usados)),
      n_opciones = as.integer(nrow(choices))
    )
  )
}

# Escribe el XLSForm sintetizado y devuelve sus bytes.
.carga_sav_xlsform_bytes <- function(sintesis) {
  path <- tempfile(fileext = ".xlsx")
  on.exit(unlink(path, force = TRUE), add = TRUE)
  wb <- openxlsx::createWorkbook()
  for (hoja in c("survey", "choices", "settings")) {
    openxlsx::addWorksheet(wb, hoja)
    openxlsx::writeData(wb, hoja, sintesis[[hoja]])
  }
  openxlsx::saveWorkbook(wb, path, overwrite = TRUE)
  readBin(path, "raw", n = file.info(path)$size)
}

# Registra como base del estudio un .sav ya subido, sin XLSForm. Lee el .sav del
# almacén, sintetiza el instrumento, lo guarda como archivo `xlsform` y corre la
# misma tubería que POST /api/estudio/base (normalizar, comprobar compatibilidad,
# `reporte_data`, `estudio_add_base`).
carga_sav_registrar_base <- function(sid, data_file_id, nombre = "") {
  data_file_id <- as.character(data_file_id %||% "")[1]
  if (is.na(data_file_id) || !nzchar(data_file_id)) {
    stop_api(400, "E_MISSING_DATA", "Falta 'data_file_id'.")
  }
  dat_meta <- get_file(sid, data_file_id)
  data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name %||% ""))
  if (!identical(data_ext, "sav")) {
    stop_api(400, "E_BASE_SAV_NO_SAV",
             sprintf("El archivo '%s' no es un .sav; esta vía solo sintetiza instrumentos desde SPSS.",
                     dat_meta$original_name %||% data_file_id))
  }
  nombre <- as.character(nombre %||% "")[1]
  if (is.na(nombre) || !nzchar(trimws(nombre))) nombre <- estudio_next_auto_name(sid)
  nombre <- trimws(nombre)

  raw_df <- .read_data_from_path(dat_meta$path, "sav")
  sintesis <- carga_sav_sintetizar_xlsform(raw_df, titulo = nombre)
  xls_meta <- save_upload(
    sid, "xlsform",
    sprintf("%s_instrumento_desde_sav.xlsx", .slug_code(nombre)),
    .carga_sav_xlsform_bytes(sintesis)
  )

  rp_inst <- reporte_instrumento(path = xls_meta$path)
  data_df <- normalize_data_for_xlsform(raw_df, rp_inst)
  .carga_assert_data_xlsform_compatible(data_df, rp_inst)
  rp_data <- reporte_data(data_df, instrumento = rp_inst)

  base_meta <- estudio_add_base(
    sid,
    nombre          = nombre,
    xlsform_file_id = xls_meta$file_id,
    data_file_id    = data_file_id,
    data_ext        = "sav",
    rp_data         = rp_data,
    rp_inst         = rp_inst,
    n_filas         = as.integer(nrow(data_df)),
    n_columnas      = as.integer(ncol(data_df)),
    extra_meta      = list(instrumento_origen = "sintetizado_sav")
  )
  # Mismo contrato legacy que POST /api/estudio/base para la primera base.
  if (length(estudio_list_bases(sid)) == 1L) {
    session_set(sid, "analitica_prep_ok", TRUE)
    session_set(sid, "analitica_fuente", sprintf("estudio:%s", nombre))
  }
  list(
    base_meta = base_meta,
    xlsform_file_id = xls_meta$file_id,
    sintesis = sintesis$resumen
  )
}
