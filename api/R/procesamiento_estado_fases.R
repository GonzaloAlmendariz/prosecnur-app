# =============================================================================
# Procesamiento (M8): estado por base y por fase
# =============================================================================
# `procesamiento_estado_fases()` es la única función que dice, para UNA base,
# en qué estado está cada fase de Procesamiento. La publica `GET /api/estudio`
# en `bases[<nombre>]$fases` (router_estudio.R) y la leen "Estado del estudio"
# y la banda del módulo.
#
# Grano: base (par formulario + respuestas de `s$estudio$bases[[nombre]]`).
# Solo se lee el estado de ESA base: una base hermana nunca cambia el estado
# de otra.
#
# Por fase: `estado` (sin_iniciar | en_curso | hecha | desactualizada), `motivo`
# (código estable), `causa` (texto para la persona, NA si el estado no
# necesita explicación), `actualizado_en` (ISO, último cambio de la fase) y
# `sin_fecha` (por qué `actualizado_en` es NA). Lo que el motor no registra no
# se infiere: queda NA y se dice por qué.
#
# Solo compara lo que el motor ya guarda; no lee archivos de datos:
#   Validación     cierre (`limpieza_artifacts$finalized_at`), linaje de la
#                  base limpia (`meta$limpieza`), firma de los archivos del
#                  cierre (`.limpieza_firma_cierre`) y la copia de "Actualizar
#                  una fuente" (`carga_actualizar_respuestas.R`).
#   Codificación   par adaptado vigente y `readaptar_desde`
#                  (`.codif_readaptar_pendiente`).
#   Analítica y    los indicadores por base de `.estudio_base_status_payload`;
#   Gráficos       el motor no registra sobre qué versión de la base se
#                  generaron sus archivos, así que nunca se declaran al día.

.PROC_FASES <- c("carga", "validacion", "codificacion", "analitica", "graficos")

.proc_fase <- function(estado, motivo, causa = NA_character_,
                       actualizado_en = NA_character_, sin_fecha = NA_character_) {
  fecha <- calc_str(actualizado_en, NA_character_)
  if (!is.na(fecha) && !nzchar(fecha)) fecha <- NA_character_
  list(estado = estado, motivo = motivo, causa = causa,
       actualizado_en = fecha,
       sin_fecha = if (is.na(fecha)) sin_fecha else NA_character_)
}

.proc_txt <- function(x) {
  v <- calc_str(x, "")
  if (identical(v, "NA")) "" else trimws(v)
}

# La fecha más reciente de un conjunto de marcas ISO; NA si ninguna se lee.
.proc_mas_reciente <- function(marcas) {
  marcas <- vapply(marcas, .proc_txt, character(1))
  marcas <- marcas[nzchar(marcas)]
  if (!length(marcas)) return(NA_character_)
  t <- suppressWarnings(as.POSIXct(sub("Z$", "", marcas), format = "%Y-%m-%dT%H:%M:%S", tz = "UTC"))
  if (all(is.na(t))) return(marcas[[length(marcas)]])
  marcas[[which.max(replace(as.numeric(t), is.na(t), -Inf))]]
}

.proc_archivo <- function(s, fid) {
  fid <- .proc_txt(fid)
  if (!nzchar(fid)) return(NULL)
  (s$files %||% list())[[fid]]
}

# ---- Fuente -----------------------------------------------------------------

# La última lectura de la plataforma de la que vienen las respuestas.
.proc_fuente <- function(meta) {
  kobo <- .proc_txt(meta$kobo_refreshed_at)
  ultima_sm <- if (is.list(meta$surveymonkey_last_refresh)) meta$surveymonkey_last_refresh else list()
  sm <- .proc_txt(ultima_sm$refreshed_at)
  if (!nzchar(sm)) sm <- .proc_txt(meta$surveymonkey_refreshed_at)
  if (nzchar(kobo) && (!nzchar(sm) || identical(.proc_mas_reciente(list(kobo, sm)), kobo))) {
    return(list(plataforma = "kobo", leida_en = kobo, sin_fecha = NA_character_))
  }
  if (nzchar(sm)) return(list(plataforma = "surveymonkey", leida_en = sm, sin_fecha = NA_character_))
  list(plataforma = NA_character_, leida_en = NA_character_,
       sin_fecha = "Las respuestas no se leyeron de una plataforma.")
}

# ---- Carga ------------------------------------------------------------------

# El archivo de respuestas recibido: el origen del linaje si la limpieza
# promovió la base, si no el vigente salvo que ya sea la base codificada.
.proc_respuestas_recibidas <- function(s, meta) {
  linaje <- meta$limpieza %||% list()
  for (fid in list(if (isTRUE(linaje$enabled)) linaje$source_data_file_id,
                   meta$data_file_id, meta$original_data_file_id)) {
    f <- .proc_archivo(s, fid)
    if (!is.null(f) && !identical(.proc_txt(f$kind), "data_adaptada")) return(f)
  }
  NULL
}

