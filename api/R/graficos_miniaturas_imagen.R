# graficos_miniaturas_imagen.R — imagen completa de la lámina en el lote de miniaturas.
#
# El visor muestra por defecto la maqueta de la lámina y, cuando el lote ya la dibujó en segundo plano, su imagen real en
# tamaño completo sin lanzar otro job. Esa imagen es el mismo raster de la vista previa (parte 1) que el lote ya tiene en
# caché; aquí sólo se escribe como PNG junto a la miniatura reducida y se publica con su propia URL.

#' PNG completo (parte 1) de la lámina, escrito una vez por huella junto a la entrada de la caché
#' @return Ruta del PNG o `NA` si no hay raster.
#' @keywords internal
.mini_imagen_png <- function(raiz, hash, slide_previews, quality = "quick", renderer_id = .mini_renderer_id()) {
  if (is.na(renderer_id) || !length(slide_previews) || is.null(slide_previews[[1]])) return(NA_character_)
  e <- .mini_entrada(raiz, hash)
  png <- file.path(e$dir, sprintf("imagen_%s_%s.png", quality, renderer_id))
  if (file.exists(png)) return(png)
  b64 <- sub("^data:image/png;base64,", "", slide_previews[[1]]$png_base64 %||% "")
  if (!nzchar(b64)) return(NA_character_)
  .mini_escribir_atomico(png, function(tmp) writeBin(jsonlite::base64_dec(b64), tmp))
  if (file.exists(png)) png else NA_character_
}

#' Campo público `imagen` de una lámina del lote: el PNG completo registrado en el file store, o `NA`
#' @keywords internal
.mini_imagen_publica <- function(sid, item) {
  png <- item$imagen %||% NA_character_
  if (is.na(png) || !file.exists(png)) return(NA)
  f <- .mini_registrar(sid, paste0(item$hash, ":", basename(png)), png, "graficos_miniatura",
                       original_name = sprintf("lamina_%s.png", .export_slug(item$slide_id %||% "lamina", fallback = "lamina")))
  dims <- .mini_png_dims(png)
  list(file_id = f$file_id, url = sprintf("/api/files/%s/download", f$file_id), mime = "image/png",
       width = dims[["width"]], height = dims[["height"]])
}
