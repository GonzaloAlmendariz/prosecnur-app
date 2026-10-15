# Reparador de `<parent>_recod` (modo padre): nombre de lista y memo de firma.
#
# Dos defectos medidos el 2026-10-15 sobre HSyVbG (bases 2026/2024/2025):
#
# 1. LISTA COMPARTIDA QUE NO CONVERGE. P23 y P52 usan la misma lista `agresor`,
#    y el reparador daba a ambas recodificadas la lista `agresor_recod`. Cada una
#    trae su propio catálogo de grupos (P23: 7 = «Externo a la universidad»;
#    P52: 7 = «Externo»). Al pasar P52 encontraba el 7 ocupado con otra etiqueta
#    y lo renumeraba al siguiente libre (166, 167, 168…); en la ronda siguiente
#    P23 volvía a escribir su 7. El XLSForm y la data (3.318 filas) se
#    reescribían en CADA lectura de Analítica y todas las caches de la sesión se
#    vaciaban: `GET /api/analitica/variables` tardaba ~60 s en frío y ~18 s en
#    caliente. Cuando dos padres comparten lista, cada recodificada recibe su
#    propia lista `lst_<parent>_recod`, el mismo nombre que da Codificación
#    (`.add_recoded_q()` con `list_hint = paste0("lst_", pv, "_recod")`).
#
# 2. COSTO DE LA COMPROBACIÓN. Aun convergido, el reparador leía XLSForm y data
#    del disco en cada request. La firma (ruta + mtime + tamaño de ambos
#    archivos + digest del pedido de reparación) se recuerda por sesión y base
#    en un env de módulo: no vive en `s`, así que no viaja al `.pulso` y se
#    invalida sola cuando cambia cualquiera de los archivos o la codificación.

# Nombre de la lista `_recod` de cada reparación. Devuelve un vector nombrado por
# parent. `parent_lists` es el list_name original de cada parent (mismo orden).
.pulso_recod_list_names <- function(parents, parent_lists) {
  parents <- as.character(parents %||% character(0))
  parent_lists <- as.character(parent_lists %||% character(0))
  if (!length(parents)) return(stats::setNames(character(0), character(0)))
  ok <- !is.na(parent_lists) & nzchar(parent_lists)
  # Se cuentan padres DISTINTOS por lista: el mismo padre repetido no comparte.
  pares <- unique(data.frame(p = parents[ok], l = parent_lists[ok], stringsAsFactors = FALSE))
  counts <- table(pares$l)
  shared <- ok & parent_lists %in% names(counts)[counts > 1L]
  out <- ifelse(ok, paste0(parent_lists, "_recod"), NA_character_)
  out[shared] <- paste0("lst_", parents[shared], "_recod")
  out <- stats::setNames(out, parents)
  out[!duplicated(parents)]
}

# Listas `_recod` que dejaron de usarse tras repartir una lista compartida. Solo
# se borran si ninguna fila del survey las referencia todavía.
.pulso_recod_drop_orphan_lists <- function(survey, choices, candidates) {
  candidates <- unique(as.character(candidates %||% character(0)))
  candidates <- candidates[!is.na(candidates) & nzchar(candidates)]
  if (!length(candidates) || is.null(choices) || !nrow(choices)) {
    return(list(choices = choices, changed = FALSE))
  }
  types <- as.character(survey$type %||% character(0))
  used <- trimws(sub("^\\S+\\s*", "", types))
  if ("list_name" %in% names(survey)) used <- c(used, as.character(survey$list_name))
  orphan <- setdiff(candidates, used)
  drop <- as.character(choices$list_name) %in% orphan
  if (!any(drop)) return(list(choices = choices, changed = FALSE))
  list(choices = choices[!drop, , drop = FALSE], changed = TRUE)
}

.pulso_recod_repair_memo <- new.env(parent = emptyenv())

.pulso_recod_file_stamp <- function(path) {
  if (is.null(path) || !nzchar(path %||% "") || !file.exists(path)) return("<ausente>")
  info <- file.info(path)
  paste(normalizePath(path, mustWork = FALSE),
        format(as.numeric(info$mtime), digits = 15),
        as.character(info$size), sep = "|")
}

# Firma de una reparación de base: si coincide con la última que dejó la base
# sin cambios pendientes, la comprobación se salta sin leer ningún archivo.
.pulso_recod_repair_signature <- function(data_path, xls_path, repairs) {
  paste(
    .pulso_recod_file_stamp(data_path),
    .pulso_recod_file_stamp(xls_path),
    digest::digest(repairs, algo = "xxhash64"),
    sep = "#"
  )
}

.pulso_recod_memo_key <- function(sid, base_name) {
  paste0(as.character(sid %||% ""), "::", as.character(base_name %||% ""))
}

.pulso_recod_memo_hit <- function(sid, base_name, signature) {
  key <- .pulso_recod_memo_key(sid, base_name)
  prev <- get0(key, envir = .pulso_recod_repair_memo, inherits = FALSE)
  identical(prev, signature)
}

.pulso_recod_memo_set <- function(sid, base_name, signature) {
  assign(.pulso_recod_memo_key(sid, base_name), signature, envir = .pulso_recod_repair_memo)
  invisible(signature)
}

.pulso_recod_memo_clear <- function(sid = NULL) {
  keys <- ls(.pulso_recod_repair_memo, all.names = TRUE)
  if (!is.null(sid)) keys <- keys[startsWith(keys, paste0(as.character(sid), "::"))]
  if (length(keys)) rm(list = keys, envir = .pulso_recod_repair_memo)
  invisible(length(keys))
}
