# Requisitos del plan que impiden exportar (compuerta común de PPT y Word: `.validar_plan_json`, router_graficos.R).
#
# Gonzalo (2026-10-13): «no se puede exportar si no está definido… esas cosas no deben pasar, se debe avisar e impedir su
# exportación». Lo que el motor no puede dibujar con el recetario no se reemplaza en silencio por la plantilla antigua:
# se rechaza con su motivo y su arreglo, y el editor (usePlanValidator.ts) muestra el mismo error y bloquea Exportar.

#' Capítulos del informe en el plan del editor: separadores de capítulo (no subcapítulo) con título
#' @param slides Láminas del plan JSON (`plan$slides`).
#' @keywords internal
.plan_capitulos_del_informe <- function(slides) {
  caps <- vapply(slides %||% list(), function(s) {
    s <- as.list(s)
    if (!identical(as.character(s$tipo %||% ""), "p_slide_seccion")) return(NA_character_)
    payload <- .as_json_list(s$payload) %||% list()
    meta <- .as_json_list(payload$meta) %||% list()
    if (identical(as.character(meta$nivel %||% ""), "subcapitulo")) return(NA_character_)
    trimws(as.character(payload$titulo %||% "")[1])
  }, character(1))
  caps[!is.na(caps) & nzchar(caps)]
}

#' ¿El índice trae capítulos propios? (`secciones` o `subindices` con texto)
#' @keywords internal
.plan_indice_tiene_capitulos <- function(payload) {
  txt <- trimws(unlist(c(payload$secciones, payload$subindices), use.names = FALSE))
  any(!is.na(txt) & nzchar(txt))
}

#' Errores que impiden exportar por un índice sin capítulos
#'
#' Sin capítulos propios ni separadores de capítulo en el informe, el índice del recetario no tiene qué listar y el motor
#' caía a la plantilla antigua con capítulos de ejemplo. Un error por índice, con la lámina y el arreglo.
#' @param slides Láminas del plan JSON.
#' @return `character()` de errores.
#' @keywords internal
.plan_errores_indice <- function(slides) {
  if (length(.plan_capitulos_del_informe(slides))) return(character(0))
  errs <- character(0)
  for (i in seq_along(slides)) {
    s <- as.list(slides[[i]])
    if (!identical(as.character(s$tipo %||% ""), "p_slide_indice")) next
    if (.plan_indice_tiene_capitulos(.as_json_list(s$payload) %||% list())) next
    errs <- c(errs, sprintf(
      "%s: el índice no tiene capítulos y el informe no tiene separadores de capítulo. Escribe sus capítulos en el índice o agrega separadores al informe",
      .aviso_lamina(i, .aviso_titulo_payload(s))))
  }
  errs
}
