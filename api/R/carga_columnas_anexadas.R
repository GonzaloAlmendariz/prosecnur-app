# Carga › Variables de la base: anexar columnas desde otro archivo.
#
# Gonzalo, 2026-10-16: las variables de cruce pueden crearse en la app, venir
# en la base con otro nombre (se equiparan en Equivalencias) o venir creadas en
# un archivo aparte. Esta es la tercera vía: un archivo con un identificador
# común (`_uuid`, `respondent_id`, código PULSO…) y las columnas que se suman a
# la base. Se guardan en la metadata de la base con sus valores —viven en el
# `.pulso` y no dependen del archivo— y se unen al leer la base
# (`base_variables_materializar()`), antes de las calculadas, así un segmento o
# una fórmula pueden partir de ellas. Sobreviven a una versión nueva de las
# respuestas: se vuelven a unir por la clave.

.ANEXAR_MAX_COLUMNAS <- 50L

.anexar_claves_posibles <- function(cols_base, cols_archivo) {
  intersect(.codif_key_candidates, intersect(cols_base, cols_archivo))
}

.anexar_valores_clave <- function(x) trimws(as.character(x))

.anexar_datos_base <- function(sid, base) {
  s <- session_get(sid)
  if (is.null((s$estudio$bases %||% list())[[base]])) {
    stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", base))
  }
  d <- estudio_data_sources(sid)[[base]]
  if (!is.data.frame(d)) stop_api(409, "E_ANEXAR_BASE_SIN_DATOS", sprintf("La base «%s» no tiene respuestas cargadas.", base))
  d
}

#' Qué trae el archivo y con qué clave se uniría a la base.
#' @keywords internal
base_columnas_anexar_vista <- function(sid, base, file_id) {
  datos <- .anexar_datos_base(sid, base)
  meta_f <- get_file(sid, file_id)
  archivo <- .read_data_from_path(meta_f$path, meta_f$ext)
  claves <- .anexar_claves_posibles(names(datos), names(archivo))
  coincidencias <- lapply(claves, function(k) {
    kb <- .anexar_valores_clave(datos[[k]]); ka <- .anexar_valores_clave(archivo[[k]])
    list(clave = k, n_base = length(kb), n_archivo = length(ka),
         n_coinciden = sum(kb %in% ka & !is.na(kb) & nzchar(kb)),
         repetidas_en_archivo = sum(duplicated(ka[!is.na(ka) & nzchar(ka)])))
  })
  columnas <- setdiff(names(archivo), claves)
  list(
    archivo = as.character(meta_f$original_name %||% basename(meta_f$path)),
    claves = coincidencias,
    columnas = lapply(columnas, function(v) {
      x <- archivo[[v]]
      con <- !is.na(x) & nzchar(trimws(as.character(x)))
      list(nombre = v, ya_en_la_base = v %in% names(datos), n_con_dato = sum(con),
           n_valores = length(unique(as.character(x[con]))))
    })
  )
}

#' Anexa columnas del archivo a la base, unidas por `clave`.
#' @keywords internal
base_columnas_anexar <- function(sid, base, file_id, clave, columnas) {
  datos <- .anexar_datos_base(sid, base)
  meta_f <- get_file(sid, file_id)
  archivo <- .read_data_from_path(meta_f$path, meta_f$ext)
  clave <- as.character(clave %||% "")[1]
  if (is.na(clave) || !(clave %in% .anexar_claves_posibles(names(datos), names(archivo)))) {
    stop_api(422, "E_ANEXAR_CLAVE", "Elige un identificador que esté en la base y en el archivo.")
  }
  columnas <- unique(as.character(unlist(columnas %||% list())))
  columnas <- columnas[nzchar(columnas) & columnas %in% names(archivo) & columnas != clave]
  if (!length(columnas)) stop_api(422, "E_ANEXAR_SIN_COLUMNAS", "Elige al menos una columna para anexar.")
  if (length(columnas) > .ANEXAR_MAX_COLUMNAS) {
    stop_api(422, "E_ANEXAR_SIN_COLUMNAS", sprintf("Se anexan hasta %d columnas a la vez.", .ANEXAR_MAX_COLUMNAS))
  }
  s <- session_get(sid)
  meta <- s$estudio$bases[[base]]
  previas <- unlist(lapply(meta$columnas_anexadas %||% list(), function(a) names(a$valores)))
  choque <- setdiff(intersect(columnas, names(datos)), previas)
  if (length(choque)) {
    stop_api(409, "E_ANEXAR_COLUMNA_OCUPADA", sprintf(
      "La base ya tiene %s. Renómbrala en el archivo o quítala de la selección.",
      paste0("«", choque, "»", collapse = ", ")), list(columnas = as.list(choque)))
  }
  ka <- .anexar_valores_clave(archivo[[clave]])
  ok <- !is.na(ka) & nzchar(ka) & !duplicated(ka)
  entrada <- list(
    archivo = as.character(meta_f$original_name %||% basename(meta_f$path)),
    clave = clave,
    anexado_en = format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
    claves = ka[ok],
    valores = lapply(stats::setNames(columnas, columnas), function(v) archivo[[v]][ok])
  )
  # Una columna que ya venía de otro anexo se reemplaza con la nueva.
  quedan <- lapply(meta$columnas_anexadas %||% list(), function(a) {
    a$valores <- a$valores[setdiff(names(a$valores), columnas)]
    a
  })
  quedan <- Filter(function(a) length(a$valores) > 0L, quedan)
  meta$columnas_anexadas <- c(quedan, list(entrada))
  s$estudio$bases[[base]] <- meta
  .session_env[[sid]] <- s
  .base_variables_tras_mutar(sid, base)
  kb <- .anexar_valores_clave(datos[[clave]])
  list(base = base, columnas = as.list(columnas), clave = clave,
       n_base = length(kb), n_con_dato = sum(kb %in% entrada$claves))
}