.proc_fase_carga <- function(s, meta, fuente) {
  sin_form <- !nzchar(.proc_txt(meta$xlsform_file_id))
  sin_resp <- !nzchar(.proc_txt(meta$data_file_id))
  if (sin_form && sin_resp) {
    return(.proc_fase("sin_iniciar", "sin_archivos", "Faltan el formulario y las respuestas.",
                      sin_fecha = "La base no tiene archivos cargados."))
  }
  recibido <- .proc_respuestas_recibidas(s, meta)
  fecha <- if (!is.na(fuente$leida_en)) fuente$leida_en
           else .proc_mas_reciente(list((recibido %||% list())$uploaded_at, meta$imported_at))
  sin_fecha <- "La base no registra cuándo se cargaron sus respuestas."
  if (sin_form) return(.proc_fase("en_curso", "falta_formulario", "Falta el formulario.", fecha, sin_fecha))
  if (sin_resp) return(.proc_fase("en_curso", "faltan_respuestas", "Faltan las respuestas.", fecha, sin_fecha))
  .proc_fase("hecha", "cargada", NA_character_, fecha, sin_fecha)
}

# ---- Validación -------------------------------------------------------------

# La copia que guarda "Actualizar una fuente" antes de reemplazar las
# respuestas. Se lee una vez por archivo y fecha de modificación.
.proc_respaldos <- new.env(parent = emptyenv())

.proc_respaldo <- function(s, nombre) {
  dir <- .proc_txt(s$dir)
  if (!nzchar(dir)) return(NULL)
  path <- .carga_actualizar_respaldo_archivo(dir, nombre)
  if (!file.exists(path)) return(NULL)
  clave <- paste(path, as.numeric(file.info(path)$mtime))
  if (!is.null(.proc_respaldos[[clave]])) return(.proc_respaldos[[clave]])
  # Una copia ilegible no prueba un cierre previo; se recuerda para no volver a
  # leerla (y a anotarla en el log) en cada lectura del estudio.
  copia <- .carga_actualizar_leer_copia(path) %||% list()
  scope <- (copia$meta %||% list())$validacion %||% list()
  resumen <- list(
    creado_en = .proc_txt(copia$creado_en),
    cerrada_en = .proc_txt((scope$limpieza_artifacts %||% list())$finalized_at)
  )
  assign(clave, resumen, envir = .proc_respaldos)
  resumen
}

.proc_fecha_trabajo_validacion <- function(scope) {
  draft <- scope$limpieza_draft %||% list()
  .proc_mas_reciente(c(
    list((scope$evaluacion %||% list())$auditada_en),
    lapply(draft, function(d) if (is.list(d)) d$updated_at else NULL)
  ))
}

.proc_fase_validacion <- function(s, meta, nombre) {
  scope <- meta$validacion %||% list()
  artifacts <- scope$limpieza_artifacts %||% list()
  linaje <- meta$limpieza %||% list()
  cerrada_en <- .proc_txt(artifacts$finalized_at)
  sin_fecha <- "La validación de esta base no registra fechas."
  if (nzchar(cerrada_en) && !.limpieza_promocion_revertida(linaje)) {
    vigente <- .proc_txt(meta$data_file_id)
    efectiva <- .proc_txt(linaje$effective_data_file_id)
    es_codificada <- identical(.proc_txt((.proc_archivo(s, vigente) %||% list())$kind), "data_adaptada")
    if (isTRUE(linaje$enabled) && nzchar(efectiva) && !identical(vigente, efectiva) && !es_codificada) {
      return(.proc_fase("desactualizada", "respuestas_cambiaron",
                        "Las respuestas cambiaron después de cerrar la limpieza.", cerrada_en))
    }
    actual <- .limpieza_firma_cierre(scope)
    causas <- unique(unlist(lapply(scope$limpieza_archivos %||% list(), function(rec) {
      if (is.list(rec) && is.list(rec$firma)) .limpieza_causas_de_firma(rec$firma, actual) else NULL
    })))
    if ("cambiaron_las_decisiones" %in% causas) {
      return(.proc_fase("desactualizada", "decisiones_cambiaron",
                        "Las decisiones de limpieza cambiaron después de cerrar la base.",
                        .proc_mas_reciente(list(cerrada_en, .proc_fecha_trabajo_validacion(scope)))))
    }
    if ("cambio_la_auditoria" %in% causas) {
      return(.proc_fase("desactualizada", "auditoria_cambio",
                        "La auditoría cambió después de cerrar la base.",
                        .proc_mas_reciente(list(cerrada_en, .proc_fecha_trabajo_validacion(scope)))))
    }
    return(.proc_fase("hecha", "cerrada", NA_character_, cerrada_en))
  }
  respaldo <- .proc_respaldo(s, nombre)
  if (!is.null(respaldo) && nzchar(respaldo$cerrada_en)) {
    return(.proc_fase("desactualizada", "respuestas_actualizadas",
                      "Las respuestas se actualizaron después de cerrar la limpieza: falta volver a auditar y a cerrar la base.",
                      respaldo$creado_en, sin_fecha))
  }
  if (.limpieza_promocion_revertida(linaje)) {
    return(.proc_fase("en_curso", "reabierta", "Se reabrió la base después de cerrarla.",
                      linaje$reverted_at, sin_fecha))
  }
  con_trabajo <- !is.null(scope$evaluacion) || length(scope$limpieza_draft %||% list()) > 0L ||
    length(scope$reglas_custom %||% list()) > 0L
  if (con_trabajo) {
    return(.proc_fase("en_curso", "sin_cerrar", NA_character_,
                      .proc_fecha_trabajo_validacion(scope), sin_fecha))
  }
  .proc_fase("sin_iniciar", "sin_auditoria", NA_character_,
             sin_fecha = "La base no tiene auditoría ni decisiones de limpieza.")
}

