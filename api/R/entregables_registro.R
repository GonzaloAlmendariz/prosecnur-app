# =============================================================================
# Entregables: un registro, un nombre y una carpeta (ADR 0133 §1, §3 y §4)
# =============================================================================
# `entregable_nombre()` arma el nombre público de todo archivo que la app
# entrega; `entregable_registrar()` lo registra en `s$files` y, con un .pulso
# guardado y fuera del modo público, deja una copia sin diálogo en
# `<carpeta del .pulso>/Entregables/<Módulo>/`. Los registradores de cada módulo
# (`.register_output_file()`, `.limpieza_register_download()`, …) son
# envoltorios que delegan aquí. La copia corre en el proceso principal: los
# resultados de un job se registran al hacer poll, nunca dentro del worker.

.ENTREGABLE_MAX_STEM <- 80L
.ENTREGABLE_MAX_RUTA <- 240L

# Texto → segmento de nombre: translitera tildes y ñ, todo lo que no sea
# [A-Za-z0-9] pasa a `_`, sin `_` repetidos ni en los bordes. Vacío si no queda nada.
.entregable_slug <- function(x) {
  x <- as.character(x %||% "")[1]
  if (is.na(x)) return("")
  x <- stringi::stri_trans_general(trimws(x), "Latin-ASCII")
  x <- gsub("[^A-Za-z0-9]+", "_", x)
  gsub("^_+|_+$", "", x)
}

.entregable_recortar <- function(x, n) {
  if (n <= 0L) return("")
  gsub("_+$", "", substr(x, 1L, n))
}

# La extensión tal cual (respeta `pulso-graficos.zip`), sin punto inicial ni
# caracteres fuera de [A-Za-z0-9.-].
.entregable_ext_limpia <- function(ext) {
  ext <- as.character(ext %||% "")[1]
  if (is.na(ext)) return("")
  gsub("[^A-Za-z0-9.-]", "", sub("^\\.+", "", ext))
}

.entregable_ext <- function(ext) {
  ext <- .entregable_ext_limpia(ext)
  if (nzchar(ext)) ext else "bin"
}

# Estudio del nombre: código de la Ficha; si no, el nombre del .pulso; si no, Prosecnur.
.entregable_estudio <- function(s) {
  if (is.null(s)) return("Prosecnur")
  codigo <- tryCatch(.entregable_slug(.planner_identidad(s)$codigo), error = function(e) "")
  if (nzchar(codigo)) return(codigo)
  pp <- as.character(s$project_path %||% "")[1]
  if (!is.na(pp) && nzchar(pp)) {
    desde_pulso <- .entregable_slug(tools::file_path_sans_ext(basename(pp)))
    if (nzchar(desde_pulso)) return(desde_pulso)
  }
  "Prosecnur"
}

.entregable_n_bases <- function(s) {
  if (is.null(s)) return(0L)
  max(length(s$estudio$bases %||% list()), length(s$rp_data_sources %||% list()))
}

