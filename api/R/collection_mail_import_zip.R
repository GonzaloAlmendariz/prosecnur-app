# collection_mail_import_zip.R — el ZIP importable de Mailchimp
# («Code your own › Import ZIP», ADR 0110 §B, H-i).
#
# Reglas de Mailchimp que se verifican aquí, no se suponen:
#   - un solo HTML;
#   - imágenes en la raíz, sin subcarpetas;
#   - nombres de archivo con a-z, 0-9 y guiones (sensible a mayúsculas: se
#     escriben igual que en el `src` del HTML);
#   - JPG o PNG;
#   - menos de 1 MB.
# El HTML referencia cada imagen por su nombre RELATIVO (`src="pulso.png"`) o por
# su URL https si la plantilla la declara; las que tienen URL no entran al ZIP.
# No contiene datos personales: solo la plantilla con etiquetas *|TAG|*.

.CMAIL_IMPORT_ZIP_NAME <- "plantilla-mailchimp.zip"
.CMAIL_IMPORT_ZIP_MAX <- 1024L * 1024L
.CMAIL_IMPORT_ZIP_WARN <- 800L * 1024L
.CMAIL_IMPORT_NAME_RE <- "^[a-z0-9][a-z0-9-]*\\.(html|png|jpg)$"

# Imágenes que viajan dentro del ZIP: con archivo y sin URL declarada.
.cmail_import_images <- function(images) {
  # Un original que sólo se usa recortado no viaja: viaja su recorte (collection_mail_recorte.R).
  Filter(function(i) is.null(i$url) && !is.null(i$path) && file.exists(i$path) && !isTRUE(i$superseded), images)
}

# Peso previsto (el HTML más las imágenes que entran; PNG/JPEG casi no comprimen).
.cmail_import_zip_estimate <- function(html_bytes, images) {
  inside <- .cmail_import_images(images)
  sizes <- vapply(inside, function(i) as.numeric(file.info(i$path)$size), numeric(1))
  list(bytes = as.integer(html_bytes + sum(sizes)),
       images = lapply(names(sort(sizes, decreasing = TRUE)), function(id) {
         list(id = id, file = inside[[id]]$export_name, size_bytes = as.integer(sizes[[id]]))
       }))
}

#' Arma el ZIP importable en `dir` y lo verifica.
#'
#' @return list(path, size_bytes, entries, html_name).
#' @keywords internal
.cmail_import_zip_build <- function(dir, html, images, html_name) {
  stage <- file.path(dir, "importable")
  dir.create(stage, recursive = TRUE, showWarnings = FALSE)
  writeBin(charToRaw(enc2utf8(html)), file.path(stage, html_name))
  entries <- html_name
  for (img in .cmail_import_images(images)) {
    file.copy(img$path, file.path(stage, img$export_name), overwrite = TRUE)
    entries <- c(entries, img$export_name)
  }
  path <- file.path(dir, .CMAIL_IMPORT_ZIP_NAME)
  zip::zip(path, files = entries, root = stage, mode = "mirror")
  check <- .cmail_import_zip_verify(path)
  if (!isTRUE(check$ok)) {
    stop_api(422, "E_COLLECTION_MAIL_IMAGE_INVALID",
             "El ZIP importable no cumple las reglas de Mailchimp.", details = list(problems = check$problems))
  }
  if (check$size_bytes >= .CMAIL_IMPORT_ZIP_MAX) {
    stop_api(413, "E_COLLECTION_MAIL_IMPORT_ZIP_TOO_LARGE",
             "El ZIP importable pesa 1 MB o más y Mailchimp lo rechaza: da una URL https a las imágenes más pesadas.",
             details = list(size_bytes = check$size_bytes))
  }
  list(path = path, size_bytes = check$size_bytes, entries = check$entries, html_name = html_name)
}

#' Verificación estructural de un ZIP importable (no confía en cómo se armó).
#' @return list(ok, problems, entries, size_bytes).
#' @keywords internal
.cmail_import_zip_verify <- function(path) {
  listing <- zip::zip_list(path)
  names <- as.character(listing$filename)
  problems <- character(0)
  html <- names[grepl("\\.html$", names)]
  if (length(html) != 1L) problems <- c(problems, sprintf("lleva %d HTML; debe llevar uno.", length(html)))
  if (any(grepl("/", names, fixed = TRUE))) problems <- c(problems, "hay archivos en subcarpetas.")
  bad <- names[!grepl(.CMAIL_IMPORT_NAME_RE, names)]
  if (length(bad)) problems <- c(problems, sprintf("nombres no válidos: %s.", paste(bad, collapse = ", ")))
  if (length(html) == 1L) {
    tmp <- tempfile("cmail-verify-"); on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)
    zip::unzip(path, files = html, exdir = tmp)
    txt <- paste(readLines(file.path(tmp, html), warn = FALSE, encoding = "UTF-8"), collapse = "\n")
    srcs <- sub('^src="', "", sub('"$', "", regmatches(txt, gregexpr('src="[^"]*"', txt))[[1]]))
    rel <- srcs[!grepl("^https://", srcs)]
    missing <- setdiff(rel, names)
    if (length(missing)) problems <- c(problems, sprintf("src sin archivo en el ZIP: %s.", paste(missing, collapse = ", ")))
    if (any(grepl("^data:", srcs))) problems <- c(problems, "hay imágenes incrustadas (data:).")
    if (grepl("data-pulso", txt, fixed = TRUE)) problems <- c(problems, "el HTML trae marcas de edición.")
  }
  list(ok = !length(problems), problems = as.list(problems), entries = as.list(names),
       size_bytes = as.integer(file.info(path)$size))
}