# ---- Codificación -----------------------------------------------------------

.proc_fase_codificacion <- function(s, meta, nombre, status) {
  codif <- (s$codif_por_base %||% list())[[nombre]] %||% list()
  if (isTRUE(status$codificacion_adaptada)) {
    adaptada <- .proc_archivo(s, meta$data_file_id)
    return(.proc_fase("hecha", "aplicada", NA_character_, (adaptada %||% list())$uploaded_at,
                      "La base codificada no registra cuándo se generó."))
  }
  if (.codif_readaptar_pendiente(codif)) {
    return(.proc_fase("desactualizada", "base_cambio",
                      "La base cambió después de aplicar la codificación: falta volver a aplicarla.",
                      codif$readaptar_desde))
  }
  sin_fecha <- "La codificación sin aplicar no registra fechas."
  if (isTRUE(status$codificacion)) return(.proc_fase("en_curso", "sin_aplicar", NA_character_, sin_fecha = sin_fecha))
  .proc_fase("sin_iniciar", "sin_codigos", NA_character_, sin_fecha = "La base no tiene grupos de códigos ni plantilla.")
}

# ---- Analítica y Gráficos -------------------------------------------------------

# Con archivos generados el motor no sabe sobre qué versión de la base salieron:
# la fase queda en curso con esa causa, salvo que una fase anterior ya esté
# desactualizada, que los arrastra.
.proc_fase_salida <- function(con_archivos, anteriores, nombre_fase) {
  sin_registro <- sprintf("La app no registra cuándo se generaron los archivos de %s de esta base.", nombre_fase)
  if (!isTRUE(con_archivos)) {
    return(.proc_fase("sin_iniciar", "sin_archivos", NA_character_,
                      sin_fecha = sprintf("Todavía no hay archivos de %s de esta base.", nombre_fase)))
  }
  previa <- Filter(function(f) identical(f$estado, "desactualizada"), anteriores)
  if (length(previa)) {
    return(.proc_fase("desactualizada", "fase_anterior_desactualizada",
                      sprintf("Depende de %s, que quedó desactualizada.", names(previa)[[1]]),
                      sin_fecha = sin_registro))
  }
  .proc_fase("en_curso", "sin_registro_de_version",
             "Hay archivos generados; la app no registra sobre qué versión de la base se generaron.",
             sin_fecha = sin_registro)
}

# ---- Publicación --------------------------------------------------------------

#' Estado por fase de una base de Procesamiento (M8)
#'
#' @param meta entrada de la base (`s$estudio$bases[[nombre]]`).
#' @param s sesión.
#' @param status indicadores por base ya calculados por
#'   `.estudio_base_status_payload()`; no se recalculan aquí.
#' @return `list(fuente, fases)`; ver el encabezado del archivo.
#' @keywords internal
procesamiento_estado_fases <- function(meta, s, status) {
  nombre <- .proc_txt(meta$nombre)
  fuente <- .proc_fuente(meta)
  carga <- .proc_fase_carga(s, meta, fuente)
  validacion <- .proc_fase_validacion(s, meta, nombre)
  codificacion <- .proc_fase_codificacion(s, meta, nombre, status %||% list())
  analitica <- .proc_fase_salida(status$analitica,
                                 list("Validación" = validacion, "Codificación" = codificacion), "Analítica")
  graficos <- .proc_fase_salida(status$graficos,
                                list("Validación" = validacion, "Codificación" = codificacion,
                                     "Analítica" = analitica), "Gráficos")
  list(
    fuente = fuente,
    fases = stats::setNames(list(carga, validacion, codificacion, analitica, graficos), .PROC_FASES)
  )
}

#' Carpeta de entregables del estudio (ADR 0133 §4)
#' @keywords internal
procesamiento_carpeta_entregables <- function(s) {
  ruta <- .entregable_carpeta(s)
  list(
    ruta = ruta %||% NA_character_,
    sin_ruta = if (is.null(ruta)) "El proyecto no se ha guardado: los entregables se copian junto al archivo .pulso." else NA_character_
  )
}