#' Nombre público de un entregable (ADR 0133 §3)
#'
#' `<Estudio>_<Entregable>[_<Base>][_<Detalle>]_<dd_mm_yy>.<ext>`, con el nombre sin
#' extensión ≤ 80: se recorta primero el detalle y luego el rótulo; el estudio y la
#' fecha quedan enteros (el estudio sólo se acota si por sí solo no dejara sitio).
#' @keywords internal
entregable_nombre <- function(sid, rotulo, ext, base = NULL, detalle = NULL, fecha = Sys.Date()) {
  s <- session_get(sid, required = FALSE)
  fecha_txt <- format(as.Date(fecha), "%d_%m_%y")
  estudio <- .entregable_recortar(.entregable_estudio(s), .ENTREGABLE_MAX_STEM - nchar(fecha_txt) - 3L)
  entregable <- .entregable_slug(rotulo)
  if (!nzchar(entregable)) entregable <- "Archivo"
  entregable <- paste0(toupper(substr(entregable, 1L, 1L)), substr(entregable, 2L, nchar(entregable)))
  base_txt <- if (.entregable_n_bases(s) > 1L) .entregable_slug(base) else ""
  detalle_txt <- .entregable_slug(detalle)

  # Lo que cabe entre «<estudio>_» y «_<fecha>».
  cupo <- .ENTREGABLE_MAX_STEM - nchar(estudio) - nchar(fecha_txt) - 2L
  largo <- function(...) { p <- c(...); p <- p[nzchar(p)]; sum(nchar(p)) + max(0L, length(p) - 1L) }
  if (largo(entregable, base_txt, detalle_txt) > cupo) {
    detalle_txt <- .entregable_recortar(detalle_txt, cupo - largo(entregable, base_txt) - 1L)
  }
  if (largo(entregable, base_txt, detalle_txt) > cupo) {
    resto <- if (nzchar(base_txt)) nchar(base_txt) + 1L else 0L
    entregable <- .entregable_recortar(entregable, max(1L, cupo - resto))
  }
  if (largo(entregable, base_txt, detalle_txt) > cupo) {
    base_txt <- .entregable_recortar(base_txt, cupo - nchar(entregable) - 1L)
  }
  partes <- c(estudio, entregable, base_txt, detalle_txt, fecha_txt)
  paste0(paste(partes[nzchar(partes)], collapse = "_"), ".", .entregable_ext(ext))
}

# Nombre de archivo limpio con las reglas del §3. Si termina en `.<ext>` (sin
# distinguir mayúsculas) ésa es la extensión y el resto el nombre; si no, todo es
# nombre y se le agrega `.<ext>` («Frecuencias» → «Frecuencias.xlsx», nunca
# «Frecuencias.xlsx.xlsx»). Vacío si el nombre no deja letras ni dígitos.
.entregable_archivo_limpio <- function(nombre, ext) {
  nombre <- trimws(as.character(nombre %||% "")[1])
  ext <- .entregable_ext_limpia(ext)
  if (is.na(nombre)) return("")
  cola <- paste0(".", ext)
  stem <- if (nzchar(ext) && endsWith(tolower(nombre), tolower(cola))) {
    substr(nombre, 1L, nchar(nombre) - nchar(cola))
  } else nombre
  stem <- .entregable_recortar(.entregable_slug(stem), .ENTREGABLE_MAX_STEM)
  if (!nzchar(stem)) return("")
  if (nzchar(ext)) paste0(stem, cola) else stem
}

#' Primer nombre libre en `carpeta`: `x.ext`, `x_2.ext`, `x_3.ext`…, comparando sin
#' distinguir mayúsculas (como Windows)
#' @keywords internal
.entregable_nombre_libre <- function(carpeta, nombre) {
  existentes <- tolower(list.files(carpeta, all.files = TRUE, no.. = TRUE))
  if (!tolower(nombre) %in% existentes) return(nombre)
  punto <- regexpr(".", nombre, fixed = TRUE)
  stem <- if (punto > 0L) substr(nombre, 1L, punto - 1L) else nombre
  cola <- if (punto > 0L) substr(nombre, punto, nchar(nombre)) else ""
  n <- 2L
  repeat {
    candidato <- paste0(stem, "_", n, cola)
    if (!tolower(candidato) %in% existentes) return(candidato)
    n <- n + 1L
  }
}

