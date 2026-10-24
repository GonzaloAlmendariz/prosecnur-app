# jobs_fuente_paquete.R — el worker callr corre con el mismo código que el servidor, o lo dice.
#
# CCSS Perfil 2026: un backend levantado por un script propio (sin el launcher) no definía PULSO_API_DIR ni PULSO_REPO_ROOT. El
# servidor corría con la fuente (`load_all`) y el worker de /api/graficos/ppt cargaba en silencio el paquete INSTALADO, más viejo:
# el mazo salía con defectos que la fuente ya corregía. Ahora:
#   - sin variables de ruta, el worker hereda la ruta del `load_all` del padre (`.jobs_api_dir_heredado`);
#   - el padre manda su firma (versión + hash de la fuente) y el worker la compara con la suya (`.jobs_verificar_firma`):
#     versión distinta, o el padre con la fuente y el worker con el instalado, falla; hash distinto avisa (la fuente cambió
#     entre el envío y la carga, típico de un árbol en edición).

#' Carpeta `api/` que el worker debe cargar, o "" para el paquete instalado
#'
#' PULSO_API_DIR, luego PULSO_REPO_ROOT/api y, si ninguna está, la ruta del `load_all` con que corre este proceso.
#' @keywords internal
.jobs_api_dir_heredado <- function() {
  api_dir <- Sys.getenv("PULSO_API_DIR", "")
  if (nzchar(api_dir)) return(api_dir)
  if (nzchar(Sys.getenv("PULSO_REPO_ROOT", ""))) return("")   # el bootstrap resuelve PULSO_REPO_ROOT/api
  if (!requireNamespace("pkgload", quietly = TRUE) || !isTRUE(pkgload::is_dev_package("prosecnurapp"))) return("")
  ruta <- tryCatch(getNamespaceInfo(asNamespace("prosecnurapp"), "path"), error = function(e) "")
  if (nzchar(ruta) && file.exists(file.path(ruta, "DESCRIPTION")) && dir.exists(file.path(ruta, "R"))) normalizePath(ruta) else ""
}

#' Firma del paquete con que corre este proceso: versión, origen («fuente» o «instalado») y hash
#'
#' En la fuente, el hash es el md5 de los `R/*.R`; en el instalado, la marca de empaquetado de su DESCRIPTION.
#' @keywords internal
.jobs_firma_paquete <- function() {
  version <- tryCatch(as.character(utils::packageVersion("prosecnurapp")), error = function(e) NA_character_)
  dev <- requireNamespace("pkgload", quietly = TRUE) && isTRUE(pkgload::is_dev_package("prosecnurapp"))
  if (dev) {
    ruta <- getNamespaceInfo(asNamespace("prosecnurapp"), "path")
    fuentes <- sort(list.files(file.path(ruta, "R"), pattern = "\\.R$", full.names = TRUE))
    sumas <- paste(basename(fuentes), unname(tools::md5sum(fuentes)), collapse = "\n")
    f <- tempfile(); on.exit(unlink(f), add = TRUE); writeLines(sumas, f)
    hash <- unname(tools::md5sum(f))
  } else {
    d <- tryCatch(utils::packageDescription("prosecnurapp"), error = function(e) list())
    hash <- as.character(d$Packaged %||% d$Built %||% NA_character_)
  }
  list(version = version, origen = if (dev) "fuente" else "instalado", hash = hash)
}

#' Compara la firma del worker con la del padre: versión u origen distinto falla; hash distinto avisa
#' @param worker,padre Firmas (`.jobs_firma_paquete`).
#' @keywords internal
.jobs_verificar_firma <- function(worker, padre) {
  if (is.null(padre)) return(invisible(TRUE))
  # Sólo la dirección del defecto falla: el servidor con la fuente y el worker con el instalado. La app empaquetada corre el
  # instalado con PULSO_REPO_ROOT definido y su worker puede cargar la fuente embebida, de la misma versión: eso sigue igual.
  if (!identical(worker$version, padre$version) || (identical(padre$origen, "fuente") && !identical(worker$origen, "fuente"))) {
    stop(sprintf(paste0("El trabajo corre con prosecnurapp %s (%s) y el servidor con la versión %s (%s): ",
                        "el resultado no reflejaría el código del servidor. Define PULSO_API_DIR o reinstala el paquete."),
                 worker$version, worker$origen, padre$version, padre$origen), call. = FALSE)
  }
  if (identical(worker$origen, padre$origen) && !identical(worker$hash, padre$hash)) {
    .pulso_aviso("El código del paquete cambió entre el envío del trabajo y su ejecución: el resultado usa la versión más nueva.")
  }
  invisible(TRUE)
}
