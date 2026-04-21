#' Exportar manuales QMD/PDF a un directorio de uso
#'
#' Publica los manuales fuente almacenados en `inst/manuales_qmd/` hacia un
#' directorio externo, copiando los `.qmd` y la carpeta `files_manuales/`.
#' Opcionalmente renderiza los PDF en el mismo destino usando Quarto + Typst.
#'
#' La función está pensada para que `prosecnur` sea la fuente maestra de los
#' manuales, mientras que otro proyecto pueda recibir una copia operativa lista
#' para leer o renderizar.
#'
#' @param dir_destino Directorio donde se publicarán los manuales. Por defecto
#'   `/Users/gonzaloalmendariz/Documents/Pulso/Pruebas_Prosecnur/manuales`.
#' @param render_pdf Si `TRUE`, intenta renderizar los `.qmd` a `.pdf` en el
#'   directorio de destino.
#' @param overwrite Si `TRUE`, permite sobreescribir archivos existentes.
#' @param limpiar_destino Si `TRUE`, vacía el directorio de destino antes de
#'   copiar los manuales.
#' @param quiet Si `TRUE`, reduce la salida de Quarto al renderizar.
#' @param package Nombre del paquete fuente. Por defecto `"prosecnur"`.
#'
#' @return Invisiblemente, una lista con `source_dir`, `dest_dir`, `qmd_files`
#'   y `pdf_files`.
#'
#' @family reporte
#' @export
exportar_manuales_qmd <- function(
    dir_destino = "/Users/gonzaloalmendariz/Documents/Pulso/Pruebas_Prosecnur/manuales",
    render_pdf = TRUE,
    overwrite = TRUE,
    limpiar_destino = TRUE,
    quiet = FALSE,
    package = "prosecnur"
) {
  source_dir <- .manuales_qmd_source_dir(package = package)
  qmd_src <- list.files(
    source_dir,
    pattern = "\\.qmd$",
    full.names = TRUE,
    recursive = FALSE
  )

  if (!length(qmd_src)) {
    stop("No se encontraron archivos `.qmd` en `inst/manuales_qmd/`.", call. = FALSE)
  }

  assets_src <- file.path(source_dir, "files_manuales")
  if (!dir.exists(assets_src)) {
    stop("No existe la carpeta `files_manuales` dentro de `inst/manuales_qmd/`.", call. = FALSE)
  }

  dir.create(dir_destino, recursive = TRUE, showWarnings = FALSE)
  dir_destino <- normalizePath(dir_destino, winslash = "/", mustWork = TRUE)

  if (isTRUE(limpiar_destino)) {
    .manuales_qmd_clear_dir(dir_destino)
  }

  qmd_dest <- file.path(dir_destino, basename(qmd_src))
  for (i in seq_along(qmd_src)) {
    ok <- file.copy(qmd_src[[i]], qmd_dest[[i]], overwrite = isTRUE(overwrite))
    if (!isTRUE(ok)) {
      stop("No se pudo copiar el manual: ", basename(qmd_src[[i]]), call. = FALSE)
    }
  }

  assets_dest <- file.path(dir_destino, "files_manuales")
  if (dir.exists(assets_dest) && isTRUE(overwrite)) {
    unlink(assets_dest, recursive = TRUE, force = TRUE)
  }
  .manuales_qmd_copy_tree(assets_src, assets_dest, overwrite = overwrite)

  pdf_dest <- file.path(dir_destino, sub("\\.qmd$", ".pdf", basename(qmd_src)))

  if (isTRUE(render_pdf)) {
    if (!requireNamespace("quarto", quietly = TRUE)) {
      stop(
        "El paquete `quarto` es necesario para renderizar los manuales.",
        call. = FALSE
      )
    }
    quarto_bin <- as.character(Sys.which("quarto"))[1]
    if (is.na(quarto_bin) || !nzchar(quarto_bin)) {
      quarto_bin <- tryCatch(as.character(quarto::quarto_path())[1], error = function(e) "")
    }
    if (!nzchar(quarto_bin) || !file.exists(quarto_bin)) {
      stop(
        "No se encontró el ejecutable `quarto` en el sistema ni a través del paquete `{quarto}`. ",
        "Instala Quarto CLI o usa `render_pdf = FALSE`.",
        call. = FALSE
      )
    }

    for (i in seq_along(qmd_dest)) {
      .manuales_qmd_render_one(
        input = qmd_dest[[i]],
        output_file = basename(pdf_dest[[i]]),
        output_dir = dir_destino,
        quiet = quiet
      )
    }

    .manuales_qmd_cleanup_render(dir_destino, allowed = c(
      basename(qmd_dest),
      basename(pdf_dest),
      "files_manuales"
    ))
  }

  invisible(list(
    source_dir = source_dir,
    dest_dir = dir_destino,
    qmd_files = qmd_dest,
    pdf_files = pdf_dest
  ))
}

