# =============================================================================
# Validación multi-tabla desde bases registradas (ADR 0030, Fase 2)
# =============================================================================
#
# La Fase 1 dejó, para cada `begin_repeat`, una base hija long registrada en el
# estudio con `extra_meta`: `source_kind="kobo_repeat"`, `parent_base=<madre>`,
# `repeat_group=<nombre del begin_repeat>` y las llaves canónicas ODK/Kobo
# (`_index`/`_parent_index`/`_submission__id`). El motor de validación
# multi-tabla (lector_limpieza + AST repeat_length/aggregate_check) ya sabe
# consumir ese modelo, pero la validación corría POR BASE single-sheet: la madre
# nunca se ensamblaba con sus hijas, así que las reglas del repeat (con
# `tabla=<repeat_group>`) fallaban como `missing_data_table`.
#
# Este módulo reconecta ambas puntas SIN duplicar el motor: reusa
# `lector_limpieza(hojas_override=...)` para armar el mismo `data_ctx` que produce
# la rama `lector_limpieza` de `read_validation_data_ast`, alimentándolo con la
# base madre + bases hija ya cargadas. La lógica vive aquí (no inline en el
# router) para mantener `router_validacion.R` delgado.

# Lee una base (madre o hija) a data.frame sin normalizar: la normalización de la
# madre y el std de columnas los aplica `.finalize_multitable_data_ctx` /
# `lector_limpieza` aguas abajo, igual que en la rama XLSX multi-hoja.
.mb_read_table <- function(path, ext) {
  ext <- tolower(as.character(ext %||% tools::file_ext(path)))
  if (is.null(path) || !nzchar(path) || !file.exists(path)) {
    stop_api(409, "E_VALIDACION_REPEAT_FILE",
             sprintf("No se encontró el archivo de datos de la base repeat: %s",
                     path %||% "<vacío>"))
  }
  df <- switch(ext,
    xlsx = readxl::read_excel(path),
    xls  = readxl::read_excel(path),
    csv  = utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE),
    sav  = haven::read_sav(path),
    stop_api(400, "E_VALIDACION_REPEAT_EXT",
             sprintf("Extensión de datos no soportada para ensamblar repeats: %s", ext))
  )
  as.data.frame(df, stringsAsFactors = FALSE, check.names = FALSE)
}

#' Ensambla el `data_ctx` multi-tabla desde la base madre + sus bases hija repeat.
#'
#' Devuelve la MISMA forma que la rama `lector_limpieza` de
#' `read_validation_data_ast` (`principal`, `tables`, `data_multi`, `rc_checks`,
#' `meta`, `row_filter`), con `source = "multibase_repeats"`. CLAVE: cada tabla
#' hija se keyea por el **nombre del `repeat_group`** (p.ej. `"rep_servicios"`),
#' que es exactamente el `tabla` que las reglas inferidas del repeat traen
#' (`.infer_*` deriva `tabla`/`repeat_context` del `begin_repeat`).
#'
#' @param main_data_path,main_data_ext Datos de la base madre.
#' @param main_instrumento Instrumento de la madre (contiene las preguntas del
#'   repeat y `meta$section_map` con `repeat_count`, para rc_checks + alias).
#' @param repeat_children Lista de `list(repeat_group, data_path, data_ext)` por
#'   cada base hija repeat de la madre.
#' @export
assemble_validation_data_multibase <- function(main_data_path,
                                               main_data_ext,
                                               main_instrumento = NULL,
                                               repeat_children = list()) {
  if (is.null(repeat_children) || !length(repeat_children)) {
    # Sin hijas: es el caso single-table; delegar al lector estándar preserva el
    # comportamiento exacto para proyectos sin repeats.
    return(read_validation_data_ast(
      path = main_data_path, ext = main_data_ext, instrumento = main_instrumento
    ))
  }

  main_df <- .mb_read_table(main_data_path, main_data_ext)
  tables_in <- list(principal = main_df)

  for (child in repeat_children) {
    rep_name <- as.character(child$repeat_group %||% "")
    if (!nzchar(rep_name)) next  # sin nombre de grupo no hay tabla destino que casar
    if (rep_name %in% names(tables_in)) next  # ya registrada (defensivo)
    child_df <- .mb_read_table(child$data_path, child$data_ext)
    tables_in[[rep_name]] <- child_df
  }

  if (length(tables_in) < 2L) {
    # Todas las hijas quedaron fuera (sin nombre/archivo): degradar a single.
    return(read_validation_data_ast(
      path = main_data_path, ext = main_data_ext, instrumento = main_instrumento
    ))
  }

  rc_map <- .repeats_count_map_from_instrumento(main_instrumento)
  lx <- lector_limpieza(
    archivo = NULL,
    hoja_principal = "principal",
    repeats_count_map = rc_map,
    warn = FALSE,
    hojas_override = tables_in
  )
  .finalize_multitable_data_ctx(lx, instrumento = main_instrumento,
                                source = "multibase_repeats")
}

#' Resuelve las bases hija repeat de una base madre (para el router).
#'
#' Busca en `s$estudio$bases` las que declaren el contrato relacional repeat:
#' `parent_base == base_nombre`, `repeat_group` no vacío y llaves compatibles
#' (`_parent_index` -> `_index`, o `_submission__id` -> `_id`). Las llaves
#' vacías se aceptan para proyectos legacy que ya registraban padre y grupo
#' antes de persistir ese metadata.
#' Devuelve una lista de specs planos (paths + repeat_group) lista para pasar
#' como argumento de datos a un job callr (sin capturar funciones ni estado del
#' entorno dev). Vacía si la base no es madre de ningún repeat.
#' @keywords internal
#' @noRd
.validacion_resolve_repeat_children <- function(sid, base_nombre = NULL) {
  if (is.null(base_nombre) || !nzchar(as.character(base_nombre))) return(list())
  s <- session_get(sid, required = FALSE)
  bases <- if (!is.null(s) && !is.null(s$estudio)) s$estudio$bases %||% list() else list()
  if (!length(bases)) return(list())

  out <- list()
  for (nm in names(bases)) {
    b <- bases[[nm]]
    if (!identical(as.character(b$parent_base %||% ""), as.character(base_nombre))) next
    repeat_group <- as.character(b$repeat_group %||% "")
    if (!nzchar(repeat_group)) next
    link_key <- as.character(b$link_key %||% "")
    parent_index_key <- as.character(b$parent_index_key %||% "")
    primary_link <- (!nzchar(link_key) || identical(link_key, "_parent_index")) &&
      (!nzchar(parent_index_key) || identical(parent_index_key, "_index"))
    fallback_link <- identical(link_key, "_submission__id") &&
      identical(parent_index_key, "_id")
    if (!primary_link && !fallback_link) next
    dat_meta <- tryCatch(get_file(sid, b$data_file_id), error = function(e) NULL)
    if (is.null(dat_meta) || is.null(dat_meta$path)) next
    out[[length(out) + 1L]] <- list(
      base         = nm,
      repeat_group = repeat_group,
      data_path    = dat_meta$path,
      data_ext     = as.character(b$data_ext %||% dat_meta$ext %||%
                                    tools::file_ext(dat_meta$path))
    )
  }
  out
}
