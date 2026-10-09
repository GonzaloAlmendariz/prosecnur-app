# calc_muestra_aulas_telefono.R — el teléfono del docente viaja de la DTI al libro.
#
# B10 del checklist del operativo (docs/qa/checklist-operativo-aulas-2026-08-31):
# la base DTI «Cursos-Horarios» trae TELEFDOCENTE junto a NOMBREDOCENTE y
# CORREOPUCPDOCENTE, pero el armador del frame solo declaraba `teacher` y
# `teacher_email`; el teléfono moría en dos listas cerradas de
# `calc_muestra_aulas.R` (roles del enriquecido y `public_cols` de la selección)
# y el libro salía con la columna «TELÉFONO DE DOCENTE» vacía el día que el
# operativo llama a los docentes.
#
# Vive aparte porque `calc_muestra_aulas.R` está CONGELADO a crecimiento: el
# archivo grande solo llama a estos helpers en líneas swapeadas neto-cero.
#
# La resolución es EXACTA por clave (.cm_criterios_col_exacta), nunca fuzzy:
# con el matcher difuso de `.cm_aulas_col`, la sintética `teacher` (nombre del
# docente) es subcadena de `teacher_phone` y una columna `DOCENTE` (el CÓDIGO
# del profesor en el catálogo DTI) es subcadena de `telefdocente`; cualquiera
# de los dos reverse-hits publicaría nombres o códigos como si fueran teléfonos
# — «un alias captura la columna ajena», otra vez.

#' Columna del teléfono del docente en la base, sin fuzzy.
#'
#' Orden idéntico a `.cm_aulas_col_o_sintetica`: primero los candidatos del
#' mapeo (con ADR 0035, un rol mapeado a mano es exclusivo) y como fallback la
#' sintética `teacher_phone` que escribe el enriquecido desde el catálogo.
#'
#' @keywords internal
.cm_aulas_col_telefono_docente <- function(raw, mapping) {
  .cm_criterios_col_exacta(
    raw,
    unique(c(.cm_aulas_chr_vec(mapping$teacher_phone), "teacher_phone"))
  )
}

#' Enriquecer `teacher_phone` desde el catálogo de curso-horario.
#'
#' Mismo molde que los lookups de `teacher`/`teacher_email` en
#' `.cm_aulas_enrich_with_catalog`: la forma PEGADA de la DTI 2026
#' (`TELEFDOCENTE`, como `CORREOPUCPDOCENTE`) va primero. `CELULAR` se acepta
#' SOLO por esta vía: en el catálogo cada fila es curso-horario × docente, así
#' que un celular ahí es del docente; en la base de alumnos ese mismo nombre
#' sería del ESTUDIANTE y por eso no entra a los candidatos del mapeo default.
#'
#' Un catálogo sin columna de teléfono devuelve `raw` intacto: el estudio de
#' 2025 no la traía y su marco debe construirse igual, sin inventar números.
#'
#' @keywords internal
.cm_aulas_enrich_teacher_phone <- function(raw, catalogo, mapping, raw_key, catalog_key) {
  col <- .cm_criterios_col_exacta(
    catalogo,
    unique(c(
      "TELEFDOCENTE", "telefdocente",
      .cm_aulas_chr_vec(mapping$teacher_phone),
      "celular", "celular_docente"
    ))
  )
  if (!nzchar(col)) return(raw)
  lookup <- .cm_aulas_catalog_lookup(catalogo, catalog_key, col)
  .cm_aulas_fill_from_lookup(raw, raw_key, "teacher_phone", lookup)
}
