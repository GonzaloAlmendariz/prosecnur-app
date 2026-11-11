# =============================================================================
# graficos_acnur_repeats_en_seccion.R — cada grupo repetible va en la sección donde vive en el formulario
# =============================================================================
#
# El plan ACNUR arma las láminas fuente por fuente: primero la base principal y después, al final del mazo, las de cada
# grupo repetible. En el RMS 2026 los dos grupos de miembros del hogar (`rpt_hhmnames` y `S1`) están dentro de "Parte 1.
# Indicadores Sociodemográficos & Movilidad", pero sus gráficos (parentesco, sexo, estado civil) salían después de "A
# rellenar por el o la encuestador/a", y "Parte 1" no aparecía porque su única pregunta de la base principal no se
# grafica. El informe sigue el orden del cuestionario, y la referencia del cliente (RMS 2025) los pone en "Parte 1"
# (Gonzalo, 2026-11-11; checklist-informe-acnur-2026-11-11, P5).
#
# Regla:
# - Las láminas de un grupo repetible se insertan al final de la sección de la base principal que lo contiene (el grupo
#   más externo en el formulario de la base madre).
# - Si esa sección no tiene láminas propias, se crea su separador y se ubica en el orden del formulario.
# - Si el grupo repetible es una sección propia del formulario (no está dentro de otro grupo), va como sección propia
#   en su lugar del formulario. Si su bloque ya abre con separadores (servicios del PDM), se respetan.
# - El índice se rehace con los separadores que quedan en el mazo, para que "Contenido" y el mazo coincidan. Los
#   separadores que trae el propio bloque repetible (uno por servicio) son subsecciones y no entran al índice.

#' Sección de la base madre que contiene a un grupo repetible, y la fila donde empieza
#'
#' @return `list(seccion, fila)` o `NULL` si no se encuentra.
#' @keywords internal
.graficos_acnur_seccion_del_repeat <- function(survey, repeat_group) {
  grupo <- .graficos_scalar_chr(repeat_group, "")
  if (!is.data.frame(survey) || !nrow(survey) || !nzchar(grupo) || !"name" %in% names(survey)) return(NULL)
  tipos <- vapply(as.character(if ("type_base" %in% names(survey)) survey$type_base else survey$type), .graficos_base_type, "")
  fila <- which(as.character(survey$name) == grupo & tipos == "begin_repeat")[1]
  if (is.na(fila)) return(NULL)
  secciones <- .graficos_acnur_survey_sections(survey)
  dentro <- which(seq_len(nrow(survey)) > fila & nzchar(secciones))[1]
  if (is.na(dentro)) return(NULL)
  list(seccion = secciones[[dentro]], fila = fila)
}

#' Primera fila del formulario de cada sección
#' @keywords internal
.graficos_acnur_fila_de_seccion <- function(survey) {
  secciones <- .graficos_acnur_survey_sections(survey)
  vistas <- unique(secciones[nzchar(secciones)])
  stats::setNames(vapply(vistas, function(s) min(which(secciones == s)), numeric(1)),
                  vapply(vistas, .graficos_titulo_de_seccion, ""))
}