#' @keywords internal
.manuales_qmd_source_dir <- function(package = "prosecnur") {
  if (!requireNamespace(package, quietly = TRUE)) {
    stop("No se pudo cargar el paquete `", package, "`.", call. = FALSE)
  }

  pkg_path <- tryCatch(find.package(package), error = function(e) NA_character_)
  ns_path <- tryCatch(
    getNamespaceInfo(asNamespace(package), "path"),
    error = function(e) NA_character_
  )

  candidates <- unique(c(
    system.file("manuales_qmd", package = package),
    file.path(pkg_path, "manuales_qmd"),
    file.path(pkg_path, "inst", "manuales_qmd"),
    file.path(ns_path, "manuales_qmd"),
    file.path(ns_path, "inst", "manuales_qmd")
  ))

  candidates <- candidates[!is.na(candidates) & nzchar(candidates)]
  hit <- candidates[dir.exists(candidates)]
  if (!length(hit)) {
    stop(
      "No se encontró `manuales_qmd` para el paquete `", package, "`.",
      call. = FALSE
    )
  }

  normalizePath(hit[[1]], winslash = "/", mustWork = TRUE)
}

#' @keywords internal
.manuales_qmd_clear_dir <- function(dir_path) {
  existing <- list.files(dir_path, all.files = TRUE, no.. = TRUE, full.names = TRUE)
  if (!length(existing)) return(invisible(NULL))
  unlink(existing, recursive = TRUE, force = TRUE)
  invisible(NULL)
}

#' @keywords internal
.manuales_qmd_copy_tree <- function(src_dir, dest_dir, overwrite = TRUE) {
  dir.create(dest_dir, recursive = TRUE, showWarnings = FALSE)

  rel_paths <- list.files(
    src_dir,
    recursive = TRUE,
    all.files = TRUE,
    no.. = TRUE,
    full.names = FALSE,
    include.dirs = TRUE
  )

  if (!length(rel_paths)) return(invisible(dest_dir))

  for (rel_i in rel_paths) {
    src_i <- file.path(src_dir, rel_i)
    dest_i <- file.path(dest_dir, rel_i)

    if (dir.exists(src_i)) {
      dir.create(dest_i, recursive = TRUE, showWarnings = FALSE)
      next
    }

    dir.create(dirname(dest_i), recursive = TRUE, showWarnings = FALSE)
    ok <- file.copy(src_i, dest_i, overwrite = isTRUE(overwrite))
    if (!isTRUE(ok)) {
      stop("No se pudo copiar el archivo auxiliar: ", rel_i, call. = FALSE)
    }
  }

  invisible(dest_dir)
}

#' @keywords internal
.manuales_qmd_render_one <- function(input, output_file, output_dir, quiet = FALSE) {
  render_args <- list(
    input = input,
    output_file = output_file
  )

  qr_formals <- names(formals(quarto::quarto_render))
  if ("quiet" %in% qr_formals) render_args$quiet <- isTRUE(quiet)
  if ("output_dir" %in% qr_formals) render_args$output_dir <- output_dir

  out_render <- do.call(quarto::quarto_render, render_args)
  out_path <- file.path(output_dir, output_file)

  if (!file.exists(out_path) && is.character(out_render) && length(out_render) == 1L) {
    out_path <- out_render
  }
  if (!file.exists(out_path)) {
    stop("Quarto no produjo el PDF esperado para: ", basename(input), call. = FALSE)
  }

  invisible(normalizePath(out_path, winslash = "/", mustWork = TRUE))
}

#' @keywords internal
.manuales_qmd_cleanup_render <- function(dir_destino, allowed) {
  current <- list.files(dir_destino, all.files = TRUE, no.. = TRUE, full.names = FALSE)
  drop <- setdiff(current, allowed)
  if (!length(drop)) return(invisible(NULL))
  unlink(file.path(dir_destino, drop), recursive = TRUE, force = TRUE)
  invisible(NULL)
}
