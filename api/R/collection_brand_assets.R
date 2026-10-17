# collection_brand_assets.R — los logos del proyecto (kind `brand_logo`) que
# usan la careta del afiche y la cabecera del correo (ADR 0110 §2).
#
# Un logo se nombra por el slug de su nombre original (`LOGO_UNSA.png` ->
# `logo-unsa`). Si se sube dos veces con el mismo nombre, vale el más reciente
# por `uploaded_at` (empate: el último registrado). No se decide por el orden de
# `session$files`: al reabrir un `.pulso` ese orden es el de
# `.pulso_collect_input_fids`, no el de subida.
#
# Esos logos son inputs del proyecto y viajan en el `.pulso` (solo el vigente
# de cada slug): si no, al reabrir la cabecera queda sin imagen y la revisión
# del correo bloquea con `images_available`.

#' Último `brand_logo` por slug: lista slug -> meta (solo los que existen en disco).
#' @keywords internal
.cm_brand_logo_latest <- function(files, require_file = TRUE) {
  out <- list()
  stamp <- list()
  for (meta in files %||% list()) {
    if (!is.list(meta) || !identical(as.character(meta$kind %||% "")[1], "brand_logo")) next
    path <- as.character(meta$path %||% "")[1]
    if (require_file && (!nzchar(path) || !file.exists(path))) next
    slug <- .cm_brand_slug(meta$original_name)
    if (!nzchar(slug)) next
    at <- as.character(meta$uploaded_at %||% "")[1]
    if (is.na(at)) at <- ""
    if (is.null(out[[slug]]) || at >= stamp[[slug]]) {
      out[[slug]] <- meta
      stamp[[slug]] <- at
    }
  }
  out
}

#' file_id de los logos vigentes del proyecto, para el `.pulso`.
#' @keywords internal
.cm_brand_logo_fids <- function(s) {
  latest <- .cm_brand_logo_latest(s$files, require_file = FALSE)
  fids <- vapply(latest, function(m) as.character(m$file_id %||% "")[1], character(1))
  unname(fids[!is.na(fids) & nzchar(fids)])
}
