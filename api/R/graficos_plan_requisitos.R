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

#' Errores que impiden exportar por una ficha técnica sin filas
#'
#' Las filas de la tabla técnica las escribe el analista (el motor sólo suma «Ponderación», lamina_ficha_ponderacion.R).
#' Una lámina creada y no llenada hacía caer el job a mitad del mazo con «`filas` debe contener al menos una fila con
#' texto» aunque la validación diera ok (Arte_v1-5, lámina 4). Se usa el mismo lector que el render.
#' @param slides Láminas del plan JSON.
#' @return `character()` de errores.
#' @keywords internal
.plan_errores_tabla_tecnica <- function(slides) {
  errs <- character(0)
  for (i in seq_along(slides)) {
    s <- as.list(slides[[i]])
    if (!identical(as.character(s$tipo %||% ""), "p_slide_tabla_tecnica")) next
    filas <- (.as_json_list(s$payload) %||% list())$filas
    vacia <- is.null(filas) || inherits(tryCatch(.ppt_parse_technical_table_rows(filas), error = function(e) e), "error")
    if (vacia) {
      errs <- c(errs, sprintf("%s: la tabla técnica no tiene filas. Escribe sus filas (criterio y detalle) o quita la lámina",
                              .aviso_lamina(i, .aviso_titulo_payload(s))))
    }
  }
  errs
}

# ---- Multiapiladas con escalas distintas ------------------------------------------------------------------------------
#
# Gonzalo (2026-10-14): «normalmente si es la misma pregunta, a pesar de ser diferente actor, van en la misma escala»;
# escalas distintas van en bloques separados («Combinar bloques»). El motor no las puede apilar juntas y la lámina salía
# «Sin datos»; el editor ya lo bloqueaba (multiApiladasScale.ts). Aquí la misma regla con la misma firma
# (`.graficos_choices_for_list()$signature`, la que publica el endpoint de variables como `scale_signature`), para que la
# exportación lo rechace con su motivo aunque el plan llegue por otra vía.

#' Firma de escala de una referencia `base$variable`: la del endpoint de variables, o su lista si no hay firma
#' @keywords internal
.plan_firma_escala <- function(ref, inst_sources) {
  ref <- trimws(as.character(ref)[1])
  partes <- regmatches(ref, regexec("^([^$]+)\\$(.+)$", ref))[[1]]
  base <- if (length(partes) == 3L) partes[2] else names(inst_sources)[1]
  var <- if (length(partes) == 3L) partes[3] else ref
  inst <- inst_sources[[base]]
  if (is.null(inst) || !is.data.frame(inst$survey)) return(NULL)
  tipo <- as.character(inst$survey$type[match(var, as.character(inst$survey$name))])
  if (is.na(tipo) || !grepl("^select_(one|multiple)\\s+", tipo)) return(NULL)
  ln <- trimws(sub("^select_(one|multiple)\\s+", "", tipo))
  meta <- .graficos_choices_for_list(inst$choices, ln)
  etiquetas <- vapply(meta$items, function(it) as.character(it$label %||% ""), character(1))
  list(firma = if (nzchar(meta$signature)) meta$signature else ln,
       describe = if (length(etiquetas) <= 3L) paste(etiquetas, collapse = " / ") else
         sprintf("%s … %s (%d categorías)", etiquetas[1], etiquetas[length(etiquetas)], length(etiquetas)))
}

#' Grupos de referencias que deben compartir escala: espejo de `multiApiladasScaleGroups()` (multiApiladasScale.ts)
#' @keywords internal
.plan_grupos_escala <- function(args) {
  args <- .as_json_list(args) %||% list()
  modo <- as.character(args$modo %||% "")[1]
  if (identical(modo, "multilista")) return(unlist(lapply(args$bloques %||% list(), .plan_grupos_escala), recursive = FALSE))
  if (identical(modo, "cruce")) return(list())
  refs <- unlist(args$vars %||% list(), use.names = FALSE)
  refs <- as.character(refs[!is.na(refs) & nzchar(trimws(as.character(refs)))])
  if (length(refs) > 1L) list(refs) else list()
}

#' Errores que impiden exportar una multiapilada cuyas preguntas no comparten escala
#' @param slides Láminas del plan JSON.
#' @param inst_sources Instrumentos por base (`.graficos_processing_sources(sid)$inst_sources`).
#' @return `character()` de errores.
#' @keywords internal
.plan_errores_escalas <- function(slides, inst_sources) {
  if (!length(inst_sources)) return(character(0))
  errs <- character(0)
  for (i in seq_along(slides)) {
    s <- as.list(slides[[i]])
    payload <- .as_json_list(s$payload) %||% list()
    for (g in payload) {
      g <- .as_json_list(g)
      if (!is.list(g) || !identical(as.character(g$graficador %||% ""), "p_barras_multiapiladas")) next
      for (refs in .plan_grupos_escala(g$args)) {
        esc <- Filter(Negate(is.null), lapply(refs, .plan_firma_escala, inst_sources = inst_sources))
        firmas <- vapply(esc, `[[`, "", "firma")
        if (length(unique(firmas)) < 2L) next
        distintas <- vapply(esc[!duplicated(firmas)], `[[`, "", "describe")
        errs <- c(errs, sprintf(
          "%s: las preguntas usan escalas distintas (%s). Ponlas en bloques separados con «Combinar bloques».",
          .aviso_lamina(i, .aviso_titulo_payload(s)), paste(distintas, collapse = " vs ")))
      }
    }
  }
  errs
}
