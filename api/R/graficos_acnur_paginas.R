# =============================================================================
# graficos_acnur_paginas.R — una lista larga se pagina sobre las categorías con casos
# =============================================================================
#
# El informe ACNUR parte en "k de N" las preguntas con más opciones que el tope por lámina. Paginaba sobre TODAS las
# opciones del formulario: la nacionalidad del RMS 2026 (unos 220 países) salía en 24 láminas, 22 de ellas "Sin datos
# para mostrar", y lo mismo con país de nacimiento, segunda nacionalidad, país de traslado y país de la entrevista
# (checklist-informe-acnur-2026-11-11, D3). La referencia del cliente muestra sólo los países con casos, en una lámina.
#
# Regla: si la lista pasa el tope, las opciones sin casos salen del gráfico y se pagina sobre las que sí tienen. Una
# lista corta conserva sus ceros (el formato ACNUR los muestra: "Desconfío del uso… 0%").

#' Códigos de respuesta con al menos un caso en la base de la pregunta
#'
#' `NULL` cuando no se puede saber (sin base o sin la columna): quien llama conserva entonces la paginación por lista.
#' @keywords internal
.graficos_acnur_codigos_con_casos <- function(ctx, v) {
  data <- (ctx %||% list())$data
  name <- .graficos_scalar_chr(v$name, "")
  if (!is.data.frame(data) || !nzchar(name) || !name %in% names(data)) return(NULL)
  values <- as.character(data[[name]])
  values <- values[!.graficos_is_blank_cell(values)]
  if (identical(.graficos_base_type(v$tipo), "select_multiple")) {
    return(unique(unlist(.graficos_acnur_multi_tokens(values), use.names = FALSE)))
  }
  unique(trimws(values))
}

#' Opciones del formulario sin casos, cuando la lista pasa el tope por lámina
#'
#' Se compara contra el código y la etiqueta de cada opción, porque la base puede traer cualquiera de los dos.
#' @return Índices (en `v$choices`) de las opciones que no se dibujan; vacío si la lista cabe o si no se sabe.
#' @keywords internal
.graficos_acnur_opciones_sin_casos <- function(v, con_casos, max_per_slide) {
  choices <- v$choices %||% list()
  if (is.null(con_casos) || length(choices) <= max_per_slide) return(integer(0))
  presente <- vapply(choices, function(item) {
    claves <- c(.graficos_scalar_chr((item %||% list())$name, ""), .graficos_scalar_chr((item %||% list())$label, ""))
    any(claves[nzchar(claves)] %in% con_casos)
  }, logical(1))
  which(!presente)
}
