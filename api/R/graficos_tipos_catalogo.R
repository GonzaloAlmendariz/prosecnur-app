# =============================================================================
# graficos_tipos_catalogo.R — catálogo generado de los tipos de lámina y de gráfico (K9, plan F6)
# =============================================================================
#
# El `SlideType` del frontend era una lista tecleada de 22 tipos cuando el registro tiene 33. Este catálogo sale del
# metadata (`.SLIDES_META`, `.GRAFICADORES_META`) y se versiona en `inst/catalogos/graficos_tipos.json` para que el
# frontend derive sus tipos y sus íconos de ahí. Regenerar: `Rscript api/scripts/generar_graficos_tipos.R`;
# test-graficos-tipos-catalogo.R falla si el archivo versionado se desvía del metadata.

#' Catálogo de tipos: láminas y graficadores en el orden del registro
#' @return `list(fuente, slides, graficadores)`; `estandar` es el id del tipo del recetario o `NA` (sin ranuras).
#' @keywords internal
.graficos_tipos_catalogo <- function() {
  slides <- lapply(names(.SLIDES_META), function(nm) {
    e <- .graficos_estandar_de_slide(nm)
    list(name = nm, categoria = as.character(.SLIDES_META[[nm]]$categoria), estandar = if (is.list(e)) e$id else NA,
         en_selector = !identical(.SLIDES_META[[nm]]$en_selector, FALSE))
  })
  graficadores <- lapply(names(.GRAFICADORES_META), function(nm) {
    m <- .GRAFICADORES_META[[nm]]
    list(name = nm, familia_editor = m$familia_editor, salida = m$salida, en_selector = m$en_selector)
  })
  list(
    fuente = "Generado desde api/R/graficos_metadata.R por api/scripts/generar_graficos_tipos.R; no editar a mano.",
    slides = slides,
    graficadores = graficadores
  )
}

#' El catálogo como texto JSON estable (el que se versiona)
#' @keywords internal
.graficos_tipos_catalogo_json <- function() {
  as.character(jsonlite::toJSON(.graficos_tipos_catalogo(), auto_unbox = TRUE, na = "null", pretty = TRUE))
}