# Copia el archivo a Entregables/<Módulo>/. Devuelve list(guardado_en, aviso); nunca lanza.
.entregable_copiar <- function(s, path, nombre, modulo) {
  nada <- list(guardado_en = NULL, aviso = NULL)
  pp <- as.character(s$project_path %||% "")[1]
  if (is.na(pp) || !nzchar(pp)) return(nada)
  aviso <- function(txt) list(guardado_en = NULL, aviso = txt)
  tryCatch({
    carpeta <- file.path(dirname(pp), "Entregables", modulo)
    archivo <- .entregable_archivo_limpio(nombre, tools::file_ext(path))
    if (!nzchar(archivo)) return(aviso("El nombre del archivo no deja un nombre válido para la copia."))
    destino <- file.path(carpeta, archivo)
    if (nchar(destino) > .ENTREGABLE_MAX_RUTA) {
      return(aviso(sprintf("No se guardó la copia junto al proyecto: la ruta pasa de %d caracteres. El archivo sigue disponible en la descarga.",
                           .ENTREGABLE_MAX_RUTA)))
    }
    if (!dir.exists(carpeta)) dir.create(carpeta, recursive = TRUE, showWarnings = FALSE)
    if (!dir.exists(carpeta)) {
      return(aviso(sprintf("No se pudo crear la carpeta «%s» junto al proyecto.", file.path("Entregables", modulo))))
    }
    destino <- file.path(carpeta, .entregable_nombre_libre(carpeta, archivo))
    if (nchar(destino) > .ENTREGABLE_MAX_RUTA) {
      return(aviso(sprintf("No se guardó la copia junto al proyecto: la ruta pasa de %d caracteres. El archivo sigue disponible en la descarga.",
                           .ENTREGABLE_MAX_RUTA)))
    }
    ok <- suppressWarnings(file.copy(path, destino, overwrite = FALSE))
    if (!isTRUE(ok)) return(aviso("No se pudo copiar el archivo junto al proyecto."))
    list(guardado_en = destino, aviso = NULL)
  }, error = function(e) {
    aviso("No se pudo copiar el archivo junto al proyecto.")
  })
}

# Un basename que ya tiene la forma del §3 (lo armó `.export_filename()` antes de
# lanzar el job) se conserva: lleva la base o el detalle que el registro no conoce.
.entregable_nombre_heredado <- function(s, path) {
  limpio <- .strip_internal_prefix(basename(path))
  stem <- sub("\\..*$", "", limpio)
  patron <- paste0("^", .entregable_estudio(s), "_.+_[0-9]{2}_[0-9]{2}_[0-9]{2}$")
  if (grepl(patron, stem) && !grepl("[0-9a-fA-F-]{36}", limpio)) limpio else NULL
}

#' Registra un entregable en el file store de la sesión (ADR 0133 §1 y §4)
#'
#' Sin `original_name`, el nombre es el del §3 (o el basename si ya lo tiene). El meta
#' trae `file_id`, `kind`, `original_name`, `path`, `size`, `ext`, `uploaded_at`,
#' `modulo`, `rotulo`, `guardado_en` y `aviso_guardado`. Una copia fallida queda en
#' `aviso_guardado` y no hace fallar la generación. `copiar = FALSE` registra y sirve
#' el archivo sin copiarlo aunque el catálogo diga `guardar` (los archivos por base
#' que viajan dentro de un ZIP multibase: se copia sólo el ZIP).
#' @keywords internal
entregable_registrar <- function(sid, path, kind, base = NULL, detalle = NULL, original_name = NULL,
                                 copiar = TRUE) {
  s <- session_get(sid)
  fila <- .entregable_fila(kind)
  ext <- tools::file_ext(path)
  nombre <- as.character(original_name %||% "")[1]
  if (is.na(nombre) || !nzchar(nombre) || grepl("[0-9a-fA-F-]{36}", nombre)) {
    nombre <- .entregable_nombre_heredado(s, path) %||%
      entregable_nombre(sid, fila$rotulo, ext, base = if (isTRUE(fila$por_base)) base else NULL,
                        detalle = detalle)
  }
  meta <- list(
    file_id = uuid::UUIDgenerate(), kind = kind,
    original_name = nombre, path = path,
    size = as.integer(file.info(path)$size),
    ext = ext,
    uploaded_at = format(Sys.time(), "%Y-%m-%dT%H:%M:%SZ", tz = "UTC"),
    modulo = fila$modulo, rotulo = fila$rotulo,
    guardado_en = NULL, aviso_guardado = NULL
  )
  if (isTRUE(copiar) && isTRUE(fila$guardar) && !is_public_mode()) {
    copia <- .entregable_copiar(s, path, nombre, fila$modulo)
    meta["guardado_en"] <- list(copia$guardado_en)
    meta["aviso_guardado"] <- list(copia$aviso)
  }
  files <- session_get(sid)$files
  files[[meta$file_id]] <- meta
  session_set(sid, "files", files)
  meta
}

