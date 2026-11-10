# Lo que una base hija repeat necesita para elegir el grano de cada tabla (ADR 0128, sección 4 ter)
# ================================================================================================
#
# `analitica_repeats.R` hereda a la hija las variables del encuestado. Este archivo completa el diseño repeat con lo
# que el motor de cruces necesita para no contarlas a grano de registro: qué variables son heredadas, cuál es la base
# madre y cómo se llama la unidad de la hija en el pie de la tabla.

#' Columnas de diseño que la hija hereda de la madre: el conglomerado y el estrato de la regla
#'
#' Los toma de la regla guardada del estudio y, si no hay, de los nombres de conglomerado que la regla reconoce por
#' defecto (`.SIG_CONGLOMERADOS_CONOCIDOS`). Sólo los que la madre trae.
#' @keywords internal
.analitica_repeat_columnas_diseno <- function(sid, parent_data) {
  if (!is.data.frame(parent_data)) return(character(0))
  s <- session_get(sid, required = FALSE)
  regla <- ((s %||% list())$graficos_config %||% list())$significancia %||% list()
  cand <- unlist(list(regla$conglomerado, regla$estrato, .SIG_CONGLOMERADOS_CONOCIDOS), use.names = FALSE)
  cand <- unique(as.character(cand))
  cand <- cand[!is.na(cand) & nzchar(cand) & !startsWith(cand, "_")]
  intersect(cand, names(parent_data))
}

#' Nombre de la unidad de una hija repeat: el rótulo del `begin_repeat` en el XLSForm de la madre
#'
#' «Personas responsables de la crianza» se escribe «personas responsables de la crianza» dentro de la oración. Sin
#' rótulo, «registros del grupo repetido «<nombre>»».
#' @keywords internal
.analitica_repeat_unidad <- function(parent_inst, repeat_group) {
  repeat_group <- as.character(repeat_group %||% "")[1]
  sv <- (parent_inst %||% list())$survey
  lbl <- ""
  if (is.data.frame(sv) && all(c("type", "name") %in% names(sv)) && nzchar(repeat_group)) {
    fila <- which(grepl("^begin[ _]repeat$", trimws(tolower(as.character(sv$type)))) &
                    as.character(sv$name) == repeat_group)
    cols <- intersect(c(grep("^label::", names(sv), value = TRUE), "label"), names(sv))
    for (cc in cols) {
      v <- if (length(fila)) trimws(as.character(sv[[cc]][fila[1]])) else NA_character_
      if (!is.na(v) && nzchar(v)) { lbl <- v; break }
    }
  }
  if (!nzchar(lbl)) {
    return(if (nzchar(repeat_group)) sprintf("registros del grupo repetido «%s»", repeat_group)
           else "registros del grupo repetido")
  }
  if (grepl("^[[:upper:]][[:lower:]]", lbl)) lbl <- paste0(tolower(substr(lbl, 1, 1)), substr(lbl, 2, nchar(lbl)))
  sub("[.]$", "", lbl)
}

#' Completa el diseño repeat de una hija con su madre, sus variables heredadas y su unidad
#' @keywords internal
.analitica_repeat_design_hija <- function(design, child, meta, parent_inst = NULL) {
  if (!is.list(design)) return(design)
  heredada <- vapply(child, function(x) isTRUE(attr(x, "repeat_inherited", exact = TRUE)), logical(1))
  design$heredadas <- names(child)[heredada]
  design$parent_base <- as.character((meta %||% list())$parent_base %||% "")
  design$unidad <- .analitica_repeat_unidad(parent_inst, (meta %||% list())$repeat_group %||% "")
  design
}

#' Adjunta a la hija los datos de su madre para las tablas de variables heredadas
#' @keywords internal
.cruces_adjuntar_madre <- function(df, design, data_sources, cruces_map) {
  madre <- if (is.list(design)) data_sources[[as.character(design$parent_base %||% "")]] else NULL
  if (is.data.frame(df) && is.data.frame(madre)) {
    attr(df, "repeat_madre") <- .excluir_cruce_rows(madre, cruces_map)
  }
  df
}

#' Secciones de una exportación multibase: las variables de cualquiera de las bases, en el orden de la config
#'
#' El router filtraba las secciones contra el instrumento de la base activa, así que las variables propias de una
#' hija repeat (CCSS 2026: A9_1 y A9_2, de cada persona responsable de la crianza) nunca llegaban a sus tablas. Cada
#' base filtra después a las variables que trae (`exportar_cruces_multi`). Sin secciones configuradas devuelve NULL.
#' @keywords internal
.analitica_filter_sections_bases <- function(secs, inst_sources, numericas = character(0), excluidas = character(0)) {
  # Sin secciones configuradas no decide: el router conserva las que arma el instrumento de la base activa.
  if (!is.list(secs) || !length(secs) || is.null(names(secs))) return(NULL)
  por_base <- Filter(Negate(is.null), lapply(inst_sources, function(inst) {
    tryCatch(.analitica_filter_sections(secs, inst, numericas, excluidas), error = function(e) NULL)
  }))
  if (!length(por_base)) return(NULL)
  if (length(por_base) == 1L) return(por_base[[1]])
  out <- list()
  for (n in names(secs)) {
    vars <- unique(unlist(lapply(por_base, function(s) s[[n]]), use.names = FALSE))
    if (!length(vars)) next
    orig <- as.character(unlist(secs[[n]], use.names = FALSE))
    pos <- match(vars, orig)
    pos[is.na(pos)] <- match(sub("_recod$", "", vars[is.na(pos)]), orig)
    out[[n]] <- vars[order(pos, na.last = TRUE)]
  }
  if (length(out)) out else NULL
}

#' Notas de frecuencias de una hija repeat: su base es la de los registros
#'
#' El univariado de la hija ya excluye las variables heredadas (ADR 0030, fase 4), así que todas sus tablas son de
#' registros. Un texto por pregunta que el estudio haya escrito sigue mandando.
#' @keywords internal
.frecuencias_notas_hija <- function(sid, notas, grain) {
  padre <- as.character((grain %||% list())$parent_base %||% "")
  s <- session_get(sid, required = FALSE)
  inst_madre <- if (nzchar(padre)) ((s %||% list())$rp_inst_sources %||% list())[[padre]] else NULL
  notas$base_defecto <- .cruces_grano_base_texto(list(
    n_instancias = grain$n_instancias, n_personas = grain$n_personas,
    unidad = .analitica_repeat_unidad(inst_madre, grain$repeat_group %||% "")
  ))
  notas
}
