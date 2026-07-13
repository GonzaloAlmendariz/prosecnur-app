# Resolución del instrumento por base para la vista de esquema de Carga.
#
# La vista de esquema (secciones + preguntas, con el marcado `is_repeat`) se
# alimenta de `estructura_instrumento(inst)`, que necesita el formato "limpieza"
# (`inst$meta$section_map`, `inst$survey`, `inst$choices`). En un estudio con
# grupos repeat, el `begin_repeat` vive en el instrumento de la base MADRE
# (el XLSForm completo con la sección repeat), no en la HIJA (que promueve las
# preguntas del repeat a top-level y pierde la sección). Por eso, en modo
# multibase el esquema debe leerse del instrumento de la base pedida y no del
# instrumento único global (`s$inst_limpieza`).
#
# Este helper resuelve ese instrumento en formato limpieza leyendo el XLSForm
# de la base desde el file store (patrón del endpoint single-base) y lo cachea
# por base en `s$inst_estructura_por_base[[base]]`, sin tocar el cache single-base
# `s$inst_limpieza`.
.carga_inst_estructura_por_base <- function(sid, base) {
  base <- if (is.null(base)) "" else trimws(as.character(base)[1])
  if (!nzchar(base)) {
    # Rama defensiva: el router solo llama aquí cuando `base` es no vacío.
    stop_api(400, "E_BASE_REQUERIDA", "El parámetro 'base' no puede estar vacío.")
  }

  bases <- estudio_list_bases(sid)
  base_meta <- bases[[base]]
  if (is.null(base_meta)) {
    disponibles <- names(bases %||% list())
    stop_api(
      404, "E_BASE_NOT_FOUND",
      sprintf("Base '%s' no existe en el estudio. Disponibles: %s",
              base, if (length(disponibles)) paste(disponibles, collapse = ", ") else "(ninguna)")
    )
  }

  s <- session_get(sid)
  cached <- s$inst_estructura_por_base[[base]]
  if (.pulso_valid_inst_cache(cached)) return(cached)

  xls_fid <- as.character(base_meta$xlsform_file_id %||% "")
  xls_meta <- if (nzchar(xls_fid)) s$files[[xls_fid]] else NULL
  if (is.null(xls_meta) || is.null(xls_meta$path) || !file.exists(xls_meta$path)) {
    stop_api(
      409, "E_NO_XLSFORM",
      sprintf("La base '%s' no tiene un XLSForm disponible en el almacén de archivos.", base)
    )
  }

  inst <- leer_xlsform_limpieza(xls_meta$path, verbose = FALSE)

  cache <- s$inst_estructura_por_base %||% list()
  cache[[base]] <- inst
  session_set(sid, "inst_estructura_por_base", cache)
  inst
}

# Handler del endpoint `GET /api/carga/instrumento/estructura`. Se extrae del
# router para mantenerlo delgado y poder probarlo sin HTTP (basta un `req` con
# el header de sesión). Devuelve la forma `{secciones, preguntas}` de
# `estructura_instrumento`, idéntica en single-base y multibase.
#
# Query param opcional `base`: nombre de la base del estudio cuyo esquema se
# pide. Sin `base` -> comportamiento single-base histórico (instrumento único).
.carga_estructura_instrumento_endpoint <- function(req, res, base = NULL) {
  sid <- session_header(req)
  base_arg <- if (is.null(base)) "" else trimws(as.character(base)[1])

  # Modo multibase: el esquema se resuelve por base. El begin_repeat vive en el
  # instrumento de la base MADRE; leerlo por base es lo que permite que la vista
  # de esquema marque is_repeat en estudios con repeat.
  if (nzchar(base_arg)) {
    return(estructura_instrumento(.carga_inst_estructura_por_base(sid, base_arg)))
  }

  # Sin `base`: comportamiento single-base intacto (instrumento único global).
  s <- session_get(sid)
  inst <- if (!is.null(s$inst_limpieza)) s$inst_limpieza else {
    meta_files <- Filter(function(f) f$kind == "xlsform", s$files)
    if (length(meta_files) == 0) stop_api(409, "E_NO_XLSFORM", "No XLSForm uploaded yet")
    x <- leer_xlsform_limpieza(meta_files[[length(meta_files)]]$path, verbose = FALSE)
    session_set(sid, "inst_limpieza", x)
    x
  }
  estructura_instrumento(inst)
}