# ---- Guardar junto al proyecto a mano (ADR 0133 §5) --------------------------

#' ¿El nombre pedido trae una ruta? Barras, `..` o una unidad de Windows
#' @keywords internal
.entregable_es_ruta <- function(x) {
  x <- as.character(x %||% "")[1]
  is.na(x) || grepl("[/\\\\]", x) || grepl("..", x, fixed = TRUE) || grepl("^[A-Za-z]:", x) ||
    startsWith(x, "~")
}

#' Subcarpeta relativa válida para save-to-project, o NULL si no lo es
#'
#' Vacía (la carpeta del proyecto), un nombre simple, `Entregables` o
#' `Entregables/<Módulo>` con una de las ocho carpetas del §4. Nunca sale de la
#' carpeta del proyecto.
#' @keywords internal
.entregable_subdir_valido <- function(subdir) {
  subdir <- as.character(subdir %||% "")[1]
  if (is.na(subdir) || !nzchar(trimws(subdir))) return("")
  subdir <- stringi::stri_trans_nfc(enc2utf8(subdir))
  if (grepl("\\", subdir, fixed = TRUE) || grepl("..", subdir, fixed = TRUE) ||
      grepl("^[A-Za-z]:", subdir) || startsWith(subdir, "/") || startsWith(subdir, "~")) {
    return(NULL)
  }
  segs <- strsplit(subdir, "/", fixed = TRUE)[[1]]
  modulos <- stringi::stri_trans_nfc(unname(.ENTREGABLES_MODULOS))
  if (length(segs) == 1L && (identical(segs, "Entregables") || grepl("^[A-Za-z0-9_-]{1,40}$", segs))) return(segs)
  if (length(segs) == 2L && identical(segs[1], "Entregables") && segs[2] %in% modulos) {
    return(file.path(segs[1], segs[2]))
  }
  NULL
}

#' Copia a `carpeta/archivo`; sin `overwrite`, el repetido sale con `_2`, `_3`…
#'
#' Devuelve la ruta escrita o NULL si la copia falló.
#' @keywords internal
.entregable_copiar_a_mano <- function(origen, carpeta, archivo, overwrite = FALSE) {
  if (!dir.exists(carpeta)) dir.create(carpeta, recursive = TRUE, showWarnings = FALSE)
  if (!dir.exists(carpeta)) return(NULL)
  destino <- file.path(carpeta, if (isTRUE(overwrite)) archivo else .entregable_nombre_libre(carpeta, archivo))
  ok <- suppressWarnings(file.copy(origen, destino, overwrite = isTRUE(overwrite)))
  if (isTRUE(ok)) destino else NULL
}

# ---- Campos del registro en una respuesta HTTP --------------------------------

#' Registra el archivo de un job terminado y arma su respuesta pública (ADR 0133 §1)
#'
#' Para el `on_complete` de un job (proceso principal, nunca el worker): registra
#' `j$result_path` con el kind del catálogo (el nombre del §3 lo hereda del
#' `result_filename`) y devuelve `list(meta, respuesta)`. `extra` se suma a la
#' respuesta; la ruta del worker no viaja nunca.
#' @keywords internal
entregable_registrar_job <- function(sid, j, kind, extra = list()) {
  meta <- entregable_registrar(sid, j$result_path, kind)
  resp <- c(list(ok = TRUE, file_id = meta$file_id, filename = meta$original_name, size = meta$size), extra)
  list(meta = meta, respuesta = entregable_respuesta(resp, meta))
}

#' Agrega a una respuesta los cuatro campos del registro único (ADR 0133 §1)
#'
#' `modulo`, `rotulo`, `guardado_en` y `aviso_guardado` del meta de un archivo
#' registrado. Un NULL sale como `NA_character_`, que el serializador de la API
#' (`na = "null"`) escribe `null`, no `{}`.
#' @keywords internal
entregable_respuesta <- function(resp, meta) {
  for (k in c("modulo", "rotulo", "guardado_en", "aviso_guardado")) {
    v <- meta[[k]]
    resp[[k]] <- if (is.null(v) || !length(v)) NA_character_ else as.character(v)[1]
  }
  resp
}
