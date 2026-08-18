# =============================================================================
# Universo de aulas del ESTUDIO ANTERIOR, derivado del catalogo vigente
# =============================================================================
#
# Gonzalo (2026-08-18, textual): «no es que se haya dicho que solo estos
# cuarenta son cursos horarios elegibles (…) hay una base que ya filtra la
# base de datos para solo coger los cursos horarios elegibles». El paso 3 de
# la ficha comparaba las aulas elegibles de HOY contra las SORTEADAS del
# estudio anterior — peras con manzanas (C&I: 571 vs 40). La comparacion
# correcta es contra el MARCO ELEGIBLE del estudio anterior, y ese marco es
# derivable EXACTO del catalogo aplicando los criterios que aquel estudio
# documento (verificado en HSVG2026: 3.699 → 3.539 → 3.046 → 2.931, los
# cuatro escalones al numero).
#
# Los criterios del estudio anterior son DATOS, no codigo: viajan en
# `config$referencia_marco` y quedan registrados en el .pulso. El engine solo
# aplica el spec de forma generica; sin spec, el bloque no se computa y el
# paso 3 conserva su comparacion previa.

#' Normaliza el spec del marco del estudio anterior. NULL si no hay spec.
#' @keywords internal
.cm_universo_ref_spec <- function(config) {
  spec <- config$referencia_marco %||% config$marco_referencia %||% NULL
  if (!is.list(spec) || !length(spec)) return(NULL)
  out <- list(
    modalidades = .cm_aulas_text_key(.cm_aulas_chr_vec(spec$modalidades %||% spec$modalidad)),
    tipos_prefijo = .cm_aulas_text_key(.cm_aulas_chr_vec(spec$tipos_prefijo %||% spec$tipos %||% spec$tipo)),
    niveles_excluidos = suppressWarnings(as.integer(unlist(spec$niveles_excluidos %||% list()))),
    min_matriculados = suppressWarnings(as.numeric(.cm_aulas_scalar(spec$min_matriculados, NA))),
    facultades_excluidas = .cm_criterios_fac_key(.cm_aulas_chr_vec(spec$facultades_excluidas %||% list()))
  )
  out$niveles_excluidos <- out$niveles_excluidos[is.finite(out$niveles_excluidos)]
  tiene_algo <- length(out$modalidades) || length(out$tipos_prefijo) ||
    length(out$niveles_excluidos) || is.finite(out$min_matriculados) ||
    length(out$facultades_excluidas)
  if (!tiene_algo) NULL else out
}

#' Universo de aulas del estudio anterior, por facultad.
#'
#' Aplica el spec sobre el catalogo (una fila por curso-horario UNICO):
#' modalidad ∈ modalidades, tipo con alguno de los prefijos, nivel ∉
#' excluidos, matriculados ≥ minimo, facultad ∉ excluidas. Devuelve
#' `list(filas = [{facultad, aulas_universo}], total, spec)` o NULL si no hay
#' spec o el catalogo no da para computarlo — nunca un bloque en cero.
#' @keywords internal
calc_muestra_aulas_universo_referencia <- function(catalogo_curso_horario, config = list()) {
  spec <- .cm_universo_ref_spec(config)
  if (is.null(spec)) return(NULL)
  cat_df <- .cm_aulas_clean_table_names(.cm_aulas_as_df(catalogo_curso_horario, "catalogo_curso_horario"))
  if (!nrow(cat_df)) return(NULL)
  col <- function(candidatas) {
    for (cc in candidatas) {
      hit <- .cm_aulas_col(cat_df, cc)
      if (nzchar(hit)) return(hit)
    }
    ""
  }
  c_code <- col(c("curso_horario", "curso.horario", "codigo_curso_horario"))
  c_fac <- col(c("facultad", "faculty"))
  c_mod <- col(c("modalidad", "modality"))
  c_tipo <- col(c("tipo_de_curso", "tipo_curso", "tipo"))
  c_niv <- col(c("nivel_del_curso", "nivel_curso", "nivel"))
  c_mat <- col(c("matriculados", "matriculados_total"))
  if (!nzchar(c_code) || !nzchar(c_fac)) return(NULL)
  u <- cat_df[!duplicated(as.character(cat_df[[c_code]])), , drop = FALSE]
  keep <- rep(TRUE, nrow(u))
  if (length(spec$modalidades) && nzchar(c_mod)) {
    keep <- keep & .cm_aulas_text_key(as.character(u[[c_mod]])) %in% spec$modalidades
  }
  if (length(spec$tipos_prefijo) && nzchar(c_tipo)) {
    tk <- .cm_aulas_text_key(as.character(u[[c_tipo]]))
    keep <- keep & Reduce(`|`, lapply(spec$tipos_prefijo, function(p) startsWith(tk, p)))
  }
  if (length(spec$niveles_excluidos) && nzchar(c_niv)) {
    niv <- suppressWarnings(as.numeric(as.character(u[[c_niv]])))
    keep <- keep & !(niv %in% spec$niveles_excluidos)
  }
  if (is.finite(spec$min_matriculados) && nzchar(c_mat)) {
    mat <- suppressWarnings(as.numeric(as.character(u[[c_mat]])))
    keep <- keep & is.finite(mat) & mat >= spec$min_matriculados
  }
  fac_keys <- .cm_criterios_fac_key(as.character(u[[c_fac]]))
  if (length(spec$facultades_excluidas)) {
    excl <- Reduce(`|`, lapply(spec$facultades_excluidas, function(p) grepl(p, fac_keys, fixed = TRUE)))
    keep <- keep & !excl
  }
  sel <- u[keep, , drop = FALSE]
  if (!nrow(sel)) return(NULL)
  conteo <- table(as.character(sel[[c_fac]]))
  filas <- lapply(names(conteo), function(fac) {
    list(facultad = fac, aulas_universo = as.integer(conteo[[fac]]))
  })
  list(
    schema = "calc_muestra_aulas_universo_referencia_v1",
    owner = "calc_muestra_aulas_frame_v1.universo_referencia",
    grain = "facultad",
    total = as.integer(nrow(sel)),
    spec = spec,
    filas = filas
  )
}