#' Reubica las láminas de los grupos repetibles en su sección y rehace el índice
#'
#' @param slides Láminas del plan, en el orden en que se armaron.
#' @param cortes Lista con `fuente` e `inicio` (índice en `slides` donde empezó cada fuente), en orden.
#' @param fuentes_ctx Contexto por fuente (`.graficos_acnur_source_context`): `is_repeat` y `base`.
#' @param surveys Survey de cada base madre, por nombre.
#' @keywords internal
.graficos_acnur_repeats_en_su_seccion <- function(slides, cortes, fuentes_ctx, surveys,
                                                  index_single_limit = 8L, index_per_slide = 8L) {
  if (!length(cortes)) return(slides)
  n <- length(slides)
  inicios <- vapply(cortes, function(x) as.integer(x$inicio), integer(1))
  fines <- c(inicios[-1], n)   # `inicio` es el largo de `slides` antes de la fuente: sus láminas van de inicio + 1 al siguiente inicio
  bloques <- lapply(seq_along(cortes), function(k) {
    idx <- if (fines[[k]] >= inicios[[k]] + 1L) seq.int(inicios[[k]] + 1L, fines[[k]]) else integer(0)
    list(fuente = cortes[[k]]$fuente, slides = slides[idx])
  })
  es_repeat <- vapply(bloques, function(b) isTRUE((fuentes_ctx[[b$fuente]] %||% list())$is_repeat), logical(1))
  if (!any(es_repeat) || all(es_repeat)) return(slides)
  previas <- if (inicios[[1]] > 0L) slides[seq_len(inicios[[1]])] else list()
  principal <- unlist(lapply(bloques[!es_repeat], `[[`, "slides"), recursive = FALSE)
  madre <- .graficos_scalar_chr(bloques[!es_repeat][[1]]$fuente, "default")

  es_sep <- function(s) identical(s$tipo, "p_slide_seccion")
  titulo_sep <- function(s) .graficos_scalar_chr((s$payload %||% list())$titulo, "")
  sub <- function(s) { if (identical(s$tipo, "p_slide_seccion")) s$subseccion_de_repeat <- TRUE; s }
  for (b in bloques[es_repeat]) {
    if (!length(b$slides)) next
    base <- (fuentes_ctx[[b$fuente]] %||% list())$base %||% list()
    padre <- .graficos_scalar_chr(base$parent_base, madre)
    survey <- surveys[[padre]] %||% surveys[[madre]]
    ubic <- .graficos_acnur_seccion_del_repeat(survey, base$repeat_group)
    if (is.null(ubic)) { principal <- c(principal, b$slides); next }
    titulo <- .graficos_titulo_de_seccion(ubic$seccion)
    # Si el grupo vive dentro de otra sección, los separadores que trae el bloque (uno por servicio en el PDM) son
    # subsecciones y no entran al índice. Si el grupo es la sección (su bloque abre con ese mismo título), sí entra.
    abre_con_su_seccion <- es_sep(b$slides[[1]]) && identical(titulo_sep(b$slides[[1]]), titulo)
    if (!abre_con_su_seccion) b$slides <- lapply(b$slides, sub)
    seps <- which(vapply(principal, es_sep, logical(1)))
    propio <- seps[vapply(principal[seps], function(s) identical(titulo_sep(s), titulo), logical(1))]
    if (length(propio)) {
      siguiente <- seps[seps > propio[[1]]][1]
      pos <- if (is.na(siguiente)) length(principal) else siguiente - 1L
      principal <- append(principal, b$slides, after = pos)
      next
    }
    # La sección no tiene láminas en la base principal: va en su lugar del formulario, con su separador salvo que el
    # bloque ya abra con el de esa misma sección.
    filas <- .graficos_acnur_fila_de_seccion(survey)
    despues <- seps[vapply(principal[seps], function(s) {
      f <- filas[titulo_sep(s)]
      length(f) && !is.na(f) && f > ubic$fila
    }, logical(1))][1]
    nuevo <- if (abre_con_su_seccion) b$slides else c(.graficos_add_section_slide(list(), ubic$seccion), b$slides)
    pos <- if (is.na(despues)) length(principal) else despues - 1L
    principal <- append(principal, nuevo, after = pos)
  }

  # El índice se rehace con los separadores del mazo.
  es_indice <- vapply(previas, function(s) identical(s$tipo, "p_slide_indice"), logical(1))
  if (any(es_indice)) {
    titulos <- vapply(Filter(function(s) es_sep(s) && !isTRUE(s$subseccion_de_repeat), principal), titulo_sep, "")
    indice <- .graficos_acnur_content_slides(titulos[nzchar(titulos)], index_single_limit, index_per_slide)
    if (length(indice)) {
      primero <- which(es_indice)[1]
      ultimo <- max(which(es_indice))
      resto <- if (ultimo < length(previas)) previas[seq.int(ultimo + 1L, length(previas))] else list()
      previas <- c(previas[seq_len(primero - 1L)], indice, resto)
    }
  }
  principal <- lapply(principal, function(s) { s$subseccion_de_repeat <- NULL; s })
  c(previas, principal)
}
