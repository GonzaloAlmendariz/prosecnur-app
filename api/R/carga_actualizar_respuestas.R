# Carga › Actualizar una fuente: vista previa, aplicar con copia y volver atrás.
#
# Plan del revamp de Procesamiento, fila "Motor de Carga", puntos 1, 3 y 4:
#   - vista previa: qué cambia y qué se conserva por fase, sin escribir nada;
#   - aplicar: guarda una copia de la base actual, reemplaza la data con el
#     flujo existente (`carga_reemplazar_respuestas()`, que no se duplica) y
#     devuelve a Validación lo que no depende de la data vieja;
#   - volver atrás: restituye la base de la copia.
#
# La copia vive en el directorio de la sesión (`state/`), no en el `.pulso`:
# dura mientras el proyecto siga abierto. Es una sola por base; aplicar otra
# actualización la reemplaza.
#
# Alcance: la versión nueva llega como archivo subido (`data_file_id` de
# `/api/upload`). La lectura de SurveyMonkey o Kobo sin aplicar (punto 2 del
# plan) no existe todavía en el código y queda fuera.

.carga_actualizar_base <- function(s, nombre) {
  meta <- (s$estudio$bases %||% list())[[nombre]]
  if (is.null(meta)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", nombre))
  meta
}

# La versión vigente que se compara es la recibida: si la limpieza promovió una
# base depurada, la recibida es su origen. Comparar contra la depurada haría
# pasar los casos excluidos por nuevos y las correcciones por ediciones.
.carga_actualizar_version_vigente <- function(s, meta) {
  linaje <- meta$limpieza %||% list()
  src <- as.character(linaje$source_data_file_id %||% "")[1]
  usa_origen <- isTRUE(linaje$enabled) && !is.na(src) && nzchar(src) && !is.null(s$files[[src]])
  fid <- if (usa_origen) src else as.character(meta$data_file_id %||% "")[1]
  fmeta <- if (!is.na(fid) && nzchar(fid)) s$files[[fid]] else NULL
  if (is.null(fmeta) || !file.exists(as.character(fmeta$path %||% ""))) {
    return(list(data = NULL, file_id = fid, archivo = NA_character_,
                es = NA_character_, causa = "El archivo de la versión vigente no está en la sesión."))
  }
  datos <- tryCatch(.read_data_from_path(fmeta$path, fmeta$ext), error = function(e) {
    message("[carga_actualizar] no se pudo leer la versión vigente: ", conditionMessage(e))
    NULL
  })
  list(data = datos, file_id = fid,
       archivo = as.character(fmeta$original_name %||% basename(fmeta$path)),
       es = if (usa_origen) "recibida_antes_de_la_limpieza" else "vigente",
       causa = if (is.null(datos)) "No se pudo leer el archivo de la versión vigente." else NA_character_)
}

# La llave declarada se usa para comparar solo si Limpieza también la usa
# (`.limpieza_llave_declarada_activa()`): si no, las decisiones congeladas se
# cruzarían por una llave distinta de la que se comparó.
.carga_actualizar_identidad_declarada <- function(meta) {
  if (!.limpieza_llave_declarada_activa()) return(character(0))
  idn <- ((meta$validacion %||% list())$operational_config %||% list())$identity %||% list()
  if (!isTRUE(idn$enabled)) return(character(0))
  as.character(unlist(idn$variables %||% list(), use.names = FALSE))
}

.carga_actualizar_leer_nueva <- function(sid, data_file_id) {
  dmeta <- get_file(sid, data_file_id)
  datos <- .read_data_from_path(dmeta$path, dmeta$ext %||% tools::file_ext(dmeta$path))
  list(data = datos, archivo = as.character(dmeta$original_name %||% basename(dmeta$path)))
}

#' Vista previa de una actualización de respuestas. No escribe la sesión.
#' @keywords internal
carga_actualizar_vista_previa <- function(sid, nombre, data_file_id) {
  s <- session_get(sid)
  meta <- .carga_actualizar_base(s, nombre)
  .carga_exigir_formulario(meta, nombre)
  nueva <- .carga_actualizar_leer_nueva(sid, data_file_id)
  vigente <- .carga_actualizar_version_vigente(s, meta)
  comparacion <- carga_actualizar_comparar(vigente$data, nueva$data,
                                           .carga_actualizar_identidad_declarada(meta))
  if (is.null(vigente$data)) {
    comparacion$casos$antes <- NA_integer_
    comparacion$casos$causa <- vigente$causa
  }
  efecto <- carga_actualizar_fases(s, nombre, nueva$data, comparacion)
  c(list(ok = TRUE, base = nombre,
         version_vigente = list(file_id = vigente$file_id, archivo = vigente$archivo, es = vigente$es),
         version_nueva = list(file_id = data_file_id, archivo = nueva$archivo),
         formulario = list(cambia = FALSE, causa = "Se conserva el formulario de la base; solo cambian las respuestas.")),
    comparacion, efecto,
    list(respaldo = carga_actualizar_respaldo_info(sid, nombre)))
}

# ---------------------------------------------------------------------------
# Copia para volver atrás
# ---------------------------------------------------------------------------

.carga_actualizar_respaldo_path <- function(sid, nombre) {
  dir <- file.path(session_get(sid)$dir, "state")
  dir.create(dir, recursive = TRUE, showWarnings = FALSE)
  .carga_actualizar_respaldo_archivo(session_get(sid)$dir, nombre)
}

# La ruta de la copia sin crear nada: la lee el estado por fase
# (procesamiento_estado_fases.R) desde la sesión que ya tiene en la mano.
.carga_actualizar_respaldo_archivo <- function(dir_sesion, nombre) {
  file.path(dir_sesion, "state",
            sprintf("carga_respaldo_%s.rds", paste(charToRaw(enc2utf8(nombre)), collapse = "")))
}

#' Copia vigente de una base para volver atrás; NULL si no hay.
#' @keywords internal
carga_actualizar_respaldo_info <- function(sid, nombre) {
  path <- .carga_actualizar_respaldo_path(sid, nombre)
  if (!file.exists(path)) return(NULL)
  r <- .carga_actualizar_leer_copia(path)
  if (is.null(r)) {
    return(list(creado_en = NA_character_, archivo = NA_character_, n_filas = NA_integer_,
                legible = FALSE, causa = "La copia anterior está dañada y no se puede leer."))
  }
  list(creado_en = r$creado_en, archivo = r$archivo, n_filas = r$meta$n_filas %||% NA_integer_,
       legible = TRUE, causa = NA_character_)
}

# NULL si el archivo de la copia no se puede leer (dañado o truncado); la causa
# va al log y quien llama la dice: la info la marca ilegible y volver atrás
# responde 409 con motivo `copia_ilegible`.
.carga_actualizar_leer_copia <- function(path) {
  tryCatch(readRDS(path), error = function(e) {
    message("[carga_actualizar] copia ilegible en ", basename(path), ": ", conditionMessage(e))
    NULL
  })
}

.carga_actualizar_guardar_respaldo <- function(sid, nombre) {
  s <- session_get(sid)
  meta <- s$estudio$bases[[nombre]]
  fmeta <- s$files[[as.character(meta$data_file_id %||% "")]] %||% list()
  copia <- list(
    version = 1L, base = nombre,
    creado_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    archivo = as.character(fmeta$original_name %||% NA_character_),
    meta = meta,
    codif = (s$codif_por_base %||% list())[[nombre]]
  )
  saveRDS(copia, .carga_actualizar_respaldo_path(sid, nombre))
  invisible(copia)
}

# Lo que `estudio_replace_base_files()` vacía y no depende de la data vieja se
# devuelve al scope de Validación. Las decisiones pasan por la misma función
# que las anuncia en la vista previa.
.carga_actualizar_devolver_validacion <- function(sid, nombre, scope_previo, destinos) {
  conservar <- vapply(destinos, function(x) identical(x$destino, "conserva"), logical(1))
  draft <- (scope_previo$limpieza_draft %||% list())[conservar]
  validacion_scope_set(sid, nombre, "reglas_custom", scope_previo$reglas_custom %||% list())
  validacion_scope_set(sid, nombre, "variables_excluidas", scope_previo$variables_excluidas %||% character(0))
  validacion_scope_set(sid, nombre, "limpieza_draft", unname(draft))
  validacion_scope_set(sid, nombre, "limpieza_preservadas", scope_previo$limpieza_preservadas %||% list())
  invisible(length(draft))
}

#' Aplica una versión nueva de las respuestas guardando una copia para volver.
#' @keywords internal
carga_actualizar_aplicar <- function(sid, nombre, data_file_id) {
  previa <- carga_actualizar_vista_previa(sid, nombre, data_file_id)
  scope_previo <- session_get(sid)$estudio$bases[[nombre]]$validacion %||% list()
  # Una copia nueva reemplaza a la anterior solo si la actualización entra: si
  # falla, la base sigue como estaba y la copia de antes sigue valiendo.
  path <- .carga_actualizar_respaldo_path(sid, nombre)
  # Una copia anterior dañada no se puede restituir: la nueva la reemplaza.
  anterior <- if (file.exists(path)) .carga_actualizar_leer_copia(path) else NULL
  .carga_actualizar_guardar_respaldo(sid, nombre)
  out <- tryCatch(carga_reemplazar_respuestas(sid, nombre, data_file_id), error = function(e) {
    if (is.null(anterior)) unlink(path) else saveRDS(anterior, path)
    stop(e)
  })
  .carga_actualizar_devolver_validacion(sid, nombre, scope_previo, previa$decisiones)
  s <- session_get(sid)
  list(ok = TRUE, base = .estudio_base_payload(s$estudio$bases[[nombre]], s),
       archivo = out$archivo, cambios = previa[c("identificador", "casos", "columnas")],
       fases = previa$fases, decisiones = previa$decisiones,
       respaldo = carga_actualizar_respaldo_info(sid, nombre))
}

#' Vuelve a la versión de la base guardada antes de la última actualización.
#'
#' Reemplaza la data con el archivo de la copia por el mismo flujo de carga y
#' restituye la base declarada (validación, linaje de limpieza, variables) y
#' el catálogo de codificación. La codificación aplicada no se restituye: el
#' par adaptado se descartó al actualizar, así que hay que volver a aplicarla.
#' @keywords internal
carga_actualizar_revertir <- function(sid, nombre) {
  .carga_actualizar_base(session_get(sid), nombre)
  path <- .carga_actualizar_respaldo_path(sid, nombre)
  if (!file.exists(path)) {
    stop_api(409, "E_CARGA_ACTUALIZAR_SIN_COPIA",
             sprintf("La base \"%s\" no tiene una copia anterior: se guarda al aplicar una actualización y dura mientras el proyecto siga abierto.", nombre),
             details = list(motivo = "sin_copia"))
  }
  copia <- .carga_actualizar_leer_copia(path)
  if (is.null(copia)) {
    stop_api(409, "E_CARGA_ACTUALIZAR_SIN_COPIA",
             "La copia anterior está dañada y no se puede leer; no se puede volver a esa versión.",
             details = list(motivo = "copia_ilegible"))
  }
  fid <- as.character(copia$meta$data_file_id %||% "")
  if (!nzchar(fid) || is.null(session_get(sid)$files[[fid]])) {
    stop_api(409, "E_CARGA_ACTUALIZAR_SIN_COPIA",
             "El archivo de la versión anterior ya no está en la sesión; no se puede volver a ella.",
             details = list(motivo = "archivo_ausente"))
  }
  carga_reemplazar_respuestas(sid, nombre, fid)
  s <- session_get(sid)
  s$estudio$bases[[nombre]] <- copia$meta
  if (!is.null(copia$codif)) {
    if (!is.list(s$codif_por_base)) s$codif_por_base <- list()
    s$codif_por_base[[nombre]] <- .codif_strip_applied_state(copia$codif)
  }
  s <- .mark_project_dirty(s)
  .session_env[[sid]] <- s
  .pulso_rebuild_estudio_runtime_sources(sid, bases = nombre)
  unlink(path)
  s2 <- session_get(sid)
  list(ok = TRUE, base = .estudio_base_payload(s2$estudio$bases[[nombre]], s2),
       archivo = copia$archivo, respaldo = NULL)
}
