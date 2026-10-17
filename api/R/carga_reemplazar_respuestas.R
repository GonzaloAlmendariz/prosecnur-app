# Carga › Fuentes: cargar una versión nueva del archivo de respuestas de una base.
#
# ADR 0100 D1: lo que decidió un script fuera de la app se cambia en el script y
# «se recarga la base». Para Kobo y SurveyMonkey existía «Actualizar respuestas»,
# pero una base cargada desde archivo no tenía cómo recibir su versión nueva:
# había que quitarla y volver a crearla, y con eso se perdían su nombre, sus
# variables propias, sus segmentos y su lugar en las equivalencias.
#
# Caso que lo destapó (HSyVbG 2026, 2026-10-16): el script del analista deja la
# base limpia y codificada completa con una columna que marca la selección
# aleatoria. No hace falta una función de «selección»: se carga esa versión y en
# Validación se declara qué casos cuentan (`caso_valido`). Faltaba sólo la carga.
#
# Lo que hace: conserva el formulario, el nombre y lo que la base declara (ADR
# 0106/0107); reemplaza la data con `estudio_replace_base_files()`, que ya
# descarta lo que hablaba de la data anterior (la limpieza hecha en la app) y
# conserva el catálogo de codificación, que se vuelve a aplicar (ADR 0100 D3).
# Devuelve qué cambió para decirlo en la pantalla.

#' Qué cambia entre la data anterior y la nueva de una base.
#'
#' Casos por identificador cuando ambas lo traen (los de `.codif_key_candidates`),
#' si no sólo los totales. Columnas: las que llegan y las que dejan de venir.
#' @keywords internal
carga_comparar_respuestas <- function(previa, nueva, claves = .codif_key_candidates) {
  previa <- previa %||% data.frame()
  cols_prev <- names(previa)
  cols_new <- names(nueva)
  clave <- intersect(claves, intersect(cols_prev, cols_new))
  clave <- if (length(clave)) clave[[1]] else ""
  casos <- list(antes = nrow(previa), despues = nrow(nueva), clave = clave)
  if (nzchar(clave)) {
    norm <- function(x) {
      v <- trimws(as.character(x))
      unique(v[!is.na(v) & nzchar(v)])
    }
    ids_prev <- norm(previa[[clave]])
    ids_new <- norm(nueva[[clave]])
    casos$se_mantienen <- length(intersect(ids_prev, ids_new))
    casos$nuevos <- length(setdiff(ids_new, ids_prev))
    casos$ya_no_vienen <- length(setdiff(ids_prev, ids_new))
  }
  list(
    casos = casos,
    columnas_nuevas = as.list(setdiff(cols_new, cols_prev)),
    columnas_que_no_vienen = as.list(setdiff(cols_prev, cols_new))
  )
}

# La base tiene grupos de codificación: reemplazar descartó su adaptación
# (ADR 0100 D3) y hay que volver a confirmarla.
.carga_codificacion_por_readaptar <- function(sid, base) {
  cb <- ((session_get(sid, required = FALSE) %||% list())$codif_por_base %||% list())[[base]]
  length((cb %||% list())$grupos_recod %||% list()) > 0L
}

#' Qué cambió al reemplazar las respuestas en el modo de una base.
#'
#' `previa` es la `data_raw_meta` anterior de la sesión; sin ella (primera
#' carga) no hay nada que comparar y devuelve NULL.
#' @keywords internal
carga_cambios_contra_archivo_previo <- function(sid, previa, nueva, base = "default") {
  ruta <- as.character((previa %||% list())$path %||% "")
  if (!length(ruta) || !nzchar(ruta[1]) || !file.exists(ruta[1])) return(NULL)
  if (identical(ruta[1], as.character(nueva$path %||% ""))) return(NULL)
  datos_previos <- tryCatch(.read_data_from_path(ruta[1], previa$ext), error = function(e) NULL)
  datos_nuevos <- tryCatch(.read_data_from_path(nueva$path, nueva$ext), error = function(e) NULL)
  if (is.null(datos_previos) || is.null(datos_nuevos)) return(NULL)
  out <- carga_comparar_respuestas(datos_previos, datos_nuevos)
  out$codificacion_por_readaptar <- .carga_codificacion_por_readaptar(sid, base)
  out
}