#' Quita columnas anexadas (todas si `columnas` es vacío).
#' @keywords internal
base_columnas_anexadas_quitar <- function(sid, base, columnas = NULL) {
  s <- session_get(sid)
  meta <- (s$estudio$bases %||% list())[[base]]
  if (is.null(meta)) stop_api(404, "E_BASE_NOT_FOUND", sprintf("Base '%s' no existe.", base))
  columnas <- as.character(unlist(columnas %||% list()))
  meta$columnas_anexadas <- Filter(function(a) length(a$valores) > 0L, lapply(meta$columnas_anexadas %||% list(), function(a) {
    a$valores <- if (length(columnas)) a$valores[setdiff(names(a$valores), columnas)] else list()
    a
  }))
  s$estudio$bases[[base]] <- meta
  .session_env[[sid]] <- s
  .base_variables_tras_mutar(sid, base)
  invisible(TRUE)
}

#' Une las columnas anexadas a la data de la base (la llama `base_variables_materializar`).
#' @keywords internal
.base_columnas_anexadas_unir <- function(data, base_meta) {
  anexos <- (base_meta %||% list())$columnas_anexadas %||% list()
  if (!length(anexos) || !is.data.frame(data)) return(data)
  for (a in anexos) {
    clave <- as.character(a$clave %||% "")[1]
    if (is.na(clave) || !(clave %in% names(data))) next
    idx <- match(.anexar_valores_clave(data[[clave]]), as.character(unlist(a$claves)))
    for (v in names(a$valores %||% list())) {
      vals <- a$valores[[v]]
      if (is.list(vals)) vals <- unlist(vals)
      data[[v]] <- vals[idx]
    }
  }
  data
}

.anexar_body <- function(req) {
  body_raw <- if (!is.null(req$bodyRaw)) rawToChar(req$bodyRaw) else (req$postBody %||% "")
  Encoding(body_raw) <- "UTF-8"
  if (!nzchar(body_raw)) return(list())
  tryCatch(jsonlite::fromJSON(body_raw, simplifyVector = FALSE),
           error = function(e) stop_api(400, "E_BAD_JSON", conditionMessage(e)))
}

# POST /api/estudio/base/anexar/vista  {nombre, file_id}            → {ok, archivo, claves, columnas}
# POST /api/estudio/base/anexar        {nombre, file_id, clave, columnas} → {ok, base, columnas, n_con_dato}
# POST /api/estudio/base/anexar/quitar {nombre, columnas?}           → {ok}
mount_carga_columnas_anexadas <- function(pr) {
  pr |>
    plumber::pr_post("/api/estudio/base/anexar/vista", wrap_endpoint(function(req, res, ...) {
      b <- .anexar_body(req)
      c(list(ok = TRUE), base_columnas_anexar_vista(session_header(req), as.character(b$nombre %||% ""), as.character(b$file_id %||% "")))
    })) |>
    plumber::pr_post("/api/estudio/base/anexar", wrap_endpoint(function(req, res, ...) {
      b <- .anexar_body(req)
      c(list(ok = TRUE), base_columnas_anexar(session_header(req), as.character(b$nombre %||% ""),
                                              as.character(b$file_id %||% ""), b$clave, b$columnas))
    })) |>
    plumber::pr_post("/api/estudio/base/anexar/quitar", wrap_endpoint(function(req, res, ...) {
      b <- .anexar_body(req)
      base_columnas_anexadas_quitar(session_header(req), as.character(b$nombre %||% ""), b$columnas)
      list(ok = TRUE)
    }))
}