#' Reemplaza el archivo de respuestas de una base y devuelve qué cambió.
#' @keywords internal
carga_reemplazar_respuestas <- function(sid, nombre, data_file_id) {
  s <- session_get(sid)
  meta <- (s$estudio$bases %||% list())[[nombre]]
  if (is.null(meta)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre))
  xls_id <- as.character(meta$xlsform_file_id %||% "")
  if (!nzchar(xls_id)) {
    stop_api(422, "E_BASE_SIN_FORMULARIO",
             sprintf("La base «%s» no tiene formulario; vuelve a crearla con su formulario y sus respuestas.", nombre))
  }
  xls_meta <- get_file(sid, xls_id)
  dat_meta <- get_file(sid, data_file_id)
  data_ext <- tolower(dat_meta$ext %||% tools::file_ext(dat_meta$original_name))
  if (!nzchar(data_ext)) data_ext <- tolower(tools::file_ext(dat_meta$path))

  # La data anterior sólo se lee para comparar; si ya no se puede, se informa
  # sin conteo de casos por identificador.
  previa <- tryCatch({
    prev_meta <- get_file(sid, as.character(meta$data_file_id %||% ""))
    .read_data_from_path(prev_meta$path, prev_meta$ext)
  }, error = function(e) NULL)

  # Los códigos confirmados para las respuestas (etiqueta → código) siguen
  # valiendo para una versión nueva del mismo archivo: se usan y se conservan.
  # `estudio_replace_base_files()` los descarta porque cambió el par.
  mapeo_previo <- meta$choice_code_mapping
  mapas <- tryCatch(.pulso_load_choice_maps(sid, nombre), error = function(e) list())

  rp_inst <- reporte_instrumento(path = xls_meta$path)
  data_df <- .read_data_from_path(dat_meta$path, dat_meta$ext)
  cambios <- carga_comparar_respuestas(previa, data_df)
  cambios$codificacion_por_readaptar <- .carga_codificacion_por_readaptar(sid, nombre)
  data_df <- normalize_data_for_xlsform(data_df, rp_inst, choice_code_maps = mapas)
  # ADR 0106: una pregunta que falta se retira (pendiente de motivo), no rechaza la base.
  retiro <- base_variables_carga_retiradas(data_df, rp_inst, xls_meta$path, data_file_id)
  rp_inst <- retiro$rp_inst
  rp_data <- reporte_data(data_df, instrumento = rp_inst)

  estudio_preserve_original_base_files(sid, nombre)
  estudio_replace_base_files(
    sid,
    nombre,
    data_file_id = data_file_id,
    data_ext     = data_ext,
    rp_data      = rp_data,
    rp_inst      = rp_inst,
    n_filas      = as.integer(nrow(data_df)),
    n_columnas   = as.integer(ncol(data_df))
  )
  if (length(mapeo_previo)) {
    s1 <- session_get(sid)
    s1$estudio$bases[[nombre]]$choice_code_mapping <- mapeo_previo
    .session_env[[sid]] <- s1
  }
  base_variables_carga_registrar(sid, nombre, retiro)
  # La base queda como al reabrir el proyecto: con sus variables declaradas y
  # calculadas materializadas sobre la data nueva (misma vía que load_pulso).
  .pulso_rebuild_estudio_runtime_sources(sid, bases = nombre)
  s2 <- session_get(sid)
  list(
    ok = TRUE,
    base = .estudio_base_payload(s2$estudio$bases[[nombre]], s2),
    cambios = cambios,
    archivo = as.character(dat_meta$original_name %||% basename(dat_meta$path))
  )
}

# POST /api/estudio/base/respuestas  body: {nombre, data_file_id}
# `data_file_id` sale de `/api/upload`. → {ok, base, cambios, archivo}
mount_carga_reemplazar_respuestas <- function(pr) {
  pr |>
    plumber::pr_post("/api/estudio/base/respuestas", wrap_endpoint(function(req, res, ...) {
      sid <- session_header(req)
      body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
      if (!nzchar(body_raw)) stop_api(400, "E_EMPTY_BODY", "Body vacío.")
      Encoding(body_raw) <- "UTF-8"
      parsed <- tryCatch(
        jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
        error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e))
      )
      nombre <- as.character(parsed$nombre %||% "")
      data_file_id <- as.character(parsed$data_file_id %||% "")
      if (!nzchar(nombre)) stop_api(400, "E_MISSING_BASE", "Falta 'nombre'.")
      if (!nzchar(data_file_id)) stop_api(400, "E_MISSING_DATA", "Falta 'data_file_id'.")
      carga_reemplazar_respuestas(sid, nombre, data_file_id)
    }))
}
